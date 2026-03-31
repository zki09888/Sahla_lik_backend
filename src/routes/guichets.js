const express = require('express');
const router = express.Router();
const guichetController = require('../controllers/guichetController');
const { verifyToken, checkRole } = require('../middleware/auth');

router.get('/agence/:id_agence', guichetController.getGuichets);
router.get('/:id', guichetController.getGuichet);
router.post('/agence/:id_agence', verifyToken, checkRole('admin', 'guichet'), guichetController.createGuichet);
router.patch('/:id/status', verifyToken, checkRole('admin', 'guichet'), guichetController.updateGuichetStatus);
router.delete('/:id', verifyToken, checkRole('admin'), guichetController.deleteGuichet);
router.get('/:id/stats', guichetController.getGuichetStats);

module.exports = router;
