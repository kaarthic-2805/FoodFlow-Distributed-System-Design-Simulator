import Redis from 'ioredis';
import http from 'http';
import { MetricEvent, MetricType } from './types';
import { InMemoryRedis } from './emulator';

export const METRICS_REDIS_CHANNEL = 'metrics:events';

export class MetricsPublisher {
  private redis: Redis | InMemoryRedis | null = null;
  private inMemoryFallback = new InMemoryRedis();
  private serviceName: string;
  private instanceId: string;

  constructor(serviceName: string, instanceId?: string) {
    this.serviceName = serviceName;
    this.instanceId = instanceId || `${serviceName}-${Math.floor(Math.random() * 1000)}`;
    
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    try {
      const client = new Redis(redisUrl, {
        retryStrategy() {
          return null; // Don't block if Redis isn't installed
        },
        maxRetriesPerRequest: 1
      });
      client.on('error', () => {
        this.redis = this.inMemoryFallback;
      });
      this.redis = client;
    } catch (err) {
      this.redis = this.inMemoryFallback;
    }
  }

  public async emit(metric: Partial<MetricEvent>): Promise<void> {
    const fullMetric: MetricEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date().toISOString(),
      service: this.serviceName,
      instanceId: this.instanceId,
      type: metric.type || MetricType.HTTP_REQUEST,
      latencyMs: metric.latencyMs,
      statusCode: metric.statusCode,
      route: metric.route,
      method: metric.method,
      targetInstance: metric.targetInstance,
      details: metric.details || {}
    };

    try {
      if (this.redis) {
        await this.redis.publish(METRICS_REDIS_CHANNEL, JSON.stringify(fullMetric));
      }
    } catch (err) {
      await this.inMemoryFallback.publish(METRICS_REDIS_CHANNEL, JSON.stringify(fullMetric));
    }

    // Always broadcast metric to Control Service via HTTP to guarantee live latency & telemetry graphs cross-process
    try {
      const controlUrl = process.env.CONTROL_SERVICE_URL || 'http://localhost:4010';
      const payload = JSON.stringify(fullMetric);
      const urlObj = new URL(`${controlUrl}/metrics/emit`);
      const req = http.request({
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
      });
      req.on('error', () => {});
      req.write(payload);
      req.end();
    } catch (e) {}
  }

  public getInstanceId(): string {
    return this.instanceId;
  }
}

