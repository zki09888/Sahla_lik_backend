const { query } = require('../config/db');

/**
 * SEND INSTITUTION NOTIFICATION - Admin sends broadcast to clients AND guichets
 */
async function sendInstitutionNotification(req, res) {
  try {
    const { id } = req.params;
    const { titre, message, type } = req.body;
    const user = req.user;

    if (!id || !message) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Agency ID and message are required'
      });
    }

    // Verify user is authenticated
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    // FIX: Force type match with Number() coercion
    const userAgency = Number(user.id_agence);
    const targetAgency = Number(id);

    // FIX: Admin can send to their own agency
    if (user.role === 'admin') {
      // Check if admin has id_agence in JWT
      if (!user.id_agence || isNaN(userAgency) || userAgency === 0) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'Admin account not properly configured. Please log in again.'
        });
      }

      // Check agency match with proper type coercion
      if (userAgency !== targetAgency) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: 'You can only send notifications to your own agency'
        });
      }
      // Admin is authorized - proceed
    } else {
      // Non-admin users cannot send broadcasts
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only admins can send institution notifications'
      });
    }

    const notifications = [];
    let totalRecipients = 0;

    // 1. Send to all clients who have tickets at this agency
    const clients = await query(
      'SELECT DISTINCT id_client FROM tickets WHERE id_agence = ? AND id_client IS NOT NULL',
      [targetAgency]
    );

    if (clients && clients.length > 0) {
      for (const client of clients) {
        const result = await query(
          'INSERT INTO notifications (id_agence, id_client, type_notif, titre, message) VALUES (?, ?, ?, ?, ?)',
          [targetAgency, client.id_client, type || 'BROADCAST', titre || 'Notification', message]
        );
        notifications.push({ id_notif: result.insertId, id_client: client.id_client, type: 'client' });
      }
      totalRecipients += clients.length;
    }

    // 2. Send to all guichets at this agency (NEW - for guichet dashboard notifications)
    const guichets = await query(
      'SELECT id_guichet FROM guichets WHERE id_agence = ?',
      [targetAgency]
    );

    if (guichets && guichets.length > 0) {
      for (const guichet of guichets) {
        const result = await query(
          'INSERT INTO notifications (id_agence, id_guichet, type_notif, titre, message) VALUES (?, ?, ?, ?, ?)',
          [targetAgency, guichet.id_guichet, type || 'BROADCAST', titre || 'Notification', message]
        );
        notifications.push({ id_notif: result.insertId, id_guichet: guichet.id_guichet, type: 'guichet' });
      }
      totalRecipients += guichets.length;
    }

    // 3. Also create a broadcast record
    const broadcastResult = await query(
      'INSERT INTO broadcasts (id_agence, titre, message, type_broadcast, nombre_destinataires, statut) VALUES (?, ?, ?, ?, ?, ?)',
      [targetAgency, titre || 'Notification', message, type || 'PUSH', totalRecipients, 'envoye']
    );

    res.json({
      success: true,
      data: {
        id_broadcast: broadcastResult.insertId,
        notifications_sent: notifications.length,
        recipients: totalRecipients,
        breakdown: {
          clients: clients ? clients.length : 0,
          guichets: guichets ? guichets.length : 0
        }
      },
      message: 'Notification sent successfully to clients and guichets'
    });
  } catch (err) {
    console.error('Send institution notification error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * GET NOTIFICATIONS FOR CURRENT USER
 */
async function getNotifications(req, res) {
  try {
    const idClient = req.user?.id_client;
    const idGuichet = req.user?.id_guichet;
    const { id_agence, unread_only } = req.query;

    if (!idClient && !idGuichet && !id_agence) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_PARAMS',
        message: 'Client ID, Guichet ID, or Agency ID is required'
      });
    }

    let notifications;

    if (idClient) {
      // Get notifications for specific client
      let queryStr = `
        SELECT n.*, a.nom_agence
        FROM notifications n
        JOIN agences a ON n.id_agence = a.id_agence
        WHERE n.id_client = ?
      `;
      const params = [idClient];
      
      // Handle unread_only parameter
      if (unread_only === 'true') {
        queryStr += ' AND n.lu = FALSE';
      }
      
      queryStr += ' ORDER BY n.date_envoi DESC LIMIT 50';
      
      notifications = await query(queryStr, params);
    } else if (idGuichet) {
      // Get notifications for specific guichet
      let queryStr = `
        SELECT n.*, a.nom_agence
        FROM notifications n
        JOIN agences a ON n.id_agence = a.id_agence
        WHERE n.id_guichet = ?
      `;
      const params = [idGuichet];
      
      // Handle unread_only parameter
      if (unread_only === 'true') {
        queryStr += ' AND n.lu = FALSE';
      }
      
      queryStr += ' ORDER BY n.date_envoi DESC LIMIT 50';
      
      notifications = await query(queryStr, params);
    } else if (id_agence) {
      // Get all notifications for an agency (admin view)
      let queryStr = `
        SELECT n.*, c.nom_complete, g.nom as guichet_nom
        FROM notifications n
        LEFT JOIN clients c ON n.id_client = c.id_client
        LEFT JOIN guichets g ON n.id_guichet = g.id_guichet
        WHERE n.id_agence = ?
      `;
      const params = [id_agence];
      
      // Handle unread_only parameter
      if (unread_only === 'true') {
        queryStr += ' AND n.lu = FALSE';
      }
      
      queryStr += ' ORDER BY n.date_envoi DESC LIMIT 100';
      
      notifications = await query(queryStr, params);
    }

    res.json({
      success: true,
      data: (notifications || []).map(n => ({
        id_notif: n.id_notif,
        id_agence: n.id_agence,
        id_client: n.id_client,
        id_guichet: n.id_guichet,
        type_notif: n.type_notif,
        titre: n.titre,
        message: n.message,
        lu: n.lu,
        date_envoi: n.date_envoi,
        agence_nom: n.nom_agence,
        client_nom: n.nom_complete,
        guichet_nom: n.guichet_nom
      }))
    });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * GET CLIENT NOTIFICATIONS - Dedicated endpoint for clients
 * GET /api/v1/notifications/client
 */
async function getClientNotifications(req, res) {
  try {
    const idClient = req.user?.id_client;

    if (!idClient) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const notifications = await query(
      `SELECT n.*, a.nom_agence
       FROM notifications n
       JOIN agences a ON n.id_agence = a.id_agence
       WHERE n.id_client = ?
       ORDER BY n.date_envoi DESC
       LIMIT 50`,
      [idClient]
    );

    res.json({
      success: true,
      data: (notifications || []).map(n => ({
        id_notif: n.id_notif,
        id_agence: n.id_agence,
        type_notif: n.type_notif,
        titre: n.titre,
        message: n.message,
        lu: n.lu,
        date_envoi: n.date_envoi,
        agence_nom: n.nom_agence
      }))
    });
  } catch (err) {
    console.error('Get client notifications error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * MARK NOTIFICATION AS READ
 */
async function markNotificationRead(req, res) {
  try {
    const { id } = req.params;
    const idClient = req.user?.id_client;

    const notifications = await query('SELECT * FROM notifications WHERE id_notif = ?', [id]);

    if (!notifications || notifications.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Notification not found'
      });
    }

    const notification = notifications[0];

    // Check permission
    if (idClient && notification.id_client && notification.id_client !== idClient) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'You can only mark your own notifications as read'
      });
    }

    await query('UPDATE notifications SET lu = TRUE, date_lecture = NOW() WHERE id_notif = ?', [id]);

    res.json({
      success: true,
      data: {
        id_notif: parseInt(id),
        lu: true
      }
    });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * GET UNREAD COUNT
 */
async function getUnreadCount(req, res) {
  try {
    const idClient = req.user?.id_client;

    if (!idClient) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const result = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE id_client = ? AND lu = FALSE',
      [idClient]
    );

    res.json({
      success: true,
      data: {
        unread_count: parseInt(result[0]?.count) || 0
      }
    });
  } catch (err) {
    console.error('Get unread count error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

module.exports = {
  sendInstitutionNotification,
  getNotifications,
  getClientNotifications,
  markNotificationRead,
  getUnreadCount
};
