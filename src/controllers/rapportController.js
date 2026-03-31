const { query } = require('../config/db');

/**
 * GET ALL RAPPORTS - SECURITY FIX: Enforce agency isolation
 * CRITICAL: Each agency can ONLY see its own rapports
 */
async function getRapports(req, res) {
  try {
    const { id_agence, id_guichet, date_from, date_to } = req.query;
    
    // SECURITY: Get agency ID from authenticated user (admin/guichet token)
    const userAgenceId = req.user?.id_agence;
    const userGuichetId = req.user?.id_guichet;
    const userRole = req.user?.role;

    // SECURITY: Determine which agency ID to use
    // Priority: 1) User's agency from token, 2) Query param (only if admin)
    let finalAgenceId = null;

    if (userRole === 'admin' && userAgenceId) {
      // Admin can only see their own agency's rapports
      finalAgenceId = userAgenceId;
    } else if (userRole === 'guichet' && userAgenceId) {
      // Guichet can only see their own agency's rapports
      finalAgenceId = userAgenceId;
    } else if (id_agence && userRole === 'superadmin') {
      // Only superadmin can specify arbitrary agency (if implemented)
      finalAgenceId = id_agence;
    } else {
      // Default to user's agency
      finalAgenceId = userAgenceId;
    }

    // SECURITY: CRITICAL - Always enforce agency isolation
    if (!finalAgenceId) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Agency ID required. Please log in again.'
      });
    }

    let queryStr = `
      SELECT r.*, g.nom as guichet_nom, a.nom_agence
       FROM rapports r
       JOIN guichets g ON r.id_guichet = g.id_guichet
       JOIN agences a ON r.id_agence = a.id_agence
       WHERE r.id_agence = ?
    `;
    const params = [finalAgenceId];

    // Additional filters (within agency scope only)
    if (id_guichet) {
      // Verify guichet belongs to user's agency
      const [guichetCheck] = await query(
        'SELECT id_guichet FROM guichets WHERE id_guichet = ? AND id_agence = ?',
        [id_guichet, finalAgenceId]
      );
      
      if (!guichetCheck || guichetCheck.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Access denied. This guichet does not belong to your agency.'
        });
      }
      
      queryStr += ' AND r.id_guichet = ?';
      params.push(id_guichet);
    }

    if (date_from) {
      queryStr += ' AND r.date_rapport >= ?';
      params.push(date_from);
    }

    if (date_to) {
      queryStr += ' AND r.date_rapport <= ?';
      params.push(date_to);
    }

    queryStr += ' ORDER BY r.date_creation DESC LIMIT 100';

    const rapports = await query(queryStr, params);

    res.json({
      success: true,
      data: (rapports || []).map(r => ({
        id_rapport: r.id_rapport,
        id_guichet: r.id_guichet,
        id_agence: r.id_agence,
        date_rapport: r.date_rapport,
        nombre_clients: r.nombre_clients,
        nombre_tickets: r.nombre_tickets,
        temps_moyen_service: r.temps_moyen_service,
        observations: r.observations,
        date_creation: r.date_creation,
        guichet: {
          id: r.id_guichet,
          nom: r.guichet_nom
        },
        agence: {
          id: r.id_agence,
          nom: r.nom_agence
        }
      })),
      meta: {
        total: rapports?.length || 0,
        agency_id: finalAgenceId
      }
    });
  } catch (err) {
    console.error('Get rapports error:', err.message, err.stack);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred while fetching rapports'
    });
  }
}

/**
 * GET RAPPORT BY ID
 */
async function getRapportById(req, res) {
  try {
    const { id } = req.params;

    const rapports = await query(
      `SELECT r.*, g.nom as guichet_nom, a.nom_agence
       FROM rapports r
       JOIN guichets g ON r.id_guichet = g.id_guichet
       JOIN agences a ON r.id_agence = a.id_agence
       WHERE r.id_rapport = ?`,
      [id]
    );

    const rapport = rapports[0];

    if (!rapport) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Rapport not found'
      });
    }

    res.json({
      success: true,
      data: {
        id_rapport: rapport.id_rapport,
        id_guichet: rapport.id_guichet,
        id_agence: rapport.id_agence,
        date_rapport: rapport.date_rapport,
        nombre_clients: rapport.nombre_clients,
        nombre_tickets: rapport.nombre_tickets,
        temps_moyen_service: rapport.temps_moyen_service,
        observations: rapport.observations,
        date_creation: rapport.date_creation,
        guichet: {
          id: rapport.id_guichet,
          nom: rapport.guichet_nom
        },
        agence: {
          id: rapport.id_agence,
          nom: rapport.nom_agence
        }
      }
    });
  } catch (err) {
    console.error('Get rapport by id error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * CREATE RAPPORT - Guichet submits daily report
 */
async function createRapport(req, res) {
  try {
    const { id_guichet, id_agence, observations, nombre_clients, nombre_tickets, temps_moyen_service } = req.body;
    const idGuichetFromToken = req.user?.id_guichet;

    const guichetId = id_guichet || idGuichetFromToken;

    if (!guichetId || !id_agence) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Guichet ID and Agency ID are required'
      });
    }

    // Verify guichet exists and belongs to agency
    const guichets = await query(
      'SELECT id_guichet FROM guichets WHERE id_guichet = ? AND id_agence = ?',
      [guichetId, id_agence]
    );

    if (!guichets || guichets.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'GUICHET_NOT_FOUND',
        message: 'Guichet not found in this agency'
      });
    }

    const result = await query(
      `INSERT INTO rapports (id_guichet, id_agence, date_rapport, observations, nombre_clients, nombre_tickets, temps_moyen_service)
       VALUES (?, ?, CURDATE(), ?, ?, ?, ?)`,
      [guichetId, id_agence, observations || null, nombre_clients || 0, nombre_tickets || 0, temps_moyen_service || null]
    );

    const newRapport = await query('SELECT * FROM rapports WHERE id_rapport = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      data: newRapport[0],
      message: 'Rapport created successfully'
    });
  } catch (err) {
    console.error('Create rapport error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * DELETE RAPPORT
 */
async function deleteRapport(req, res) {
  try {
    const { id } = req.params;

    const rapports = await query('SELECT id_rapport FROM rapports WHERE id_rapport = ?', [id]);

    if (!rapports || rapports.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Rapport not found'
      });
    }

    await query('DELETE FROM rapports WHERE id_rapport = ?', [id]);

    res.json({
      success: true,
      message: 'Rapport deleted successfully'
    });
  } catch (err) {
    console.error('Delete rapport error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

module.exports = {
  getRapports,
  getRapportById,
  createRapport,
  deleteRapport
};
