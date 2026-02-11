# Gaming Leaderboard System

A high-performance, real-time gaming leaderboard system built with Node.js, PostgreSQL, and Redis. 
Designed to handle millions of records with sub-millisecond latency.

## 🚀 Features
- **Real-time Updates**: WebSocket integration broadcasts leaderboard changes instantly.
- **High Performance**: Redis caching strategies (Lazy-loading query cache) for read-heavy operations.
- **Scalable Architecture**: 
  - **Database**: PostgreSQL with connection pooling and optimized indexing.
  - **Caching**: Redis for `O(1)` access to top players and user ranks.
  - **Concurrency**: Atomic transactions with `ON CONFLICT` resolution for score submissions.
- **Observability**: Integrated New Relic APM support.

---

## 🛠 Tech Stack
- **Backend**: Node.js, Express
- **Database**: PostgreSQL (Neon Serverless compatible)
- **Cache**: Redis
- **Real-time**: WebSocket (`ws`)
- **Frontend**: React, Tailwind CSS

---

## 🏗 High Level Design (HLD)

```mermaid
graph TD
    Client[Client / Game] -->|HTTP POST| LB_API[Leaderboard API]
    Client -->|WebSocket| WS_Server[WebSocket Server]
    
    LB_API -->|Write| DB[(PostgreSQL)]
    LB_API -->|Read/Write| Cache[(Redis)]
    
    LB_API -->|Event| WS_Server
    WS_Server -->|Push Update| Client
    
    subgraph Data Flow
        DB -->|Aggregated Rank| Batch_Job[Rank Recalculation]
    end
```

### Key Components
1.  **API Layer**: Handles `submit`, `top`, and `rank` requests. Validates input and manages rate limiting.
2.  **Service Layer**: Orchestrates data consistency. Writes to DB first (source of truth), then invalidates Cache, then notifies WebSocket.
3.  **Caching Strategy**: 
    - `Top 10`: Cached for 10s.
    - `Player Rank`: Cached for 30s.
    - Invalidation on new score submission for immediate consistency for that user.

---

## 🔧 Low Level Design (LLD)

### Database Schema

**`users`**
- `id`: SERIAL PK
- `username`: VARCHAR UNIQUE
- `join_date`: TIMESTAMP

**`game_sessions`** (Write Heavy)
- `id`: SERIAL PK
- `user_id`: FK -> users.id
- `score`: INT
- `game_mode`: VARCHAR
- `timestamp`: TIMESTAMP
- *Indexes*: `(user_id)`, `(score)`

**`leaderboard`** (Read Optimized / Aggregated)
- `id`: SERIAL PK
- `user_id`: FK -> users.id
- `total_score`: INT (Average of all sessions)
- `rank`: INT
- *Indexes*: `(total_score DESC)`, `(user_id)`

### API Endpoints

1.  **`POST /api/leaderboard/submit`**
    - **Input**: `{ user_id: 123, score: 5000 }`
    - **Logic**: 
        - Transaction start
        - Insert into `game_sessions`
        - Upsert into `leaderboard` (`ON CONFLICT` update avg score)
        - Transaction commit
        - Invalidate cache
        - Broadcast via WebSocket
    - **Output**: `{ success: true, newRank: ..., ... }`

2.  **`GET /api/leaderboard/top`**
    - **Logic**: Check Redis -> Miss -> Select Top 10 from DB -> Cache -> Return.

3.  **`GET /api/leaderboard/rank/:id`**
    - **Logic**: Check Redis -> Miss -> DB queries rank via `DENSE_RANK()` subquery -> Cache -> Return.

---

## ⚡ Setup & Run

### Prerequisites
- Node.js v16+
- PostgreSQL (Local or Neon)
- Redis (Local or will fallback to In-Memory)

### 1. Installation
```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

### 2. Configuration (`.env`)
Create `.env` in `backend/`:
```env
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
REDIS_HOST=localhost
PORT=8000
NEW_RELIC_LICENSE_KEY=your_key_optional
```

### 3. Database Migration & Seeding
```bash
cd backend
npm run migrate       # Create tables
npm run seed          # Seed 10k users (Small)
# npm run seed:full   # Seed 1M users (Large)
```

### 4. Running
```bash
# Start Backend
cd backend
npm start

# Start Frontend
cd frontend
npm run dev
```

### 5. Load Testing
Simulate traffic with the Python script:
```bash
cd backend
python scripts/load_test.py
```
