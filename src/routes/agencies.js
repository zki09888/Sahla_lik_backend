const express = require('express');
const router = express.Router();
const agencyController = require('../controllers/agencyController');
const { optionalAuth } = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db'); // uses the existing db pool

// ─── Existing routes (unchanged) ──────────────────────────────────────────────

router.get('/', optionalAuth, agencyController.getAllAgencies);
router.get('/motifs', agencyController.getAgencyMotifs);

// NEW: Search endpoint with normalized query
router.get('/search', optionalAuth, agencyController.searchAgencies);

// NEW: Nearby endpoint with GPS coordinates
router.get('/nearby', optionalAuth, agencyController.getNearbyAgencies);

router.get('/:id', optionalAuth, agencyController.getAgencyById);
router.get('/:id/queue', optionalAuth, agencyController.getAgencyQueue);
router.get('/:id/motifs', optionalAuth, agencyController.getAgencyMotifs);

// ─── Password Reset endpoints ──────────────────────────────────────────────────

// POST /api/v1/agences/check-email
// Called by ForgotPassword.jsx — checks if email exists in agences table
router.post('/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const [rows] = await pool.query(
      'SELECT id_agence, nom_agence FROM agences WHERE email = ? AND actif = 1 LIMIT 1',
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No active agency found with this email.' });
    }

    return res.json({ success: true, message: 'Agency found', agence: rows[0].nom_agence });
  } catch (err) {
    console.error('[check-email]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/v1/agences/reset-password
// Called by ResetPassword.html — hashes and updates motpass in agences table
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    // Check agency exists and is active
    const [rows] = await pool.query(
      'SELECT id_agence FROM agences WHERE email = ? AND actif = 1 LIMIT 1',
      [email.trim().toLowerCase()]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Agency not found' });
    }

    // Hash new password using bcryptjs (same as rest of project)
    const hashed = await bcrypt.hash(newPassword, 10);

    // Update motpass in agences table
    await pool.query(
      'UPDATE agences SET motpass = ? WHERE email = ?',
      [hashed, email.trim().toLowerCase()]
    );

    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    console.error('[reset-password]', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
