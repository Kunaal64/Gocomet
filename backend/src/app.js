/**
 * Gaming Leaderboard - Main Application Entry Point
 * 
 * Initializes Express server with all middleware, routes, database,
 * cache, and WebSocket connections. Includes graceful shutdown handling.
 */

require('dotenv').config();

// Load New Relic agent first (must be before all other requires)
try {
    if (process.env.NEW_RELIC_LICENSE_KEY && process.env.NEW_RELIC_LICENSE_KEY !== 'YOUR_NEW_RELIC_LICENSE_KEY') {
        require('newrelic');
        console.log('[NewRelic] Agent loaded');
    }
} catch (err) {
    console.warn('[NewRelic] Could not load agent:', err.message);
}

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

// Config
const { testConnection, closePool } = require('./config/db');
const { initRedis, closeRedis, isUsingMemoryCache } = require('./config/redis');
const { initWebSocket, closeWebSocket, getClientCount } = require('./config/websocket');

// Routes
const leaderboardRoutes = require('./routes/leaderboard.routes');

// Middleware
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

// ─── App Setup ──────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const PORT = parseInt(process.env.PORT, 10) || 8000;

// Track interval for cleanup during graceful shutdown
let rankRecalcInterval = null;

// ─── Security & Performance Middleware ──────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP request logging (skip in test)
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

// ─── Serve Frontend Static Files (React build output) ───────────────────────
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// ─── Health Check ───────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        cache: isUsingMemoryCache() ? 'in-memory' : 'redis',
        websocket_clients: getClientCount(),
    });
});

// ─── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/leaderboard', leaderboardRoutes);

// ─── Error Handling ─────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ─── Startup ────────────────────────────────────────────────────────────────
const startServer = async () => {
    console.log('═══════════════════════════════════════════════');
    console.log('  Gaming Leaderboard System - Starting Up...');
    console.log('═══════════════════════════════════════════════');

    // 1. Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
        console.warn('[Startup] PostgreSQL not available - some features may not work');
        console.warn('[Startup] Run migrations first: npm run migrate');
    }

    // 2. Initialize Redis/cache
    await initRedis();
    console.log(`[Cache] Using ${isUsingMemoryCache() ? 'in-memory' : 'Redis'} cache`);

    // 3. Start HTTP + WebSocket server
    server.listen(PORT, () => {
        console.log('═══════════════════════════════════════════════');
        console.log(`  Server running on http://localhost:${PORT}`);
        console.log(`  API Base: http://localhost:${PORT}/api/leaderboard`);
        console.log(`  WebSocket: ws://localhost:${PORT}/ws`);
        console.log(`  Frontend: http://localhost:${PORT}`);
        console.log('═══════════════════════════════════════════════');
    });

    // 4. Initialize WebSocket
    initWebSocket(server);

    // 5. Schedule periodic rank recalculation (every 5 minutes)
    const { recalculateRanks } = require('./services/leaderboard.service');
    rankRecalcInterval = setInterval(async () => {
        try {
            const updated = await recalculateRanks();
            if (updated > 0) {
                console.log(`[Scheduler] Recalculated ${updated} ranks`);
            }
        } catch (err) {
            console.error('[Scheduler] Rank recalculation error:', err.message);
        }
    }, 5 * 60 * 1000);
};

// ─── Graceful Shutdown ──────────────────────────────────────────────────────
const gracefulShutdown = async (signal) => {
    console.log(`\n[Shutdown] Received ${signal}. Shutting down gracefully...`);

    // Clear scheduled intervals
    if (rankRecalcInterval) {
        clearInterval(rankRecalcInterval);
        rankRecalcInterval = null;
    }

    // Close WebSocket connections
    closeWebSocket();

    // Close server (stop accepting new connections)
    server.close(() => {
        console.log('[Shutdown] HTTP server closed');
    });

    // Close Redis connections
    await closeRedis();

    // Close database pool
    await closePool();

    console.log('[Shutdown] All connections closed. Exiting.');
    process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
    console.error('[UnhandledRejection]', reason);
});

// ─── Start ──────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
    startServer();
}

module.exports = { app, server, startServer };
