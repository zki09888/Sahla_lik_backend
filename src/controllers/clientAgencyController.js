const { query } = require('../config/db');

/**
 * GET AGENCY INFO FOR CLIENT - Aggregated data ONLY
 * Returns:
 * - total_queue: COUNT of waiting tickets
 * - active_guichets: COUNT of active guichets
 * - estimated_wait_time: calculated by backend
 * 
 * DOES NOT expose:
 * - guichet IDs
 * - guichet names
 * - internal assignment logic
 */
async function getClientAgencyInfo(req, res) {
  try {
    const { id } = req.params;

    // Verify agency exists and is active
    const agences = await query(
      'SELECT id_agence, nom_agence, horaire_ouverture, horaire_fermeture, status FROM agences WHERE id_agence = ? AND actif = TRUE',
      [id]
    );

    if (!agences || agences.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'AGENCE_NOT_FOUND',
        message: 'Agency not found or inactive'
      });
    }

    const agence = agences[0];

    // Get total queue count (waiting tickets only)
    const queueResult = await query(
      'SELECT COUNT(*) as total_queue FROM tickets WHERE id_agence = ? AND status = "attente" AND DATE(heure_prise) = CURDATE()',
      [id]
    );
    const totalQueue = parseInt(queueResult[0]?.total_queue) || 0;

    // Get active guichets count
    const guichetsResult = await query(
      'SELECT COUNT(*) as active_guichets FROM guichets WHERE id_agence = ? AND status = "actif"',
      [id]
    );
    const activeGuichets = parseInt(guichetsResult[0]?.active_guichets) || 0;

    // Calculate estimated wait time on backend
    // Formula: avg_service_time * (total_queue / active_guichets)
    // If active_guichets = 0 → return -1
    let estimatedWaitTime = -1;
    
    if (activeGuichets > 0 && totalQueue > 0) {
      // Get average service time from motifs (default 15 min)
      const avgServiceResult = await query(
        'SELECT AVG(temps_moyen_service) as avg_time FROM motifs WHERE id_agence = ?',
        [id]
      );
      const avgServiceTime = parseFloat(avgServiceResult[0]?.avg_time) || 15;
      
      estimatedWaitTime = Math.floor(avgServiceTime * (totalQueue / activeGuichets));
    }

    res.json({
      success: true,
      data: {
        id_agence: agence.id_agence,
        nom_agence: agence.nom_agence,
        status: agence.status,
        total_queue: totalQueue,
        active_guichets: activeGuichets,
        estimated_wait_time: estimatedWaitTime,
        // Only return aggregated info - NO guichet details
      }
    });
  } catch (err) {
    console.error('Get client agency info error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * GET ALL AGENCIES INFO FOR CLIENT - Aggregated data ONLY
 * Same as above but for all agencies
 */
async function getAllAgenciesForClient(req, res) {
  try {
    const { wilaya, commune, status, category, search } = req.query;

    let queryStr = `
      SELECT
        a.id_agence,
        a.nom_agence,
        a.wilaya,
        a.commune,
        a.status,
        a.rating,
        a.nb_ratings,
        e.id_enterprise,
        e.nom_entreprise,
        e.category
      FROM agences a
      JOIN enterprises e ON a.id_enterprise = e.id_enterprise
      WHERE a.actif = TRUE
    `;
    const params = [];

    if (wilaya) {
      queryStr += ' AND a.wilaya = ?';
      params.push(wilaya);
    }

    if (commune) {
      queryStr += ' AND a.commune = ?';
      params.push(commune);
    }

    if (status) {
      queryStr += ' AND a.status = ?';
      params.push(status);
    }

    if (category) {
      queryStr += ' AND e.category = ?';
      params.push(category);
    }

    if (search) {
      queryStr += ' AND (a.nom_agence LIKE ? OR a.adresse LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }

    queryStr += ' ORDER BY a.nom_agence LIMIT 100';

    const agencies = await query(queryStr, params);

    if (!agencies || agencies.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }

    // OPTIMIZATION: Batch all agency data in single queries instead of N+1
    const agencyIds = agencies.map(a => a.id_agence);
    const placeholders = agencyIds.map(() => '?').join(',');

    // Get all queue counts in one query
    const queueCounts = await query(
      `SELECT id_agence, COUNT(*) as total_queue 
       FROM tickets 
       WHERE id_agence IN (${placeholders}) 
         AND status = 'attente' 
         AND DATE(heure_prise) = CURDATE()
       GROUP BY id_agence`,
      agencyIds
    );

    // Get all active guichet counts in one query
    const guichetCounts = await query(
      `SELECT id_agence, COUNT(*) as active_guichets 
       FROM guichets 
       WHERE id_agence IN (${placeholders}) 
         AND status = 'actif'
       GROUP BY id_agence`,
      agencyIds
    );

    // Get all average service times in one query
    const avgServiceTimes = await query(
      `SELECT id_agence, AVG(temps_moyen_service) as avg_time 
       FROM motifs 
       WHERE id_agence IN (${placeholders})
       GROUP BY id_agence`,
      agencyIds
    );

    // Create lookup maps for O(1) access
    const queueMap = new Map(queueCounts.map(r => [r.id_agence, parseInt(r.total_queue) || 0]));
    const guichetMap = new Map(guichetCounts.map(r => [r.id_agence, parseInt(r.active_guichets) || 0]));
    const serviceMap = new Map(avgServiceTimes.map(r => [r.id_agence, parseFloat(r.avg_time) || 15]));

    // Build response with pre-fetched data
    const agenciesWithInfo = agencies.map(a => {
      const totalQueue = queueMap.get(a.id_agence) || 0;
      const activeGuichets = guichetMap.get(a.id_agence) || 0;
      
      let estimatedWaitTime = -1;
      if (activeGuichets > 0 && totalQueue > 0) {
        const avgServiceTime = serviceMap.get(a.id_agence) || 15;
        estimatedWaitTime = Math.floor(avgServiceTime * (totalQueue / activeGuichets));
      }

      return {
        id_agence: a.id_agence,
        nom_agence: a.nom_agence,
        wilaya: a.wilaya,
        commune: a.commune,
        status: a.status,
        rating: parseFloat(a.rating) || 0,
        nb_ratings: a.nb_ratings || 0,
        enterprise: {
          id: a.id_enterprise,
          nom: a.nom_entreprise,
          category: a.category
        },
        queue_info: {
          total_queue: totalQueue,
          active_guichets: activeGuichets,
          estimated_wait_time: estimatedWaitTime
        }
      };
    });

    res.json({
      success: true,
      data: agenciesWithInfo
    });
  } catch (err) {
    console.error('Get all agencies for client error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

module.exports = {
  getClientAgencyInfo,
  getAllAgenciesForClient
};
