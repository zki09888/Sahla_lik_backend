const bcrypt = require('bcryptjs');
const { query, transaction } = require('../config/db');

/**
 * GET ALL GUICHETS FOR AN AGENCE
 * CRITICAL: Enforce agency isolation - guichets are bound to their agency
 */
async function getGuichets(req, res) {
  try {
    const { id_agence } = req.params;

    if (!id_agence) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_AGENCE',
        message: 'Agency ID is required'
      });
    }

    // SECURITY: Verify user has access to this agency
    const userAgenceId = req.user?.id_agence;
    const userRole = req.user?.role;

    if (userRole !== 'superadmin' && userAgenceId && userAgenceId !== parseInt(id_agence)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Access denied. You can only view guichets for your own agency.'
      });
    }

    const guichets = await query(
      `SELECT g.*,
              e.nom_entreprise,
              a.nom_agence,
              a.horaire_ouverture as agency_opening,
              a.horaire_fermeture as agency_closing,
              a.heure_ouv_matin,
              a.heure_ferm_matin,
              a.heure_ouv_soir,
              a.heure_ferm_soir
       FROM guichets g
       JOIN enterprises e ON g.id_enterprise = e.id_enterprise
       JOIN agences a ON g.id_agence = a.id_agence
       WHERE g.id_agence = ?
       ORDER BY g.nom ASC`,
      [id_agence]
    );

    // OPTIMIZATION: Get queue stats once for the agency instead of per guichet
    const queueStats = await query(
      `SELECT COUNT(*) as waiting_count
       FROM tickets
       WHERE id_agence = ? AND status = 'attente' AND DATE(heure_prise) = CURDATE()`,
      [id_agence]
    );
    const waitingCount = queueStats[0]?.waiting_count || 0;

    // Attach the same stats to all guichets (they share the agency queue)
    const guichetsWithStats = (guichets || []).map(g => ({
      ...g,
      stats: {
        tickets_served: g.stats?.tickets_served || 0,
        waiting_count: waitingCount
      }
    }));

    res.json({
      success: true,
      data: (guichetsWithStats || []).map(g => ({
        id: g.id_guichet,
        id_guichet: g.id_guichet,
        id_enterprise: g.id_enterprise,
        id_agence: g.id_agence,
        nom: g.nom,
        email: g.email,
        category_guichet: g.category_guichet,
        status: g.status,
        nom_entreprise: g.nom_entreprise,
        nom_agence: g.nom_agence,
        // Shift times - inherit from agency (guichets don't have independent shifts)
        shift_matin: `${g.heure_ouv_matin || g.agency_opening || '08:00'} - ${g.heure_ferm_matin || '12:00'}`,
        shift_soir: `${g.heure_ouv_soir || '14:00'} - ${g.heure_ferm_soir || g.agency_closing || '17:00'}`,
        agency_schedule: {
          opening: g.agency_opening,
          closing: g.agency_closing,
          morning: { start: g.heure_ouv_matin, end: g.heure_ferm_matin },
          afternoon: { start: g.heure_ouv_soir, end: g.heure_ferm_soir }
        },
        date_creation: g.date_creation
      }))
    });
  } catch (err) {
    console.error('Get guichets error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * GET SINGLE GUICHET
 * CRITICAL: Enforce agency isolation - verify user has access to this guichet's agency
 */
async function getGuichet(req, res) {
  try {
    const { id } = req.params;

    // SECURITY: Get user context
    const userAgenceId = req.user?.id_agence;
    const userGuichetId = req.user?.id_guichet;
    const userRole = req.user?.role;

    const guichets = await query(
      `SELECT g.*,
              e.nom_entreprise,
              a.nom_agence,
              a.horaire_ouverture as agency_opening,
              a.horaire_fermeture as agency_closing,
              a.heure_ouv_matin,
              a.heure_ferm_matin,
              a.heure_ouv_soir,
              a.heure_ferm_soir
       FROM guichets g
       JOIN enterprises e ON g.id_enterprise = e.id_enterprise
       JOIN agences a ON g.id_agence = a.id_agence
       WHERE g.id_guichet = ?`,
      [id]
    );

    const guichet = guichets[0];

    if (!guichet) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Guichet not found'
      });
    }

    // SECURITY: Verify user has access to this guichet
    // - Superadmin can access all
    // - Admin can only access their own agency's guichets
    // - Guichet can only access their own guichet
    if (userRole === 'guichet' && userGuichetId !== parseInt(id)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Access denied. You can only view your own guichet.'
      });
    }

    if (userRole === 'admin' && userAgenceId !== guichet.id_agence) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Access denied. This guichet does not belong to your agency.'
      });
    }

    res.json({
      success: true,
      data: {
        id: guichet.id_guichet,
        id_guichet: guichet.id_guichet,
        id_enterprise: guichet.id_enterprise,
        id_agence: guichet.id_agence,
        nom: guichet.nom,
        email: guichet.email,
        category_guichet: guichet.category_guichet,
        status: guichet.status,
        nom_entreprise: guichet.nom_entreprise,
        nom_agence: guichet.nom_agence,
        // Shift times - inherit from agency (guichets don't have independent shifts)
        shift_matin: `${guichet.heure_ouv_matin || guichet.agency_opening || '08:00'} - ${guichet.heure_ferm_matin || '12:00'}`,
        shift_soir: `${guichet.heure_ouv_soir || '14:00'} - ${guichet.heure_ferm_soir || guichet.agency_closing || '17:00'}`,
        agency_schedule: {
          opening: guichet.agency_opening,
          closing: guichet.agency_closing,
          morning: { start: guichet.heure_ouv_matin, end: guichet.heure_ferm_matin },
          afternoon: { start: guichet.heure_ouv_soir, end: guichet.heure_ferm_soir }
        },
        date_creation: guichet.date_creation
      }
    });
  } catch (err) {
    console.error('Get guichet error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * CREATE GUICHET - Admin creates guichet
 * Saves directly to guichets table with email + motpass
 */
async function createGuichet(req, res) {
  try {
    const { nom, email, motpass, category_guichet } = req.body;
    const id_agence = req.params.id_agence;

    if (!nom || !email || !motpass || !id_agence) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Nom, email, password, category and agency are required'
      });
    }

    if (motpass.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PASSWORD',
        message: 'Password must be at least 6 characters'
      });
    }

    // Verify agency exists
    const agences = await query(
      'SELECT id_agence, id_enterprise FROM agences WHERE id_agence = ? AND actif = TRUE',
      [id_agence]
    );

    if (!agences || agences.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'AGENCE_NOT_FOUND',
        message: 'Agency not found'
      });
    }

    const agence = agences[0];

    // Check if email already exists
    const existing = await query('SELECT id_guichet FROM guichets WHERE email = ?', [email.toLowerCase()]);
    if (existing && existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'EMAIL_EXISTS',
        message: 'Email already exists'
      });
    }

    const hashedPassword = await bcrypt.hash(motpass, 12);

    const result = await query(
      `INSERT INTO guichets (id_enterprise, id_agence, nom, email, motpass, category_guichet, status)
       VALUES (?, ?, ?, ?, ?, ?, 'actif')`,
      [agence.id_enterprise, id_agence, nom, email.toLowerCase(), hashedPassword, category_guichet || 'Standard']
    );

    const newGuichet = await query('SELECT * FROM guichets WHERE id_guichet = ?', [result.insertId]);

    res.status(201).json({
      success: true,
      data: {
        id: newGuichet[0].id_guichet,
        id_guichet: newGuichet[0].id_guichet,
        id_enterprise: newGuichet[0].id_enterprise,
        id_agence: newGuichet[0].id_agence,
        nom: newGuichet[0].nom,
        email: newGuichet[0].email,
        category_guichet: newGuichet[0].category_guichet,
        status: newGuichet[0].status
      },
      message: 'Guichet created successfully'
    });
  } catch (err) {
    console.error('Create guichet error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * UPDATE GUICHET STATUS
 */
async function updateGuichetStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['actif', 'pause', 'hors_service'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STATUS',
        message: 'Status must be: actif, pause, or hors_service'
      });
    }

    const guichets = await query('SELECT id_guichet FROM guichets WHERE id_guichet = ?', [id]);

    if (!guichets || guichets.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Guichet not found'
      });
    }

    await query('UPDATE guichets SET status = ? WHERE id_guichet = ?', [status, id]);

    res.json({
      success: true,
      data: {
        id: parseInt(id),
        status: status
      }
    });
  } catch (err) {
    console.error('Update guichet status error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * DELETE GUICHET - Admin deletes a guichet account
 * Handles cascading deletes for related data safely
 */
async function deleteGuichet(req, res) {
  try {
    const { id } = req.params;
    const adminId = req.user?.id_agence;

    // Verify admin is authenticated
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Admin authentication required'
      });
    }

    // Verify guichet exists and belongs to admin's agency
    const guichets = await query(
      'SELECT id_guichet, id_agence, nom FROM guichets WHERE id_guichet = ?',
      [id]
    );

    if (!guichets || guichets.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Guichet not found'
      });
    }

    const guichet = guichets[0];

    // Verify admin has permission to delete this guichet (must be from same agency)
    if (guichet.id_agence !== adminId) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'You can only delete guichets from your own agency'
      });
    }

    // Check for active tickets (waiting or in progress)
    const activeTickets = await query(
      "SELECT COUNT(*) as count FROM tickets WHERE id_guichet = ? AND status IN ('attente', 'en_cours')",
      [id]
    );

    if (activeTickets[0].count > 0) {
      return res.status(400).json({
        success: false,
        error: 'HAS_ACTIVE_TICKETS',
        message: `Cannot delete: ${activeTickets[0].count} active ticket(s) still in queue. Please clear or reassign tickets first.`
      });
    }

    // Use transaction to ensure all related data is cleaned up properly
    const result = await transaction(async (connection) => {
      // Step 1: Clear guichet assignment from active tickets (SET NULL behavior)
      await connection.execute(
        'UPDATE tickets SET id_guichet = NULL WHERE id_guichet = ?',
        [id]
      );

      // Step 2: Clear guichet from files_attente (queue files)
      await connection.execute(
        'UPDATE files_attente SET id_guichet = NULL WHERE id_guichet = ?',
        [id]
      );

      // Step 3: Delete notifications sent to this guichet
      await connection.execute(
        'DELETE FROM notifications WHERE id_guichet = ?',
        [id]
      );

      // Step 4: Delete absence logs (CASCADE would handle this, but being explicit)
      await connection.execute(
        'DELETE FROM absence_logs WHERE id_guichet = ?',
        [id]
      );

      // Step 5: Delete rapports (CASCADE would handle this, but being explicit)
      await connection.execute(
        'DELETE FROM rapports WHERE id_guichet = ?',
        [id]
      );

      // Step 6: Clear guichet from service_ratings
      await connection.execute(
        'UPDATE service_ratings SET id_guichet = NULL WHERE id_guichet = ?',
        [id]
      );

      // Step 7: Finally, delete the guichet
      await connection.execute(
        'DELETE FROM guichets WHERE id_guichet = ?',
        [id]
      );

      return { deletedGuichetId: id, deletedName: guichet.nom };
    });

    res.json({
      success: true,
      data: {
        id: parseInt(id),
        nom: guichet.nom,
        message: 'Guichet and all related data deleted successfully'
      },
      message: 'Guichet account deleted successfully'
    });
  } catch (err) {
    console.error('Delete guichet error:', err.message, err.stack);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred while deleting the guichet'
    });
  }
}

/**
 * GET GUICHET STATS
 */
async function getGuichetStats(req, res) {
  try {
    const { id } = req.params;

    const guichets = await query('SELECT * FROM guichets WHERE id_guichet = ?', [id]);

    if (!guichets || guichets.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Guichet not found'
      });
    }

    const guichet = guichets[0];

    // Today stats
    const todayStats = await query(
      `SELECT
        COUNT(*) as total_served,
        AVG(TIMESTAMPDIFF(MINUTE, heure_prise, heure_service)) as avg_service_time
       FROM tickets
       WHERE id_guichet = ? AND DATE(heure_service) = CURDATE()`,
      [id]
    );

    // Current ticket being served
    const currentTicket = await query(
      `SELECT id_ticket, numero_ticket, status
       FROM tickets
       WHERE id_guichet = ? AND status = 'en_cours'
       ORDER BY heure_appel DESC
       LIMIT 1`,
      [id]
    );

    res.json({
      success: true,
      data: {
        guichet: {
          id: guichet.id_guichet,
          nom: guichet.nom,
          status: guichet.status
        },
        currentTicket: currentTicket[0] || null,
        today: {
          total_served: parseInt(todayStats[0].total_served) || 0,
          avg_service_time: Math.round(parseFloat(todayStats[0].avg_service_time) || 0)
        }
      }
    });
  } catch (err) {
    console.error('Get guichet stats error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

module.exports = {
  getGuichets,
  getGuichet,
  createGuichet,
  updateGuichetStatus,
  deleteGuichet,
  getGuichetStats
};
