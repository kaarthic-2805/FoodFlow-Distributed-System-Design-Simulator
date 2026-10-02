import { Partitioners } from 'kafkajs';
import Redis from 'ioredis';
import { prisma } from '@foodflow/database';
import { MetricsPublisher, MetricType, EventType, KafkaOrderEvent, OrderStatus, InMemoryKafkaStream, createKafkaClient } from '@foodflow/shared';

const INSTANCE_ID = process.env.INSTANCE_ID || 'delivery-worker-1';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const metrics = new MetricsPublisher('delivery-worker', INSTANCE_ID);

let redis: Redis | null = null;
try {
  redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
  redis.on('error', () => {});
} catch (e) {}

const kafka = createKafkaClient(`delivery-worker-${INSTANCE_ID}`);

const consumer = kafka.consumer({ groupId: 'delivery-group' });
const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });

const COURIER_NAMES = ['Driver #104 (Marcus)', 'Driver #208 (Sarah)', 'Driver #312 (Kenji)', 'Driver #416 (Elena)'];

async function processDelivery(event: KafkaOrderEvent, partition: number, offset: any) {
  const startTime = Date.now();
  if (event.eventType !== EventType.KITCHEN_READY) return;

  const courier = COURIER_NAMES[Math.floor(Math.random() * COURIER_NAMES.length)];
  console.log(`🛵 [Delivery Worker] Assigning ${courier} to Order #${event.payload.orderId}`);

  await prisma.order.update({
    where: { id: event.payload.orderId },
    data: { status: OrderStatus.DELIVERY_ASSIGNED, courierId: courier }
  });

  // Simulate Transit Time (1s)
  await new Promise(r => setTimeout(r, 1000));

  await prisma.order.update({
    where: { id: event.payload.orderId },
    data: { status: OrderStatus.DELIVERY_COMPLETED }
  });

  const completedEvent: KafkaOrderEvent = {
    eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    eventType: EventType.DELIVERY_COMPLETED,
    timestamp: new Date().toISOString(),
    payload: { ...event.payload, status: OrderStatus.DELIVERY_COMPLETED, courierId: courier }
  };

  try {
    await producer.send({
      topic: 'foodflow.orders',
      messages: [{ key: event.payload.orderId, value: JSON.stringify(completedEvent) }]
    });
  } catch (e) {}

  InMemoryKafkaStream.produce('foodflow.orders', event.payload.orderId, completedEvent);

  const latency = Date.now() - startTime;
  metrics.emit({
    type: MetricType.KAFKA_CONSUME,
    latencyMs: latency,
    details: { group: 'delivery-group', partition, offset, orderId: event.payload.orderId, status: OrderStatus.DELIVERY_COMPLETED }
  });
}

async function runWorker() {
  InMemoryKafkaStream.subscribe('foodflow.orders', 'delivery-group', async ({ partition, message }) => {
    const evt: KafkaOrderEvent = message.value || message;
    await processDelivery(evt, partition, message.offset);
  });

  try {
    await producer.connect();
    await consumer.connect();
    await consumer.subscribe({ topic: 'foodflow.orders', fromBeginning: false });

    console.log(`🛵 [Delivery Worker - ${INSTANCE_ID}] Listening on topic foodflow.orders (group: delivery-group)`);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;
        const event: KafkaOrderEvent = JSON.parse(message.value.toString());
        await processDelivery(event, partition, message.offset);
      }
    });
  } catch (err) {
    console.warn(`[Delivery Worker] Standalone Kafka absent. Active on In-Memory Stream Engine.`);
  }
}

runWorker().catch(console.error);
