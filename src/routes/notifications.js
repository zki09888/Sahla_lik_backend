const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { verifyToken, checkRole } = require('../middleware/auth');

// Existing routes (unchanged)
router.post('/institution/:id', verifyToken, notificationController.sendInstitutionNotification);
router.get('/', verifyToken, notificationController.getNotifications);
router.get('/client', verifyToken, checkRole('client'), notificationController.getClientNotifications);
router.patch('/:id/read', verifyToken, notificationController.markNotificationRead);
router.get('/unread/count', verifyToken, notificationController.getUnreadCount);

// ================= FIXED ROUTE =================
router.get('/clients', async (req, res) => {
  try {
    const { query } = require('../config/db');

    const rawAgence = req.query.id_agence;
    const idAgence = rawAgence !== undefined && /^\d+$/.test(rawAgence.trim())
      ? parseInt(rawAgence.trim(), 10)
      : null;

    const rows = await query(`
      SELECT 
        t.id_ticket AS id,
        t.numero_ticket AS ticket,
        COALESCE(c.nom_complete, t.guest_name, 'Guest') AS name,
        COALESCE(o.phone_number, 'N/A') AS phone,
        ROW_NUMBER() OVER (ORDER BY t.numero_ticket ASC) AS position,
        5 AS avgServiceTime
      FROM tickets t
      LEFT JOIN clients c ON t.id_client = c.id_client
      LEFT JOIN off_sms o ON t.id_client = o.id_client
      WHERE t.status = 'attente'
        AND (? IS NULL OR t.id_agence = ?)
      ORDER BY t.numero_ticket ASC
    `, [idAgence, idAgence]);

    const data = rows.map(r => ({
      ...r,
      position: Number(r.position)
    }));

    res.json({ success: true, data: Array.isArray(data) ? data : [] });

  } catch (err) {
    console.error('GET /notifications/clients error:', err);
    res.status(500).json({ success: false, error: 'SERVER_ERROR', message: err.message });
  }
});

module.exports = router;