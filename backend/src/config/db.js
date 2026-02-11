/**
 * PostgreSQL Database Configuration (Neon Serverless Compatible)
 * 
 * Supports both:
 * - DATABASE_URL (Neon, Heroku, etc.) — auto-detects SSL requirement
 * - Individual DB_HOST/DB_PORT/etc. env vars for local dev
 */

const { Pool } = require('pg');
require('dotenv').config();

// Build pool config from DATABASE_URL if available, otherwise individual vars
const buildPoolConfig = () => {
    if (process.env.DATABASE_URL) {
        return {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.DATABASE_URL.includes('sslmode=require')
                ? { rejectUnauthorized: false }
                : false,
            max: parseInt(process.env.DB_MAX_CONNECTIONS, 10) || 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
            statement_timeout: 10000,
        };
    }

    return {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'gaming_leaderboard',
        max: parseInt(process.env.DB_MAX_CONNECTIONS, 10) || 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        statement_timeout: 10000,
    };
};

const pool = new Pool(buildPoolConfig());

// Log pool errors (don't crash on idle client errors)
pool.on('error', (err) => {
    console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Execute a parameterized query
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<object>} Query result
 */
const query = async (text, params) => {
    const start = Date.now();
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    if (duration > 200) {
        console.warn(`[DB] Slow query (${duration}ms):`, text.substring(0, 100));
    }

    return result;
};

/**
 * Get a client from the pool for transaction support
 * @returns {Promise<object>} Pool client
 */
const getClient = async () => {
    const client = await pool.connect();
    return client;
};

/**
 * Test database connectivity
 * @returns {Promise<boolean>} Connection status
 */
const testConnection = async () => {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('[DB] Connected to PostgreSQL at', res.rows[0].now);
        return true;
    } catch (err) {
        console.error('[DB] Connection failed:', err.message);
        return false;
    }
};

/**
 * Gracefully close the connection pool
 */
const closePool = async () => {
    await pool.end();
    console.log('[DB] Connection pool closed');
};

module.exports = {
    pool,
    query,
    getClient,
    testConnection,
    closePool,
};
