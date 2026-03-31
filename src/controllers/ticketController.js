const { query, transaction, pool } = require('../config/db');

/**
 * CREATE TICKET - Client books a ticket
 * CRITICAL: files_attente is the SINGLE SOURCE OF TRUTH for queue
 * All operations wrapped in transaction to prevent race conditions
 *
 * GUEST TICKETS:
 * - id_client = NULL (normal, not special)
 * - Same lifecycle as authenticated user tickets
 * - Status updates work identically
 */
async function createTicket(req, res) {
  const connection = await pool.getConnection();

  try {
    const { id_motif, guest_name, guest_phone } = req.body;

    // SECURITY: Get id_client from JWT token ONLY
    // NEVER accept id_client from request body (prevents identity spoofing)
    const idClientFromToken = req.user?.id_client;
    const isGuest = req.user?.isGuest === true || !idClientFromToken;

    // Get agency from middleware
    const agency = req.agence;
    const id_agence = agency?.id_agence;

    if (!id_agence) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_AGENCY',
        message: 'Agency not found. Please select a valid agency.'
      });
    }

    // Determine final id_client
    // Guest bookings use id_client = NULL (normal behavior)
    let finalIdClient = null;
    let clientName = guest_name || 'Guest Client';

    if (!isGuest && idClientFromToken) {
      // Logged-in user - validate client exists
      const [clients] = await connection.execute(
        'SELECT id_client, nom_complete FROM clients WHERE id_client = ?',
        [idClientFromToken]
      );

      if (!clients || clients.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'CLIENT_NOT_FOUND',
          message: 'Client account not found'
        });
      }

      finalIdClient = idClientFromToken;
      clientName = clients[0].nom_complete;
    }

    // Check active guichets
    const [guichets] = await connection.execute(
      'SELECT COUNT(*) as count FROM guichets WHERE id_agence = ? AND status = "actif"',
      [id_agence]
    );
    const activeGuichets = guichets[0]?.count || 0;

    if (activeGuichets === 0) {
      return res.status(400).json({
        success: false,
        error: 'NO_ACTIVE_GUICHETS',
        message: 'No active counters available. Please try later.'
      });
    }

    // Check working hours (REQUIRED fields - no fallback defaults)
    // Algeria is UTC+1 — always fixed offset, no DST
    const now = new Date();
    const algeriaOffset = 60; // minutes
    const localNow = new Date(now.getTime() + algeriaOffset * 60 * 1000);
    const serverTime = localNow.toISOString().slice(11, 19);    const openingTime = agency.horaire_ouverture;
    const closingTime = agency.horaire_fermeture;

    if (serverTime < openingTime || serverTime > closingTime) {
      return res.status(400).json({
        success: false,
        error: 'OUTSIDE_WORKING_HOURS',
        message: `Booking not allowed outside working hours (${openingTime} - ${closingTime})`
      });
    }

    // Check pause hours (auto-calculated from working hours)
    const pauseDebut = agency.heure_pause_debut;
    const pauseFin = agency.heure_pause_fin;
    if (pauseDebut && pauseFin && serverTime >= pauseDebut && serverTime <= pauseFin) {
      return res.status(400).json({
        success: false,
        error: 'DURING_PAUSE_HOURS',
        message: `Booking not allowed during break time (${pauseDebut} - ${pauseFin})`
      });
    }

    // ✅ Validate id_motif exists for this agency BEFORE transaction
    // If id_motif is not provided, it will be NULL
    let finalMotifId = null;

    if (id_motif) {
      // Client provided id_motif - validate it exists for this agency
      const [motifs] = await connection.execute(
        'SELECT id_motif, nom_motif FROM motifs WHERE id_motif = ? AND id_agence = ?',
        [id_motif, id_agence]
      );

      if (motifs && motifs.length > 0) {
        finalMotifId = id_motif;
      } else {
        // Reject request - do NOT allow invalid motif
        return res.status(400).json({
          success: false,
          error: 'INVALID_MOTIF',
          message: 'The specified service type does not exist for this agency'
        });
      }
    }

    // START TRANSACTION - All operations atomic
    await connection.beginTransaction();

    // STEP 1: Get or create file_attente for today (with FOR UPDATE lock)
    const [fileAttenteRows] = await connection.execute(
      'SELECT * FROM files_attente WHERE id_agence = ? AND DATE(date_creation) = CURDATE() ORDER BY id_file DESC LIMIT 1 FOR UPDATE',
      [id_agence]
    );

    let fileAttente = fileAttenteRows && fileAttenteRows.length > 0 ? fileAttenteRows[0] : null;

    if (!fileAttente) {
      // Create new file_attente with numero_ticket = 0, nb_personnes_restantes = 0
      const [newFileResult] = await connection.execute(
        'INSERT INTO files_attente (id_agence, id_motif, numero_ticket, nb_personnes_restantes, date_creation) VALUES (?, ?, 0, 0, NOW())',
        [id_agence, finalMotifId]
      );

      const [newFileRows] = await connection.execute(
        'SELECT * FROM files_attente WHERE id_file = ?',
        [newFileResult.insertId]
      );
      fileAttente = newFileRows[0];
    }

    // STEP 2: Calculate next ticket number from files_attente (source of truth)
    const newNumero = (fileAttente.numero_ticket || 0) + 1;

    // STEP 3: Count people currently waiting in queue (for position info only)
    const [waitingCounts] = await connection.execute(
      'SELECT COUNT(*) as count FROM tickets WHERE id_file = ? AND status = "attente"',
      [fileAttente.id_file]
    );
    const waitingCount = waitingCounts[0]?.count || 0;

    // STEP 4: Calculate estimated wait time
    const avgServiceTime = 5; // minutes per person
    const estimatedWait = activeGuichets > 0 && waitingCount > 0
      ? Math.floor(avgServiceTime * (waitingCount / activeGuichets))
      : 0;

    // STEP 5: Insert ticket with calculated numero_ticket
    // CRITICAL: Use finalIdClient (can be NULL for guests), never auto-assign
    const [ticketResult] = await connection.execute(
      `INSERT INTO tickets (
        id_client,
        id_agence,
        id_motif,
        id_file,
        numero_ticket,
        status,
        temps_attente_estime,
        heure_prise
      ) VALUES (?, ?, ?, ?, ?, 'attente', ?, NOW())`,
      [finalIdClient, id_agence, finalMotifId, fileAttente.id_file, newNumero, estimatedWait]
    );

    const ticketId = ticketResult.insertId;

    // STEP 6: Update files_attente IMMEDIATELY (source of truth)
    // Increment both numero_ticket and nb_personnes_restantes
    await connection.execute(
      'UPDATE files_attente SET numero_ticket = ?, nb_personnes_restantes = nb_personnes_restantes + 1 WHERE id_file = ?',
      [newNumero, fileAttente.id_file]
    );

    // STEP 7: Update client ticket count ONLY for logged-in users (not guests)
    if (finalIdClient) {
      await connection.execute(
        'UPDATE clients SET nombre_tickets = nombre_tickets + 1 WHERE id_client = ?',
        [finalIdClient]
      );
    }

    // COMMIT transaction
    await connection.commit();

    // Return EXACT data - no recalculation
    res.status(201).json({
      success: true,
      data: {
        ticket: {
          id_ticket: ticketId,
          numero_ticket: newNumero,  // EXACT number from files_attente
          status: 'attente',
          estimated_wait: estimatedWait,
          queuePosition: waitingCount + 1,
          motif_used: finalMotifId,
          // Guest info (if applicable)
          is_guest: !finalIdClient,
          guest_name: guest_name || null
        },
        queue: {
          total_queue: newNumero,  // Same as numero_ticket (source of truth)
          active_guichets: activeGuichets,
          estimated_wait: estimatedWait
        },
        agency: {
          id_agence: id_agence,
          nom_agence: agency.nom_agence
        },
        client: {
          id: finalIdClient,
          name: clientName,
          is_guest: !finalIdClient
        }
      },
      message: 'Ticket created successfully' + (finalIdClient ? '' : ' (Guest booking)')
    });

  } catch (err) {
    await connection.rollback();
    console.error('=== CREATE TICKET ERROR ===');
    console.error('Error message:', err.message);
    console.error('SQL message:', err.sqlMessage);
    console.error('Error code:', err.code);
    console.error('SQL state:', err.sqlState);
    console.error('Error stack:', err.stack);

    // Handle foreign key constraint errors specifically
    if (err.code === 'ER_NO_REFERENCED_ROW' || err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).json({
        success: false,
        error: 'INVALID_MOTIF',
        message: 'The specified service type is invalid or does not exist for this agency'
      });
    }

    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: err.message || 'An error occurred while creating the ticket',
      code: err.code,
      sqlMessage: err.sqlMessage
    });
  } finally {
    connection.release();
  }
}

/**
 * GET MY TICKETS - Client's tickets
 */
async function getMyTickets(req, res) {
  try {
    const idClient = req.user?.id_client;

    if (!idClient) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const tickets = await query(
      `SELECT t.*,
              m.nom_motif,
              a.nom_agence,
              g.nom as guichet_nom
       FROM tickets t
       LEFT JOIN motifs m ON t.id_motif = m.id_motif
       JOIN agences a ON t.id_agence = a.id_agence
       LEFT JOIN guichets g ON t.id_guichet = g.id_guichet
       WHERE t.id_client = ?
       ORDER BY t.heure_prise DESC`,
      [idClient]
    );

    res.json({
      success: true,
      data: (tickets || []).map(t => ({
        id_ticket: t.id_ticket,
        numero_ticket: t.numero_ticket,
        status: t.status,
        motif: t.nom_motif,
        agency: t.nom_agence,
        guichet: t.guichet_nom,
        bookingTime: t.heure_prise,
        calledTime: t.heure_appel,
        servedTime: t.heure_service,
        estimated_wait: t.temps_attente_estime,
        waitTime: t.temps_attente
      }))
    });
  } catch (err) {
    console.error('Get my tickets error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * GET TICKET BY ID - Get single ticket status
 * CRITICAL: NEVER return 404 for valid tickets
 * - If ticket exists in DB → ALWAYS return it
 * - If truly not found → return 404
 * - Works for both authenticated and guest tickets
 */
async function getTicketById(req, res) {
  try {
    const { id } = req.params;

    // CRITICAL: Validate ID is a valid positive number
    const ticketId = parseInt(id, 10);
    if (isNaN(ticketId) || ticketId <= 0) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ID',
        message: 'Ticket ID must be a positive number'
      });
    }

    // SAFE QUERY: Simple, direct query - NEVER return 404 for valid tickets
    // This query fetches ALL ticket data including status, guichet info, etc.
    const tickets = await query(
      `SELECT t.id_ticket, t.id_client, t.id_agence, t.id_motif, t.id_file,
              t.numero_ticket, t.status, t.id_guichet,
              t.heure_prise, t.heure_appel, t.heure_service,
              t.temps_attente_estime, t.temps_attente,
              m.nom_motif,
              a.nom_agence,
              g.nom as guichet_nom, g.id_guichet as guichet_id
       FROM tickets t
       LEFT JOIN motifs m ON t.id_motif = m.id_motif
       JOIN agences a ON t.id_agence = a.id_agence
       LEFT JOIN guichets g ON t.id_guichet = g.id_guichet
       WHERE t.id_ticket = ?
       LIMIT 1`,
      [ticketId]
    );

    const ticket = tickets && tickets.length > 0 ? tickets[0] : null;

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Ticket not found in database'
      });
    }

    // CRITICAL: Return ALL required fields for Flutter client
    // Response format MUST match: { success: true, data: { id_ticket, status, numero_ticket, id_guichet } }
    res.json({
      success: true,
      data: {
        id_ticket: ticket.id_ticket,
        status: ticket.status,              // REQUIRED: waiting/en_cours/termine/annule/skipped
        numero_ticket: ticket.numero_ticket, // REQUIRED: ticket number
        id_guichet: ticket.id_guichet,       // REQUIRED: guichet ID (null if not called yet)
        // Additional fields for display
        guichet_number: ticket.guichet_nom,  // Guichet name/number
        guichet_id: ticket.guichet_id,       // Guichet numeric ID
        motif: ticket.nom_motif,
        agency: ticket.nom_agence,
        bookingTime: ticket.heure_prise,
        calledTime: ticket.heure_appel,
        servedTime: ticket.heure_service,
        estimated_wait: ticket.temps_attente_estime,
        waitTime: ticket.temps_attente,
        // Client info
        id_client: ticket.id_client,
        is_guest: !ticket.id_client
      }
    });
  } catch (err) {
    console.error('[getTicketById] ❌ CRITICAL ERROR:', err);
    console.error('[getTicketById] Stack:', err.stack);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred while fetching ticket',
      details: err.message
    });
  }
}

/**
 * CANCEL TICKET
 * CRITICAL: Must update status to 'annule' and decrement queue count
 * This change MUST be reflected immediately in guichet dashboard
 */
async function cancelTicket(req, res) {
  try {
    const { id } = req.params;
    const idClient = req.user?.id_client;

    const tickets = await query('SELECT * FROM tickets WHERE id_ticket = ?', [id]);
    const ticket = tickets[0];

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Ticket not found'
      });
    }

    if (ticket.status !== 'attente') {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STATUS',
        message: 'Only waiting tickets can be cancelled'
      });
    }

    if (idClient && ticket.id_client && ticket.id_client !== idClient) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'You can only cancel your own tickets'
      });
    }

    await transaction(async (connection) => {
      await connection.execute('UPDATE tickets SET status = "annule" WHERE id_ticket = ?', [id]);

      await connection.execute(
        'UPDATE files_attente SET nb_personnes_restantes = GREATEST(nb_personnes_restantes - 1, 0) WHERE id_file = ?',
        [ticket.id_file]
      );
    });

    res.json({
      success: true,
      message: 'Ticket cancelled successfully',
      data: {
        id_ticket: parseInt(id),
        status: 'annule'
      }
    });
  } catch (err) {
    console.error('[cancelTicket] Error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * CALL NEXT TICKET - Guichet calls next client
 * CRITICAL: Uses files_attente as source of truth
 * Finds next ticket from files_attente → updates status to en_cours
 * Also decrements nb_personnes_restantes in files_attente
 *
 * GUEST TICKETS: Works identically - id_client can be NULL
 * UPDATE: WHERE id_ticket = ? (no id_client requirement)
 */
async function callNextTicket(req, res) {
  const connection = await pool.getConnection();

  try {
    const { id_agence } = req.body;
    const idGuichet = req.user?.id_guichet;

    // VALIDATE: Required fields
    if (!id_agence) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'MISSING_AGENCE',
        message: 'Agency ID is required'
      });
    }

    if (!idGuichet) {
      connection.release();
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Guichet authentication required'
      });
    }

    // VALIDATE: Guichet exists and is active
    const [guichets] = await connection.execute(
      'SELECT id_guichet, nom, status FROM guichets WHERE id_guichet = ? AND id_agence = ?',
      [idGuichet, id_agence]
    );

    if (!guichets || guichets.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'GUICHET_NOT_FOUND',
        message: 'Guichet not found or not assigned to this agency'
      });
    }

    const guichet = guichets[0];

    if (guichet.status !== 'actif') {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'GUICHET_INACTIVE',
        message: 'Guichet is not active. Please activate it first.'
      });
    }

    // START TRANSACTION
    await connection.beginTransaction();

    // STEP 1: Get file_attente for this agency (source of truth) with lock
    const [fileAttentes] = await connection.execute(
      'SELECT id_file, id_agence, id_motif, numero_ticket, nb_personnes_restantes FROM files_attente WHERE id_agence = ? AND DATE(date_creation) = CURDATE() ORDER BY id_file DESC LIMIT 1 FOR UPDATE',
      [id_agence]
    );

    if (!fileAttentes || fileAttentes.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'NO_QUEUE',
        message: 'No queue exists for today. Please create a queue first.'
      });
    }

    const fileAttente = fileAttentes[0];

    // STEP 2: Find next waiting ticket with STRICT filtering
    // CRITICAL: Only select tickets that are:
    // - status = 'attente' (waiting)
    // - id_agence matches (multi-tenant isolation)
    // - id_file matches (today's queue)
    // - NOT cancelled, NOT skipped, NOT already called
    // ORDER BY numero_ticket ASC (FIFO queue order)
    // GUEST TICKETS: LEFT JOIN clients - includes id_client = NULL
    const [tickets] = await connection.execute(
      `SELECT t.id_ticket, t.id_client, t.id_agence, t.id_file, t.id_motif,
              t.numero_ticket, t.status, t.temps_attente_estime,
              m.nom_motif,
              c.nom_complete as client_name
       FROM tickets t
       LEFT JOIN motifs m ON t.id_motif = m.id_motif
       LEFT JOIN clients c ON t.id_client = c.id_client
       WHERE t.id_file = ?
         AND t.id_agence = ?
         AND t.status = 'attente'
       ORDER BY t.numero_ticket ASC LIMIT 1`,
      [fileAttente.id_file, id_agence]
    );

    if (!tickets || tickets.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'NO_WAITING',
        message: 'No clients waiting in queue'
      });
    }

    const ticket = tickets[0];

    // CRITICAL: EXTRA SAFETY CHECK - Verify agency isolation
    if (ticket.id_agence !== id_agence) {
      await connection.rollback();
      connection.release();
      return res.status(500).json({
        success: false,
        error: 'SECURITY_ERROR',
        message: 'Ticket agency mismatch - potential data corruption'
      });
    }

    // CRITICAL: Resolve name correctly - guest_name or client_name or "Guest"
    const resolvedName = ticket.client_name || 'Guest';

    // VALIDATE: Ticket status is waiting
    if (ticket.status !== 'attente') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'INVALID_STATUS',
        message: `Ticket status is ${ticket.status}, not 'attente'`
      });
    }

    // STEP 3: Update ticket status to en_cours
    // CRITICAL: Uses WHERE id_ticket = ? ONLY - works for ALL tickets (guest + normal)
    const [updateResult] = await connection.execute(
      'UPDATE tickets SET status = "en_cours", id_guichet = ?, heure_appel = NOW() WHERE id_ticket = ?',
      [idGuichet, ticket.id_ticket]
    );

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return res.status(500).json({
        success: false,
        error: 'UPDATE_FAILED',
        message: 'Failed to update ticket status'
      });
    }

    // STEP 4: Decrement nb_personnes_restantes in files_attente
    const newRemaining = Math.max((fileAttente.nb_personnes_restantes || 1) - 1, 0);
    await connection.execute(
      'UPDATE files_attente SET nb_personnes_restantes = ? WHERE id_file = ?',
      [newRemaining, fileAttente.id_file]
    );

    // STEP 5: INSERT notification for the client
    // GUEST TICKETS: id_client is NULL - notification will have NULL id_client (handled by DB)
    try {
      await connection.execute(
        `INSERT INTO notifications (id_client, id_agence, type_notif, titre, message, lu, date_creation)
         VALUES (?, ?, 'TURN', 'Your Turn', 'It\'s your turn now! Head to the guichet.', FALSE, NOW())`,
        [ticket.id_client, id_agence]
      );
    } catch (notifErr) {
      // Continue - notification is not critical
    }

    // COMMIT TRANSACTION
    await connection.commit();
    connection.release();

    res.json({
      success: true,
      data: {
        ticket: {
          id_ticket: ticket.id_ticket,
          numero_ticket: ticket.numero_ticket,
          status: 'en_cours',
          motif: ticket.nom_motif || null,
          // CRITICAL: Include resolved name for display
          client_name: resolvedName,
          is_guest: !ticket.id_client,
          id_client: ticket.id_client,
          calledAt: new Date().toISOString()
        },
        queue: {
          remaining: newRemaining,
          current_ticket: ticket.numero_ticket,
          guichet: guichet.nom
        }
      },
      message: 'Ticket called successfully' + (ticket.id_client ? '' : ' (Guest)')
    });

  } catch (err) {
    console.error('[callNextTicket] CRITICAL ERROR:', err);
    console.error('[callNextTicket] Error stack:', err.stack);

    // Attempt rollback if connection is still valid
    try {
      await connection.rollback();
    } catch (rollbackErr) {
      console.error('[callNextTicket] Rollback failed:', rollbackErr.message);
    }

    // Release connection
    try {
      connection.release();
    } catch (releaseErr) {
      console.error('[callNextTicket] Release failed:', releaseErr.message);
    }

    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: err.message || 'An error occurred while calling next ticket',
      code: err.code || undefined,
      sqlMessage: err.sqlMessage || undefined
    });
  }
}

/**
 * SERVE TICKET - Guichet marks ticket as complete
 * Update status to termine, set heure_service
 */
async function serveTicket(req, res) {
  try {
    const { id } = req.params;
    const idGuichet = req.user?.id_guichet;

    const tickets = await query('SELECT * FROM tickets WHERE id_ticket = ?', [id]);
    const ticket = tickets[0];

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Ticket not found'
      });
    }

    if (ticket.status !== 'en_cours') {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STATUS',
        message: 'Only tickets in progress can be marked as served'
      });
    }

    // Calculate wait time
    const waitTime = ticket.temps_attente ||
      Math.floor((new Date() - new Date(ticket.heure_prise)) / 60000);

    await transaction(async (connection) => {
      await connection.execute(
        'UPDATE tickets SET status = "termine", heure_service = NOW(), temps_attente = ? WHERE id_ticket = ?',
        [waitTime, id]
      );
      // BUG 9 FIX: Do NOT decrement nb_personnes_restantes here.
      // It was already decremented in callNextTicket when the ticket was called.
      // Double-decrementing corrupts the queue count.
    });

    res.json({
      success: true,
      data: {
        id_ticket: parseInt(id),
        status: 'termine',
        waitTime: waitTime,
        servedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Serve ticket error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * SKIP TICKET - Move ticket to end of queue OR mark as skipped
 * Works for both 'en_cours' (currently serving) and 'attente' (waiting) tickets
 */
async function skipTicket(req, res) {
  try {
    const { id } = req.params;

    const tickets = await query('SELECT * FROM tickets WHERE id_ticket = ?', [id]);
    const ticket = tickets[0];

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Ticket not found'
      });
    }

    // Allow skipping both 'en_cours' and 'attente' tickets
    if (ticket.status !== 'en_cours' && ticket.status !== 'attente') {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STATUS',
        message: 'Only waiting or in-progress tickets can be skipped'
      });
    }

    if (ticket.status === 'en_cours') {
      // Skip from serving - mark as skipped (removed from active queue)
      await query(
        'UPDATE tickets SET status = "skipped", id_guichet = NULL, heure_appel = NULL WHERE id_ticket = ?',
        [id]
      );
    } else if (ticket.status === 'attente') {
      // Skip from waiting - mark as skipped (removed from active queue)
      await query(
        'UPDATE tickets SET status = "skipped" WHERE id_ticket = ?',
        [id]
      );
    }

    res.json({
      success: true,
      message: 'Ticket skipped successfully'
    });
  } catch (err) {
    console.error('Skip ticket error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * CALL SPECIFIC TICKET - Guichet calls a specific client by ticket ID
 * CRITICAL: Allows guichet to call ANY waiting ticket (not just next in queue)
 */
async function callSpecificTicket(req, res) {
  const connection = await pool.getConnection();

  try {
    const { id } = req.params; // id_ticket from URL
    const { id_agence } = req.body;
    const idGuichet = req.user?.id_guichet;

    // VALIDATE: Required fields
    if (!id_agence) {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'MISSING_AGENCE',
        message: 'Agency ID is required'
      });
    }

    if (!idGuichet) {
      connection.release();
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Guichet authentication required'
      });
    }

    // VALIDATE: Guichet exists and belongs to agency
    const [guichets] = await connection.execute(
      'SELECT id_guichet, nom, status FROM guichets WHERE id_guichet = ? AND id_agence = ?',
      [idGuichet, id_agence]
    );

    if (!guichets || guichets.length === 0) {
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'GUICHET_NOT_FOUND',
        message: 'Guichet not found or not assigned to this agency'
      });
    }

    const guichet = guichets[0];

    if (guichet.status !== 'actif') {
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'GUICHET_INACTIVE',
        message: 'Guichet is not active. Please activate it first.'
      });
    }

    // START TRANSACTION
    await connection.beginTransaction();

    // STEP 1: Fetch specific ticket with validation
    const [tickets] = await connection.execute(
      `SELECT t.id_ticket, t.id_client, t.id_agence, t.id_file, t.id_motif,
              t.numero_ticket, t.status, t.temps_attente_estime,
              m.nom_motif,
              c.nom_complete as client_name
       FROM tickets t
       LEFT JOIN motifs m ON t.id_motif = m.id_motif
       LEFT JOIN clients c ON t.id_client = c.id_client
       WHERE t.id_ticket = ?
         AND t.id_agence = ?
         AND t.status = 'attente'`,
      [id, id_agence]
    );

    if (!tickets || tickets.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Ticket not found or not in waiting status'
      });
    }

    const ticket = tickets[0];

    // CRITICAL: EXTRA SAFETY CHECK - Verify agency isolation
    if (ticket.id_agence !== id_agence) {
      await connection.rollback();
      connection.release();
      return res.status(500).json({
        success: false,
        error: 'SECURITY_ERROR',
        message: 'Ticket agency mismatch - potential data corruption'
      });
    }

    // CRITICAL: Validate ticket status
    if (ticket.status !== 'attente') {
      await connection.rollback();
      connection.release();
      return res.status(400).json({
        success: false,
        error: 'INVALID_TICKET',
        message: `Cannot call ticket: status is ${ticket.status}, not 'attente'`
      });
    }

    // CRITICAL: Resolve name correctly
    const resolvedName = ticket.client_name || 'Guest';

    // STEP 2: Update ticket status to en_cours
    const [updateResult] = await connection.execute(
      'UPDATE tickets SET status = "en_cours", id_guichet = ?, heure_appel = NOW() WHERE id_ticket = ?',
      [idGuichet, ticket.id_ticket]
    );

    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return res.status(500).json({
        success: false,
        error: 'UPDATE_FAILED',
        message: 'Failed to update ticket status'
      });
    }

    // STEP 3: Decrement nb_personnes_restantes in files_attente
    const [fileAttentes] = await connection.execute(
      'SELECT id_file, nb_personnes_restantes FROM files_attente WHERE id_agence = ? AND DATE(date_creation) = CURDATE() ORDER BY id_file DESC LIMIT 1',
      [id_agence]
    );

    if (fileAttentes && fileAttentes.length > 0) {
      const newRemaining = Math.max((fileAttentes[0].nb_personnes_restantes || 1) - 1, 0);
      await connection.execute(
        'UPDATE files_attente SET nb_personnes_restantes = ? WHERE id_file = ?',
        [newRemaining, fileAttentes[0].id_file]
      );
    }

    // STEP 4: INSERT notification for the client
    try {
      await connection.execute(
        `INSERT INTO notifications (id_client, id_agence, type_notif, titre, message, lu, date_creation)
         VALUES (?, ?, 'TURN', 'Your Turn', 'It\'s your turn now! Head to the guichet.', FALSE, NOW())`,
        [ticket.id_client, id_agence]
      );
    } catch (notifErr) {
      // Continue - notification is not critical
    }

    // COMMIT TRANSACTION
    await connection.commit();
    connection.release();

    res.json({
      success: true,
      data: {
        ticket: {
          id_ticket: ticket.id_ticket,
          numero_ticket: ticket.numero_ticket,
          status: 'en_cours',
          motif: ticket.nom_motif || null,
          client_name: resolvedName,
          is_guest: !ticket.id_client,
          id_client: ticket.id_client,
          id_guichet: idGuichet,
          guichet_number: guichet.nom,
          calledAt: new Date().toISOString()
        },
        queue: {
          remaining: fileAttentes && fileAttentes.length > 0 ? Math.max((fileAttentes[0].nb_personnes_restantes || 1) - 1, 0) : 0
        }
      },
      message: 'Ticket called successfully' + (ticket.id_client ? '' : ' (Guest)')
    });

  } catch (err) {
    console.error('[callSpecificTicket] CRITICAL ERROR:', err);
    console.error('[callSpecificTicket] Error stack:', err.stack);

    try {
      await connection.rollback();
    } catch (rollbackErr) {
      console.error('[callSpecificTicket] Rollback failed:', rollbackErr.message);
    }

    try {
      connection.release();
    } catch (releaseErr) {
      console.error('[callSpecificTicket] Release failed:', releaseErr.message);
    }

    return res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: err.message || 'An error occurred while calling ticket',
      code: err.code || undefined,
      sqlMessage: err.sqlMessage || undefined
    });
  }
}

/**
 * GET AGENCY QUEUE - Real-time queue status
 * CRITICAL: Shows guest_name for guest tickets (id_client IS NULL)
 */
async function getAgencyQueue(req, res) {
  try {
    const { id } = req.params;

    const agencies = await query(
      'SELECT id_agence, nom_agence FROM agences WHERE id_agence = ? AND actif = TRUE',
      [id]
    );

    if (!agencies || agencies.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Agency not found'
      });
    }

    // Get all active tickets for today (exclude skipped, cancelled, completed)
    // CRITICAL: LEFT JOIN clients to get name for registered users, show guest for guests
    const tickets = await query(
      `SELECT t.*,
              m.nom_motif,
              g.nom as guichet_nom,
              c.nom_complete as client_name
       FROM tickets t
       LEFT JOIN motifs m ON t.id_motif = m.id_motif
       LEFT JOIN guichets g ON t.id_guichet = g.id_guichet
       LEFT JOIN clients c ON t.id_client = c.id_client
       WHERE t.id_agence = ?
         AND t.status IN ('attente', 'en_cours')
         AND DATE(t.heure_prise) = CURDATE()
       ORDER BY t.numero_ticket ASC`,
      [id]
    );

    // Get queue stats
    const statsRows = await query(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'attente' THEN 1 ELSE 0 END) as waiting,
        SUM(CASE WHEN status = 'en_cours' THEN 1 ELSE 0 END) as in_progress
       FROM tickets
       WHERE id_agence = ? AND DATE(heure_prise) = CURDATE()`,
      [id]
    );

    const stats = statsRows[0];

    // Get active counters count
    const countersRows = await query(
      'SELECT COUNT(*) as count FROM guichets WHERE id_agence = ? AND status = "actif"',
      [id]
    );

    res.json({
      success: true,
      data: {
        id_agence: id,
        currentTime: new Date().toISOString(),
        stats: {
          total: parseInt(stats?.total) || 0,
          waiting: parseInt(stats?.waiting) || 0,
          in_progress: parseInt(stats?.in_progress) || 0,
          activeCounters: parseInt(countersRows[0]?.count) || 0
        },
        tickets: (tickets || []).map(t => ({
          id_ticket: t.id_ticket,
          numero_ticket: t.numero_ticket,
          status: t.status,
          motif: t.nom_motif,
          guichet: t.guichet_nom,
          // CRITICAL: Show client name for registered users, "Guest" for guest tickets
          clientName: t.client_name || 'Guest',
          is_guest: !t.id_client,
          bookingTime: t.heure_prise,
          calledTime: t.heure_appel,
          estimated_wait: t.temps_attente_estime
        }))
      }
    });
  } catch (err) {
    console.error('Get agency queue error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * GET QUEUE BY AGENCY - For Flutter app
 * CRITICAL: Uses files_attente as SINGLE SOURCE OF TRUTH
 * Returns queue stats in exact format Flutter expects:
 * { total_queue, active_guichets, estimated_wait, current_ticket }
 */
async function getQueueByAgency(req, res) {
  try {
    const { id_agence } = req.params;

    if (!id_agence) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_AGENCE',
        message: 'Agency ID is required'
      });
    }

    // STEP 1: Get files_attente for today (source of truth)
    // BUG 1 FIX: query() returns a flat array, not [rows, fields].
    // Destructuring with [filesAttente] would assign the first row object, not the array.
    const filesAttente = await query(
      'SELECT * FROM files_attente WHERE id_agence = ? AND DATE(date_creation) = CURDATE() ORDER BY id_file DESC LIMIT 1',
      [id_agence]
    );

    const fileAttente = Array.isArray(filesAttente) && filesAttente.length > 0 ? filesAttente[0] : null;

    // Get nb_personnes_restantes from files_attente (authoritative count)
    const totalQueue = fileAttente ? parseInt(fileAttente.nb_personnes_restantes) || 0 : 0;
    const currentTicket = fileAttente ? parseInt(fileAttente.numero_ticket) || 0 : 0;

    // STEP 2: Count active guichets
    const activeGuichetsResult = await query(
      'SELECT COUNT(*) as active_guichets FROM guichets WHERE id_agence = ? AND status = "actif"',
      [id_agence]
    );
    const activeGuichets = parseInt(activeGuichetsResult[0]?.active_guichets) || 0;

    // STEP 3: Calculate estimated wait time
    // Formula: avg_service_time * (total_queue / active_guichets)
    const avgServiceTime = 5; // minutes (default)
    let estimatedWait = 0;

    if (activeGuichets > 0 && totalQueue > 0) {
      estimatedWait = Math.floor(avgServiceTime * (totalQueue / activeGuichets));
    }

    // Return exact format Flutter expects
    // BUG 7 FIX: Add current_ticket_number so Flutter can display the current serving ticket
    res.json({
      success: true,
      data: {
        total_queue: totalQueue,  // From files_attente.nb_personnes_restantes
        active_guichets: activeGuichets,
        estimated_wait: estimatedWait,
        current_ticket: currentTicket,  // From files_attente.numero_ticket
        current_ticket_number: currentTicket  // Explicit field for Flutter QueueData.fromJson
      }
    });
  } catch (err) {
    console.error('Get queue by agency error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred while fetching queue data'
    });
  }
}

/**
 * GET TICKET POSITION - Get queue position for a specific ticket
 * Returns the number of people ahead in the queue
 *
 * CRITICAL: Uses DATABASE COUNT - not fake calculations!
 * Query: SELECT COUNT(*) FROM tickets WHERE:
 *   - id_agence = user's agency (same agency only)
 *   - status = 'attente' (ONLY waiting tickets)
 *   - numero_ticket < user's ticket (FIFO order)
 *   - id_ticket != user's ticket (exclude self)
 *
 * EXCLUDED: cancelled, skipped, completed, en_cours tickets
 */
async function getTicketPosition(req, res) {
  try {
    const { id } = req.params;

    // Get ticket details
    const tickets = await query(
      `SELECT t.id_ticket, t.id_agence, t.numero_ticket, t.status, t.id_file
       FROM tickets t
       WHERE t.id_ticket = ?`,
      [id]
    );

    if (!tickets || tickets.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Ticket not found'
      });
    }

    const ticket = tickets[0];

    // CRITICAL: Count ONLY waiting tickets with lower numero_ticket
    // EXCLUDE: cancelled, skipped, completed, en_cours
    const positionResult = await query(
      `SELECT COUNT(*) AS people_ahead
       FROM tickets
       WHERE id_agence = ?
       AND status = 'attente'
       AND numero_ticket < ?
       AND id_ticket != ?`,
      [ticket.id_agence, ticket.numero_ticket, ticket.id_ticket]
    );

    const peopleAhead = parseInt(positionResult[0]?.people_ahead) || 0;

    res.json({
      success: true,
      data: {
        id_ticket: ticket.id_ticket,
        numero_ticket: ticket.numero_ticket,
        status: ticket.status,
        people_ahead: peopleAhead,      // ✅ DATABASE COUNT
        queue_position: peopleAhead + 1 // ✅ Position in queue
      }
    });
  } catch (err) {
    console.error('[getTicketPosition] Error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred while fetching ticket position'
    });
  }
}

module.exports = {
  createTicket,
  getMyTickets,
  getTicketById,
  cancelTicket,
  callNextTicket,
  callSpecificTicket,
  serveTicket,
  skipTicket,
  getAgencyQueue,
  getQueueByAgency,
  getTicketPosition
};
