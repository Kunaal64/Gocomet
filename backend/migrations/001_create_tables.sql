-- ═══════════════════════════════════════════════════════════════
-- Gaming Leaderboard - Database Schema
-- Creates users, game_sessions, and leaderboard tables with
-- optimized indexes for high-performance queries.
-- ═══════════════════════════════════════════════════════════════

-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Game sessions table
CREATE TABLE IF NOT EXISTS game_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    score INT NOT NULL,
    game_mode VARCHAR(50) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Leaderboard table (pre-computed aggregations)
CREATE TABLE IF NOT EXISTS leaderboard (
    id SERIAL PRIMARY KEY,
    user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    total_score INT NOT NULL,
    rank INT
);

-- ═══════════════════════════════════════════════════════════════
-- Performance Indexes
-- 
-- These indexes are critical for API latency optimization:
-- - game_sessions(user_id): Fast JOIN and aggregation per user
-- - leaderboard(total_score DESC): Fast top-N queries
-- - leaderboard(user_id): Fast individual rank lookups
-- - leaderboard(rank): Fast rank-based queries
-- ═══════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id 
    ON game_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_game_sessions_timestamp 
    ON game_sessions(timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_total_score 
    ON leaderboard(total_score DESC);

CREATE INDEX IF NOT EXISTS idx_leaderboard_user_id 
    ON leaderboard(user_id);

CREATE INDEX IF NOT EXISTS idx_leaderboard_rank 
    ON leaderboard(rank ASC);

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_score 
    ON game_sessions(user_id, score);
