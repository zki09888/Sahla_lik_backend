const { query } = require('../config/db');

/**
 * GET ALL AGENCIES GROUPED BY ENTERPRISE
 * Returns agencies organized by their parent enterprise for multi-tenant UI
 */
async function getAllAgencies(req, res) {
  try {
    const { wilaya, commune, status, category, search } = req.query;

    let queryStr = `
      SELECT
        a.id_agence,
        a.nom_agence,
        a.adresse,
        a.wilaya,
        a.commune,
        a.latitude,
        a.longitude,
        a.status,
        a.rating,
        a.nb_ratings,
        e.id_enterprise,
        e.nom_entreprise,
        e.category,
        f.numero_ticket as current_ticket,
        f.nb_personnes_restantes as waiting_count
      FROM agences a
      JOIN enterprises e ON a.id_enterprise = e.id_enterprise
      LEFT JOIN files_attente f ON a.id_agence = f.id_agence AND DATE(f.date_creation) = CURDATE()
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

    queryStr += ' ORDER BY e.nom_entreprise ASC, a.nom_agence ASC LIMIT 500';

    const agencies = await query(queryStr, params);

    // GROUP BY ENTERPRISE - NORMALIZED BY NAME
    // Normalize: trim whitespace, convert to lowercase for consistent grouping
    const normalizeName = (name) => (name || '').toString().trim().toLowerCase();
    
    const enterpriseMap = new Map();

    for (const a of (agencies || [])) {
      // Use normalized name as key to group duplicates
      const normalizedKey = normalizeName(a.nom_entreprise);
      const entId = a.id_enterprise;
      
      // Try to find existing enterprise by normalized name first
      let existingEnterprise = null;
      for (const [key, value] of enterpriseMap.entries()) {
        if (normalizeName(value.nom_entreprise) === normalizedKey) {
          existingEnterprise = value;
          break;
        }
      }

      if (!existingEnterprise) {
        // Create new enterprise group
        enterpriseMap.set(normalizedKey, {
          id_enterprise: a.id_enterprise,
          nom_entreprise: a.nom_entreprise,  // Keep original case for display
          category: a.category,
          agencies: []
        });
        existingEnterprise = enterpriseMap.get(normalizedKey);
      }

      existingEnterprise.agencies.push({
        id: a.id_agence,
        id_agence: a.id_agence,
        nom: a.nom_agence,
        nom_agence: a.nom_agence,
        adresse: a.adresse,
        wilaya: a.wilaya,
        commune: a.commune,
        latitude: parseFloat(a.latitude) || 0,
        longitude: parseFloat(a.longitude) || 0,
        status: a.status,
        rating: parseFloat(a.rating) || 0,
        nb_ratings: a.nb_ratings || 0,
        queue: {
          currentTicket: a.current_ticket || 0,
          waitingCount: a.waiting_count || 0
        }
      });
    }

    // Convert map to array
    const groupedData = Array.from(enterpriseMap.values());

    res.json({
      success: true,
      data: groupedData,
      meta: {
        total_enterprises: groupedData.length,
        total_agencies: (agencies || []).length
      }
    });
  } catch (err) {
    console.error('Get all agencies error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * GET AGENCY BY ID
 */
async function getAgencyById(req, res) {
  try {
    const { id } = req.params;

    const agencies = await query(
      `SELECT a.*, e.*
       FROM agences a
       JOIN enterprises e ON a.id_enterprise = e.id_enterprise
       WHERE a.id_agence = ? AND a.actif = TRUE`,
      [id]
    );

    const agency = agencies[0];

    if (!agency) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Agency not found'
      });
    }

    // Get motifs for this agency
    const motifs = await query(
      'SELECT id_motif, nom_motif, description, temps_moyen_service FROM motifs WHERE id_agence = ?',
      [id]
    );

    // Get queue info
    const fileAttentes = await query(
      'SELECT numero_ticket, nb_personnes_restantes FROM files_attente WHERE id_agence = ? ORDER BY date_creation DESC LIMIT 1',
      [id]
    );
    const queueInfo = fileAttentes[0];

    // Get active counters count
    const activeCountersRows = await query(
      `SELECT COUNT(*) as count FROM guichets WHERE id_agence = ? AND status = 'actif'`,
      [id]
    );

    res.json({
      success: true,
      data: {
        id: agency.id_agence,
        id_agence: agency.id_agence,
        nom: agency.nom_agence,
        nom_agence: agency.nom_agence,
        adresse: agency.adresse,
        wilaya: agency.wilaya,
        commune: agency.commune,
        latitude: parseFloat(agency.latitude) || 0,
        longitude: parseFloat(agency.longitude) || 0,
        status: agency.status,
        rating: parseFloat(agency.rating) || 0,
        nb_ratings: agency.nb_ratings || 0,
        activeCounters: parseInt(activeCountersRows[0]?.count) || 0,
        enterprise: {
          id: agency.id_enterprise,
          nom: agency.nom_entreprise,
          category: agency.category
        },
        motifs: (motifs || []).map(m => ({
          id: m.id_motif,
          id_motif: m.id_motif,
          nom: m.nom_motif,
          nom_motif: m.nom_motif,
          description: m.description
        })),
        queue: {
          currentTicket: queueInfo ? queueInfo.numero_ticket : 0,
          waitingCount: queueInfo ? queueInfo.nb_personnes_restantes : 0
        },
        created_at: agency.date_creation
      }
    });
  } catch (err) {
    console.error('Get agency error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * GET AGENCY QUEUE
 * CRITICAL: MUST exclude cancelled, skipped, and completed tickets
 * Filter: status IN ('attente', 'en_cours') ONLY
 */
async function getAgencyQueue(req, res) {
  try {
    const { id } = req.params;

    const agencies = await query(
      'SELECT id_agence, nom_agence FROM agences WHERE id_agence = ? AND actif = TRUE',
      [id]
    );

    const agency = agencies[0];

    if (!agency) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Agency not found'
      });
    }

    // CRITICAL: Filter ONLY waiting and in-progress tickets
    // EXCLUDE: cancelled (annule), skipped, completed (termine)
    const tickets = await query(
      `SELECT t.*, m.nom_motif, c.nom_complete, g.nom as guichet_nom
       FROM tickets t
       LEFT JOIN motifs m ON t.id_motif = m.id_motif
       LEFT JOIN clients c ON t.id_client = c.id_client
       LEFT JOIN guichets g ON t.id_guichet = g.id_guichet
       WHERE t.id_agence = ?
         AND t.status IN ('attente', 'en_cours')
         AND DATE(t.heure_prise) = CURDATE()
       ORDER BY t.numero_ticket ASC`,
      [id]
    );

    // CRITICAL: Stats must also exclude cancelled tickets
    const statsRows = await query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'attente' THEN 1 ELSE 0 END) as waiting,
        SUM(CASE WHEN status = 'en_cours' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'annule' THEN 1 ELSE 0 END) as cancelled
       FROM tickets
       WHERE id_agence = ? AND DATE(heure_prise) = CURDATE()`,
      [id]
    );

    const stats = statsRows[0];

    res.json({
      success: true,
      data: {
        id_agence: agency.id_agence,
        nom_agence: agency.nom_agence,
        currentTime: new Date().toISOString(),
        stats: {
          total: parseInt(stats?.total) || 0,
          waiting: parseInt(stats?.waiting) || 0,
          in_progress: parseInt(stats?.in_progress) || 0,
          cancelled: parseInt(stats?.cancelled) || 0  // For debugging
        },
        tickets: (tickets || []).map(t => ({
          id_ticket: t.id_ticket,
          numero_ticket: t.numero_ticket,
          status: t.status,
          motif: t.nom_motif,
          clientName: t.nom_complete,
          guichet: t.guichet_nom,
          bookingTime: t.heure_prise,
          calledTime: t.heure_appel,
          estimated_wait: t.temps_attente_estime
        }))
      }
    });
  } catch (err) {
    console.error('[getAgencyQueue] Error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * GET AGENCY MOTIFS
 */
async function getAgencyMotifs(req, res) {
  try {
    const { id } = req.params;

    const motifs = await query(
      'SELECT id_motif, nom_motif, description, temps_moyen_service FROM motifs WHERE id_agence = ?',
      [id]
    );

    res.json({
      success: true,
      data: (motifs || []).map(m => ({
        id: m.id_motif,
        id_motif: m.id_motif,
        nom: m.nom_motif,
        nom_motif: m.nom_motif,
        description: m.description,
        temps_moyen_service: m.temps_moyen_service
      }))
    });
  } catch (err) {
    console.error('Get motifs error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

module.exports = {
  getAllAgencies,
  getAgencyById,
  getAgencyQueue,
  getAgencyMotifs,
  searchAgencies,
  getNearbyAgencies
};

/**
 * SEARCH AGENCIES - Search by query (nom_agence, commune, wilaya)
 * Uses normalized search (lowercase, trimmed)
 */
async function searchAgencies(req, res) {
  try {
    const { q, wilaya, commune } = req.query;

    let queryStr = `
      SELECT
        a.id_agence,
        a.nom_agence,
        a.adresse,
        a.wilaya,
        a.commune,
        a.latitude,
        a.longitude,
        a.status,
        a.rating,
        a.nb_ratings,
        e.id_enterprise,
        e.nom_entreprise,
        e.category,
        f.numero_ticket as current_ticket,
        f.nb_personnes_restantes as waiting_count
      FROM agences a
      JOIN enterprises e ON a.id_enterprise = e.id_enterprise
      LEFT JOIN files_attente f ON a.id_agence = f.id_agence AND DATE(f.date_creation) = CURDATE()
      WHERE a.actif = TRUE
    `;
    const params = [];

    // Search by query (normalized - lowercase, trimmed)
    if (q) {
      const normalizedQ = q.trim().toLowerCase();
      queryStr += ' AND (LOWER(a.nom_agence) LIKE ? OR LOWER(a.commune) LIKE ? OR LOWER(a.wilaya) LIKE ?)';
      const searchTerm = `%${normalizedQ}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Filter by wilaya (exact match)
    if (wilaya) {
      queryStr += ' AND LOWER(a.wilaya) = ?';
      params.push(wilaya.trim().toLowerCase());
    }

    // Filter by commune (exact match)
    if (commune) {
      queryStr += ' AND LOWER(a.commune) = ?';
      params.push(commune.trim().toLowerCase());
    }

    queryStr += ' ORDER BY a.nom_agence ASC LIMIT 500';

    const agencies = await query(queryStr, params);

    // GROUP BY ENTERPRISE - NORMALIZED BY NAME
    const normalizeName = (name) => (name || '').toString().trim().toLowerCase();

    const enterpriseMap = new Map();

    for (const a of (agencies || [])) {
      const normalizedKey = normalizeName(a.nom_entreprise);
      
      let existingEnterprise = null;
      for (const [key, value] of enterpriseMap.entries()) {
        if (normalizeName(value.nom_entreprise) === normalizedKey) {
          existingEnterprise = value;
          break;
        }
      }

      if (!existingEnterprise) {
        enterpriseMap.set(normalizedKey, {
          id_enterprise: a.id_enterprise,
          nom_entreprise: a.nom_entreprise,
          category: a.category,
          agencies: []
        });
        existingEnterprise = enterpriseMap.get(normalizedKey);
      }

      existingEnterprise.agencies.push({
        id: a.id_agence,
        id_agence: a.id_agence,
        nom: a.nom_agence,
        nom_agence: a.nom_agence,
        adresse: a.adresse,
        wilaya: a.wilaya,
        commune: a.commune,
        latitude: parseFloat(a.latitude) || 0,
        longitude: parseFloat(a.longitude) || 0,
        status: a.status,
        rating: parseFloat(a.rating) || 0,
        nb_ratings: a.nb_ratings || 0,
        queue: {
          currentTicket: a.current_ticket || 0,
          waitingCount: a.waiting_count || 0
        }
      });
    }

    const groupedData = Array.from(enterpriseMap.values());

    res.json({
      success: true,
      data: groupedData,
      meta: {
        total_results: groupedData.length,
        search_query: q || null
      }
    });
  } catch (err) {
    console.error('Search agencies error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * GET NEARBY AGENCIES - Get agencies near GPS coordinates
 * Uses Haversine formula for distance calculation
 */
async function getNearbyAgencies(req, res) {
  try {
    const { lat, lng, radius = 10 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_COORDS',
        message: 'Latitude and longitude are required'
      });
    }

    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    const searchRadius = parseFloat(radius);

    // Get all active agencies
    const agencies = await query(`
      SELECT
        a.id_agence,
        a.nom_agence,
        a.adresse,
        a.wilaya,
        a.commune,
        a.latitude,
        a.longitude,
        a.status,
        a.rating,
        a.nb_ratings,
        e.id_enterprise,
        e.nom_entreprise,
        e.category,
        f.numero_ticket as current_ticket,
        f.nb_personnes_restantes as waiting_count
      FROM agences a
      JOIN enterprises e ON a.id_enterprise = e.id_enterprise
      LEFT JOIN files_attente f ON a.id_agence = f.id_agence AND DATE(f.date_creation) = CURDATE()
      WHERE a.actif = TRUE
      ORDER BY a.nom_agence ASC
    `);

    // Filter by distance and calculate smart score
    const results = [];
    for (const a of (agencies || [])) {
      const agencyLat = parseFloat(a.latitude);
      const agencyLng = parseFloat(a.longitude);

      if (isNaN(agencyLat) || isNaN(agencyLng)) continue;

      // Calculate distance using Haversine formula
      const distance = _haversineDistance(userLat, userLng, agencyLat, agencyLng);

      // Only include if within radius
      if (distance <= searchRadius) {
        const waitingCount = a.waiting_count || 0;
        // Smart score: lower is better
        // score = (queue * 0.3) + (distance * 0.7)
        const smartScore = (waitingCount * 0.3) + (distance * 0.7);

        results.push({
          id: a.id_agence,
          id_agence: a.id_agence,
          nom: a.nom_agence,
          nom_agence: a.nom_agence,
          adresse: a.adresse,
          wilaya: a.wilaya,
          commune: a.commune,
          latitude: agencyLat,
          longitude: agencyLng,
          status: a.status,
          rating: parseFloat(a.rating) || 0,
          nb_ratings: a.nb_ratings || 0,
          distance_km: parseFloat(distance.toFixed(2)),
          queue: {
            currentTicket: a.current_ticket || 0,
            waitingCount: waitingCount
          },
          enterprise: {
            id_enterprise: a.id_enterprise,
            nom_entreprise: a.nom_entreprise,
            category: a.category
          },
          smart_score: parseFloat(smartScore.toFixed(2))
        });
      }
    }

    // Sort by smart score (lower is better)
    results.sort((a, b) => a.smart_score - b.smart_score);

    res.json({
      success: true,
      data: results,
      meta: {
        user_location: { lat: userLat, lng: userLng },
        radius_km: searchRadius,
        total_results: results.length
      }
    });
  } catch (err) {
    console.error('Get nearby agencies error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * Haversine formula to calculate distance between two coordinates
 * Returns distance in kilometers
 */
function _haversineDistance(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371; // km
  
  const dLat = _toRadians(lat2 - lat1);
  const dLon = _toRadians(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(_toRadians(lat1)) * Math.cos(_toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return earthRadius * c;
}

function _toRadians(degrees) {
  return degrees * (Math.PI / 180);
}
