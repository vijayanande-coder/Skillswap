const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const { connectDB, isMongoConnected } = require('./src/config/db');
const serviceRoutes = require('./src/routes/serviceRoutes');
const authRoutes = require('./src/routes/authRoutes');
const bookingRoutes = require('./src/routes/bookingRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB (local or Atlas)
connectDB();

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

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    appName: 'SkillSwap API',
    version: '1.0.0',
    database: isMongoConnected() ? 'connected (MongoDB)' : 'in-memory (seed mode)',
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

// Start listening on all network interfaces so other devices can access it
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=================================================`);
  console.log(`🚀 SkillSwap Server is running on port ${PORT}!`);
  console.log(`🌐 On this PC:    http://localhost:${PORT}`);
  console.log(`📱 Other Devices: http://10.250.95.133:${PORT}`);
  console.log(`📦 API Health:    http://localhost:${PORT}/api/health`);
  console.log(`=================================================\n`);
});

module.exports = app;
