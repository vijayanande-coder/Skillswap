const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { ensureMongoConnected, isMongoConnected } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'skillswap_dev_jwt_secret_key_2026_super_secure';

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);

      // Ensure MongoDB connection is active
      const connected = await ensureMongoConnected(6000);
      if (!connected) {
        return res.status(503).json({
          success: false,
          retryable: true,
          message: 'Database is currently connecting. Please retry shortly.',
        });
      }

      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized: student account not found',
        });
      }

      return next();
    } catch (error) {
      console.error('Auth verification error:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, session expired or invalid token',
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no authentication token provided',
    });
  }
};

/**
 * Admin authorization middleware
 * Requires req.user to be set by protect middleware and role to be 'admin'
 */
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied: Administrator privileges required',
  });
};

module.exports = {
  protect,
  admin,
};
