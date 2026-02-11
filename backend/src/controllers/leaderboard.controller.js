/**
 * Leaderboard Controller
 * 
 * Handles HTTP request/response for leaderboard API endpoints.
 * Delegates business logic to the service layer.
 */

const leaderboardService = require('../services/leaderboard.service');

/**
 * POST /api/leaderboard/submit
 * Submit a new score for a user
 */
const submitScore = async (req, res, next) => {
    try {
        const { userId, score } = req.validatedData;
        const result = await leaderboardService.submitScore(userId, score);

        res.status(201).json(result);
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/leaderboard/top
 * Get top 10 players by total score
 */
const getTopPlayers = async (req, res, next) => {
    try {
        const result = await leaderboardService.getTopPlayers();
        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/leaderboard/rank/:user_id
 * Get a specific player's rank
 */
const getPlayerRank = async (req, res, next) => {
    try {
        const userId = req.validatedUserId;
        const result = await leaderboardService.getPlayerRank(userId);

        if (!result.success) {
            return res.status(404).json(result);
        }

        res.status(200).json(result);
    } catch (err) {
        next(err);
    }
};

/**
 * POST /api/leaderboard/recalculate
 * Trigger batch rank recalculation (admin endpoint)
 */
const recalculateRanks = async (req, res, next) => {
    try {
        const updatedCount = await leaderboardService.recalculateRanks();
        res.status(200).json({
            success: true,
            message: `Ranks recalculated. ${updatedCount} entries updated.`,
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    submitScore,
    getTopPlayers,
    getPlayerRank,
    recalculateRanks,
};
