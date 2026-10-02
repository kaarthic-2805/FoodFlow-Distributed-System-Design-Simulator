export enum OrderStatus {
  CREATED = 'CREATED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  KITCHEN_PREPARING = 'KITCHEN_PREPARING',
  KITCHEN_READY = 'KITCHEN_READY',
  DELIVERY_ASSIGNED = 'DELIVERY_ASSIGNED',
  DELIVERY_IN_TRANSIT = 'DELIVERY_IN_TRANSIT',
  DELIVERY_COMPLETED = 'DELIVERY_COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum EventType {
  ORDER_CREATED = 'ORDER_CREATED',
  PAYMENT_COMPLETED = 'PAYMENT_COMPLETED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  KITCHEN_PREPARING = 'KITCHEN_PREPARING',
  KITCHEN_READY = 'KITCHEN_READY',
  DELIVERY_ASSIGNED = 'DELIVERY_ASSIGNED',
  DELIVERY_COMPLETED = 'DELIVERY_COMPLETED'
}

export interface OrderItemPayload {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface OrderEventPayload {
  orderId: string;
  userId: string;
  restaurantId: string;
  items: OrderItemPayload[];
  totalAmount: number;
  status: OrderStatus;
  timestamp: string;
  failureReason?: string;
  deliveryAddress?: string;
  courierId?: string;
  prepTimeMinutes?: number;
}

export interface KafkaOrderEvent {
  eventId: string;
  eventType: EventType;
  payload: OrderEventPayload;
  timestamp: string;
}

export enum MetricType {
  HTTP_REQUEST = 'HTTP_REQUEST',
  CACHE_HIT = 'CACHE_HIT',
  CACHE_MISS = 'CACHE_MISS',
  KAFKA_PRODUCE = 'KAFKA_PRODUCE',
  KAFKA_CONSUME = 'KAFKA_CONSUME',
  CONSUMER_LAG = 'CONSUMER_LAG',
  SERVICE_HEALTH = 'SERVICE_HEALTH',
  LB_ROUTE = 'LB_ROUTE',
  CDN_REQUEST = 'CDN_REQUEST',
  CHAOS_EVENT = 'CHAOS_EVENT'
}

export interface MetricEvent {
  id: string;
  timestamp: string;
  service: string;
  instanceId?: string;
  type: MetricType;
  latencyMs?: number;
  statusCode?: number;
  route?: string;
  method?: string;
  targetInstance?: string;
  details?: Record<string, any>;
}

export interface RestaurantDTO {
  id: string;
  name: string;
  cuisine: string;
  address: string;
  rating: number;
  imageUrl: string;
  isAvailable: boolean;
  menuItems?: MenuItemDTO[];
}

export interface MenuItemDTO {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  isAvailable: boolean;
}

export interface ServiceHealthStatus {
  service: string;
  instanceId: string;
  status: 'healthy' | 'degraded' | 'down';
  uptimeSeconds: number;
  cpuUsage: number;
  memoryUsageMb: number;
  activeRequests: number;
  lastHeartbeat: string;
}

export interface ChaosConfig {
  redisDown: boolean;
  serviceDelayMs: Record<string, number>; // e.g. { 'restaurant-service': 1500 }
  serviceDown: Record<string, boolean>;   // e.g. { 'restaurant-service-2': true }
  workerLagMs: Record<string, number>;     // e.g. { 'payment-worker': 3000 }
  kafkaConsumerPause: Record<string, boolean>; // e.g. { 'kitchen-group': true }
  chaosModeActive: boolean;
}
