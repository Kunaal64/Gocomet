/**
 * WebSocket Server Configuration
 * 
 * Handles real-time leaderboard updates via WebSocket connections.
 * Subscribes to Redis pub/sub channel for cross-process communication.
 * Supports auto-reconnect and heartbeat for connection health.
 */

const { WebSocketServer } = require('ws');
const { getSubClient, getPubClient } = require('./redis');

let wss = null;
const CHANNEL = 'leaderboard:updates';

/**
 * Initialize WebSocket server on existing HTTP server
 * @param {object} server - HTTP server instance
 */
const initWebSocket = (server) => {
    wss = new WebSocketServer({ server, path: '/ws' });

    wss.on('connection', (ws, req) => {
        const clientIp = req.socket.remoteAddress;
        console.log(`[WS] Client connected from ${clientIp}`);

        ws.send(JSON.stringify({
            type: 'connected',
            message: 'Connected to leaderboard live updates',
            timestamp: new Date().toISOString(),
        }));

        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        ws.on('close', () => {
            console.log(`[WS] Client disconnected from ${clientIp}`);
        });

        ws.on('error', (err) => {
            console.error('[WS] Client error:', err.message);
        });
    });

    // Heartbeat interval — close dead connections every 30s
    const heartbeatInterval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) {
                return ws.terminate();
            }
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(heartbeatInterval);
    });

    // Subscribe to Redis pub/sub for leaderboard updates
    _subscribeToUpdates();

    console.log('[WS] WebSocket server initialized on /ws');
};

/**
 * Subscribe to leaderboard update channel.
 * Safe to call even if Redis is not initialized (uses lazy-init fallback).
 */
const _subscribeToUpdates = () => {
    const subClient = getSubClient();
    if (!subClient) return;

    if (subClient.isMemoryFallback) {
        subClient.subscribe(CHANNEL, (_channel, message) => {
            _broadcastToClients(message);
        });
    } else {
        subClient.subscribe(CHANNEL);
        subClient.on('message', (_channel, message) => {
            _broadcastToClients(message);
        });
    }
};

/**
 * Broadcast message to all connected WebSocket clients
 * @param {string} message - JSON stringified message
 */
const _broadcastToClients = (message) => {
    if (!wss) return;

    let sent = 0;
    wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(message);
            sent++;
        }
    });

    if (sent > 0) {
        console.log(`[WS] Broadcasted update to ${sent} clients`);
    }
};

/**
 * Publish a leaderboard update event.
 * Safe to call even if Redis is not initialized.
 * @param {object} data - Update data to broadcast
 */
const publishUpdate = async (data) => {
    const pubClient = getPubClient();
    if (!pubClient) return;

    const message = JSON.stringify({
        type: 'leaderboard_update',
        data,
        timestamp: new Date().toISOString(),
    });
    await pubClient.publish(CHANNEL, message);
};

/**
 * Get count of connected clients
 */
const getClientCount = () => {
    return wss ? wss.clients.size : 0;
};

/**
 * Close WebSocket server
 */
const closeWebSocket = () => {
    if (wss) {
        wss.close();
        console.log('[WS] Server closed');
    }
};

module.exports = {
    initWebSocket,
    publishUpdate,
    getClientCount,
    closeWebSocket,
};
