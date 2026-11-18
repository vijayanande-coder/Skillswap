const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { isMongoConnected } = require('../config/db');

// In-memory reference for offline/fallback mode (will be shared from runtime store)
let runtimeUsers = [];

const setRuntimeUsersRef = (users) => {
  runtimeUsers = users;
};

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'skillswap_jwt_dev_secret_key_2026_super_secure'
      );

      if (isMongoConnected()) {
        req.user = await User.findById(decoded.id).select('-password');
      } else {
        const found = runtimeUsers.find(
          (u) => (u._id && u._id.toString() === decoded.id) || u.id === decoded.id
        );
        if (found) {
          const { password, ...safeUser } = found;
          req.user = safeUser;
        }
      }

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized: user not found',
        });
      }

      return next();
    } catch (error) {
      console.error('Auth verification error:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Not authorized, token failed or expired',
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

module.exports = {
  protect,
  setRuntimeUsersRef,
};
