const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { verifyToken, optionalAuth, checkRole } = require('../middleware/auth');

// Stats routes - require authentication (admin or guichet)
router.get('/daily', verifyToken, checkRole('admin', 'guichet'), analyticsController.getDailyStats);
router.get('/stats', verifyToken, checkRole('admin', 'guichet'), analyticsController.getStats);
router.get('/monthly', verifyToken, checkRole('admin', 'guichet'), analyticsController.getMonthlyStats);
router.get('/weekly', verifyToken, checkRole('admin', 'guichet'), analyticsController.getWeeklyStats);
router.get('/insights', verifyToken, checkRole('admin', 'guichet'), analyticsController.getInsights);

// Ratings - client can submit, anyone can view (with optional auth)
router.post('/ratings', verifyToken, checkRole('client'), analyticsController.submitRating);
router.get('/ratings/:id', optionalAuth, analyticsController.getAgencyRatings);

module.exports = router;
