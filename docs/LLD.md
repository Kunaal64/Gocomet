# Low-Level Design (LLD) — Gaming Leaderboard System

## 1. Database Schema Details

### 1.1 Entity Relationship

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────────┐
│    users      │       │  game_sessions    │       │   leaderboard    │
├──────────────┤       ├──────────────────┤       ├──────────────────┤
│ id (PK)      │◄──┐   │ id (PK)          │       │ id (PK)          │
│ username     │   ├───│ user_id (FK)     │   ┌──│ user_id (FK, UQ) │
│ join_date    │   │   │ score            │   │   │ total_score      │
└──────────────┘   │   │ game_mode        │   │   │ rank             │
                   │   │ timestamp        │   │   └──────────────────┘
                   │   └──────────────────┘   │
                   └──────────────────────────┘
```

### 1.2 Index Strategy

```sql
-- Primary lookup for aggregation
CREATE INDEX idx_game_sessions_user_id ON game_sessions(user_id);

-- Composite for AVG(score) computation
CREATE INDEX idx_game_sessions_user_score ON game_sessions(user_id, score);

-- Top-N query optimization (ORDER BY total_score DESC LIMIT 10)
CREATE INDEX idx_leaderboard_total_score ON leaderboard(total_score DESC);

-- Individual rank lookup
CREATE INDEX idx_leaderboard_user_id ON leaderboard(user_id);

-- Rank-based queries  
CREATE INDEX idx_leaderboard_rank ON leaderboard(rank ASC);
```

**Why these indexes?**
- `idx_leaderboard_total_score DESC`: PostgreSQL can satisfy `ORDER BY total_score DESC LIMIT 10` with an **index-only scan** — O(1) instead of sorting 1M rows
- `idx_game_sessions_user_score`: **Covering index** — PostgreSQL computes `AVG(score)` directly from the index without touching the heap

## 2. API Contracts

### 2.1 Submit Score

```
POST /api/leaderboard/submit
Content-Type: application/json

Request:  { user_id: int (>0), score: int (0-1000000) }
Success:  201 { success: true, data: { session_id, user_id, score, total_score, game_mode, timestamp } }
Error:    400 { success: false, error: "validation message" }
          404 { success: false, error: "Referenced user does not exist" }
          429 { success: false, error: "Too many score submissions" }
          500 { success: false, error: "Internal server error" }
```

### 2.2 Get Top Players

```
GET /api/leaderboard/top

Success:  200 { success: true, data: [{ rank, user_id, username, total_score, games_played }], source: "cache"|"database" }
Error:    429 { success: false, error: "Too many requests" }
          500 { success: false, error: "Internal server error" }
```

### 2.3 Get Player Rank

```
GET /api/leaderboard/rank/:user_id

Success:  200 { success: true, data: { user_id, username, total_score, rank, total_players }, source: "cache"|"database" }
Error:    400 { success: false, error: "user_id must be a positive integer" }
          404 { success: false, error: "Player not found on leaderboard" }
          429 { success: false, error: "Too many requests" }
```

## 3. Transaction Details

### 3.1 Score Submission Transaction

```sql
BEGIN;

-- Step 1: Insert game session
INSERT INTO game_sessions (user_id, score, game_mode, timestamp)
VALUES ($1, $2, $3, NOW())
RETURNING id, score, game_mode, timestamp;

-- Step 2: Atomic upsert leaderboard
-- ON CONFLICT handles concurrent writes safely
INSERT INTO leaderboard (user_id, total_score, rank)
  SELECT $1, COALESCE(AVG(score)::int, 0), 0
  FROM game_sessions WHERE user_id = $1
ON CONFLICT (user_id)
DO UPDATE SET total_score = (
  SELECT COALESCE(AVG(score)::int, 0)
  FROM game_sessions WHERE user_id = $1
)
RETURNING user_id, total_score;

COMMIT;
-- On any error: ROLLBACK + release client to pool
```

**Concurrency handling:**
- `ON CONFLICT` uses PostgreSQL's row-level locking — no race conditions
- Multiple concurrent submissions for the same user are serialized by the row lock
- The transaction ensures session + leaderboard are updated atomically

### 3.2 Batch Rank Recalculation

```sql
-- Runs every 5 minutes via setInterval
UPDATE leaderboard l
SET rank = sub.new_rank
FROM (
  SELECT user_id, DENSE_RANK() OVER (ORDER BY total_score DESC) as new_rank
  FROM leaderboard
) sub
WHERE l.user_id = sub.user_id AND l.rank != sub.new_rank;
```

**Why batch instead of per-write?**
- Per-write rank update requires scanning entire leaderboard table (1M rows) on every score submit
- Batch approach runs once every 5 min, amortizing the cost
- Ranks are "eventually consistent" with ~5 min max staleness — acceptable for gaming context

## 4. Caching Strategy

### 4.1 Cache Keys

| Key Pattern | Data | TTL | Invalidation |
|-------------|------|-----|--------------|
| `leaderboard:top` | Top 10 players JSON | 10s | On any score submit |
| `leaderboard:rank:{userId}` | Player rank JSON | 30s | When that user submits |

### 4.2 Cache Flow

```
READ:  Redis GET → HIT? return cached → MISS? query DB → SET with TTL → return
WRITE: DB Transaction → COMMIT → DEL cache keys → Publish update
```

### 4.3 Invalidation Strategy

- **Eager invalidation**: `DEL` cache keys immediately after successful commit
- **TTL safety net**: Even without explicit invalidation, data auto-expires
- **Invalidation after commit**: Prevents caching uncommitted data if transaction rolls back

## 5. WebSocket Protocol

### 5.1 Message Types

```json
// Server → Client: Connection confirmed
{ "type": "connected", "message": "Connected to leaderboard live updates", "timestamp": "..." }

// Server → Client: Leaderboard update
{
  "type": "leaderboard_update",
  "data": { "userId": 42, "newScore": 5000, "totalScore": 15200, "sessionId": 1234 },
  "timestamp": "..."
}
```

### 5.2 Connection Management

- **Heartbeat**: Server pings every 30s, terminates dead connections
- **Auto-reconnect**: Client reconnects with exponential backoff (max 30s)
- **Pub/Sub**: Redis channel `leaderboard:updates` enables multi-instance broadcasting

## 6. Rate Limiting Strategy

| Endpoint | Window | Max Requests | Rationale |
|----------|--------|-------------|-----------|
| POST /submit | 60s | 100/IP | Prevent score spam |
| GET /top | 60s | 200/IP | Allow frequent polling |
| GET /rank/:id | 60s | 200/IP | Allow frequent lookups |

## 7. Error Handling Flow

```
Controller catch(err) → next(err)
  → errorHandler middleware
    → ECONNREFUSED → 503 Service Unavailable
    → FK violation (23503) → 404 User Not Found
    → Default → 500 (production: generic, dev: message + stack)
```

## 8. Module Dependency Graph

```
app.js
  ├── config/db.js          (pg.Pool)
  ├── config/redis.js       (ioredis / InMemoryCache)
  ├── config/websocket.js   (ws.WebSocketServer)
  ├── routes/leaderboard.routes.js
  │     ├── middleware/rateLimiter.js
  │     ├── middleware/validator.js
  │     └── controllers/leaderboard.controller.js
  │           └── services/leaderboard.service.js
  │                 ├── config/db.js
  │                 ├── config/redis.js
  │                 └── config/websocket.js (publishUpdate)
  └── middleware/errorHandler.js
```
