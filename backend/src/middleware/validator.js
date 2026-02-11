/**
 * Input Validation Middleware
 * 
 * Validates and sanitizes input for leaderboard API endpoints.
 * Prevents SQL injection, invalid data, and malformed requests.
 */

/**
 * Validate score submission request body
 */
const validateSubmitScore = (req, res, next) => {
    const { user_id, score } = req.body;

    // user_id validation
    if (user_id === undefined || user_id === null) {
        return res.status(400).json({
            success: false,
            error: 'user_id is required',
        });
    }

    const userId = parseInt(user_id, 10);
    if (isNaN(userId) || userId <= 0) {
        return res.status(400).json({
            success: false,
            error: 'user_id must be a positive integer',
        });
    }

    // score validation
    if (score === undefined || score === null) {
        return res.status(400).json({
            success: false,
            error: 'score is required',
        });
    }

    const scoreVal = parseInt(score, 10);
    if (isNaN(scoreVal) || scoreVal < 0) {
        return res.status(400).json({
            success: false,
            error: 'score must be a non-negative integer',
        });
    }

    if (scoreVal > 1000000) {
        return res.status(400).json({
            success: false,
            error: 'score exceeds maximum allowed value (1,000,000)',
        });
    }

    // Sanitize and attach parsed values
    req.validatedData = {
        userId,
        score: scoreVal,
    };

    next();
};

/**
 * Validate user_id path parameter
 */
const validateUserId = (req, res, next) => {
    const { user_id } = req.params;

    const userId = parseInt(user_id, 10);
    if (isNaN(userId) || userId <= 0) {
        return res.status(400).json({
            success: false,
            error: 'user_id must be a positive integer',
        });
    }

    req.validatedUserId = userId;
    next();
};

module.exports = { validateSubmitScore, validateUserId };
