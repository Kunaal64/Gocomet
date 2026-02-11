/**
 * Redis Cache Configuration
 * 
 * Supports standard Redis and Upstash Redis (Serverless).
 * - Uses REDIS_URL if available (handles rediss:// for TLS automatically)
 * - Falls back to in-memory cache if connection fails
 * - Handles pub/sub via separate connections
 */

const Redis = require('ioredis');
require('dotenv').config();

// Determine Redis configuration
const getRedisConfig = () => {
    if (process.env.REDIS_URL) {
        console.log('[Redis] Using REDIS_URL configuration');
        return process.env.REDIS_URL;
    }

    return {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
        // Only retry a few times before falling back to memory
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            if (times > 5) {
                console.warn('[Redis] Max retries reached, falling back to in-memory cache');
                return null;
            }
            return Math.min(times * 200, 2000);
        },
        lazyConnect: true,
    };
};

const REDIS_CONFIG = getRedisConfig();

// ─── In-Memory Fallback Cache ───────────────────────────────────────────────
class InMemoryCache {
    constructor() {
        this.store = new Map();
        this.timers = new Map();
        this.subscribers = new Map();
        this.isMemoryFallback = true;
    }

    async get(key) {
        const item = this.store.get(key);
        if (!item) return null;
        if (item.expiry && Date.now() > item.expiry) {
            this.store.delete(key);
            return null;
        }
        return item.value;
    }

    async set(key, value, ...args) {
        let ttl = null;
        if (args[0] === 'EX' && args[1]) {
            ttl = args[1] * 1000;
        }
        const expiry = ttl ? Date.now() + ttl : null;
        this.store.set(key, { value, expiry });

        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }
        if (ttl) {
            this.timers.set(key, setTimeout(() => this.store.delete(key), ttl));
        }
        return 'OK';
    }

    async del(...keys) {
        let count = 0;
        for (const key of keys) {
            if (this.store.delete(key)) count++;
            if (this.timers.has(key)) {
                clearTimeout(this.timers.get(key));
                this.timers.delete(key);
            }
        }
        return count;
    }

    async keys(pattern) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return Array.from(this.store.keys()).filter((k) => regex.test(k));
    }

    async flushall() {
        this.store.clear();
        this.timers.forEach((t) => clearTimeout(t));
        this.timers.clear();
        return 'OK';
    }

    async publish(channel, message) {
        const handlers = this.subscribers.get(channel) || [];
        handlers.forEach((handler) => handler(channel, message));
        return handlers.length;
    }

    subscribe(channel, handler) {
        if (!this.subscribers.has(channel)) {
            this.subscribers.set(channel, []);
        }
        this.subscribers.get(channel).push(handler);
    }

    async quit() {
        this.store.clear();
        this.timers.forEach((t) => clearTimeout(t));
        this.timers.clear();
        return 'OK';
    }

    on() { return this; }
    once() { return this; }
    connect() { return Promise.resolve(); }

    pipeline() {
        const ops = [];
        const self = this;
        const pipelineProxy = {
            get(key) { ops.push(() => self.get(key)); return pipelineProxy; },
            set(...args) { ops.push(() => self.set(...args)); return pipelineProxy; },
            del(...keys) { ops.push(() => self.del(...keys)); return pipelineProxy; },
            async exec() {
                const results = [];
                for (const op of ops) {
                    try {
                        const result = await op();
                        results.push([null, result]);
                    } catch (err) {
                        results.push([err, null]);
                    }
                }
                return results;
            },
        };
        return pipelineProxy;
    }
}

// ─── Create Redis Clients ───────────────────────────────────────────────────
let redisClient = null;
let redisPubClient = null;
let redisSubClient = null;
let usingMemoryCache = false;

/**
 * Initialize Redis connections. Falls back to in-memory cache on failure.
 */
const initRedis = async () => {
    // Suppress error events to prevent unhandled error crashes
    const suppressErrors = (client) => {
        client.on('error', () => { /* handled via connect rejection */ });
    };

    try {
        // Force lazyConnect: true generally to handle manual connection flow
        const redisOptions = { lazyConnect: true };

        // Helper to create client with correct arguments
        const createClient = () => {
            if (typeof REDIS_CONFIG === 'string') {
                return new Redis(REDIS_CONFIG, redisOptions);
            }
            return new Redis({ ...REDIS_CONFIG, ...redisOptions });
        };

        redisClient = createClient();
        suppressErrors(redisClient);
        await redisClient.connect();
        await redisClient.ping();

        redisPubClient = createClient();
        suppressErrors(redisPubClient);
        await redisPubClient.connect();

        redisSubClient = createClient();
        suppressErrors(redisSubClient);
        await redisSubClient.connect();

        console.log('[Redis] Connected successfully');
        usingMemoryCache = false;
    } catch (err) {
        console.warn('[Redis] Connection failed, using in-memory cache:', err.message);
        // Quietly close any partially-created ioredis clients
        _quietQuit(redisClient);
        _quietQuit(redisPubClient);
        _quietQuit(redisSubClient);
        _fallbackToMemory();
    }
};

/**
 * Quietly close an ioredis client (ignore errors).
 * Used when falling back to in-memory cache after partial connection.
 */
const _quietQuit = (client) => {
    if (client && typeof client.quit === 'function' && !client.isMemoryFallback) {
        client.quit().catch(() => { });
    }
};

/**
 * Create in-memory fallback instances
 */
const _fallbackToMemory = () => {
    redisClient = new InMemoryCache();
    redisPubClient = new InMemoryCache();
    redisSubClient = new InMemoryCache();
    usingMemoryCache = true;
    // Link pub/sub for in-memory mode
    redisPubClient.subscribers = redisSubClient.subscribers;
};

/**
 * Get the main Redis/cache client.
 * Lazy-initializes to InMemoryCache if initRedis() hasn't been called yet
 * (e.g. during tests or when server starts without Redis).
 */
const getRedisClient = () => {
    if (!redisClient) {
        _fallbackToMemory();
    }
    return redisClient;
};

const getPubClient = () => {
    if (!redisPubClient) {
        _fallbackToMemory();
    }
    return redisPubClient;
};

const getSubClient = () => {
    if (!redisSubClient) {
        _fallbackToMemory();
    }
    return redisSubClient;
};

const isUsingMemoryCache = () => usingMemoryCache;

/**
 * Gracefully close all Redis connections
 */
const closeRedis = async () => {
    try {
        if (redisClient) await redisClient.quit();
        if (redisPubClient) await redisPubClient.quit();
        if (redisSubClient) await redisSubClient.quit();
        console.log('[Redis] Connections closed');
    } catch (err) {
        console.error('[Redis] Error closing:', err.message);
    }
};

module.exports = {
    initRedis,
    getRedisClient,
    getPubClient,
    getSubClient,
    isUsingMemoryCache,
    closeRedis,
    InMemoryCache,
};
