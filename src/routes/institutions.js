const express = require('express');
const router = express.Router();
const guichetController = require('../controllers/guichetController');
const ticketController = require('../controllers/ticketController');
const analyticsController = require('../controllers/analyticsController');
const { query } = require('../config/db');
const { verifyToken, checkRole } = require('../middleware/auth');

// Counters
router.get('/:institutionId/counters', guichetController.getGuichets);

router.post('/:institutionId/counters', verifyToken, checkRole('admin', 'guichet'), (req, res, next) => {
  req.params.id_agence = req.params.institutionId;
  guichetController.createGuichet(req, res);
});

router.patch('/:institutionId/counters/:counterId/status', verifyToken, checkRole('admin', 'guichet'), (req, res, next) => {
  req.params.id = req.params.counterId;
  guichetController.updateGuichetStatus(req, res);
});

router.delete('/:institutionId/counters/:counterId', verifyToken, checkRole('admin'), (req, res, next) => {
  req.params.id = req.params.counterId;
  guichetController.deleteGuichet(req, res);
});

// Queue
router.get('/:institutionId/queue', ticketController.getAgencyQueue);

router.post('/:institutionId/queue/issue', verifyToken, (req, res, next) => {
  req.body.id_agence = req.params.institutionId;
  ticketController.createTicket(req, res);
});

// Analytics
router.get('/:institutionId/analytics', analyticsController.getDailyStats);

router.get('/:institutionId/analytics/stats', analyticsController.getStats);

// Ratings
router.post('/:institutionId/ratings', verifyToken, analyticsController.submitRating);

// Notifications
router.post('/:institutionId/notify', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { id_agence } = req.params;
    const { titre, message, type = 'PUSH', recipients = [] } = req.body;
    const userId = req.user.id_user;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_MESSAGE',
        message: 'Message is required'
      });
    }

    // Get all users in this agency (guichets + admin)
    const guichetUsers = await query(
      `SELECT DISTINCT u.id_user, u.email, u.n_phone
       FROM users u
       JOIN guichets g ON u.id_user = g.id_user
       WHERE g.id_agence = ? AND u.actif = TRUE`,
      [id_agence]
    );

    // Create notifications for each user
    let sentCount = 0;
    for (const user of guichetUsers) {
      if (!recipients.length || recipients.includes(user.id_user)) {
        await query(
          'INSERT INTO notifications (id_user, type_notif, titre, message) VALUES (?, ?, ?, ?)',
          [user.id_user, type, titre || 'Notification', message]
        );
        sentCount++;
      }
    }

    res.json({
      success: true,
      data: { sent: sentCount },
      message: 'Notification sent successfully'
    });
  } catch (err) {
    console.error('Send notification error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
});

// Broadcast
router.post('/:institutionId/broadcast', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { id_agence } = req.params;
    const { titre, message, type = 'PUSH' } = req.body;
    const userId = req.user.id_user;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_MESSAGE',
        message: 'Message is required'
      });
    }

    await query(
      'INSERT INTO broadcasts (id_admin, id_agence, titre, message, type_broadcast, statut, date_envoi) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [userId, id_agence, titre || 'Broadcast', message.trim(), type, 'envoye']
    );

    res.json({
      success: true,
      message: 'Broadcast sent successfully'
    });
  } catch (err) {
    console.error('Send broadcast error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
});

module.exports = router;
