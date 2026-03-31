const { query } = require('../config/db');

/**
 * SAVE/UPDATE OFF SMS SETTINGS
 * POST /api/v1/off-sms
 *
 * Body:
 * {
 *   "phone_number": "0555555555",
 *   "is_actif": true
 * }
 */
async function saveOffSms(req, res) {
  try {
    const idClient = req.user?.id_client;
    const { phone_number, is_actif } = req.body;

    // Validate client authentication
    if (!idClient) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required - id_client not found in token'
      });
    }

    // Validate phone number
    if (!phone_number || phone_number.trim().length < 10) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PHONE',
        message: 'Valid phone number is required (minimum 10 digits)'
      });
    }

    // Clean phone number (remove spaces, dashes)
    const cleanPhone = phone_number.replace(/[\s\-]/g, '');

    // Check if record exists - use * instead of specific column
    const existing = await query(
      'SELECT * FROM off_sms WHERE id_client = ?',
      [idClient]
    );

    if (existing && existing.length > 0) {
      // UPDATE existing record - use actual column names
      await query(
        'UPDATE off_sms SET phone_number = ?, is_actif = ? WHERE id_client = ?',
        [cleanPhone, is_actif !== undefined ? is_actif : true, idClient]
      );

      res.json({
        success: true,
        message: 'SMS settings updated successfully',
        data: {
          phone_number: cleanPhone,
          is_actif: is_actif !== undefined ? is_actif : true
        }
      });
    } else {
      // INSERT new record
      const result = await query(
        'INSERT INTO off_sms (id_client, phone_number, is_actif) VALUES (?, ?, ?)',
        [idClient, cleanPhone, is_actif !== undefined ? is_actif : true]
      );

      res.status(201).json({
        success: true,
        message: 'SMS settings saved successfully',
        data: {
          phone_number: cleanPhone,
          is_actif: is_actif !== undefined ? is_actif : true
        }
      });
    }
  } catch (err) {
    console.error('Off SMS error:', err.message);
    
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: err.message || 'An error occurred while saving SMS settings',
      code: err.code || undefined
    });
  }
}

/**
 * GET OFF SMS SETTINGS
 * GET /api/v1/off-sms
 */
async function getOffSms(req, res) {
  try {
    const idClient = req.user?.id_client;

    // Validate client authentication
    if (!idClient) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    // Get SMS settings for client
    const settings = await query(
      'SELECT * FROM off_sms WHERE id_client = ?',
      [idClient]
    );

    if (!settings || settings.length === 0) {
      // No settings found - return defaults
      return res.json({
        success: true,
        data: {
          phone_number: null,
          is_actif: false
        }
      });
    }

    const setting = settings[0];

    res.json({
      success: true,
      data: {
        phone_number: setting.phone_number,
        is_actif: setting.is_actif === 1 || setting.is_actif === true
      }
    });
  } catch (err) {
    console.error('Get off_sms error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred while retrieving SMS settings'
    });
  }
}

module.exports = {
  saveOffSms,
  getOffSms
};
