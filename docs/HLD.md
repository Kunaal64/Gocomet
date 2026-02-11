# High-Level Design (HLD) — Gaming Leaderboard System

## 1. System Overview

The Gaming Leaderboard System is a real-time ranking platform that tracks player scores across game sessions, computes aggregate rankings, and serves live-updating leaderboard data to connected clients.

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                            │
│                                                             │
│  ┌──────────────┐    ┌──────────────┐   ┌───────────────┐  │
│  │  Browser UI  │    │ Load Tester  │   │  External API  │  │
│  │ (HTML/CSS/JS)│    │  (Python)    │   │   Consumers    │  │
│  └──────┬───────┘    └──────┬───────┘   └──────┬────────┘  │
│         │ WS + REST         │ REST              │ REST      │
└─────────┼───────────────────┼──────────────────┼───────────┘
          │                   │                  │
┌─────────▼───────────────────▼──────────────────▼───────────┐
│                    APPLICATION LAYER                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Express.js + WebSocket                  │   │
│  │                                                     │   │
│  │  Middleware: Helmet, CORS, Rate Limit, Compression  │   │
│  │  Routes:    /submit, /top, /rank/:id                │   │
│  │  Service:   Transaction Mgmt, Cache Strategy        │   │
│  │  Scheduler: Periodic Rank Recalculation (5 min)     │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       │                                     │
│            ┌──────────┴──────────┐                          │
│            │                     │                          │
│     ┌──────▼──────┐      ┌──────▼──────┐                   │
│     │    Redis     │      │ PostgreSQL  │                   │
│     │   (Cache)    │      │   (Store)   │                   │
│     │  Pub/Sub     │      │  Pool: 20   │                   │
│     └─────────────┘      └─────────────┘                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │            New Relic APM Agent                       │   │
│  │  Monitors: Latencies, Queries, Errors, Throughput   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 3. Data Flow

### Score Submission Flow
```
Client → POST /submit → Validator → Rate Limiter
  → Service: BEGIN TRANSACTION
    → INSERT game_session
    → UPSERT leaderboard (ON CONFLICT)
  → COMMIT
  → Invalidate Redis Cache
  → Publish to Redis Pub/Sub
  → WebSocket Broadcast to Clients
  → Response: 201 Created
```

### Leaderboard Query Flow
```
Client → GET /top → Rate Limiter
  → Service: Check Redis Cache
    → Cache HIT → Return cached data (< 1ms)
    → Cache MISS → Query PostgreSQL (JOIN + ORDER + LIMIT 10)
      → Cache result (TTL: 10s)
  → Response: 200 OK
```

### Rank Lookup Flow
```
Client → GET /rank/:id → Validator → Rate Limiter
  → Service: Check Redis Cache (per-user key)
    → Cache HIT → Return cached rank
    → Cache MISS → Query with DENSE_RANK() window function
      → Cache result (TTL: 30s)
  → Response: 200 OK
```

## 4. Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| **Express Server** | HTTP handling, middleware orchestration, static file serving |
| **Middleware Layer** | Security (Helmet, CORS), rate limiting, input validation, error handling |
| **Service Layer** | Business logic, transaction management, cache interaction |
| **PostgreSQL** | Persistent storage, ACID transactions, aggregation queries |
| **Redis** | Read caching (TTL-based), pub/sub for real-time broadcasts |
| **WebSocket** | Real-time bidirectional communication with browser clients |
| **New Relic** | APM monitoring, slow query detection, alerting |
| **Frontend** | Leaderboard display, rank lookup, live update rendering |

## 5. Non-Functional Requirements

| Requirement | Approach |
|-------------|----------|
| **Performance** | Redis caching, DB indexing, connection pooling, gzip compression |
| **Scalability** | Stateless app layer (horizontal scaling), Redis pub/sub for multi-instance |
| **Consistency** | Transactions, atomic upserts, batch rank recalculation |
| **Availability** | In-memory fallback, graceful shutdown, auto-reconnect |
| **Security** | Helmet headers, rate limiting, input sanitization, CORS |
| **Observability** | New Relic APM, Morgan logging, slow query warnings |

## 6. Trade-offs

| Trade-off | Choice | Rationale |
|-----------|--------|-----------|
| **Eventual consistency on ranks** | Batch recalculation every 5min | Avoids per-write lock contention on rank column |
| **Cache staleness** | Short TTL (10-30s) | Acceptable for gaming context; freshness vs latency |
| **Single-node Redis** | No cluster | Sufficient for assignment scale; easily upgradeable |
| **Raw SQL over ORM** | Direct pg queries | Better query control, lower overhead for complex operations |
