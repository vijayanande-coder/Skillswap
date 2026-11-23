const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
require('dotenv').config();

const { connectDB, isMongoConnected, getMongoUri } = require('./src/config/db');
const serviceRoutes = require('./src/routes/serviceRoutes');
const authRoutes = require('./src/routes/authRoutes');
const bookingRoutes = require('./src/routes/bookingRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const reviewRoutes = require('./src/routes/reviewRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Serve static frontend files from 'public'
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', serviceRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reviews', reviewRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const connected = isMongoConnected();
  const configured = !!getMongoUri();
  res.json({
    status: 'online',
    appName: 'SkillSwap API',
    version: '1.0.0',
    database: connected ? 'connected (MongoDB)' : (configured ? 'connecting / unavailable' : 'not configured'),
    mongoConfigured: configured,
    dbReadyState: mongoose.connection.readyState,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

// Single Page Application fallback: serve index.html for non-API GET requests
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
  next();
});

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Resource or API route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[SkillSwap Server Error]:', err.stack);
  res.status(500).json({
    success: false,
    message: 'An internal server error occurred',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start listening after connecting to database
let server;
const startServer = async () => {
  console.log('[Startup] Initializing SkillSwap server and database...');
  try {
    await connectDB();
  } catch (err) {
    console.error('[Startup Warning] Initial database connection attempt threw:', err.message);
  }

  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n=================================================`);
    console.log(`🚀 SkillSwap Server is running on port ${PORT}!`);
    console.log(`🌐 On this PC:    http://localhost:${PORT}`);
    console.log(`📱 Other Devices: http://10.250.95.133:${PORT}`);
    console.log(`📦 API Health:    http://localhost:${PORT}/api/health`);
    console.log(`=================================================\n`);
  });
};

startServer();

module.exports = app;
