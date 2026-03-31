const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { testConnection } = require('./src/config/db');
const { smartRateLimiter, createRateLimiter } = require('./src/middleware/rateLimiter');

const authRoutes = require('./src/routes/auth');
const agencyRoutes = require('./src/routes/agencies');
const enterpriseRoutes = require('./src/routes/enterprises');
const ticketRoutes = require('./src/routes/tickets');
const guichetRoutes = require('./src/routes/guichets');
const analyticsRoutes = require('./src/routes/analytics');
const institutionRoutes = require('./src/routes/institutions');
const rapportRoutes = require('./src/routes/rapports');
const notificationRoutes = require('./src/routes/notifications');
const queueRoutes = require('./src/routes/queues');

// New client routes
const clientAuthRoutes = require('./src/routes/clients');
const clientAgencyRoutes = require('./src/routes/client-agencies');
const ratingsRoutes = require('./src/routes/ratings');
const offSmsRoutes = require('./src/routes/off-sms');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(helmet());

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : ['http://localhost:3000'];
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-guest-id']
}));

// Smart Rate Limiting - Different limits per endpoint
// Apply global smart limiter (uses endpoint-specific configs)
app.use(smartRateLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    success: true,
    message: 'SAHLA-LIK API is running',
    version: '2.0.0',
    database: process.env.DB_NAME || 'sahlalik_db',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/agencies', agencyRoutes);
app.use('/api/v1/agences', agencyRoutes); // Alias for French
app.use('/api/v1/enterprises', enterpriseRoutes);
app.use('/api/v1/tickets', ticketRoutes);
app.use('/api/v1/guichets', guichetRoutes);
app.use('/api/v1/counters', guichetRoutes); // Alias for English
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/institutions', institutionRoutes);
app.use('/api/v1/rapports', rapportRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/queues', queueRoutes); // Queue endpoint for Flutter

// Client routes
app.use('/api/v1/clients', clientAuthRoutes);
app.use('/api/v1/client/agencies', clientAgencyRoutes);
app.use('/api/v1/ratings', ratingsRoutes);
app.use('/api/v1/off-sms', offSmsRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'SERVER_ERROR',
    message: process.env.NODE_ENV === 'production'
      ? 'An internal error occurred'
      : err.message
  });
});

// Start Server
async function startServer() {
  const dbConnected = await testConnection();

  if (!dbConnected) {
    console.error('⚠️  Database connection failed. Please check your database configuration.');
    console.log('To setup the database, run:');
    console.log('  mysql -u root -p < schema.sql');
  }

  // Listen on ALL network interfaces (0.0.0.0) for local network access
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   🚀 SAHLA-LIK Backend Server v2.1                          ║
║                                                              ║
║   Server:     http://localhost:${PORT}                         ║
║   API Base:   http://localhost:${PORT}/api/v1                  ║
║   Health:     http://localhost:${PORT}/api/v1/health           ║
║   Network:    http://192.168.8.100:${PORT}/api/v1              ║
║   Database:   ${(process.env.DB_NAME || 'sahlalik_db').padEnd(15)}                         ║
║                                                              ║
║   Routes:                                                    ║
║   • /api/v1/auth/*         Authentication                   ║
║   • /api/v1/clients/*      Client Auth                      ║
║   • /api/v1/agencies/*     Agencies                         ║
║   • /api/v1/client/agencies/* Client Agency Info            ║
║   • /api/v1/enterprises/*  Enterprises                      ║
║   • /api/v1/tickets/*      Tickets                          ║
║   • /api/v1/guichets/*     Counters (Guichets)              ║
║   • /api/v1/ratings/*      Service & App Ratings            ║
║   • /api/v1/notifications/* Notifications                   ║
║   • /api/v1/analytics/*    Analytics                        ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
    `);
  });
}

startServer();

module.exports = app;
