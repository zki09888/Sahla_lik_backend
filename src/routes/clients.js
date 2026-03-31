const express = require('express');
const router = express.Router();
const clientAuthController = require('../controllers/clientAuthController');
const { verifyToken, checkRole } = require('../middleware/auth');

// Client authentication routes
router.post('/register', clientAuthController.register);
router.post('/login', clientAuthController.login);
router.get('/me', verifyToken, checkRole('client'), clientAuthController.getProfile);
router.delete('/me', verifyToken, checkRole('client'), clientAuthController.deleteAccount);

module.exports = router;
