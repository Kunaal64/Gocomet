/**
 * Leaderboard API - Unit & Integration Tests
 * 
 * Tests all three main API endpoints:
 * - POST /api/leaderboard/submit
 * - GET /api/leaderboard/top
 * - GET /api/leaderboard/rank/{user_id}
 */

const request = require('supertest');

// ─── Mock pg module ─────────────────────────────────────────────────────────
jest.mock('pg', () => {
    const mockClient = {
        query: jest.fn(),
        release: jest.fn(),
    };

    const mockPool = {
        query: jest.fn(),
        connect: jest.fn().mockResolvedValue(mockClient),
        on: jest.fn(),
        end: jest.fn().mockResolvedValue(undefined),
        _mockClient: mockClient,
    };

    return { Pool: jest.fn(() => mockPool), _mockPool: mockPool };
});

// ─── Mock websocket module ──────────────────────────────────────────────────
jest.mock('../src/config/websocket', () => ({
    initWebSocket: jest.fn(),
    closeWebSocket: jest.fn().mockResolvedValue(undefined),
    publishUpdate: jest.fn().mockResolvedValue(undefined),
    broadcastToClients: jest.fn(),
    getClientCount: jest.fn().mockReturnValue(0),
}));

// ─── Mock Redis module directly ─────────────────────────────────────────────
jest.mock('../src/config/redis', () => {
    const mockRedis = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        keys: jest.fn().mockResolvedValue([]),
        pipeline: jest.fn().mockReturnValue({
            del: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue([]),
        }),
    };
    return {
        getRedisClient: jest.fn().mockReturnValue(mockRedis),
        closeRedis: jest.fn().mockResolvedValue(undefined),
        initRedis: jest.fn().mockResolvedValue(undefined),
        isUsingMemoryCache: jest.fn().mockReturnValue(true),
        _mockRedis: mockRedis,
    };
});

// ─── Mock ioredis (for any direct imports) ──────────────────────────────────
jest.mock('ioredis', () => {
    return jest.fn().mockImplementation(() => ({
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn().mockResolvedValue(1),
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockResolvedValue(undefined),
        publish: jest.fn().mockResolvedValue(1),
        quit: jest.fn().mockResolvedValue('OK'),
    }));
});

// ─── Get mock references ────────────────────────────────────────────────────
const { _mockPool: mockPool } = require('pg');
const mockClient = mockPool._mockClient;

// Import app AFTER mocks
const { app } = require('../src/app');

// ─── Test Data ──────────────────────────────────────────────────────────────
const mockTopPlayers = {
    rows: [
        { user_id: 1, username: 'user_1', total_score: 9500, rank: 1, games_played: '15' },
        { user_id: 5, username: 'user_5', total_score: 8800, rank: 2, games_played: '12' },
        { user_id: 3, username: 'user_3', total_score: 8200, rank: 3, games_played: '18' },
        { user_id: 7, username: 'user_7', total_score: 7600, rank: 4, games_played: '10' },
        { user_id: 2, username: 'user_2', total_score: 7100, rank: 5, games_played: '14' },
    ],
};

const mockPlayerRank = {
    rows: [{ user_id: 42, username: 'user_42', total_score: 5200, rank: '156', total_players: '1000' }],
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Leaderboard API', () => {
    beforeEach(() => {
        // Reset only call history, NOT implementations
        mockPool.query.mockClear();
        mockClient.query.mockClear();
        mockClient.release.mockClear();
        mockPool.connect.mockClear();
        // Re-set connect to return mockClient
        mockPool.connect.mockResolvedValue(mockClient);
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // Health Check
    // ═══════════════════════════════════════════════════════════════════════════
    describe('GET /api/health', () => {
        it('should return 200 with health status', async () => {
            const res = await request(app).get('/api/health');

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
            expect(res.body).toHaveProperty('uptime');
            expect(res.body).toHaveProperty('timestamp');
            expect(res.body).toHaveProperty('cache');
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // POST /api/leaderboard/submit
    // ═══════════════════════════════════════════════════════════════════════════
    describe('POST /api/leaderboard/submit', () => {
        it('should accept valid score submission', async () => {
            mockClient.query
                .mockResolvedValueOnce()  // BEGIN
                .mockResolvedValueOnce({ rows: [{ id: 1, score: 500, game_mode: 'team', timestamp: new Date() }] })
                .mockResolvedValueOnce({ rows: [{ user_id: 1, total_score: 3500 }] })
                .mockResolvedValueOnce();  // COMMIT

            const res = await request(app)
                .post('/api/leaderboard/submit')
                .send({ user_id: 1, score: 500 });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('session_id');
            expect(res.body.data).toHaveProperty('user_id', 1);
            expect(res.body.data).toHaveProperty('score', 500);
            expect(res.body.data).toHaveProperty('total_score');
        });

        it('should reject missing user_id', async () => {
            const res = await request(app)
                .post('/api/leaderboard/submit')
                .send({ score: 500 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('user_id');
        });

        it('should reject missing score', async () => {
            const res = await request(app)
                .post('/api/leaderboard/submit')
                .send({ user_id: 1 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('score');
        });

        it('should reject negative user_id', async () => {
            const res = await request(app)
                .post('/api/leaderboard/submit')
                .send({ user_id: -5, score: 500 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('should reject non-numeric user_id', async () => {
            const res = await request(app)
                .post('/api/leaderboard/submit')
                .send({ user_id: 'abc', score: 500 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('should reject negative score', async () => {
            const res = await request(app)
                .post('/api/leaderboard/submit')
                .send({ user_id: 1, score: -100 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('should reject excessively large score', async () => {
            const res = await request(app)
                .post('/api/leaderboard/submit')
                .send({ user_id: 1, score: 9999999 });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('maximum');
        });

        it('should rollback on database error', async () => {
            mockClient.query
                .mockResolvedValueOnce()  // BEGIN
                .mockRejectedValueOnce(new Error('DB Error'));

            const res = await request(app)
                .post('/api/leaderboard/submit')
                .send({ user_id: 1, score: 500 });

            expect(res.status).toBe(500);
            expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
            expect(mockClient.release).toHaveBeenCalled();
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // GET /api/leaderboard/top
    // ═══════════════════════════════════════════════════════════════════════════
    describe('GET /api/leaderboard/top', () => {
        it('should return top players from database', async () => {
            mockPool.query.mockResolvedValueOnce(mockTopPlayers);

            const res = await request(app).get('/api/leaderboard/top');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data)).toBe(true);
            expect(res.body.data.length).toBeLessThanOrEqual(10);

            for (let i = 1; i < res.body.data.length; i++) {
                expect(res.body.data[i - 1].total_score).toBeGreaterThanOrEqual(
                    res.body.data[i].total_score
                );
            }
        });

        it('should include required fields in response', async () => {
            mockPool.query.mockResolvedValueOnce(mockTopPlayers);

            const res = await request(app).get('/api/leaderboard/top');

            const player = res.body.data[0];
            expect(player).toHaveProperty('rank');
            expect(player).toHaveProperty('user_id');
            expect(player).toHaveProperty('username');
            expect(player).toHaveProperty('total_score');
            expect(player).toHaveProperty('games_played');
        });

        it('should handle empty leaderboard', async () => {
            mockPool.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app).get('/api/leaderboard/top');

            expect(res.status).toBe(200);
            expect(res.body.data).toEqual([]);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // GET /api/leaderboard/rank/:user_id
    // ═══════════════════════════════════════════════════════════════════════════
    describe('GET /api/leaderboard/rank/:user_id', () => {
        it('should return rank for valid user', async () => {
            mockPool.query.mockResolvedValueOnce(mockPlayerRank);

            const res = await request(app).get('/api/leaderboard/rank/42');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('user_id', 42);
            expect(res.body.data).toHaveProperty('username');
            expect(res.body.data).toHaveProperty('total_score');
            expect(res.body.data).toHaveProperty('rank');
            expect(res.body.data).toHaveProperty('total_players');
        });

        it('should return 404 for non-existent user', async () => {
            mockPool.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app).get('/api/leaderboard/rank/9999999');

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });

        it('should reject invalid user_id format', async () => {
            const res = await request(app).get('/api/leaderboard/rank/abc');

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('user_id');
        });

        it('should reject negative user_id', async () => {
            const res = await request(app).get('/api/leaderboard/rank/-1');

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('should reject zero user_id', async () => {
            const res = await request(app).get('/api/leaderboard/rank/0');

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // 404 Handler
    // ═══════════════════════════════════════════════════════════════════════════
    describe('404 Handler', () => {
        it('should return 404 for unknown routes', async () => {
            const res = await request(app).get('/api/unknown');

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('not found');
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // Input Validation Edge Cases
    // ═══════════════════════════════════════════════════════════════════════════
    describe('Input Validation', () => {
        it('should handle empty request body', async () => {
            const res = await request(app)
                .post('/api/leaderboard/submit')
                .send({});

            expect(res.status).toBe(400);
        });

        it('should handle score of 0', async () => {
            mockClient.query
                .mockResolvedValueOnce()
                .mockResolvedValueOnce({ rows: [{ id: 1, score: 0, game_mode: 'team', timestamp: new Date() }] })
                .mockResolvedValueOnce({ rows: [{ user_id: 1, total_score: 0 }] })
                .mockResolvedValueOnce();

            const res = await request(app)
                .post('/api/leaderboard/submit')
                .send({ user_id: 1, score: 0 });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });

        it('should handle maximum valid score', async () => {
            mockClient.query
                .mockResolvedValueOnce()
                .mockResolvedValueOnce({ rows: [{ id: 1, score: 1000000, game_mode: 'solo', timestamp: new Date() }] })
                .mockResolvedValueOnce({ rows: [{ user_id: 1, total_score: 1000000 }] })
                .mockResolvedValueOnce();

            const res = await request(app)
                .post('/api/leaderboard/submit')
                .send({ user_id: 1, score: 1000000 });

            expect(res.status).toBe(201);
            expect(res.body.success).toBe(true);
        });
    });
});
