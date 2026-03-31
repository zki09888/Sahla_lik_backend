const express = require('express');
const router = express.Router();
const rapportController = require('../controllers/rapportController');
const { verifyToken, checkRole } = require('../middleware/auth');

// Get all rapports (admin only, or guichet for their agency)
router.get('/', verifyToken, rapportController.getRapports);

// Get single rapport by ID
router.get('/:id', verifyToken, rapportController.getRapportById);

// Create new rapport (guichet sends to admin)
router.post('/', verifyToken, checkRole('guichet', 'admin'), rapportController.createRapport);

// Delete rapport (admin only)
router.delete('/:id', verifyToken, checkRole('admin'), rapportController.deleteRapport);

module.exports = router;
