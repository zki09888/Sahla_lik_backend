const { query } = require('../config/db');

/**
 * GET DAILY STATS - For admin dashboard
 */
async function getDailyStats(req, res) {
  try {
    const { id_agence } = req.query;

    if (!id_agence) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_AGENCE',
        message: 'Agency ID is required'
      });
    }

    // Hourly breakdown
    const hourlyData = await query(
      `SELECT
        HOUR(heure_prise) as hour,
        COUNT(*) as tickets_created,
        SUM(CASE WHEN status = 'attente' THEN 1 ELSE 0 END) as waiting,
        SUM(CASE WHEN status = 'en_cours' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'termine' THEN 1 ELSE 0 END) as served,
        SUM(CASE WHEN status = 'annule' THEN 1 ELSE 0 END) as cancelled
      FROM tickets
      WHERE DATE(heure_prise) = CURDATE() AND id_agence = ?
      GROUP BY HOUR(heure_prise) ORDER BY hour`,
      [id_agence]
    );

    // Build hourly array (8h to 17h)
    const hourly = [];
    for (let h = 8; h <= 17; h++) {
      const found = (hourlyData || []).find(r => r.hour === h);
      hourly.push({
        hour: `${String(h).padStart(2, '0')}:00`,
        tickets_created: found ? parseInt(found.tickets_created) : 0,
        waiting: found ? parseInt(found.waiting) : 0,
        in_progress: found ? parseInt(found.in_progress) : 0,
        served: found ? parseInt(found.served) : 0,
        cancelled: found ? parseInt(found.cancelled) : 0
      });
    }

    // Totals
    const totals = await query(
      `SELECT
        COUNT(*) as total_created,
        SUM(CASE WHEN status = 'termine' THEN 1 ELSE 0 END) as total_served,
        SUM(CASE WHEN status = 'annule' THEN 1 ELSE 0 END) as total_cancelled,
        AVG(CASE WHEN status = 'termine' THEN temps_attente ELSE NULL END) as avg_wait_time
      FROM tickets
      WHERE DATE(heure_prise) = CURDATE() AND id_agence = ?`,
      [id_agence]
    );

    res.json({
      success: true,
      data: {
        date: new Date().toISOString().split('T')[0],
        hourly: hourly,
        totals: {
          created: parseInt(totals[0]?.total_created) || 0,
          served: parseInt(totals[0]?.total_served) || 0,
          cancelled: parseInt(totals[0]?.total_cancelled) || 0,
          avg_wait_time: Math.round(parseFloat(totals[0]?.avg_wait_time) || 0)
        }
      }
    });
  } catch (err) {
    console.error('Get daily stats error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * GET STATS - Real-time dashboard stats
 */
async function getStats(req, res) {
  try {
    const { id_agence } = req.query;

    if (!id_agence) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_AGENCE',
        message: 'Agency ID is required'
      });
    }

    // Active counters
    const activeCounters = await query(
      'SELECT COUNT(*) as count FROM guichets WHERE id_agence = ? AND status = "actif"',
      [id_agence]
    );

    // Total queue
    const totalQueue = await query(
      'SELECT COALESCE(SUM(nb_personnes_restantes), 0) as total FROM files_attente WHERE id_agence = ?',
      [id_agence]
    );

    // Served today
    const servedToday = await query(
      'SELECT COUNT(*) as count FROM tickets WHERE status = "termine" AND DATE(heure_service) = CURDATE() AND id_agence = ?',
      [id_agence]
    );

    // Average wait time
    const avgWaitTime = await query(
      'SELECT AVG(temps_attente) as avg_time FROM tickets WHERE status = "termine" AND DATE(heure_service) = CURDATE() AND id_agence = ? AND temps_attente IS NOT NULL',
      [id_agence]
    );

    res.json({
      success: true,
      data: {
        activeCounters: parseInt(activeCounters[0]?.count) || 0,
        totalQueue: parseInt(totalQueue[0]?.total) || 0,
        servedToday: parseInt(servedToday[0]?.count) || 0,
        avgWaitTime: Math.round(parseFloat(avgWaitTime[0]?.avg_time) || 0)
      }
    });
  } catch (err) {
    console.error('Get stats error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * GET MONTHLY STATS
 */
async function getMonthlyStats(req, res) {
  try {
    const { id_agence } = req.query;

    let queryStr = `
      SELECT
        MONTH(heure_prise) as month,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'termine' THEN 1 ELSE 0 END) as served
      FROM tickets
      WHERE heure_prise >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
    `;
    const params = [];

    if (id_agence) {
      queryStr += ' AND id_agence = ?';
      params.push(id_agence);
    }

    queryStr += ' GROUP BY MONTH(heure_prise) ORDER BY month';

    const results = await query(queryStr, params);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth() + 1;

    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const m = ((currentMonth - i - 1 + 12) % 12) + 1;
      const found = (results || []).find(r => r.month === m);
      monthlyData.push({
        name: months[m - 1],
        month: m,
        total: found ? parseInt(found.total) : 0,
        served: found ? parseInt(found.served) : 0
      });
    }

    res.json({
      success: true,
      data: monthlyData
    });
  } catch (err) {
    console.error('Get monthly stats error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * GET WEEKLY STATS
 */
async function getWeeklyStats(req, res) {
  try {
    const { id_agence } = req.query;

    let queryStr = `
      SELECT
        DAYOFWEEK(heure_prise) as day_num,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'termine' THEN 1 ELSE 0 END) as served
      FROM tickets
      WHERE heure_prise >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
    `;
    const params = [];

    if (id_agence) {
      queryStr += ' AND id_agence = ?';
      params.push(id_agence);
    }

    queryStr += ' GROUP BY DAYOFWEEK(heure_prise) ORDER BY day_num';

    const results = await query(queryStr, params);

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weeklyData = days.map((day, i) => {
      const found = (results || []).find(r => r.day_num === i + 1);
      return {
        day: day,
        day_num: i,
        total: found ? parseInt(found.total) : 0,
        served: found ? parseInt(found.served) : 0
      };
    });

    res.json({
      success: true,
      data: weeklyData
    });
  } catch (err) {
    console.error('Get weekly stats error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * GET INSIGHTS - Dashboard insights
 */
async function getInsights(req, res) {
  try {
    const { id_agence } = req.query;

    const insights = [];

    // Check queue size
    const totalQueue = await query(
      'SELECT COALESCE(SUM(nb_personnes_restantes), 0) as total FROM files_attente WHERE id_agence = ?',
      [id_agence]
    );
    const totalWaiting = parseInt(totalQueue[0]?.total) || 0;
    const isCrowded = totalWaiting > 30;

    if (isCrowded) {
      insights.push({
        icon: '🚨',
        type: 'High Queue Alert',
        color: '#ef4444',
        bg: '#fef2f2',
        border: '#fec9ca',
        text: `Current queue has ${totalWaiting} people waiting. Consider activating additional counters.`
      });
    }

    // Peak hour
    const peakData = await query(
      `SELECT HOUR(heure_prise) as hour, COUNT(*) as count
       FROM tickets
       WHERE DATE(heure_prise) = CURDATE() AND id_agence = ?
       GROUP BY HOUR(heure_prise) ORDER BY count DESC LIMIT 1`,
      [id_agence]
    );

    if (peakData && peakData.length > 0 && peakData[0].count > 15) {
      insights.push({
        icon: '⏰',
        type: 'Peak Hour',
        color: '#f59e0b',
        bg: '#fffbeb',
        border: '#fde68a',
        text: `Peak hour is around ${String(peakData[0].hour).padStart(2, '0')}:00 with ${peakData[0].count} tickets.`
      });
    }

    // Average service time
    const avgService = await query(
      `SELECT AVG(TIMESTAMPDIFF(MINUTE, heure_prise, heure_service)) as avg_time
       FROM tickets
       WHERE status = 'termine' AND DATE(heure_service) = CURDATE() AND id_agence = ?`,
      [id_agence]
    );
    const avgTime = Math.round(parseFloat(avgService[0]?.avg_time) || 0);

    if (avgTime > 0) {
      insights.push({
        icon: '📊',
        type: 'Average Service Time',
        color: '#3b82f6',
        bg: '#eff6ff',
        border: '#bfdbfe',
        text: `Average service time is ${avgTime} minutes per ticket.`
      });
    }

    if (insights.length === 0) {
      insights.push({
        icon: '✅',
        type: 'All Clear',
        color: '#10b981',
        bg: '#ecfdf5',
        border: '#a7f3d0',
        text: 'No significant issues detected. System is running smoothly.'
      });
    }

    res.json({
      success: true,
      data: {
        insights: insights,
        isCrowded: isCrowded,
        totalQueue: totalWaiting
      }
    });
  } catch (err) {
    console.error('Get insights error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * SUBMIT SERVICE RATING
 */
async function submitRating(req, res) {
  try {
    const { id_ticket, rating, tags, commentaire } = req.body;
    const idClient = req.user?.id_client;

    if (!id_ticket || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_RATING',
        message: 'Ticket ID and rating (1-5) are required'
      });
    }

    if (!idClient) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication required'
      });
    }

    const tickets = await query('SELECT id_ticket, id_agence, id_guichet FROM tickets WHERE id_ticket = ?', [id_ticket]);
    const ticket = tickets[0];

    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Ticket not found'
      });
    }

    // Check for existing rating
    const existing = await query(
      'SELECT id_rating FROM service_ratings WHERE id_ticket = ?',
      [id_ticket]
    );

    if (existing && existing.length > 0) {
      await query(
        'UPDATE service_ratings SET rating = ?, tags = ?, commentaire = ? WHERE id_rating = ?',
        [rating, JSON.stringify(tags || []), commentaire || null, existing[0].id_rating]
      );
    } else {
      await query(
        'INSERT INTO service_ratings (id_ticket, id_guichet, rating, tags, commentaire) VALUES (?, ?, ?, ?, ?)',
        [id_ticket, ticket.id_guichet, rating, JSON.stringify(tags || []), commentaire || null]
      );
    }

    res.json({
      success: true,
      data: {
        rating: rating,
        commentaire: commentaire || null
      }
    });
  } catch (err) {
    console.error('Submit rating error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

/**
 * GET AGENCY RATINGS
 */
async function getAgencyRatings(req, res) {
  try {
    const { id } = req.params;

    const ratings = await query(
      `SELECT sr.*, t.numero_ticket, c.nom_complete
       FROM service_ratings sr
       JOIN tickets t ON sr.id_ticket = t.id_ticket
       JOIN clients c ON t.id_client = c.id_client
       WHERE t.id_agence = ?
       ORDER BY sr.date_creation DESC
       LIMIT 50`,
      [id]
    );

    const statsRows = await query(
      `SELECT
        COUNT(*) as total,
        AVG(sr.rating) as avg_rating,
        SUM(CASE WHEN sr.rating = 5 THEN 1 ELSE 0 END) as five_star,
        SUM(CASE WHEN sr.rating = 4 THEN 1 ELSE 0 END) as four_star,
        SUM(CASE WHEN sr.rating = 3 THEN 1 ELSE 0 END) as three_star,
        SUM(CASE WHEN sr.rating = 2 THEN 1 ELSE 0 END) as two_star,
        SUM(CASE WHEN sr.rating = 1 THEN 1 ELSE 0 END) as one_star
       FROM service_ratings sr
       JOIN tickets t ON sr.id_ticket = t.id_ticket
       WHERE t.id_agence = ?`,
      [id]
    );

    const s = statsRows[0];

    res.json({
      success: true,
      data: {
        ratings: (ratings || []).map(r => ({
          id_rating: r.id_rating,
          rating: r.rating,
          tags: r.tags ? JSON.parse(r.tags) : [],
          commentaire: r.commentaire,
          numero_ticket: r.numero_ticket,
          client: r.nom_complete,
          date_creation: r.date_creation
        })),
        stats: {
          total: parseInt(s?.total) || 0,
          avg_rating: parseFloat(s?.avg_rating) || 0,
          distribution: {
            5: parseInt(s?.five_star) || 0,
            4: parseInt(s?.four_star) || 0,
            3: parseInt(s?.three_star) || 0,
            2: parseInt(s?.two_star) || 0,
            1: parseInt(s?.one_star) || 0
          }
        }
      }
    });
  } catch (err) {
    console.error('Get agency ratings error:', err);
    res.status(500).json({
      success: false,
      error: 'SERVER_ERROR',
      message: 'An error occurred'
    });
  }
}

module.exports = {
  getDailyStats,
  getStats,
  getMonthlyStats,
  getWeeklyStats,
  getInsights,
  submitRating,
  getAgencyRatings
};
