const express = require('express');
const router = express.Router();
const ratingsController = require('../controllers/ratingsController');
const { verifyToken, checkRole } = require('../middleware/auth');

// Submit ratings (client only)
router.post('/service', verifyToken, checkRole('client'), ratingsController.submitServiceRating);
router.post('/app', verifyToken, checkRole('client'), ratingsController.submitAppRating);

// Get my ratings (client only)
router.get('/service/my', verifyToken, checkRole('client'), ratingsController.getMyServiceRatings);
router.get('/app/my', verifyToken, checkRole('client'), ratingsController.getMyAppRatings);

module.exports = router;
