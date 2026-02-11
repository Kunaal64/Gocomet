/**
 * Leaderboard API Routes
 * 
 * Defines all route handlers for the leaderboard API.
 * Applies appropriate middleware (validation, rate limiting) per route.
 */

const express = require('express');
const router = express.Router();

const leaderboardController = require('../controllers/leaderboard.controller');
const { validateSubmitScore, validateUserId } = require('../middleware/validator');
const { submitLimiter, readLimiter } = require('../middleware/rateLimiter');

// ─── Score Submission ───────────────────────────────────────────────────────
// POST /api/leaderboard/submit
router.post(
    '/submit',
    submitLimiter,
    validateSubmitScore,
    leaderboardController.submitScore
);

// ─── Top Players ────────────────────────────────────────────────────────────
// GET /api/leaderboard/top
router.get(
    '/top',
    readLimiter,
    leaderboardController.getTopPlayers
);

// ─── Player Rank ────────────────────────────────────────────────────────────
// GET /api/leaderboard/rank/:user_id
router.get(
    '/rank/:user_id',
    readLimiter,
    validateUserId,
    leaderboardController.getPlayerRank
);

// ─── Admin: Recalculate Ranks ───────────────────────────────────────────────
// POST /api/leaderboard/recalculate
router.post(
    '/recalculate',
    submitLimiter,
    leaderboardController.recalculateRanks
);

module.exports = router;
