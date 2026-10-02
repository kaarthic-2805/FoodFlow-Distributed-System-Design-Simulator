# FoodFlow — Distributed System Design Simulator

**FoodFlow** is an interactive, full-stack distributed food-delivery system-design simulator. The food-ordering application (browsing restaurants, placing orders, tracking status) serves as the *demo scenario*, while the real core product is a fully functional distributed system featuring an **API Gateway**, **Microservices**, **Kafka Event Streaming**, **Redis Caching**, **Async Worker Consumer Groups**, **SQLite Persistence**, **CDN Edge Simulation**, and **Load Balancing** — paired with a live **Control Room Dashboard** that visualizes system internals and supports live failure injection in real time.

---

## Architecture Diagram

```
                              ┌───────────────────────────────────────┐
                              │     React Frontend (Port 3000)        │
                              │  (Food App + Control Room Dashboard)  │
                              └──────────────────┬────────────────────┘
                                                 │ HTTP / WebSocket (Port 4010)
                                                 ▼
                              ┌───────────────────────────────────────┐
                              │        Reverse Proxy / API Gateway    │
                              │        (Port 4000 - Round-Robin LB)   │
                              └───────┬──────────────┬─────────┬──────┘
                                      │              │         │
                 ┌────────────────────┘              │         └───────────────────┐
                 ▼                                   ▼                             ▼
   ┌───────────────────────────┐       ┌───────────────────────────┐       ┌──────────────────┐
   │    Restaurant Service     │       │       Order Service       │       │   User Service   │
   │ Inst 1 (4001) Inst 2 (4002)│       │ Inst 1 (4004) Inst 2 (4005)│       │   Inst 1 (4003)  │
   └─────────────┬─────────────┘       └─────────────┬─────────────┘       └────────┬─────────┘
                 │                                   │                             │
                 ▼                                   ▼                             │
   ┌───────────────────────────┐       ┌───────────────────────────┐               │
   │        Redis Cache        │       │    Kafka Event Stream     │               │
   │ (Cache-Aside + CDN Edge)  │       │     (Topic: foodflow.orders)│               │
   └───────────────────────────┘       └─────────────┬─────────────┘               │
                                                     │                             │
                                       ┌─────────────┼─────────────┐               │
                                       ▼             ▼             ▼               │
                                 ┌──────────┐   ┌──────────┐  ┌──────────┐         │
                                 │ Payment  │   │ Kitchen  │  │ Delivery │         │
                                 │ Worker   │   │ Worker   │  │ Worker   │         │
                                 └────┬─────┘   └────┬─────┘  └────┬─────┘         │
                                      │              │             │               │
                                      └──────────────┼─────────────┴───────────────┘
                                                     ▼
                                      ┌────────────────────────────┐
                                      │      SQLite Database       │
                                      │  (Zero External Dependency)│
                                      └────────────────────────────┘
```

---

## Zero-Dependency Execution (No Docker Required)

This system is engineered to run 100% natively on any machine using Node.js without requiring Docker, MySQL, Redis, or Kafka to be installed locally.

### 1. Initialize Database Schema & Seed Data
```bash
npm run db:push
npm run db:seed
```

### 2. Start the Whole Stack (1 Single Command)
```bash
npm start
```
*Launches API Gateway, 2x Restaurant Service instances, 2x Order Service instances, User Service, 3x Workers, Control Telemetry Service, and the React Frontend simultaneously.*

### 3. Open Web Interfaces
- **Customer Food App & Control Room Dashboard:** [http://localhost:3000](http://localhost:3000)
- **API Gateway Endpoint:** [http://localhost:4000](http://localhost:4000)
- **Control Telemetry Service (WebSocket):** [http://localhost:4010](http://localhost:4010)

---

## Kafka Topology & Consumer Groups

| Topic Name | Partitions | Producer | Consumer Group | Responsible Action |
| :--- | :--- | :--- | :--- | :--- |
| `foodflow.orders` | 3 | `order-service`, Workers | `payment-group` | Consumes `ORDER_CREATED`, processes payment, emits `PAYMENT_COMPLETED` / `PAYMENT_FAILED`. |
| `foodflow.orders` | 3 | Workers | `kitchen-group` | Consumes `PAYMENT_COMPLETED`, prepares food, emits `KITCHEN_READY`. |
| `foodflow.orders` | 3 | Workers | `delivery-group` | Consumes `KITCHEN_READY`, assigns courier, emits `DELIVERY_COMPLETED`. |
| `foodflow.metrics` | 3 | Gateway, Services | `metrics-aggregator` | Consumes system metrics for real-time dashboard visualization. |

---

## Redis Key Scheme

| Key Pattern | Data Structure | TTL | Purpose |
| :--- | :--- | :--- | :--- |
| `restaurant:list` | Stringified JSON | 300s | Cache-aside store for all restaurant catalog listings. |
| `restaurant:detail:{id}` | Stringified JSON | 300s | Cache-aside store for specific restaurant menu details. |
| `cdn:edge:{region}:asset:{path}` | String | 600s | Regional CDN edge cache store (`us-east`, `eu-central`). |
| `ratelimit:{ip}` | Integer Counter | 60s | Gateway sliding-window rate limiting counter. |
| `chaos:config` | Stringified JSON | Infinite | Live failure injection & chaos engineering configuration state. |

---

## Failure Injection & Guided Tour Demo

Use the **Control Room Dashboard** to run this step-by-step failure story:

1. **Step 1: Warm Cache & Observe Hits**
   - Click around the **Customer Food App**. Notice the green `[REDIS CACHE HIT]` badge in the app header and 100% Cache Hit Ratio on the Control Room charts.
2. **Step 2: Generate Synthetic Load**
   - In the Control Room, click **"Trigger 35 RPS Burst"**. Observe real-time p50/p95/p99 latency spikes and the Load Balancer histogram splitting requests between `restaurant-service-1` and `restaurant-service-2`.
3. **Step 3: Force Redis Cache Failure**
   - Under **Failure Injection**, click **FORCE OFFLINE** on Redis.
   - Go back to the Food App and refresh. Notice the badge switches to `[MYSQL / SQLITE DB FALLBACK / MISS]` and p95 latency increases as reads hit the database directly.
4. **Step 4: Kill Service Instance**
   - Toggle `restaurant-service-2` to **DEAD**.
   - Notice the API Gateway instantly reroutes 100% of traffic to `restaurant-service-1` without returning errors to the user.
5. **Step 5: Pause Kafka Consumer Group & Watch Lag Climb**
   - In the **Kafka Inspector**, click **Pause Group** on `payment-group`.
   - Place an order in the Food App. Notice the Order Tracker stays paused at `Order Created` while partition lag accumulates on Kafka. Click **Resume Group** to watch the worker catch up and process the order instantly.
