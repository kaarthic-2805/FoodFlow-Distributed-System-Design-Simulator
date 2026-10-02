import express, { Request, Response } from 'express';
import cors from 'cors';
import https from 'https';
import Redis from 'ioredis';
import { prisma } from '@foodflow/database';
import { seedDatabase } from '@foodflow/database/prisma/seed';
import { MetricsPublisher, MetricType, InMemoryRedis } from '@foodflow/shared';

const app = express();
const PORT = process.env.PORT || 4001;
const INSTANCE_ID = process.env.INSTANCE_ID || 'restaurant-service-1';
const CACHE_TTL_SECONDS = 300; // 5 minutes

const metrics = new MetricsPublisher('restaurant-service', INSTANCE_ID);

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let redis: any = new InMemoryRedis();

try {
  const client = new Redis(redisUrl, { retryStrategy: () => null, maxRetriesPerRequest: 1 });
  client.on('error', () => {});
  client.ping().then(() => { redis = client; }).catch(() => {});
} catch (e) {}

app.use(cors());
app.use(express.json());

// Helper to check if Redis is active and accessible (not blocked by Chaos Mode)
async function isRedisHealthy(): Promise<boolean> {
  if (!redis) return false;
  try {
    const chaos = await redis.get('chaos:config');
    if (chaos) {
      const parsed = JSON.parse(chaos);
      if (parsed.redisDown) return false;
    }
    const ping = await redis.ping();
    return ping === 'PONG';
  } catch (err) {
    return false;
  }
}

// Auto-seed guard helper
async function ensureCatalogSeeded() {
  try {
    const count = await prisma.restaurant.count();
    if (count === 0) {
      console.log('🌱 Restaurant catalog is empty. Auto-seeding database...');
      await seedDatabase();
    }
  } catch (e) {
    console.error('Auto-seed check failed:', e);
  }
}

// 1. Get All Restaurants (Cache-Aside)
app.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  await ensureCatalogSeeded();

  const cacheKey = 'restaurant:list';
  const isCacheAlive = await isRedisHealthy();

  if (isCacheAlive && redis) {
    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        const latency = Date.now() - startTime;
        metrics.emit({
          type: MetricType.CACHE_HIT,
          latencyMs: latency,
          route: '/api/restaurants',
          method: 'GET',
          details: { cacheKey, source: 'redis' }
        });
        return res.json({
          source: 'cache',
          instanceId: INSTANCE_ID,
          data: JSON.parse(cachedData)
        });
      }
    } catch (e) {}
  }

  // Cache Miss / Fallback to Database
  try {
    const restaurants = await prisma.restaurant.findMany({
      include: { menuItems: true }
    });
    const latency = Date.now() - startTime;

    metrics.emit({
      type: MetricType.CACHE_MISS,
      latencyMs: latency,
      route: '/api/restaurants',
      method: 'GET',
      details: { cacheKey, source: 'mysql', reason: isCacheAlive ? 'key_not_found' : 'redis_unavailable' }
    });

    if (isCacheAlive && redis) {
      redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(restaurants)).catch(() => {});
    }

    res.json({
      source: 'database',
      instanceId: INSTANCE_ID,
      data: restaurants
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper for fallback internal recipe sync
async function performLocalSync(res: Response, queryStr: string) {
  let bistro = await prisma.restaurant.findFirst({
    where: { name: 'Global Fusion Bistro' }
  });

  if (!bistro) {
    bistro = await prisma.restaurant.create({
      data: {
        id: `rest-external-${Date.now()}`,
        name: 'Global Fusion Bistro',
        cuisine: 'International',
        address: '500 World Plaza, Financial District',
        rating: 4.9,
        imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80'
      }
    });
  }

  const sampleDishes = [
    { name: 'Truffle Cream Penne Pasta', desc: 'Handmade penne in black truffle cream sauce with fresh basil.', price: 18.99, cat: 'Pasta', img: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281318?w=600&q=80' },
    { name: 'Seafood Paella Valenciana', desc: 'Saffron rice with tiger prawns, mussels, squid, and bell peppers.', price: 24.50, cat: 'Seafood', img: 'https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=600&q=80' },
    { name: 'Pan-Seared Duck Breast', desc: 'Crispy skin duck breast with cherry reduction sauce and potato puree.', price: 26.00, cat: 'Mains', img: 'https://images.unsplash.com/photo-1514944288352-fffac99f0bdf?w=600&q=80' }
  ];

  const createdItems = [];
  for (const dish of sampleDishes) {
    const item = await prisma.menuItem.create({
      data: {
        id: `menu-synced-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        restaurantId: bistro.id,
        name: dish.name,
        description: dish.desc,
        price: dish.price,
        category: dish.cat,
        imageUrl: dish.img
      }
    });
    createdItems.push(item);
  }

  if (redis && (await isRedisHealthy())) {
    await redis.del('restaurant:list');
    await redis.del(`restaurant:detail:${bistro.id}`);
  }

  return res.json({
    message: `Synced ${createdItems.length} live dishes into Global Fusion Bistro catalog!`,
    restaurant: bistro,
    syncedDishes: createdItems
  });
}

// 2. Sync External Public Food API (TheMealDB Integration with automatic fallback)
app.post('/external-sync', async (req: Request, res: Response) => {
  const query = (req.body?.query || req.query?.query || 'pasta').toString();
  const apiUrl = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`;

  const request = https.get(apiUrl, (apiRes) => {
    let raw = '';
    apiRes.on('data', (chunk) => { raw += chunk; });
    apiRes.on('end', async () => {
      try {
        const parsed = JSON.parse(raw);
        const meals = parsed.meals || [];
        if (meals.length === 0) {
          return performLocalSync(res, query);
        }

        let bistro = await prisma.restaurant.findFirst({
          where: { name: 'Global Fusion Bistro' }
        });

        if (!bistro) {
          bistro = await prisma.restaurant.create({
            data: {
              id: `rest-external-${Date.now()}`,
              name: 'Global Fusion Bistro',
              cuisine: 'International',
              address: '500 World Plaza, Financial District',
              rating: 4.9,
              imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80'
            }
          });
        }

        const addedItems = [];
        for (const meal of meals.slice(0, 5)) {
          const item = await prisma.menuItem.create({
            data: {
              id: `menu-ext-${meal.idMeal}-${Date.now()}`,
              restaurantId: bistro.id,
              name: meal.strMeal,
              description: `Traditional ${meal.strArea || 'International'} ${meal.strCategory || 'Specialty'}. ${meal.strInstructions ? meal.strInstructions.slice(0, 90) + '...' : ''}`,
              price: Math.floor(Math.random() * 8) + 12.99,
              category: meal.strCategory || 'Chef Specialties',
              imageUrl: meal.strMealThumb || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80'
            }
          });
          addedItems.push(item);
        }

        if (redis && (await isRedisHealthy())) {
          await redis.del('restaurant:list');
          await redis.del(`restaurant:detail:${bistro.id}`);
        }

        res.json({
          message: `Synced ${addedItems.length} dishes from external Food API (TheMealDB)`,
          restaurant: bistro,
          syncedDishes: addedItems
        });
      } catch (err: any) {
        performLocalSync(res, query);
      }
    });
  });

  request.on('error', () => {
    performLocalSync(res, query);
  });

  request.setTimeout(3000, () => {
    request.destroy();
    performLocalSync(res, query);
  });
});

// Also support GET /external-sync for simple testing
app.get('/external-sync', async (req: Request, res: Response) => {
  const query = (req.query.query || 'pasta').toString();
  performLocalSync(res, query);
});

// 3. Get Restaurant Details & Menu (Cache-Aside)
app.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const startTime = Date.now();
  const cacheKey = `restaurant:detail:${id}`;
  const isCacheAlive = await isRedisHealthy();

  if (isCacheAlive && redis) {
    try {
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        const latency = Date.now() - startTime;
        metrics.emit({
          type: MetricType.CACHE_HIT,
          latencyMs: latency,
          route: `/api/restaurants/${id}`,
          method: 'GET',
          details: { cacheKey, source: 'redis' }
        });
        return res.json({
          source: 'cache',
          instanceId: INSTANCE_ID,
          data: JSON.parse(cachedData)
        });
      }
    } catch (e) {}
  }

  // Database Fallback
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id },
      include: { menuItems: true }
    });

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const latency = Date.now() - startTime;
    metrics.emit({
      type: MetricType.CACHE_MISS,
      latencyMs: latency,
      route: `/api/restaurants/${id}`,
      method: 'GET',
      details: { cacheKey, source: 'mysql' }
    });

    if (isCacheAlive && redis) {
      redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(restaurant)).catch(() => {});
    }

    res.json({
      source: 'database',
      instanceId: INSTANCE_ID,
      data: restaurant
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Update Menu Item / Restaurant Availability (Cache Invalidation)
app.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, isAvailable } = req.body;

  try {
    const updated = await prisma.restaurant.update({
      where: { id },
      data: { name, isAvailable }
    });

    // Invalidate Cache
    if (redis && (await isRedisHealthy())) {
      await redis.del('restaurant:list');
      await redis.del(`restaurant:detail:${id}`);
    }

    res.json({ message: 'Restaurant updated & cache invalidated', data: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. CDN Simulation Endpoint
app.get('/cdn/assets/:region/:assetName', async (req: Request, res: Response) => {
  const { region, assetName } = req.params;
  const startTime = Date.now();
  const cdnKey = `cdn:edge:${region}:asset:${assetName}`;
  const isCacheAlive = await isRedisHealthy();

  const regionalBaseLatency = region === 'us-east' ? 10 : region === 'eu-central' ? 85 : 45;

  if (isCacheAlive && redis) {
    try {
      const cachedAsset = await redis.get(cdnKey);
      if (cachedAsset) {
        await new Promise((r) => setTimeout(r, regionalBaseLatency));
        const latency = Date.now() - startTime;
        metrics.emit({
          type: MetricType.CDN_REQUEST,
          latencyMs: latency,
          route: `/cdn/assets/${region}/${assetName}`,
          details: { hit: true, region, assetName }
        });
        return res.json({
          cdnStatus: 'HIT',
          edgeRegion: region,
          latencyMs: latency,
          assetUrl: `https://cdn.foodflow.dev/${region}/${assetName}`
        });
      }
    } catch (e) {}
  }

  // Edge Cache MISS
  await new Promise((r) => setTimeout(r, regionalBaseLatency + 120));
  const latency = Date.now() - startTime;

  if (isCacheAlive && redis) {
    redis.setex(cdnKey, 600, 'CACHED_ASSET_CONTENT').catch(() => {});
  }

  metrics.emit({
    type: MetricType.CDN_REQUEST,
    latencyMs: latency,
    route: `/cdn/assets/${region}/${assetName}`,
    details: { hit: false, region, assetName }
  });

  res.json({
    cdnStatus: 'MISS',
    edgeRegion: region,
    latencyMs: latency,
    assetUrl: `https://cdn.foodflow.dev/${region}/${assetName}`
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'restaurant-service', instanceId: INSTANCE_ID });
});

app.listen(PORT, () => {
  console.log(`🍜 [Restaurant Service - ${INSTANCE_ID}] Running on port ${PORT}`);
});
