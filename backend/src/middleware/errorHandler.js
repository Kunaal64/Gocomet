/**
 * Centralized Error Handling Middleware
 * 
 * Catches all unhandled errors and returns consistent JSON responses.
 * Logs errors for debugging while hiding internal details from clients.
 */

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        error: `Route ${req.method} ${req.originalUrl} not found`,
    });
};

/**
 * Global error handler
 */
const errorHandler = (err, req, res, _next) => {
    console.error('[Error]', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        url: req.originalUrl,
        method: req.method,
    });

    // Database connection errors
    if (err.code === 'ECONNREFUSED') {
        return res.status(503).json({
            success: false,
            error: 'Database service unavailable',
        });
    }

    // Database foreign-key constraint violations
    if (err.code === '23503') {
        return res.status(404).json({
            success: false,
            error: 'Referenced user does not exist',
        });
    }

    // Database unique constraint violations (e.g. duplicate leaderboard entry)
    if (err.code === '23505') {
        return res.status(409).json({
            success: false,
            error: 'Duplicate entry — this record already exists',
        });
    }

    // Default error response
    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message,
    });
};

module.exports = { notFoundHandler, errorHandler };
