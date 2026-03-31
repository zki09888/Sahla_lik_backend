const bcrypt = require('bcryptjs');
const { query, transaction, pool } = require('../config/db');
const { generateToken } = require('../middleware/auth');

/**
 * CLIENT REGISTER - Create new client account
 * POST /api/v1/clients/register
 */
async function register(req, res) {
  try {
    const { nom_complete, email, motpass } = req.body;

    // Validation
    if (!nom_complete || !email || !motpass) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Name, email and password are required'
      });
    }

    if (motpass.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PASSWORD',
        message: 'Password must be at least 6 characters'
      });
    }

    // Check if email already exists
    const existing = await query(
      'SELECT id_client FROM clients WHERE email = ?',
      [email.toLowerCase()]
    );

    if (existing && existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'EMAIL_EXISTS',
        message: 'Email already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(motpass, 12);

    // Insert client
    const result = await query(
      'INSERT INTO clients (nom_complete, email, motpass, nombre_tickets) VALUES (?, ?, ?, 0)',
      [nom_complete, email.toLowerCase(), hashedPassword]
    );

    // Generate JWT token
    const token = generateToken({
      id_user: result.insertId,
      email: email.toLowerCase(),
      role: 'client',
      id_client: result.insertId
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id_client: result.insertId,
          nom_complete: nom_complete,
          email: email.toLowerCase(),
          nombre_tickets: 0,
          role: 'client'
        },
        expiresIn: '24h'
      },
      message: 'Account created successfully'
    });
  } catch (err) {
    console.error('Client registration error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred during registration'
    });
  }
}

/**
 * CLIENT LOGIN - Authenticate client
 * POST /api/v1/clients/login
 */
async function login(req, res) {
  try {
    const { email, motpass } = req.body;

    // Validation
    if (!email || !motpass) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Email and password are required'
      });
    }

    // Find client by email
    const clients = await query(
      'SELECT * FROM clients WHERE email = ?',
      [email.toLowerCase()]
    );

    if (!clients || clients.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    const client = clients[0];

    // Verify password
    const isValid = await bcrypt.compare(motpass, client.motpass);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = generateToken({
      id_user: client.id_client,
      email: client.email,
      role: 'client',
      id_client: client.id_client
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id_client: client.id_client,
          nom_complete: client.nom_complete,
          email: client.email,
          nombre_tickets: client.nombre_tickets,
          role: 'client'
        },
        expiresIn: '24h'
      }
    });
  } catch (err) {
    console.error('Client login error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred during login'
    });
  }
}

/**
 * GET CLIENT PROFILE - Get current client info
 * GET /api/v1/clients/me
 */
async function getProfile(req, res) {
  try {
    const clientId = req.user?.id_client;

    if (!clientId) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const clients = await query(
      'SELECT id_client, nom_complete, email, nombre_tickets, date_premiere_visite FROM clients WHERE id_client = ?',
      [clientId]
    );

    if (!clients || clients.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Client not found'
      });
    }

    const client = clients[0];

    res.json({
      success: true,
      data: {
        id_client: client.id_client,
        nom_complete: client.nom_complete,
        email: client.email,
        nombre_tickets: client.nombre_tickets,
        date_premiere_visite: client.date_premiere_visite,
        role: 'client'
      }
    });
  } catch (err) {
    console.error('Get client profile error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * DELETE CLIENT ACCOUNT - Client deletes their own account
 * DELETE /api/v1/clients/me
 * CRITICAL: Anonymize data instead of breaking foreign keys
 */
async function deleteAccount(req, res) {
  const connection = await pool.getConnection();
  
  try {
    const clientId = req.user?.id_client;

    if (!clientId) {
      connection.release();
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    // Verify client exists
    const [clients] = await connection.execute(
      'SELECT id_client, nom_complete, email FROM clients WHERE id_client = ?',
      [clientId]
    );

    if (!clients || clients.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Client account not found'
      });
    }

    const client = clients[0];

    // START TRANSACTION
    await connection.beginTransaction();

    // STEP 1: Anonymize tickets
    await connection.execute(
      'UPDATE tickets SET id_client = NULL WHERE id_client = ?',
      [clientId]
    );

    // STEP 2: Delete notifications
    await connection.execute(
      'DELETE FROM notifications WHERE id_client = ?',
      [clientId]
    );

    // STEP 3: Delete client
    await connection.execute(
      'DELETE FROM clients WHERE id_client = ?',
      [clientId]
    );

    // COMMIT
    await connection.commit();
    
    connection.release();

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (err) {
    console.error('[deleteAccount] ERROR:', err);
    console.error('[deleteAccount] Stack:', err.stack);
    
    // Try rollback
    try {
      await connection.rollback();
      connection.release();
    } catch (rollbackErr) {
      console.error('[deleteAccount] Rollback error:', rollbackErr.message);
    }

    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: err.message || 'Failed to delete account'
    });
  }
}

module.exports = {
  register,
  login,
  getProfile,
  deleteAccount
};
