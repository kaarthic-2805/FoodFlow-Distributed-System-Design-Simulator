import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import Redis from 'ioredis';
import { MetricsPublisher, MetricType } from '@foodflow/shared';

const app = express();
const PORT = process.env.PORT || 4000;
const metrics = new MetricsPublisher('api-gateway', 'gateway-instance-1');

// Connect to Redis for Chaos & Rate Limiting state
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let redis: Redis | null = null;
try {
  redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
  redis.on('error', () => {});
} catch (e) {}

app.use(cors());

// Parsing JSON only for custom gateway routes (Proxy routes take raw stream)
app.use(express.json({
  verify: (req: any, res, buf) => {
    req.rawBody = buf;
  }
}));

// Rate Limiter Middleware
const rateLimitMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (!redis) return next();
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const key = `ratelimit:${clientIp}`;
  
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, 60);
    }
    if (current > 120) { // Limit to 120 req / minute
      metrics.emit({
        type: MetricType.HTTP_REQUEST,
        statusCode: 429,
        route: req.path,
        method: req.method,
        details: { error: 'Rate limit exceeded' }
      });
      return res.status(429).json({ error: 'Too Many Requests (Rate limit exceeded at API Gateway)' });
    }
  } catch (err) {
    // If Redis is down, let traffic through
  }
  next();
};

app.use(rateLimitMiddleware);

// Service Targets Configuration
const restaurantTargets = (process.env.RESTAURANT_SERVICE_URLS || 'http://localhost:4001,http://localhost:4002').split(',');
const orderTargets = (process.env.ORDER_SERVICE_URLS || 'http://localhost:4004,http://localhost:4005').split(',');
const userTarget = (process.env.USER_SERVICE_URL || 'http://localhost:4003').split(',')[0];
const controlTarget = (process.env.CONTROL_SERVICE_URL || 'http://localhost:4010').split(',')[0];

let restaurantRoundRobin = 0;
let orderRoundRobin = 0;

// Helper to check Chaos Config in Redis
async function getChaosConfig(): Promise<{ serviceDown?: Record<string, boolean>; serviceDelayMs?: Record<string, number> }> {
  if (!redis) return {};
  try {
    const data = await redis.get('chaos:config');
    return data ? JSON.parse(data) : {};
  } catch (e) {
    return {};
  }
}

// Custom Dynamic Proxy Router with Load Balancing & Chaos Injection
const createDynamicProxy = (getTargets: () => string[], serviceName: string, getRrIndex: () => number, setRrIndex: (idx: number) => void) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const targets = getTargets();
    const chaos = await getChaosConfig();

    // Check artificial service delay
    const delayMs = chaos.serviceDelayMs?.[serviceName] || 0;
    if (delayMs > 0) {
      await new Promise((r) => setTimeout(r, delayMs));
    }

    // Filter available targets (exclude artificially downed instances)
    const availableTargets = targets.filter(t => {
      const instanceName = t.includes('4001') ? 'restaurant-service-1' :
                           t.includes('4002') ? 'restaurant-service-2' :
                           t.includes('4004') ? 'order-service-1' :
                           t.includes('4005') ? 'order-service-2' : serviceName;
      return !chaos.serviceDown?.[instanceName];
    });

    if (availableTargets.length === 0) {
      const latency = Date.now() - startTime;
      metrics.emit({
        type: MetricType.HTTP_REQUEST,
        statusCode: 503,
        latencyMs: latency,
        route: req.path,
        method: req.method,
        details: { error: `All instances of ${serviceName} are DOWN` }
      });
      return res.status(503).json({ error: `Service Unavailable: All instances of ${serviceName} are currently offline.` });
    }

    // Round-robin selection
    const currentIndex = getRrIndex() % availableTargets.length;
    const targetUrl = availableTargets[currentIndex];
    setRrIndex((currentIndex + 1) % availableTargets.length);

    const targetInstanceName = targetUrl.includes('4001') ? 'restaurant-service-1' :
                               targetUrl.includes('4002') ? 'restaurant-service-2' :
                               targetUrl.includes('4004') ? 'order-service-1' :
                               targetUrl.includes('4005') ? 'order-service-2' : serviceName;

    // Log LB Route metric
    metrics.emit({
      type: MetricType.LB_ROUTE,
      service: serviceName,
      targetInstance: targetInstanceName,
      route: req.path,
      method: req.method
    });

    const proxy = createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      pathRewrite: (path) => path.replace(new RegExp(`^/api/${serviceName}s?`), ''),
      onProxyReq: (proxyReq, req: any) => {
        if (req.body && Object.keys(req.body).length > 0) {
          const bodyData = JSON.stringify(req.body);
          proxyReq.setHeader('Content-Type', 'application/json');
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }
      },
      onProxyRes: (proxyRes) => {
        const latency = Date.now() - startTime;
        metrics.emit({
          type: MetricType.HTTP_REQUEST,
          statusCode: proxyRes.statusCode || 200,
          latencyMs: latency,
          route: req.path,
          method: req.method,
          targetInstance: targetInstanceName
        });
      },
      onError: (err, req, res) => {
        const latency = Date.now() - startTime;
        metrics.emit({
          type: MetricType.HTTP_REQUEST,
          statusCode: 502,
          latencyMs: latency,
          route: req.path,
          method: req.method,
          targetInstance: targetInstanceName,
          details: { error: err.message }
        });
        (res as Response).status(502).json({ error: `Bad Gateway: Could not reach target ${targetInstanceName}` });
      }
    });

    return proxy(req, res, next);
  };
};

// Route definitions
app.use('/api/restaurants', createDynamicProxy(
  () => restaurantTargets,
  'restaurants',
  () => restaurantRoundRobin,
  (idx) => { restaurantRoundRobin = idx; }
));

app.use('/api/orders', createDynamicProxy(
  () => orderTargets,
  'orders',
  () => orderRoundRobin,
  (idx) => { orderRoundRobin = idx; }
));

app.use('/api/users', createProxyMiddleware({
  target: userTarget,
  changeOrigin: true,
  pathRewrite: { '^/api/users': '' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.body && Object.keys(req.body).length > 0) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  }
}));

app.use('/api/control', createProxyMiddleware({
  target: controlTarget,
  changeOrigin: true,
  pathRewrite: { '^/api/control': '' },
  onProxyReq: (proxyReq, req: any) => {
    if (req.body && Object.keys(req.body).length > 0) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  }
}));

// Gateway Health Route
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`⚡ [API Gateway] Running on port ${PORT}`);
  console.log(`   Routing /api/restaurants -> [${restaurantTargets.join(', ')}] (Round-Robin LB)`);
  console.log(`   Routing /api/orders      -> [${orderTargets.join(', ')}] (Round-Robin LB)`);
  console.log(`   Routing /api/users       -> ${userTarget}`);
  console.log(`   Routing /api/control     -> ${controlTarget}`);
});
