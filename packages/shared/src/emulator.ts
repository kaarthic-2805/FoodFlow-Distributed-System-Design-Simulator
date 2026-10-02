import EventEmitter from 'events';

// Global Event Emitter for In-Memory PubSub & Event Streaming across microservices in the same process tree
const globalBus = new EventEmitter();
globalBus.setMaxListeners(100);

import http from 'http';

// In-Memory Key-Value & PubSub Cache Engine (Redis Fallback)
export class InMemoryRedis {
  private static store = new Map<string, { value: string; expiresAt?: number }>();
  private static counters = new Map<string, { count: number; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const item = InMemoryRedis.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      InMemoryRedis.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string): Promise<'OK'> {
    InMemoryRedis.store.set(key, { value });
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    InMemoryRedis.store.set(key, {
      value,
      expiresAt: Date.now() + seconds * 1000
    });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    const existed = InMemoryRedis.store.has(key);
    InMemoryRedis.store.delete(key);
    return existed ? 1 : 0;
  }

  async incr(key: string): Promise<number> {
    const item = InMemoryRedis.counters.get(key);
    let val = 1;
    if (item && (!item.expiresAt || Date.now() <= item.expiresAt)) {
      val = item.count + 1;
    }
    InMemoryRedis.counters.set(key, { count: val, expiresAt: item?.expiresAt });
    return val;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const item = InMemoryRedis.counters.get(key);
    if (item) {
      item.expiresAt = Date.now() + seconds * 1000;
      return 1;
    }
    return 0;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async publish(channel: string, message: string): Promise<number> {
    globalBus.emit(`channel:${channel}`, message);
    return 1;
  }

  subscribe(channel: string, callback?: (err: any) => void) {
    if (callback) callback(null);
  }

  on(event: string, listener: (...args: any[]) => void) {
    if (event === 'message') {
      globalBus.on('channel:metrics:events', (msg: string) => {
        listener('metrics:events', msg);
      });
    }
  }
}

// In-Memory Kafka Stream Engine (Kafka Fallback)
export class InMemoryKafkaStream {
  private static topics: Record<string, { partitions: Array<{ offset: number; messages: any[] }> }> = {
    'foodflow.orders': {
      partitions: [
        { offset: 0, messages: [] },
        { offset: 0, messages: [] },
        { offset: 0, messages: [] }
      ]
    },
    'foodflow.metrics': {
      partitions: [
        { offset: 0, messages: [] },
        { offset: 0, messages: [] },
        { offset: 0, messages: [] }
      ]
    }
  };

  private static groupOffsets: Record<string, Record<string, number>> = {
    'payment-group': { 'foodflow.orders': 0 },
    'kitchen-group': { 'foodflow.orders': 0 },
    'delivery-group': { 'foodflow.orders': 0 }
  };

  static produce(topic: string, key: string, messageValue: any) {
    if (!this.topics[topic]) {
      this.topics[topic] = {
        partitions: [{ offset: 0, messages: [] }, { offset: 0, messages: [] }, { offset: 0, messages: [] }]
      };
    }
    const partitionIdx = Math.abs(this.hashCode(key)) % 3;
    const partition = this.topics[topic].partitions[partitionIdx];
    partition.offset += 1;
    const msgObj = { offset: partition.offset, key, value: messageValue, timestamp: Date.now() };
    partition.messages.push(msgObj);

    // 1. Emit locally (in same process)
    globalBus.emit(`kafka:${topic}`, { partition: partitionIdx, message: msgObj });

    // 2. Broadcast to Control Service Stream Hub across processes
    try {
      const controlUrl = process.env.CONTROL_SERVICE_URL || 'http://localhost:4010';
      const payload = JSON.stringify({ topic, key, messageValue });
      const urlObj = new URL(`${controlUrl}/stream/produce`);
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

  static subscribe(topic: string, groupId: string, handler: (event: { partition: number; message: any }) => Promise<void>) {
    // 1. Local process handler
    globalBus.on(`kafka:${topic}`, async (data) => {
      try {
        await handler(data);
        if (!this.groupOffsets[groupId]) this.groupOffsets[groupId] = {};
        this.groupOffsets[groupId][topic] = (this.groupOffsets[groupId][topic] || 0) + 1;
      } catch (e) {}
    });

    // 2. Cross-process polling from Control Service Stream Hub (every 500ms)
    setInterval(() => {
      const controlUrl = process.env.CONTROL_SERVICE_URL || 'http://localhost:4010';
      http.get(`${controlUrl}/stream/poll?topic=${encodeURIComponent(topic)}&groupId=${encodeURIComponent(groupId)}`, (res) => {
        let raw = '';
        res.on('data', chunk => raw += chunk);
        res.on('end', async () => {
          try {
            const data = JSON.parse(raw);
            if (data.events && Array.isArray(data.events)) {
              for (const evt of data.events) {
                await handler(evt);
                if (!this.groupOffsets[groupId]) this.groupOffsets[groupId] = {};
                this.groupOffsets[groupId][topic] = (this.groupOffsets[groupId][topic] || 0) + 1;
              }
            }
          } catch (e) {}
        });
      }).on('error', () => {});
    }, 500);
  }

  static getTopicStats() {
    const stats: Record<string, any> = {};
    for (const [topic, data] of Object.entries(this.topics)) {
      stats[topic] = {
        partitions: data.partitions.length,
        offsets: data.partitions.map((p, idx) => {
          const off = p.offset || p.messages?.length || 0;
          return { partition: idx, offset: off, high: off };
        })
      };
    }
    return stats;
  }

  static getGroupStats() {
    return this.groupOffsets;
  }

  private static hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }
}
