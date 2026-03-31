const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');

// Login endpoints
router.post('/login', authController.login);
router.post('/login/admin', authController.adminLogin);
router.post('/login/guichet', authController.guichetLogin);
router.post('/login/client', authController.clientLogin);

// Signup endpoints
router.post('/signup/admin', authController.adminSignup);
router.post('/signup/client', authController.clientSignup);
router.post('/signup/guest', authController.guestSignup);  // Guest session

// User profile
router.get('/me', verifyToken, authController.getMe);

// OTP endpoints
router.post('/otp/send', authController.sendOtp);
router.post('/otp/verify', authController.verifyOtp);

// Password reset
router.post('/password-reset', authController.resetPassword);

// Account deletion (admin only)
router.delete('/admin/delete-account', verifyToken, authController.deleteAdminAccount);

module.exports = router;
