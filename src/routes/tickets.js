const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const agencyController = require('../controllers/agencyController');
const { verifyToken, optionalAuth, checkRole } = require('../middleware/auth');
const { validateTicketBooking } = require('../middleware/bookingValidation');

// Client ticket routes
router.post('/', optionalAuth, validateTicketBooking, ticketController.createTicket);
router.get('/mine', verifyToken, checkRole('client'), ticketController.getMyTickets);
router.get('/:id', optionalAuth, ticketController.getTicketById);
router.patch('/:id/cancel', verifyToken, checkRole('client'), ticketController.cancelTicket);

// NEW: Get ticket queue position endpoint
router.get('/:id/position', optionalAuth, ticketController.getTicketPosition);

// Guichet/Admin ticket routes
router.post('/call-next', verifyToken, checkRole('guichet', 'admin'), ticketController.callNextTicket);
router.post('/call/:id', verifyToken, checkRole('guichet', 'admin'), ticketController.callSpecificTicket);
router.patch('/:id/serve', verifyToken, checkRole('guichet', 'admin'), ticketController.serveTicket);
router.patch('/:id/skip', verifyToken, checkRole('guichet', 'admin'), ticketController.skipTicket);

// FIX: Add /queues/:id_agence endpoint for Flutter compatibility
// Returns queue stats in exact format Flutter expects
router.get('/queues/:id_agence', optionalAuth, ticketController.getQueueByAgency);

module.exports = router;
