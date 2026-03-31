const { query } = require('../config/db');

/**
 * Validate ticket booking conditions:
 * 1. At least one active guichet exists
 * 2. Current time is within agence working hours
 *
 * Must be used BEFORE inserting ticket
 */
async function validateTicketBooking(req, res, next) {
  try {
    const { id_agence } = req.body;

    if (!id_agence) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_AGENCE',
        message: 'Agency ID is required'
      });
    }

    // Verify agency exists and is active
    const agences = await query(
      'SELECT * FROM agences WHERE id_agence = ? AND actif = TRUE',
      [id_agence]
    );

    if (!agences || agences.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'AGENCE_NOT_FOUND',
        message: 'Agency not found or inactive'
      });
    }

    const agence = agences[0];

    // Check 1: Verify at least one active guichet
    const activeGuichets = await query(
      'SELECT COUNT(*) as count FROM guichets WHERE id_agence = ? AND status = "actif"',
      [id_agence]
    );

    const activeCount = activeGuichets[0]?.count || 0;

    if (activeCount === 0) {
      return res.status(400).json({
        success: false,
        error: 'NO_ACTIVE_GUICHETS',
        message: 'No active guichets available. Please try later.'
      });
    }

    // Check 2: Verify current time is within working hours
    // Algeria is UTC+1 — always fixed offset, no DST
    const now = new Date();
    const algeriaOffset = 60; // minutes
    const localNow = new Date(now.getTime() + algeriaOffset * 60 * 1000);
    const serverTime = localNow.toISOString().slice(11, 19); // HH:MM:SS format in UTC+1
    // Working hours are REQUIRED - no fallback defaults
    const openingTime = agence.horaire_ouverture;
    const closingTime = agence.horaire_fermeture;

    // Check if outside working hours
    if (serverTime < openingTime || serverTime > closingTime) {
      return res.status(400).json({
        success: false,
        error: 'OUTSIDE_WORKING_HOURS',
        message: `Booking is not allowed outside working hours (${openingTime} - ${closingTime}).`
      });
    }

    // Check 3: Verify not during lunch break (pause times are auto-calculated)
    const pauseDebut = agence.heure_pause_debut;
    const pauseFin = agence.heure_pause_fin;

    if (pauseDebut && pauseFin) {
      if (serverTime >= pauseDebut && serverTime <= pauseFin) {
        return res.status(400).json({
          success: false,
          error: 'DURING_PAUSE_HOURS',
          message: `Booking is not allowed during break time (${pauseDebut} - ${pauseFin}).`
        });
      }
    }

    // All validations passed
    req.agence = agence;
    req.activeGuichetsCount = activeCount;
    next();
  } catch (err) {
    console.error('Ticket booking validation error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred during booking validation'
    });
  }
}

module.exports = {
  validateTicketBooking
};
