import express, { Request, Response } from 'express';
import cors from 'cors';
import { Partitioners } from 'kafkajs';
import { prisma } from '@foodflow/database';
import { MetricsPublisher, MetricType, EventType, KafkaOrderEvent, OrderStatus, InMemoryKafkaStream, createKafkaClient } from '@foodflow/shared';

const app = express();
const PORT = process.env.PORT || 4004;
const INSTANCE_ID = process.env.INSTANCE_ID || 'order-service-1';
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9094').split(',');

const metrics = new MetricsPublisher('order-service', INSTANCE_ID);

// Initialize Kafka Producer
const kafka = createKafkaClient(`order-service-${INSTANCE_ID}`);

const producer = kafka.producer({
  createPartitioner: Partitioners.DefaultPartitioner
});

let isProducerConnected = false;

async function connectProducer() {
  try {
    await producer.connect();
    isProducerConnected = true;
    console.log(`✅ [Order Service - ${INSTANCE_ID}] Connected to Kafka brokers: ${KAFKA_BROKERS.join(', ')}`);
  } catch (err) {
    console.log(`ℹ️ [Order Service - ${INSTANCE_ID}] Kafka broker offline. Event Stream active on In-Memory Stream Engine.`);
  }
}

connectProducer();

app.use(cors());
app.use(express.json());

// 1. Create Order & Emit ORDER_CREATED Kafka Event
app.post('/', async (req: Request, res: Response) => {
  const { userId, restaurantId, items, deliveryAddress } = req.body;
  const startTime = Date.now();

  if (!userId || !restaurantId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Missing required order fields (userId, restaurantId, items)' });
  }

  try {
    // Calculate total
    const totalAmount = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

    // Create DB record
    const order = await prisma.order.create({
      data: {
        userId,
        restaurantId,
        totalAmount,
        status: OrderStatus.CREATED,
        deliveryAddress: deliveryAddress || '742 Evergreen Terrace',
        items: {
          create: items.map((i: any) => ({
            menuItemId: i.menuItemId,
            name: i.name,
            price: i.price,
            quantity: i.quantity
          }))
        }
      },
      include: { items: true }
    });

    const eventPayload: KafkaOrderEvent = {
      eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      eventType: EventType.ORDER_CREATED,
      timestamp: new Date().toISOString(),
      payload: {
        orderId: order.id,
        userId: order.userId,
        restaurantId: order.restaurantId,
        items: order.items.map((i: any) => ({ menuItemId: i.menuItemId, name: i.name, quantity: i.quantity, price: i.price })),
        totalAmount: order.totalAmount,
        status: OrderStatus.CREATED,
        timestamp: order.createdAt.toISOString(),
        deliveryAddress: order.deliveryAddress || undefined
      }
    };

    // Emit Kafka Event (or In-Memory Stream fallback)
    if (isProducerConnected) {
      await producer.send({
        topic: 'foodflow.orders',
        messages: [{ key: order.id, value: JSON.stringify(eventPayload), timestamp: Date.now().toString() }]
      });
    }
    InMemoryKafkaStream.produce('foodflow.orders', order.id, eventPayload);

    const latency = Date.now() - startTime;
    metrics.emit({
      type: MetricType.KAFKA_PRODUCE,
      latencyMs: latency,
      route: '/api/orders',
      method: 'POST',
      details: { topic: 'foodflow.orders', eventType: EventType.ORDER_CREATED, orderId: order.id }
    });

    res.status(201).json({
      message: 'Order created successfully',
      instanceId: INSTANCE_ID,
      data: order
    });
  } catch (err: any) {
    console.error('[Order Service] Create Order Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 2. Get Order Details
app.get('/:id', async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true, restaurant: true, user: true }
    });
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ instanceId: INSTANCE_ID, data: order });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Get User Orders
app.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.params.userId },
      include: { items: true, restaurant: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ instanceId: INSTANCE_ID, data: orders });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order-service', instanceId: INSTANCE_ID, kafkaConnected: isProducerConnected });
});

app.listen(PORT, () => {
  console.log(`📦 [Order Service - ${INSTANCE_ID}] Running on port ${PORT}`);
});
