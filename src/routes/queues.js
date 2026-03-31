const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const { optionalAuth } = require('../middleware/auth');

/**
 * GET /api/v1/queues/:id_agence
 * Returns queue stats for Flutter app
 */
router.get('/:id_agence', optionalAuth, ticketController.getQueueByAgency);

module.exports = router;
