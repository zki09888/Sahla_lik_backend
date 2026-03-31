const express = require('express');
const router = express.Router();
const offSmsController = require('../controllers/offSmsController');
const { verifyToken, checkRole } = require('../middleware/auth');

// Save/Update SMS settings (client only)
router.post('/', verifyToken, checkRole('client'), offSmsController.saveOffSms);

// Get SMS settings (client only)
router.get('/', verifyToken, checkRole('client'), offSmsController.getOffSms);

module.exports = router;
