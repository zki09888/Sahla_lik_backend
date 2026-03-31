const { query, transaction } = require('../config/db');

/**
 * SUBMIT SERVICE RATING - Rate a guichet service
 * POST /api/v1/ratings/service
 */
async function submitServiceRating(req, res) {
  try {
    const { id_ticket, rating, tags, commentaire } = req.body;
    const idClient = req.user?.id_client;

    // Validation
    if (!id_ticket || !rating) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Ticket ID and rating are required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_RATING',
        message: 'Rating must be between 1 and 5'
      });
    }

    // Verify ticket exists and belongs to client
    const tickets = await query(
      'SELECT t.*, t.id_guichet FROM tickets t WHERE t.id_ticket = ?',
      [id_ticket]
    );

    if (!tickets || tickets.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'TICKET_NOT_FOUND',
        message: 'Ticket not found'
      });
    }

    const ticket = tickets[0];

    // Only the ticket owner can rate (if client is authenticated)
    if (idClient && ticket.id_client && ticket.id_client !== idClient) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'You can only rate your own tickets'
      });
    }

    // Check if already rated
    const existingRatings = await query(
      'SELECT id_rating FROM service_ratings WHERE id_ticket = ?',
      [id_ticket]
    );

    if (existingRatings && existingRatings.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'ALREADY_RATED',
        message: 'You have already rated this service'
      });
    }

    // Insert rating
    const [result] = await query(
      'INSERT INTO service_ratings (id_ticket, id_guichet, rating, tags, commentaire) VALUES (?, ?, ?, ?, ?)',
      [id_ticket, ticket.id_guichet || null, rating, tags ? JSON.stringify(tags) : null, commentaire || null]
    );

    // Trigger will update agence rating automatically

    res.status(201).json({
      success: true,
      data: {
        id_rating: result.insertId,
        id_ticket,
        rating,
        message: 'Thank you for your feedback!'
      }
    });
  } catch (err) {
    console.error('Submit service rating error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred while submitting your rating'
    });
  }
}

/**
 * SUBMIT APP RATING - Rate the mobile app
 * POST /api/v1/ratings/app
 */
async function submitAppRating(req, res) {
  try {
    const { rating, commentaire } = req.body;
    const idClient = req.user?.id_client;

    // Validation
    if (!rating) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_RATING',
        message: 'Rating is required'
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_RATING',
        message: 'Rating must be between 1 and 5'
      });
    }

    if (!idClient) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    // Check if client already rated
    const existingRatings = await query(
      'SELECT id_app_rating FROM app_ratings WHERE id_client = ?',
      [idClient]
    );

    if (existingRatings && existingRatings.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'ALREADY_RATED',
        message: 'You have already rated the app'
      });
    }

    // Get client's ticket count before rating
    const clients = await query(
      'SELECT nombre_tickets FROM clients WHERE id_client = ?',
      [idClient]
    );
    const nombreTickets = clients[0]?.nombre_tickets || 0;

    // Insert app rating
    const [result] = await query(
      'INSERT INTO app_ratings (id_client, rating, commentaire, nombre_tickets_avant_eval) VALUES (?, ?, ?, ?)',
      [idClient, rating, commentaire || null, nombreTickets]
    );

    res.status(201).json({
      success: true,
      data: {
        id_app_rating: result.insertId,
        rating,
        message: 'Thank you for rating our app!'
      }
    });
  } catch (err) {
    console.error('Submit app rating error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred while submitting your rating'
    });
  }
}

/**
 * GET MY SERVICE RATINGS - Get client's submitted service ratings
 * GET /api/v1/ratings/service/my
 */
async function getMyServiceRatings(req, res) {
  try {
    const idClient = req.user?.id_client;

    if (!idClient) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const ratings = await query(
      `SELECT sr.*, t.numero_ticket, a.nom_agence
       FROM service_ratings sr
       JOIN tickets t ON sr.id_ticket = t.id_ticket
       JOIN agences a ON t.id_agence = a.id_agence
       WHERE t.id_client = ?
       ORDER BY sr.date_creation DESC
       LIMIT 50`,
      [idClient]
    );

    res.json({
      success: true,
      data: (ratings || []).map(r => ({
        id_rating: r.id_rating,
        id_ticket: r.id_ticket,
        numero_ticket: r.numero_ticket,
        agence: r.nom_agence,
        rating: r.rating,
        tags: r.tags ? JSON.parse(r.tags) : null,
        commentaire: r.commentaire,
        date_creation: r.date_creation
      }))
    });
  } catch (err) {
    console.error('Get my service ratings error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * GET MY APP RATINGS - Get client's submitted app ratings
 * GET /api/v1/ratings/app/my
 */
async function getMyAppRatings(req, res) {
  try {
    const idClient = req.user?.id_client;

    if (!idClient) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const ratings = await query(
      `SELECT * FROM app_ratings WHERE id_client = ? ORDER BY date_creation DESC`,
      [idClient]
    );

    res.json({
      success: true,
      data: (ratings || []).map(r => ({
        id_app_rating: r.id_app_rating,
        rating: r.rating,
        commentaire: r.commentaire,
        nombre_tickets_avant_eval: r.nombre_tickets_avant_eval,
        date_creation: r.date_creation
      }))
    });
  } catch (err) {
    console.error('Get my app ratings error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

module.exports = {
  submitServiceRating,
  submitAppRating,
  getMyServiceRatings,
  getMyAppRatings
};
