const express = require('express');
const router = express.Router();
const clientAgencyController = require('../controllers/clientAgencyController');

// Client agency info routes (aggregated data only)
router.get('/', clientAgencyController.getAllAgenciesForClient);
router.get('/:id', clientAgencyController.getClientAgencyInfo);

module.exports = router;
