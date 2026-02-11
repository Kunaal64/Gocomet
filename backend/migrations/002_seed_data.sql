-- ═══════════════════════════════════════════════════════════════
-- Gaming Leaderboard - Seed Data
-- 
-- Populates the database with large-scale test data:
-- - 1,000,000 users
-- - 5,000,000 game sessions with random scores
-- - Aggregated leaderboard entries
--
-- NOTE: These queries may take several minutes on large datasets.
--       Reduce the numbers if running locally with limited resources.
--       See 002_seed_data_small.sql for a smaller dataset.
-- ═══════════════════════════════════════════════════════════════

-- Populate Users Table with 1 Million Records
INSERT INTO users (username)
SELECT 'user_' || generate_series(1, 1000000);

-- Populate Game Sessions with Random Scores (5 Million)
INSERT INTO game_sessions (user_id, score, game_mode, timestamp)
SELECT
    floor(random() * 1000000 + 1)::int,
    floor(random() * 10000 + 1)::int,
    CASE WHEN random() > 0.5 THEN 'solo' ELSE 'team' END,
    NOW() - INTERVAL '1 day' * floor(random() * 365)
FROM generate_series(1, 5000000);

-- Populate Leaderboard by Aggregating Scores
-- total_score = AVG(score), rank = sorted by AVG(score) DESC
INSERT INTO leaderboard (user_id, total_score, rank)
SELECT user_id, AVG(score)::int as total_score, DENSE_RANK() OVER (ORDER BY AVG(score)::int DESC)
FROM game_sessions
GROUP BY user_id;
