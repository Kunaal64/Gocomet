/**
 * Leaderboard Service
 * 
 * Core business logic for the gaming leaderboard system.
 * Handles score submission (with transactions), leaderboard retrieval,
 * and player rank lookup. Integrates Redis caching for performance.
 * 
 * Design Decisions:
 * - Score submission uses atomic transactions for consistency
 * - Leaderboard upsert uses ON CONFLICT for idempotent writes
 * - Rank recalculation is done via a batch update to avoid lock contention
 * - Cache is invalidated on writes, with short TTL as safety net
 */

const db = require('../config/db');
const { getRedisClient } = require('../config/redis');
const { publishUpdate } = require('../config/websocket');

// Cache key constants
const CACHE_KEYS = {
    TOP_LEADERBOARD: 'leaderboard:top',
    PLAYER_RANK: (userId) => `leaderboard:rank:${userId}`,
};

// Cache TTLs (seconds)
const CACHE_TTL = {
    LEADERBOARD: parseInt(process.env.CACHE_TTL_LEADERBOARD, 10) || 10,
    RANK: parseInt(process.env.CACHE_TTL_RANK, 10) || 30,
};

/**
 * Submit a score for a user
 * 
 * Transaction flow:
 * 1. Insert game session record
 * 2. Upsert leaderboard entry with new aggregated total_score
 * 3. Invalidate relevant caches
 * 4. Broadcast update via WebSocket
 * 
 * @param {number} userId - The user's ID
 * @param {number} score - The score to submit
 * @returns {Promise<object>} Submission result
 */
const submitScore = async (userId, score) => {
    const client = await db.getClient();

    try {
        await client.query('BEGIN');

        // 1. Insert game session
        const sessionResult = await client.query(
            `INSERT INTO game_sessions (user_id, score, game_mode, timestamp)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, score, game_mode, timestamp`,
            [userId, score, score > 5000 ? 'solo' : 'team']
        );

        // 2. Upsert leaderboard entry
        // Uses ON CONFLICT for atomic upsert — handles concurrent writes safely
        // Recalculates total_score as AVG of all sessions
        const leaderboardResult = await client.query(
            `INSERT INTO leaderboard (user_id, total_score, rank)
       SELECT $1, COALESCE(AVG(score)::int, 0), 0
       FROM game_sessions
       WHERE user_id = $1
       ON CONFLICT (user_id)
       DO UPDATE SET total_score = (
         SELECT COALESCE(AVG(score)::int, 0)
         FROM game_sessions
         WHERE user_id = $1
       )
       RETURNING user_id, total_score`,
            [userId]
        );

        await client.query('COMMIT');

        // 3. Invalidate caches (after commit to ensure data is persisted)
        await _invalidateCache(userId);

        // 4. Broadcast update via WebSocket
        const updateData = {
            userId,
            newScore: score,
            totalScore: leaderboardResult.rows[0].total_score,
            sessionId: sessionResult.rows[0].id,
        };

        // Non-blocking broadcast
        publishUpdate(updateData).catch((err) =>
            console.error('[WS] Broadcast error:', err.message)
        );

        return {
            success: true,
            data: {
                session_id: sessionResult.rows[0].id,
                user_id: userId,
                score,
                total_score: leaderboardResult.rows[0].total_score,
                game_mode: sessionResult.rows[0].game_mode,
                timestamp: sessionResult.rows[0].timestamp,
            },
        };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

/**
 * Get top 10 players sorted by total_score
 * 
 * Optimization: Checks Redis cache first, falls back to DB query.
 * Uses JOIN with users table to include usernames.
 * 
 * @returns {Promise<object>} Top 10 players
 */
const getTopPlayers = async () => {
    const redis = getRedisClient();

    let topPlayers = null;
    let globalStats = null;
    let source = 'database';

    // 1. Check cache for Leaderboard
    try {
        const cached = await redis.get(CACHE_KEYS.TOP_LEADERBOARD);
        if (cached) {
            topPlayers = JSON.parse(cached);
            source = 'cache';
        }
    } catch (err) {
        console.error('[Cache] Read error:', err.message);
    }

    // 2. Check cache for Global Stats
    try {
        const cachedStats = await redis.get('leaderboard:stats');
        if (cachedStats) {
            globalStats = JSON.parse(cachedStats);
        }
    } catch (err) { }

    // 3. Query DB if cache miss
    if (!topPlayers) {
        const result = await db.query(
            `SELECT 
           l.user_id,
           u.username,
           l.total_score,
           l.rank,
           COUNT(gs.id) as games_played
         FROM leaderboard l
         JOIN users u ON l.user_id = u.id
         LEFT JOIN game_sessions gs ON l.user_id = gs.user_id
         GROUP BY l.user_id, u.username, l.total_score, l.rank
         ORDER BY l.total_score DESC
         LIMIT 10`
        );

        topPlayers = result.rows.map((row, index) => ({
            rank: index + 1,
            user_id: row.user_id,
            username: row.username,
            total_score: row.total_score,
            games_played: parseInt(row.games_played, 10),
        }));

        try {
            await redis.set(
                CACHE_KEYS.TOP_LEADERBOARD,
                JSON.stringify(topPlayers),
                'EX',
                CACHE_TTL.LEADERBOARD
            );
        } catch (err) {
            console.error('[Cache] Write error:', err.message);
        }
        source = 'database';
    }

    // 4. Query DB for Stats if cache miss
    if (!globalStats) {
        const statsResult = await db.query(`
            SELECT 
                (SELECT COUNT(*) FROM users) as total_players,
                (SELECT COUNT(*) FROM game_sessions) as total_games
        `);

        globalStats = {
            total_players: parseInt(statsResult.rows[0].total_players, 10),
            total_games: parseInt(statsResult.rows[0].total_games, 10)
        };

        try {
            // Cache stats for 60 seconds (doesn't need strictly real-time precision)
            await redis.set('leaderboard:stats', JSON.stringify(globalStats), 'EX', 60);
        } catch (err) { }
    }

    return {
        success: true,
        data: topPlayers,
        stats: globalStats,
        source,
    };
};

/**
 * Get a specific player's rank
 * 
 * Uses a subquery that ranks ALL leaderboard users first, then filters to
 * the requested user. This ensures the rank is globally accurate (not just
 * rank 1 within a single-row result set).
 * 
 * @param {number} userId - The user's ID
 * @returns {Promise<object>} Player rank info
 */
const getPlayerRank = async (userId) => {
    const redis = getRedisClient();

    // 1. Check cache
    const cacheKey = CACHE_KEYS.PLAYER_RANK(userId);
    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            return {
                success: true,
                data: JSON.parse(cached),
                source: 'cache',
            };
        }
    } catch (err) {
        console.error('[Cache] Read error:', err.message);
    }

    // 2. Query database — rank ALL users in subquery, then filter
    const result = await db.query(
        `SELECT ranked.user_id, ranked.username, ranked.total_score, ranked.rank, ranked.total_players
     FROM (
       SELECT 
         l.user_id,
         u.username,
         l.total_score,
         DENSE_RANK() OVER (ORDER BY l.total_score DESC) as rank,
         COUNT(*) OVER () as total_players
       FROM leaderboard l
       JOIN users u ON l.user_id = u.id
     ) ranked
     WHERE ranked.user_id = $1`,
        [userId]
    );

    if (result.rows.length === 0) {
        return {
            success: false,
            error: `Player with user_id ${userId} not found on leaderboard`,
        };
    }

    const playerData = {
        user_id: result.rows[0].user_id,
        username: result.rows[0].username,
        total_score: result.rows[0].total_score,
        rank: parseInt(result.rows[0].rank, 10),
        total_players: parseInt(result.rows[0].total_players, 10),
    };

    // 3. Cache the result
    try {
        await redis.set(cacheKey, JSON.stringify(playerData), 'EX', CACHE_TTL.RANK);
    } catch (err) {
        console.error('[Cache] Write error:', err.message);
    }

    return {
        success: true,
        data: playerData,
        source: 'database',
    };
};

/**
 * Batch recalculate ranks for all leaderboard entries
 * 
 * Called periodically or after significant score changes.
 * Uses a single UPDATE with window function for efficiency.
 * 
 * @returns {Promise<number>} Number of rows updated
 */
const recalculateRanks = async () => {
    const result = await db.query(
        `UPDATE leaderboard l
     SET rank = sub.new_rank
     FROM (
       SELECT user_id, DENSE_RANK() OVER (ORDER BY total_score DESC) as new_rank
       FROM leaderboard
     ) sub
     WHERE l.user_id = sub.user_id AND l.rank != sub.new_rank`
    );

    // Invalidate all caches after rank recalculation
    try {
        const redis = getRedisClient();
        await redis.del(CACHE_KEYS.TOP_LEADERBOARD);
    } catch (err) {
        console.error('[Cache] Invalidation error after recalculation:', err.message);
    }

    return result.rowCount;
};

/**
 * Invalidate caches related to a user's score update
 * @param {number} userId - The user whose caches should be invalidated
 */
const _invalidateCache = async (userId) => {
    try {
        const redis = getRedisClient();
        await redis.del(CACHE_KEYS.TOP_LEADERBOARD);
        await redis.del(CACHE_KEYS.PLAYER_RANK(userId));
    } catch (err) {
        // Cache invalidation failure is not critical
        console.error('[Cache] Invalidation error:', err.message);
    }
};

module.exports = {
    submitScore,
    getTopPlayers,
    getPlayerRank,
    recalculateRanks,
};
