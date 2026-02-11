# 🎮 Gaming Leaderboard System

A high-performance gaming leaderboard system built with **Node.js**, **PostgreSQL**, **Redis**, and **WebSocket** for real-time updates. Designed to handle millions of game records with optimized API latencies.

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Setup & Installation](#setup--installation)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Performance Optimization](#performance-optimization)
- [Monitoring (New Relic)](#monitoring-new-relic)
- [Load Testing](#load-testing)
- [Running Tests](#running-tests)
- [Frontend](#frontend)
- [Design Decisions](#design-decisions)

---

## ✨ Features

- **3 Core APIs**: Submit score, Get top 10, Get player rank
- **Redis Caching**: Sub-millisecond reads for leaderboard data with TTL-based expiry
- **Real-time Updates**: WebSocket-powered live leaderboard updates
- **Transactional Writes**: Atomic score submission with rollback on failure
- **Performance Indexes**: Optimized database indexes for queries on 1M+ users
- **Rate Limiting**: Separate limits for read (200/min) and write (100/min) operations
- **Input Validation**: Sanitized inputs to prevent injection and invalid data
- **Graceful Shutdown**: Clean connection teardown for zero-downtime deployments
- **In-memory Fallback**: Works without Redis/PostgreSQL using in-memory cache
- **Live Frontend**: Premium dark-themed UI with real-time rank updates

---

## 🛠 Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Runtime | Node.js 18+ | Async I/O for high concurrency |
| Framework | Express.js 4.x | HTTP server & routing |
| Database | PostgreSQL 14+ | Persistent storage, aggregations |
| Cache | Redis 7+ / In-memory | Low-latency reads, pub/sub |
| Real-time | WebSocket (ws) | Live leaderboard broadcasts |
| Security | Helmet, CORS, Rate Limiter | API protection |
| Monitoring | New Relic APM | Latency tracking, slow queries |
| Testing | Jest + Supertest | Unit & integration tests |
| Frontend | Vanilla HTML/CSS/JS | No build step, premium UI |

---

## 🏗 Architecture

```
Client (Browser)          Load Simulator (Python)
  │  ↕ WebSocket             │  HTTP
  │  ↕ REST API              │
  ▼                          ▼
┌─────────────────────────────────────┐
│         Express.js Server           │
│  ┌─────────┐  ┌──────────────────┐  │
│  │ Helmet   │  │ Rate Limiter     │  │
│  │ CORS     │  │ Validator        │  │
│  │ Morgan   │  │ Error Handler    │  │
│  └─────────┘  └──────────────────┘  │
│  ┌──────────────────────────────┐   │
│  │     Leaderboard Routes       │   │
│  │  /submit  /top  /rank/:id    │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │    Leaderboard Service       │   │
│  │  Transactions │ Caching      │   │
│  └──────┬───────────┬───────────┘   │
│         │           │               │
│    ┌────▼────┐ ┌────▼────┐          │
│    │ PostgreSQL│ │  Redis  │          │
│    │  (Pool)  │ │ (Cache) │          │
│    └─────────┘ └─────────┘          │
│         ┌───────────┐               │
│         │ WebSocket │──→ Broadcast  │
│         │  Server   │               │
│         └───────────┘               │
└─────────────────────────────────────┘
```

---

## 🚀 Setup & Installation

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+ (optional - has in-memory fallback)
- Redis 7+ (optional - has in-memory fallback)
- Python 3.8+ (for load testing)

### Quick Start

```bash
# 1. Clone and install dependencies
cd backend
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 3. Run database migrations (if PostgreSQL is available)
npm run migrate           # Schema only
npm run migrate -- --seed-small  # Schema + 10K users (quick)
npm run migrate -- --seed        # Schema + 1M users (takes minutes)

# 4. Start the server
npm run dev    # Development with hot reload
npm start      # Production

# Server starts on http://localhost:8000
# Frontend on http://localhost:8000
# WebSocket on ws://localhost:8000/ws
```

### Without PostgreSQL/Redis

The system includes **in-memory fallbacks**. Just run:

```bash
cd backend
npm install
npm run dev
```

> ⚠️ **Note**: Replace dummy database credentials in `.env` with your actual PostgreSQL and Redis connection details for production use.

---

## 📡 API Documentation

### Base URL: `http://localhost:8000/api/leaderboard`

### 1. Submit Score

```http
POST /api/leaderboard/submit
Content-Type: application/json

{
  "user_id": 42,
  "score": 5000
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "session_id": 1234,
    "user_id": 42,
    "score": 5000,
    "total_score": 15200,
    "game_mode": "team",
    "timestamp": "2026-02-11T10:00:00.000Z"
  }
}
```

### 2. Get Top 10 Players

```http
GET /api/leaderboard/top
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "user_id": 1,
      "username": "user_1",
      "total_score": 9500,
      "games_played": 15
    }
  ],
  "source": "cache"
}
```

### 3. Get Player Rank

```http
GET /api/leaderboard/rank/42
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user_id": 42,
    "username": "user_42",
    "total_score": 5200,
    "rank": 156,
    "total_players": 1000000
  },
  "source": "database"
}
```

### 4. Health Check

```http
GET /api/health
```

---

## 🗄 Database Schema

```sql
-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Game sessions (individual plays)
CREATE TABLE game_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    score INT NOT NULL,
    game_mode VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leaderboard (pre-computed aggregates)
CREATE TABLE leaderboard (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    total_score INT NOT NULL,
    rank INT
);
```

### Indexes

| Index | Column(s) | Purpose |
|-------|----------|---------|
| `idx_game_sessions_user_id` | `game_sessions(user_id)` | Fast aggregation per user |
| `idx_game_sessions_user_score` | `game_sessions(user_id, score)` | Composite for AVG queries |
| `idx_leaderboard_total_score` | `leaderboard(total_score DESC)` | Fast top-N queries |
| `idx_leaderboard_user_id` | `leaderboard(user_id)` | Fast rank lookups |
| `idx_leaderboard_rank` | `leaderboard(rank ASC)` | Rank-based queries |

---

## ⚡ Performance Optimization

### 1. Database Indexing
- Covering indexes for top-N and rank queries
- Composite index on `(user_id, score)` for aggregation

### 2. Redis Caching
- **Top leaderboard**: 10s TTL, invalidated on score submit
- **Player ranks**: 30s TTL, invalidated per-user on score submit
- **In-memory fallback** with Map-based cache if Redis unavailable

### 3. Query Optimization
- Pre-computed `leaderboard` table avoids real-time aggregation
- `DENSE_RANK()` window function for gap-free rankings
- `ON CONFLICT ... DO UPDATE` for atomic upserts

### 4. Concurrency
- PostgreSQL transactions (`BEGIN/COMMIT/ROLLBACK`)
- `ON CONFLICT` prevents duplicate leaderboard entries
- Batch rank recalculation (every 5 min) avoids lock contention
- Cache invalidation after commit (not during transaction)

### 5. Connection Pooling
- pg.Pool with max 20 connections
- Idle timeout: 30s, connection timeout: 5s

---

## 📊 Monitoring (New Relic)

### Setup

1. Sign up at [newrelic.com](https://newrelic.com) (100GB free)
2. Set `NEW_RELIC_LICENSE_KEY` in `.env`
3. Restart the server — New Relic agent auto-instruments

### What's Monitored
- API response times per endpoint
- Database query durations (slow query threshold: 500ms)
- Error rates and types
- Throughput (requests/min)

> Replace `YOUR_NEW_RELIC_LICENSE_KEY` in `.env` with your actual New Relic license key.

---

## 🔄 Load Testing

```bash
# Install Python dependencies
pip install requests

# Run load simulator
python load-test/simulate.py

# With custom parameters
python load-test/simulate.py --users 10000 --interval 0.5 --iterations 100
```

The script continuously submits scores, fetches leaderboards, and checks ranks while logging response times.

---

## 🧪 Running Tests

```bash
cd backend
npm test
```

Tests cover:
- ✅ All 3 API endpoints (submit, top, rank)
- ✅ Input validation (missing fields, invalid types, edge cases)
- ✅ Error handling (DB failures, rollbacks)
- ✅ Response format validation
- ✅ 404 handling

---

## 🎨 Frontend

Access at `http://localhost:8000` after starting the server.

Features:
- **Top 10 Leaderboard** with live WebSocket updates
- **Player Rank Lookup** with percentile calculation
- **Score Submission** form
- **Live Activity Feed** showing real-time events
- **Connection Status** indicator
- Gold/Silver/Bronze badges for top 3 players
- Auto-reconnect on WebSocket disconnect

---

## 🤔 Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Pre-computed leaderboard table** | Avoids expensive real-time aggregation on 5M+ rows |
| **Redis caching with short TTL** | Balances freshness vs latency; TTL as safety net |
| **Batch rank recalculation** | Prevents lock contention from per-write rank updates |
| **In-memory fallback** | System works without Redis/PostgreSQL for easy local development |
| **Express over Fastify** | More ecosystem support, easier onboarding |
| **Raw SQL over ORM** | Full control over query optimization, no ORM overhead |
| **Vanilla frontend** | No build step complexity, instant load, assignment focus is backend |
| **WebSocket over SSE** | Bidirectional communication, wider browser support |

---

## 📁 Project Structure

```
Gocomet/
├── backend/
│   ├── src/
│   │   ├── config/         # DB, Redis, WebSocket configs
│   │   ├── controllers/    # HTTP request handlers
│   │   ├── middleware/      # Rate limit, validation, errors
│   │   ├── services/       # Core business logic
│   │   ├── routes/         # API route definitions
│   │   └── app.js          # Express app entry point
│   ├── tests/              # Jest test suite
│   ├── migrations/         # SQL schema & seed data
│   ├── newrelic.js         # New Relic APM config
│   └── package.json
├── frontend/
│   ├── index.html          # Main UI
│   ├── css/style.css       # Dark theme styles
│   └── js/app.js           # WebSocket + API client
├── load-test/
│   └── simulate.py         # Load simulator
├── docs/
│   ├── HLD.md              # High-Level Design
│   ├── LLD.md              # Low-Level Design
│   └── performance-report.md
└── README.md
```
