const { query } = require('../config/db');

/**
 * GET ALL ENTERPRISES
 */
async function getAllEnterprises(req, res) {
  try {
    const enterprises = await query(
      `SELECT e.*,
              COUNT(DISTINCT a.id_agence) as agency_count,
              COUNT(DISTINCT g.id_guichet) as guichet_count
       FROM enterprises e
       LEFT JOIN agences a ON e.id_enterprise = a.id_enterprise AND a.actif = TRUE
       LEFT JOIN guichets g ON e.id_enterprise = g.id_enterprise AND g.status = 'actif'
       WHERE e.actif = TRUE
       GROUP BY e.id_enterprise
       ORDER BY e.nom_entreprise`
    );

    res.json({
      success: true,
      data: (enterprises || []).map(e => ({
        id: e.id_enterprise,
        id_enterprise: e.id_enterprise,
        nom_entreprise: e.nom_entreprise,
        category: e.category,
        stats: {
          agency_count: parseInt(e.agency_count) || 0,
          guichet_count: parseInt(e.guichet_count) || 0
        },
        date_creation: e.date_creation
      }))
    });
  } catch (err) {
    console.error('Get enterprises error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * GET ENTERPRISE BY ID
 */
async function getEnterpriseById(req, res) {
  try {
    const { id } = req.params;

    const enterprises = await query(
      `SELECT e.*,
              COUNT(DISTINCT a.id_agence) as agency_count,
              COUNT(DISTINCT g.id_guichet) as guichet_count
       FROM enterprises e
       LEFT JOIN agences a ON e.id_enterprise = a.id_enterprise AND a.actif = TRUE
       LEFT JOIN guichets g ON e.id_enterprise = g.id_enterprise
       WHERE e.id_enterprise = ? AND e.actif = TRUE
       GROUP BY e.id_enterprise`,
      [id]
    );

    const enterprise = enterprises[0];

    if (!enterprise) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Enterprise not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: enterprise.id_enterprise,
        id_enterprise: enterprise.id_enterprise,
        nom_entreprise: enterprise.nom_entreprise,
        category: enterprise.category,
        stats: {
          agency_count: parseInt(enterprise.agency_count) || 0,
          guichet_count: parseInt(enterprise.guichet_count) || 0
        },
        date_creation: enterprise.date_creation
      }
    });
  } catch (err) {
    console.error('Get enterprise error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * GET ENTERPRISE AGENCIES
 */
async function getEnterpriseAgencies(req, res) {
  try {
    const { id } = req.params;
    const { wilaya, status } = req.query;

    let queryStr = `
      SELECT a.*,
             COUNT(DISTINCT g.id_guichet) as guichet_count,
             COALESCE(s.total_queue, 0) as total_queue,
             COALESCE(s.active_counters, 0) as active_counters
      FROM agences a
      LEFT JOIN guichets g ON a.id_agence = g.id_agence AND g.status = 'actif'
      LEFT JOIN statistiques s ON a.id_agence = s.id_agence AND s.date_stat = CURDATE()
      WHERE a.id_enterprise = ? AND a.actif = TRUE
    `;
    const params = [id];

    if (wilaya) {
      queryStr += ' AND a.wilaya = ?';
      params.push(wilaya);
    }

    if (status) {
      queryStr += ' AND a.status = ?';
      params.push(status);
    }

    queryStr += ' GROUP BY a.id_agence ORDER BY a.nom_agence';

    const agencies = await query(queryStr, params);

    res.json({
      success: true,
      data: (agencies || []).map(a => ({
        id: a.id_agence,
        id_agence: a.id_agence,
        nom_agence: a.nom_agence,
        adresse: a.adresse,
        wilaya: a.wilaya,
        commune: a.commune,
        telephone: a.telephone,
        latitude: parseFloat(a.latitude) || 0,
        longitude: parseFloat(a.longitude) || 0,
        status: a.status,
        horaire_ouverture: a.horaire_ouverture,
        horaire_fermeture: a.horaire_fermeture,
        stats: {
          guichet_count: parseInt(a.guichet_count) || 0,
          total_queue: parseInt(a.total_queue) || 0,
          active_counters: parseInt(a.active_counters) || 0
        },
        date_creation: a.date_creation
      }))
    });
  } catch (err) {
    console.error('Get enterprise agencies error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * GET CATEGORIES
 */
async function getCategories(req, res) {
  try {
    const categories = await query(
      'SELECT DISTINCT category, COUNT(*) as count FROM enterprises WHERE actif = TRUE GROUP BY category ORDER BY category'
    );

    res.json({
      success: true,
      data: (categories || []).map(c => ({
        name: c.category,
        count: parseInt(c.count)
      }))
    });
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * GET MOTIFS BY ENTERPRISE
 */
async function getMotifs(req, res) {
  try {
    const { id_agence } = req.query;

    let queryStr = 'SELECT * FROM motifs WHERE 1=1';
    const params = [];

    if (id_agence) {
      queryStr += ' AND id_agence = ?';
      params.push(id_agence);
    }

    queryStr += ' ORDER BY nom_motif';

    const motifs = await query(queryStr, params);

    res.json({
      success: true,
      data: (motifs || []).map(m => ({
        id: m.id_motif,
        id_motif: m.id_motif,
        id_agence: m.id_agence,
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
  getAllEnterprises,
  getEnterpriseById,
  getEnterpriseAgencies,
  getCategories,
  getMotifs
};
