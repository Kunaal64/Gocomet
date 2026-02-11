/**
 * Rate Limiting Middleware
 * 
 * Protects APIs from abuse by limiting request frequency per IP.
 * Different limits for write (submit) vs read (top/rank) endpoints.
 */

const rateLimit = require('express-rate-limit');

// Stricter limit for score submissions (write operations)
const submitLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    message: {
        success: false,
        error: 'Too many score submissions. Please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
});

// More relaxed limit for read operations
const readLimiter = rateLimit({
    windowMs: 60000,
    max: 200,
    message: {
        success: false,
        error: 'Too many requests. Please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
});

module.exports = { submitLimiter, readLimiter };
