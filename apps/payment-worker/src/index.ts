import { Partitioners } from 'kafkajs';
import Redis from 'ioredis';
import { prisma } from '@foodflow/database';
import { MetricsPublisher, MetricType, EventType, KafkaOrderEvent, OrderStatus, InMemoryKafkaStream, createKafkaClient } from '@foodflow/shared';

const INSTANCE_ID = process.env.INSTANCE_ID || 'payment-worker-1';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const metrics = new MetricsPublisher('payment-worker', INSTANCE_ID);

let redis: Redis | null = null;
try {
  redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 1 });
  redis.on('error', () => {});
} catch (e) {}

const kafka = createKafkaClient(`payment-worker-${INSTANCE_ID}`);

const consumer = kafka.consumer({ groupId: 'payment-group' });
const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner });

async function processPayment(event: KafkaOrderEvent, partition: number, offset: any) {
  const startTime = Date.now();
  if (event.eventType !== EventType.ORDER_CREATED) return;

  console.log(`💳 [Payment Worker] Processing payment for Order #${event.payload.orderId} ($${event.payload.totalAmount})`);

  // Simulate payment processing (0.6s delay)
  await new Promise(r => setTimeout(r, 600));

  const isSuccess = Math.random() > 0.05;
  const newStatus = isSuccess ? OrderStatus.PAYMENT_SUCCESS : OrderStatus.PAYMENT_FAILED;

  // Update DB
  await prisma.order.update({
    where: { id: event.payload.orderId },
    data: {
      status: newStatus,
      failureReason: isSuccess ? null : 'Card Declined / Insufficient Funds (Simulated)'
    }
  });

  const nextEventType = isSuccess ? EventType.PAYMENT_COMPLETED : EventType.PAYMENT_FAILED;
  const nextEvent: KafkaOrderEvent = {
    eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    eventType: nextEventType,
    timestamp: new Date().toISOString(),
    payload: {
      ...event.payload,
      status: newStatus,
      failureReason: isSuccess ? undefined : 'Card Declined (Simulated)'
    }
  };

  try {
    await producer.send({
      topic: 'foodflow.orders',
      messages: [{ key: event.payload.orderId, value: JSON.stringify(nextEvent), timestamp: Date.now().toString() }]
    });
  } catch (e) {}

  InMemoryKafkaStream.produce('foodflow.orders', event.payload.orderId, nextEvent);

  const latency = Date.now() - startTime;
  metrics.emit({
    type: MetricType.KAFKA_CONSUME,
    latencyMs: latency,
    details: { group: 'payment-group', partition, offset, orderId: event.payload.orderId, status: newStatus }
  });
}

async function runWorker() {
  // Subscribe to In-Memory Stream Fallback
  InMemoryKafkaStream.subscribe('foodflow.orders', 'payment-group', async ({ partition, message }) => {
    const evt: KafkaOrderEvent = message.value || message;
    await processPayment(evt, partition, message.offset);
  });

  try {
    await producer.connect();
    await consumer.connect();
    await consumer.subscribe({ topic: 'foodflow.orders', fromBeginning: false });

    console.log(`💳 [Payment Worker - ${INSTANCE_ID}] Listening on topic foodflow.orders (group: payment-group)`);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;
        const event: KafkaOrderEvent = JSON.parse(message.value.toString());
        await processPayment(event, partition, message.offset);
      }
    });
  } catch (err) {
    console.warn(`[Payment Worker] Standalone Kafka absent. Active on In-Memory Stream Engine.`);
  }
}

runWorker().catch(console.error);
