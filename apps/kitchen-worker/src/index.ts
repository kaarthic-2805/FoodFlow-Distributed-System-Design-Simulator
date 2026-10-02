import { Partitioners } from 'kafkajs';
import Redis from 'ioredis';
import { prisma } from '@foodflow/database';
import { MetricsPublisher, MetricType, EventType, KafkaOrderEvent, OrderStatus, InMemoryKafkaStream, createKafkaClient } from '@foodflow/shared';

const INSTANCE_ID = process.env.INSTANCE_ID || 'kitchen-worker-1';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const metrics = new MetricsPublisher('kitchen-worker', INSTANCE_ID);

let redis: Redis | null = null;
try {
  redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
  redis.on('error', () => {});
} catch (e) {}

const kafka = createKafkaClient(`kitchen-worker-${INSTANCE_ID}`);

const consumer = kafka.consumer({ groupId: 'kitchen-group' });
const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });

async function processKitchen(event: KafkaOrderEvent, partition: number, offset: any) {
  const startTime = Date.now();
  if (event.eventType !== EventType.PAYMENT_COMPLETED) return;

  console.log(`🍳 [Kitchen Worker] Preparing food for Order #${event.payload.orderId}`);

  await prisma.order.update({
    where: { id: event.payload.orderId },
    data: { status: OrderStatus.KITCHEN_PREPARING }
  });

  // Simulate Food Prep Time (1.2s)
  await new Promise(r => setTimeout(r, 1200));

  await prisma.order.update({
    where: { id: event.payload.orderId },
    data: { status: OrderStatus.KITCHEN_READY }
  });

  const readyEvent: KafkaOrderEvent = {
    eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    eventType: EventType.KITCHEN_READY,
    timestamp: new Date().toISOString(),
    payload: { ...event.payload, status: OrderStatus.KITCHEN_READY }
  };

  try {
    await producer.send({
      topic: 'foodflow.orders',
      messages: [{ key: event.payload.orderId, value: JSON.stringify(readyEvent) }]
    });
  } catch (e) {}

  InMemoryKafkaStream.produce('foodflow.orders', event.payload.orderId, readyEvent);

  const latency = Date.now() - startTime;
  metrics.emit({
    type: MetricType.KAFKA_CONSUME,
    latencyMs: latency,
    details: { group: 'kitchen-group', partition, offset, orderId: event.payload.orderId, status: OrderStatus.KITCHEN_READY }
  });
}

async function runWorker() {
  InMemoryKafkaStream.subscribe('foodflow.orders', 'kitchen-group', async ({ partition, message }) => {
    const evt: KafkaOrderEvent = message.value || message;
    await processKitchen(evt, partition, message.offset);
  });

  try {
    await producer.connect();
    await consumer.connect();
    await consumer.subscribe({ topic: 'foodflow.orders', fromBeginning: false });

    console.log(`🍳 [Kitchen Worker - ${INSTANCE_ID}] Listening on topic foodflow.orders (group: kitchen-group)`);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;
        const event: KafkaOrderEvent = JSON.parse(message.value.toString());
        await processKitchen(event, partition, message.offset);
      }
    });
  } catch (err) {
    console.warn(`[Kitchen Worker] Standalone Kafka absent. Active on In-Memory Stream Engine.`);
  }
}

runWorker().catch(console.error);
