import express, { Request, Response } from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import Redis from 'ioredis';
import { METRICS_REDIS_CHANNEL, MetricEvent, MetricType, ChaosConfig, InMemoryKafkaStream, createKafkaClient } from '@foodflow/shared';

const app = express();
const PORT = process.env.PORT || 4010;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Redis Clients
let redisSub: Redis | null = null;
let redisClient: Redis | null = null;

try {
  redisSub = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
  redisClient = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
  redisSub.on('error', () => {});
  redisClient.on('error', () => {});
} catch (e) {}

// Kafka Admin Client
const kafka = createKafkaClient('control-service-admin');
const admin = kafka.admin();

// In-Memory Rolling Metrics Buffer (Last 500 events)
const recentMetrics: MetricEvent[] = [];
const MAX_METRICS_BUFFER = 500;

// Default Chaos Configuration State
let currentChaos: ChaosConfig = {
  redisDown: false,
  serviceDelayMs: {},
  serviceDown: {},
  workerLagMs: {},
  kafkaConsumerPause: {},
  chaosModeActive: false
};

// Sync Chaos State with Redis
async function syncChaosToRedis() {
  if (redisClient) {
    try {
      await redisClient.set('chaos:config', JSON.stringify(currentChaos));
    } catch (e) {}
  }
}

// Subscribe to Redis Metrics Channel
if (redisSub) {
  redisSub.subscribe(METRICS_REDIS_CHANNEL, (err) => {
    if (err) console.warn('[Control Service] Metrics Redis subscribe failed:', err);
  });

  redisSub.on('message', (channel, message) => {
    if (channel === METRICS_REDIS_CHANNEL) {
      try {
        const metric: MetricEvent = JSON.parse(message);
        recentMetrics.push(metric);
        if (recentMetrics.length > MAX_METRICS_BUFFER) {
          recentMetrics.shift();
        }

        // Also track in foodflow.metrics Kafka stream partition offsets
        const partition = Math.abs(metric.id ? metric.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 0) % 3;
        if (!streamBrokerStore['foodflow.metrics']) streamBrokerStore['foodflow.metrics'] = [];
        const offset = streamBrokerStore['foodflow.metrics'].filter(e => e.partition === partition).length + 1;
        streamBrokerStore['foodflow.metrics'].push({ partition, message: { offset, value: metric, timestamp: Date.now() } });

        // Broadcast raw metric to all connected WebSocket clients
        broadcast({ type: 'METRIC_EVENT', payload: metric });
      } catch (e) {}
    }
  });
}

// Helper to broadcast JSON messages to all WS clients
function broadcast(data: any) {
  const jsonStr = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(jsonStr);
    }
  });
}

let isRealKafkaConnected = false;
admin.connect().then(() => {
  isRealKafkaConnected = true;
  admin.disconnect();
}).catch(() => {
  isRealKafkaConnected = false;
});

function getInMemoryKafkaStats() {
  const topicNames = ['foodflow.orders', 'foodflow.metrics'];
  const topics: Record<string, any> = {};

  for (const topicName of topicNames) {
    const events = streamBrokerStore[topicName] || [];
    const offsets = [0, 1, 2].map((p) => {
      const pEvents = events.filter(e => e.partition === p);
      const count = pEvents.length;
      return {
        partition: p,
        offset: count,
        high: count
      };
    });

    topics[topicName] = {
      partitions: 3,
      offsets
    };
  }

  return {
    topics,
    consumerGroups: streamBrokerOffsets
  };
}

// Fetch Kafka Topics & Consumer Lag metrics from real Kafka Broker or In-Memory Stream Engine
async function getKafkaMetrics() {
  if (isRealKafkaConnected) {
    try {
      await admin.connect();
      const topics = await admin.listTopics();
      const filteredTopics = topics.filter(t => t.startsWith('foodflow.'));

      const topicStats: Record<string, any> = {};

      for (const topic of filteredTopics) {
        const offsets = await admin.fetchTopicOffsets(topic);
        topicStats[topic] = {
          partitions: offsets.length,
          offsets: offsets.map(o => ({ partition: o.partition, offset: o.offset, high: o.high }))
        };
      }

      // Consumer Groups Lag
      const groups = ['payment-group', 'kitchen-group', 'delivery-group'];
      const groupLags: Record<string, any> = {};

      for (const group of groups) {
        try {
          const offsets = await admin.fetchOffsets({ groupId: group, topics: ['foodflow.orders'] });
          groupLags[group] = offsets;
        } catch (e) {
          groupLags[group] = [];
        }
      }

      await admin.disconnect();
      return { topics: topicStats, consumerGroups: groupLags };
    } catch (err) {
      isRealKafkaConnected = false;
    }
  }

  return getInMemoryKafkaStats();
}

// Compute Aggregated Telemetry (RPS, p50/p95/p99 Latency, Cache Hit Ratio, Instance Distributions)
function computeAggregatedTelemetry() {
  const now = Date.now();
  const last10s = recentMetrics.filter(m => (now - new Date(m.timestamp).getTime()) <= 10000);

  const rps = +(last10s.length / 10).toFixed(1);

  // Latency calculation
  const latencies = last10s.map(m => m.latencyMs || 0).filter(l => l > 0).sort((a, b) => a - b);
  const count = latencies.length;
  const p50 = count ? latencies[Math.floor(count * 0.5)] : 0;
  const p95 = count ? latencies[Math.floor(count * 0.95)] : 0;
  const p99 = count ? latencies[Math.floor(count * 0.99)] : 0;

  // Cache hit vs miss split
  const cacheEvents = last10s.filter(m => m.type === MetricType.CACHE_HIT || m.type === MetricType.CACHE_MISS);
  const cacheHits = cacheEvents.filter(m => m.type === MetricType.CACHE_HIT).length;
  const cacheMisses = cacheEvents.filter(m => m.type === MetricType.CACHE_MISS).length;
  const cacheTotal = cacheHits + cacheMisses;
  const cacheHitRatio = cacheTotal ? +((cacheHits / cacheTotal) * 100).toFixed(1) : 100;

  // Load Balancer Distribution
  const lbEvents = last10s.filter(m => m.type === MetricType.LB_ROUTE);
  const lbDistribution: Record<string, number> = {};
  lbEvents.forEach(e => {
    if (e.targetInstance) {
      lbDistribution[e.targetInstance] = (lbDistribution[e.targetInstance] || 0) + 1;
    }
  });

  return {
    rps,
    p50,
    p95,
    p99,
    cacheHits,
    cacheMisses,
    cacheHitRatio,
    lbDistribution,
    activeConnections: wss.clients.size,
    chaosConfig: currentChaos
  };
}

// --- IN-MEMORY EVENT STREAM BROKER (Cross-Process Kafka Emulator) ---
const streamBrokerStore: Record<string, any[]> = {
  'foodflow.orders': [],
  'foodflow.metrics': []
};
const streamBrokerOffsets: Record<string, Record<string, number>> = {
  'payment-group': { 'foodflow.orders': 0 },
  'kitchen-group': { 'foodflow.orders': 0 },
  'delivery-group': { 'foodflow.orders': 0 }
};

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

app.post('/stream/produce', (req: Request, res: Response) => {
  const { topic = 'foodflow.orders', key, messageValue } = req.body;
  if (!streamBrokerStore[topic]) streamBrokerStore[topic] = [];
  const partition = key ? Math.abs(hashCode(key)) % 3 : Math.floor(Math.random() * 3);
  const offset = streamBrokerStore[topic].filter(e => e.partition === partition).length + 1;
  const msgObj = { offset, key, value: messageValue, timestamp: Date.now() };
  streamBrokerStore[topic].push({ partition, message: msgObj });
  res.json({ status: 'ok', topic, partition, offset });
});

app.get('/stream/poll', (req: Request, res: Response) => {
  const { topic = 'foodflow.orders', groupId = 'default-group' } = req.query as { topic: string; groupId: string };
  if (!streamBrokerOffsets[groupId]) streamBrokerOffsets[groupId] = {};

  // Check if consumer group is paused in Chaos Config
  if (currentChaos.kafkaConsumerPause?.[groupId]) {
    return res.json({ events: [], nextOffset: streamBrokerOffsets[groupId][topic] || 0 });
  }

  const currentOffset = streamBrokerOffsets[groupId][topic] || 0;
  const topicEvents = streamBrokerStore[topic] || [];
  
  if (currentOffset < topicEvents.length) {
    const unread = topicEvents.slice(currentOffset);
    streamBrokerOffsets[groupId][topic] = topicEvents.length;
    return res.json({ events: unread, nextOffset: topicEvents.length });
  }
  res.json({ events: [], nextOffset: currentOffset });
});

// Periodic Telemetry Telemetry Loop (every 500ms)
setInterval(async () => {
  const telemetry = computeAggregatedTelemetry();
  const kafkaMetrics = await getKafkaMetrics();
  broadcast({
    type: 'SYSTEM_TELEMETRY',
    payload: {
      timestamp: new Date().toISOString(),
      telemetry,
      kafka: kafkaMetrics
    }
  });
}, 500);

// REST endpoint to receive metrics cross-process from all microservices & gateway
app.post('/metrics/emit', (req: Request, res: Response) => {
  const metric: MetricEvent = req.body;
  if (metric && metric.type) {
    recentMetrics.push(metric);
    if (recentMetrics.length > MAX_METRICS_BUFFER) {
      recentMetrics.shift();
    }

    const partition = Math.abs(metric.id ? metric.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0) : 0) % 3;
    if (!streamBrokerStore['foodflow.metrics']) streamBrokerStore['foodflow.metrics'] = [];
    const offset = streamBrokerStore['foodflow.metrics'].filter(e => e.partition === partition).length + 1;
    streamBrokerStore['foodflow.metrics'].push({ partition, message: { offset, value: metric, timestamp: Date.now() } });

    broadcast({ type: 'METRIC_EVENT', payload: metric });
  }
  res.json({ status: 'ok' });
});

// --- REST CONTROL ENDPOINTS ---

// 1. Synthetic Traffic Generator Endpoint
let trafficTimer: NodeJS.Timeout | null = null;
app.post('/traffic/generate', (req: Request, res: Response) => {
  const { rps = 5, durationSec = 10, targetService = 'orders' } = req.body;

  if (trafficTimer) clearInterval(trafficTimer);

  const intervalMs = Math.floor(1000 / Math.max(1, rps));
  let elapsedCount = 0;
  const maxRequests = rps * durationSec;

  console.log(`🚀 [Traffic Generator] Started load: ${rps} req/sec for ${durationSec}s on /${targetService}`);

  trafficTimer = setInterval(async () => {
    elapsedCount++;
    if (elapsedCount > maxRequests) {
      if (trafficTimer) clearInterval(trafficTimer);
      console.log(`🛑 [Traffic Generator] Finished load test.`);
      return;
    }

    // Trigger synthetic order request
    try {
      const targetUrl = targetService === 'orders' ? 'http://localhost:4000/api/orders' : 'http://localhost:4000/api/restaurants';
      const body = targetService === 'orders' ? {
        userId: 'usr-demo-001',
        restaurantId: 'rest-001',
        items: [{ menuItemId: 'menu-101', name: 'Tonkotsu Ramen', price: 16.50, quantity: 1 }]
      } : undefined;

      http.request(targetUrl, {
        method: targetService === 'orders' ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' }
      }, (res) => {
        res.on('data', () => {});
      }).on('error', () => {}).end(body ? JSON.stringify(body) : undefined);
    } catch (e) {}
  }, intervalMs);

  res.json({ message: `Started synthetic traffic (${rps} req/s for ${durationSec}s)` });
});

// 2. Failure Injection Endpoint
app.post('/chaos/toggle', async (req: Request, res: Response) => {
  const { redisDown, serviceDelayMs, serviceDown, workerLagMs, kafkaConsumerPause, chaosModeActive } = req.body;

  if (redisDown !== undefined) currentChaos.redisDown = redisDown;
  if (serviceDelayMs !== undefined) {
    currentChaos.serviceDelayMs = { ...(currentChaos.serviceDelayMs || {}), ...serviceDelayMs };
  }
  if (serviceDown !== undefined) {
    currentChaos.serviceDown = { ...(currentChaos.serviceDown || {}), ...serviceDown };
  }
  if (workerLagMs !== undefined) {
    currentChaos.workerLagMs = { ...(currentChaos.workerLagMs || {}), ...workerLagMs };
  }
  if (kafkaConsumerPause !== undefined) {
    currentChaos.kafkaConsumerPause = { ...(currentChaos.kafkaConsumerPause || {}), ...kafkaConsumerPause };
  }
  if (chaosModeActive !== undefined) {
    currentChaos.chaosModeActive = chaosModeActive;
  } else {
    currentChaos.chaosModeActive = currentChaos.redisDown ||
      Object.values(currentChaos.serviceDown || {}).some(Boolean) ||
      Object.values(currentChaos.serviceDelayMs || {}).some(v => v > 0) ||
      Object.values(currentChaos.workerLagMs || {}).some(v => v > 0) ||
      Object.values(currentChaos.kafkaConsumerPause || {}).some(Boolean);
  }

  await syncChaosToRedis();

  broadcast({
    type: 'METRIC_EVENT',
    payload: {
      id: `${Date.now()}`,
      timestamp: new Date().toISOString(),
      service: 'control-service',
      type: MetricType.CHAOS_EVENT,
      details: { config: currentChaos }
    }
  });

  console.log(`⚠️ [Chaos Mode] Updated chaos configuration:`, currentChaos);
  res.json({ message: 'Chaos configuration updated', chaos: currentChaos });
});

// 3. Get Chaos Configuration Status
app.get('/chaos/status', (req: Request, res: Response) => {
  res.json(currentChaos);
});

// 4. Get Metrics History
app.get('/metrics/history', (req: Request, res: Response) => {
  res.json(recentMetrics.slice(-100));
});

server.listen(PORT, () => {
  console.log(`🎛️ [Control Service] Running on port ${PORT} (WebSocket + Control REST API)`);
});
