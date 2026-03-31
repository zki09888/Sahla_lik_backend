const express = require('express');
const router = express.Router();
const enterpriseController = require('../controllers/enterpriseController');
const { optionalAuth } = require('../middleware/auth');

router.get('/', optionalAuth, enterpriseController.getAllEnterprises);
router.get('/categories', enterpriseController.getCategories);
router.get('/motifs', enterpriseController.getMotifs);
router.get('/:id', optionalAuth, enterpriseController.getEnterpriseById);
router.get('/:id/agencies', optionalAuth, enterpriseController.getEnterpriseAgencies);
router.get('/:id/agences', optionalAuth, enterpriseController.getEnterpriseAgencies); // French alias

module.exports = router;
