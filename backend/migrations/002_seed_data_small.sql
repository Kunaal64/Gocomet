-- ═══════════════════════════════════════════════════════════════
-- Gaming Leaderboard - Small Seed Data (For development/testing)
-- 
-- Use this instead of 002_seed_data.sql if the full dataset
-- takes too long. Contains:
-- - 10,000 users
-- - 50,000 game sessions
-- - Aggregated leaderboard
-- ═══════════════════════════════════════════════════════════════

-- Populate Users Table with 10,000 Records
INSERT INTO users (username)
SELECT 'user_' || generate_series(1, 10000);

-- Populate Game Sessions with Random Scores (50,000)
INSERT INTO game_sessions (user_id, score, game_mode, timestamp)
SELECT
    floor(random() * 10000 + 1)::int,
    floor(random() * 10000 + 1)::int,
    CASE WHEN random() > 0.5 THEN 'solo' ELSE 'team' END,
    NOW() - INTERVAL '1 day' * floor(random() * 365)
FROM generate_series(1, 50000);

-- Populate Leaderboard by Aggregating Scores
INSERT INTO leaderboard (user_id, total_score, rank)
SELECT user_id, AVG(score)::int as total_score, DENSE_RANK() OVER (ORDER BY AVG(score)::int DESC)
FROM game_sessions
GROUP BY user_id;
