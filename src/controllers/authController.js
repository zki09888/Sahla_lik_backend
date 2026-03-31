const bcrypt = require('bcryptjs');
const { query, transaction } = require('../config/db');
const { generateToken } = require('../middleware/auth');

/**
 * ADMIN LOGIN - Auth from agences table
 * Email + motpass (hashed with bcrypt)
 */
async function adminLogin(req, res) {
  try {
    const { email, motpass } = req.body;

    if (!email || !motpass) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Email and password are required'
      });
    }

    // Find admin by email in agences table
    const agences = await query(
      'SELECT * FROM agences WHERE email = ? AND actif = TRUE',
      [email.toLowerCase()]
    );

    if (!agences || agences.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    const agence = agences[0];

    // Compare hashed password
    const isValid = await bcrypt.compare(motpass, agence.motpass);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token with admin role
    const token = generateToken({
      id_user: agence.id_agence,
      email: agence.email,
      role: 'admin',
      id_agence: agence.id_agence,
      id_enterprise: agence.id_enterprise
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id_agence: agence.id_agence,
          id_enterprise: agence.id_enterprise,
          nom_agence: agence.nom_agence,
          email: agence.email,
          wilaya: agence.wilaya,
          commune: agence.commune,
          role: 'admin'
        },
        expiresIn: '24h'
      }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred during login'
    });
  }
}

/**
 * GUICHET LOGIN - Auth from guichets table
 * Email + motpass (hashed with bcrypt)
 */
async function guichetLogin(req, res) {
  try {
    const { email, motpass } = req.body;

    if (!email || !motpass) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Email and password are required'
      });
    }

    // Find guichet by email (without status filter to check status later)
    const guichets = await query(
      'SELECT * FROM guichets WHERE email = ?',
      [email.toLowerCase()]
    );

    if (!guichets || guichets.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    const guichet = guichets[0];

    // Check if guichet is paused or inactive
    if (guichet.status !== 'actif') {
      return res.status(403).json({
        success: false,
        error: 'ACCOUNT_PAUSED',
        reason: 'paused',
        message: 'This counter is currently paused. Contact admin to activate the account.'
      });
    }

    // Compare hashed password
    const isValid = await bcrypt.compare(motpass, guichet.motpass);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token with guichet role
    const token = generateToken({
      id_user: guichet.id_guichet,
      email: guichet.email,
      role: 'guichet',
      id_guichet: guichet.id_guichet,
      id_agence: guichet.id_agence,
      id_enterprise: guichet.id_enterprise
    });

    res.json({
      success: true,
      data: {
        token,
        user: {
          id_guichet: guichet.id_guichet,
          id_agence: guichet.id_agence,
          id_enterprise: guichet.id_enterprise,
          nom: guichet.nom,
          email: guichet.email,
          category_guichet: guichet.category_guichet,
          role: 'guichet'
        },
        expiresIn: '24h'
      }
    });
  } catch (err) {
    console.error('Guichet login error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred during login'
    });
  }
}

/**
 * CLIENT LOGIN - Auth from clients table
 * Email + motpass (hashed with bcrypt)
 */
async function clientLogin(req, res) {
  try {
    const { email, motpass } = req.body;

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

    // Compare hashed password
    const isValid = await bcrypt.compare(motpass, client.motpass);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token with client role
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
 * UNIFIED LOGIN - Auto-detect role from email
 */
async function login(req, res) {
  try {
    const { email, motpass, role } = req.body;

    if (!email || !motpass) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Email and password are required'
      });
    }

    const searchEmail = email.toLowerCase();

    // If role specified, use specific login
    if (role === 'admin') {
      return adminLogin(req, res);
    }
    if (role === 'guichet') {
      return guichetLogin(req, res);
    }
    if (role === 'client') {
      return clientLogin(req, res);
    }

    // Auto-detect: try agences first (admin), then guichets, then clients
    let user = null;
    let detectedRole = null;

    // Try admin (agences)
    const agences = await query(
      'SELECT * FROM agences WHERE email = ? AND actif = TRUE',
      [searchEmail]
    );
    if (agences && agences.length > 0) {
      user = agences[0];
      detectedRole = 'admin';
    }

    // Try guichet
    if (!user) {
      const guichets = await query(
        'SELECT * FROM guichets WHERE email = ? AND status = "actif"',
        [searchEmail]
      );
      if (guichets && guichets.length > 0) {
        user = guichets[0];
        detectedRole = 'guichet';
      }
    }

    // Try client
    if (!user) {
      const clients = await query(
        'SELECT * FROM clients WHERE email = ?',
        [searchEmail]
      );
      if (clients && clients.length > 0) {
        user = clients[0];
        detectedRole = 'client';
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    // Compare hashed password
    const isValid = await bcrypt.compare(motpass, user.motpass);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    // Build response based on role
    let token, userData;

    if (detectedRole === 'admin') {
      token = generateToken({
        id_user: user.id_agence,
        email: user.email,
        role: 'admin',
        id_agence: user.id_agence,
        id_enterprise: user.id_enterprise
      });
      userData = {
        id_agence: user.id_agence,
        id_enterprise: user.id_enterprise,
        nom_agence: user.nom_agence,
        email: user.email,
        wilaya: user.wilaya,
        commune: user.commune,
        role: 'admin'
      };
    } else if (detectedRole === 'guichet') {
      token = generateToken({
        id_user: user.id_guichet,
        email: user.email,
        role: 'guichet',
        id_guichet: user.id_guichet,
        id_agence: user.id_agence,
        id_enterprise: user.id_enterprise
      });
      userData = {
        id_guichet: user.id_guichet,
        id_agence: user.id_agence,
        id_enterprise: user.id_enterprise,
        nom: user.nom,
        email: user.email,
        category_guichet: user.category_guichet,
        role: 'guichet'
      };
    } else {
      token = generateToken({
        id_user: user.id_client,
        email: user.email,
        role: 'client',
        id_client: user.id_client
      });
      userData = {
        id_client: user.id_client,
        nom_complete: user.nom_complete,
        email: user.email,
        nombre_tickets: user.nombre_tickets,
        role: 'client'
      };
    }

    res.json({
      success: true,
      data: {
        token,
        user: userData,
        role: detectedRole,
        expiresIn: '24h'
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred during login'
    });
  }
}

/**
 * ADMIN SIGNUP - Create new agence (admin)
 * nom_agence = enterprise_name + commune
 * Working hours are REQUIRED - no defaults allowed
 */
async function adminSignup(req, res) {
  try {
    const {
      nom_entreprise,
      category,
      nom_agence,
      adresse,
      wilaya,
      commune,
      email,
      motpass,
      latitude,
      longitude,
      // REQUIRED: Working hours (4 sessions)
      heure_ouv_matin,
      heure_ferm_matin,
      heure_ouv_soir,
      heure_ferm_soir
    } = req.body;

    // Validate required basic fields
    if (!nom_entreprise || !category || !email || !motpass) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Company name, category, email and password are required'
      });
    }

    // Validate required working hours fields (NO DEFAULTS ALLOWED)
    if (!heure_ouv_matin || !heure_ferm_matin || !heure_ouv_soir || !heure_ferm_soir) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_WORKING_HOURS',
        message: 'All working hours fields are required: morning start/end and afternoon start/end'
      });
    }

    // Validate working hours format (HH:MM:SS or HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;
    const validateTimeFormat = (time) => timeRegex.test(time);
    
    if (!validateTimeFormat(heure_ouv_matin)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_TIME_FORMAT',
        message: 'Invalid morning opening time format. Use HH:MM or HH:MM:SS'
      });
    }
    if (!validateTimeFormat(heure_ferm_matin)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_TIME_FORMAT',
        message: 'Invalid morning closing time format. Use HH:MM or HH:MM:SS'
      });
    }
    if (!validateTimeFormat(heure_ouv_soir)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_TIME_FORMAT',
        message: 'Invalid afternoon opening time format. Use HH:MM or HH:MM:SS'
      });
    }
    if (!validateTimeFormat(heure_ferm_soir)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_TIME_FORMAT',
        message: 'Invalid afternoon closing time format. Use HH:MM or HH:MM:SS'
      });
    }

    // Validate working hours logic
    // 1. Morning: opening < closing
    if (heure_ouv_matin >= heure_ferm_matin) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_MORNING_HOURS',
        message: 'Morning opening time must be before morning closing time'
      });
    }

    // 2. Afternoon: opening < closing
    if (heure_ouv_soir >= heure_ferm_soir) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_AFTERNOON_HOURS',
        message: 'Afternoon opening time must be before afternoon closing time'
      });
    }

    // 3. No overlap: morning closing <= afternoon opening
    if (heure_ferm_matin > heure_ouv_soir) {
      return res.status(400).json({
        success: false,
        error: 'OVERLAPPING_HOURS',
        message: 'Morning session must end before afternoon session starts'
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
    const existing = await query('SELECT id_agence FROM agences WHERE email = ?', [email.toLowerCase()]);
    if (existing && existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'EMAIL_EXISTS',
        message: 'Email already registered'
      });
    }

    const hashedPassword = await bcrypt.hash(motpass, 12);

    // Use provided nom_agence or generate from enterprise_name + commune
    const finalNomAgence = nom_agence || `${nom_entreprise} - ${commune || ''}`;

    // AUTO-CALCULATE derived fields
    // Pause time = gap between morning end and afternoon start
    const heure_pause_debut = heure_ferm_matin;
    const heure_pause_fin = heure_ouv_soir;
    // Global hours = full day span
    const horaire_ouverture = heure_ouv_matin;
    const horaire_fermeture = heure_ferm_soir;

    const result = await transaction(async (connection) => {
      // 1. Create enterprise
      const [enterpriseResult] = await connection.execute(
        'INSERT INTO enterprises (nom_entreprise, category, actif) VALUES (?, ?, TRUE)',
        [nom_entreprise, category]
      );
      const idEnterprise = enterpriseResult.insertId;

      // 2. Create agence (admin) with ALL working hours fields
      const [agenceResult] = await connection.execute(
        `INSERT INTO agences (
          id_enterprise, nom_agence, adresse, wilaya, commune, email, motpass,
          latitude, longitude,
          horaire_ouverture, horaire_fermeture,
          heure_pause_debut, heure_pause_fin,
          heure_ouv_matin, heure_ferm_matin, heure_ouv_soir, heure_ferm_soir,
          actif
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
        [
          idEnterprise,
          finalNomAgence,
          adresse || null,
          wilaya || null,
          commune || null,
          email.toLowerCase(),
          hashedPassword,
          latitude || null,
          longitude || null,
          horaire_ouverture,  // = heure_ouv_matin
          horaire_fermeture,  // = heure_ferm_soir
          heure_pause_debut,  // = heure_ferm_matin
          heure_pause_fin,    // = heure_ouv_soir
          heure_ouv_matin,
          heure_ferm_matin,
          heure_ouv_soir,
          heure_ferm_soir
        ]
      );
      const idAgence = agenceResult.insertId;

      // 3. Create initial stats entry
      await connection.execute(
        'INSERT INTO statistiques (id_agence, date_stat, active_counters, total_queue) VALUES (?, CURDATE(), 0, 0)',
        [idAgence]
      );

      // 4. Create default motif for the new agency
      await connection.execute(
        'INSERT INTO motifs (id_agence, nom_motif, description, temps_moyen_service) VALUES (?, ?, ?, ?)',
        [idAgence, 'Service Général', 'Service par défaut', 15]
      );

      return { idEnterprise, idAgence };
    });

    // Generate token
    const token = generateToken({
      id_user: result.idAgence,
      email: email.toLowerCase(),
      role: 'admin',
      id_agence: result.idAgence,
      id_enterprise: result.idEnterprise
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id_agence: result.idAgence,
          id_enterprise: result.idEnterprise,
          nom_agence: finalNomAgence,
          email: email.toLowerCase(),
          wilaya: wilaya || null,
          commune: commune || null,
          role: 'admin'
        },
        message: 'Account created successfully'
      }
    });
  } catch (err) {
    console.error('Admin signup error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred during registration'
    });
  }
}

/**
 * CLIENT SIGNUP - Create new client (Flutter app)
 */
async function clientSignup(req, res) {
  try {
    const { nom_complete, email, motpass } = req.body;

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
    const existing = await query('SELECT id_client FROM clients WHERE email = ?', [email.toLowerCase()]);
    if (existing && existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'EMAIL_EXISTS',
        message: 'Email already registered'
      });
    }

    const hashedPassword = await bcrypt.hash(motpass, 12);

    const [result] = await query(
      'INSERT INTO clients (nom_complete, email, motpass, nombre_tickets) VALUES (?, ?, ?, 0)',
      [nom_complete, email.toLowerCase(), hashedPassword]
    );

    // Generate token
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
        message: 'Account created successfully'
      }
    });
  } catch (err) {
    console.error('Client signup error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred during registration'
    });
  }
}

/**
 * GET CURRENT USER
 */
async function getMe(req, res) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    let userData = null;

    if (user.role === 'admin') {
      const agences = await query('SELECT * FROM agences WHERE id_agence = ?', [user.id_agence]);
      if (!agences || agences.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Admin not found'
        });
      }
      const agence = agences[0];
      userData = {
        id_agence: agence.id_agence,
        id_enterprise: agence.id_enterprise,
        nom_agence: agence.nom_agence,
        email: agence.email,
        wilaya: agence.wilaya,
        commune: agence.commune,
        role: 'admin'
      };
    } else if (user.role === 'guichet') {
      const guichets = await query('SELECT * FROM guichets WHERE id_guichet = ?', [user.id_guichet]);
      if (!guichets || guichets.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Guichet not found'
        });
      }
      const guichet = guichets[0];
      userData = {
        id_guichet: guichet.id_guichet,
        id_agence: guichet.id_agence,
        id_enterprise: guichet.id_enterprise,
        nom: guichet.nom,
        email: guichet.email,
        category_guichet: guichet.category_guichet,
        status: guichet.status,
        role: 'guichet'
      };
    } else if (user.role === 'client') {
      const clients = await query('SELECT * FROM clients WHERE id_client = ?', [user.id_client]);
      if (!clients || clients.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Client not found'
        });
      }
      const client = clients[0];
      userData = {
        id_client: client.id_client,
        nom_complete: client.nom_complete,
        email: client.email,
        nombre_tickets: client.nombre_tickets,
        role: 'client'
      };
    }

    res.json({
      success: true,
      data: userData
    });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * SEND OTP - For password reset (Flutter app)
 */
async function sendOtp(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_EMAIL',
        message: 'Email is required'
      });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await query(
      'INSERT INTO otp_codes (email, otp_code, date_expires) VALUES (?, ?, ?)',
      [email.toLowerCase(), otpCode, expiresAt]
    );

    // OTP is sent via email/SMS - never log or expose the code
    res.json({
      success: true,
      message: 'OTP sent successfully'
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * VERIFY OTP
 */
async function verifyOtp(req, res) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Email and OTP required'
      });
    }

    const otpRecords = await query(
      'SELECT * FROM otp_codes WHERE email = ? AND otp_code = ? AND used = FALSE AND date_expires > NOW()',
      [email.toLowerCase(), otp]
    );

    if (!otpRecords || otpRecords.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_OTP',
        message: 'Invalid or expired OTP'
      });
    }

    await query('UPDATE otp_codes SET used = TRUE WHERE id_otp = ?', [otpRecords[0].id_otp]);

    res.json({
      success: true,
      message: 'OTP verified',
      data: { verified: true }
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * RESET PASSWORD
 */
async function resetPassword(req, res) {
  try {
    const { email, reset_token } = req.body;
    
    // Support both client payload formats to not break other frontends
    const password = req.body.password || req.body.motpass;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'EMAIL_AND_PASSWORD_REQUIRED' 
      });
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Default target is 'clients' table
    const role = req.body.role || 'client';
    let table = 'clients';
    if (role === 'admin') {
      table = 'agences';
    } else if (role === 'guichet') {
      table = 'guichets';
    }

    // Update in appropriate table using unified DB query method
    const result = await query(
      `UPDATE ${table} SET motpass = ? WHERE email = ?`,
      [hashedPassword, email.toLowerCase()]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'CLIENT_NOT_FOUND' 
      });
    }

    return res.json({ 
      success: true, 
      message: 'Password updated successfully' 
    });
  } catch (err) {
    console.error('[password-reset]', err);
    return res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
}

/**
 * GUEST SIGNUP - Create temporary guest session
 * Returns JWT with isGuest=true for booking tickets without full registration
 */
async function guestSignup(req, res) {
  try {
    const { guest_name, guest_phone } = req.body;

    // Generate temporary guest credentials
    const guestEmail = `guest_${Date.now()}@temp.sahlalik.dz`;
    const guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create guest JWT token
    const token = generateToken({
      id_client: null,  // NULL for guests
      email: guestEmail,
      role: 'client',
      isGuest: true,
      guest_name: guest_name || 'Guest Client',
      guest_phone: guest_phone || null,
      guest_id: guestId
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: guestId,
          email: guestEmail,
          fullName: guest_name || 'Guest Client',
          phone: guest_phone || null,
          isGuest: true
        }
      },
      message: 'Guest session created successfully'
    });
  } catch (err) {
    console.error('Guest signup error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred during guest signup'
    });
  }
}

module.exports = {
  login,
  adminLogin,
  guichetLogin,
  clientLogin,
  adminSignup,
  clientSignup,
  guestSignup,
  getMe,
  sendOtp,
  verifyOtp,
  resetPassword,
  deleteAdminAccount
};

/**
 * DELETE ADMIN ACCOUNT - Admin deletes their own account
 * Deletes: agence + all guichets
 * Preserves: enterprise (business requirement)
 */
async function deleteAdminAccount(req, res) {
  try {
    const adminId = req.user?.id_agence;
    const adminEmail = req.user?.email;

    // Verify admin is authenticated
    if (!adminId) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Admin authentication required'
      });
    }

    // Verify admin exists
    const agences = await query(
      'SELECT id_agence, id_enterprise, nom_agence FROM agences WHERE id_agence = ?',
      [adminId]
    );

    if (!agences || agences.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Admin account not found'
      });
    }

    const agence = agences[0];

    // Use transaction to ensure all related data is cleaned up properly
    await transaction(async (connection) => {
      // Step 1: Delete all guichets belonging to this agence
      // (Foreign keys will handle related notifications, rapports, etc. via CASCADE)
      await connection.execute(
        'DELETE FROM guichets WHERE id_agence = ?',
        [adminId]
      );

      // Step 2: Delete tickets associated with this agence
      await connection.execute(
        'DELETE FROM tickets WHERE id_agence = ?',
        [adminId]
      );

      // Step 3: Delete motifs for this agence
      await connection.execute(
        'DELETE FROM motifs WHERE id_agence = ?',
        [adminId]
      );

      // Step 4: Delete files_attente for this agence
      await connection.execute(
        'DELETE FROM files_attente WHERE id_agence = ?',
        [adminId]
      );

      // Step 5: Delete notifications for this agence
      await connection.execute(
        'DELETE FROM notifications WHERE id_agence = ?',
        [adminId]
      );

      // Step 6: Delete broadcasts for this agence
      await connection.execute(
        'DELETE FROM broadcasts WHERE id_agence = ?',
        [adminId]
      );

      // Step 7: Delete statistiques for this agence
      await connection.execute(
        'DELETE FROM statistiques WHERE id_agence = ?',
        [adminId]
      );

      // Step 8: Finally, delete the agence (admin account)
      await connection.execute(
        'DELETE FROM agences WHERE id_agence = ?',
        [adminId]
      );
    });

    // Note: Enterprise is NOT deleted (business requirement)
    // The enterprise record remains for historical/audit purposes

    res.json({
      success: true,
      data: {
        id: adminId,
        nom_agence: agence.nom_agence,
        message: 'Account and all related data deleted successfully. Enterprise preserved.'
      },
      message: 'Your account has been deleted successfully.'
    });
  } catch (err) {
    console.error('Delete admin account error:', err.message, err.stack);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred while deleting the account'
    });
  }
}
