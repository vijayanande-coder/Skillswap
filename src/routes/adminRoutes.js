const express = require('express');
const router = express.Router();
const {
  getAdminStats,
  getAdminUsers,
  toggleUserVerification,
  updateUserRole,
  deleteUser,
  getAdminServices,
  updateServiceStatus,
  deleteAdminService,
  getAdminBookings,
  claimInitialAdmin,
} = require('../controllers/adminController');
const { protect, admin } = require('../middleware/authMiddleware');

// Owner self-promotion if 0 admins exist (authenticated user)
router.post('/claim-owner', protect, claimInitialAdmin);

// All routes below require both valid JWT and 'admin' role
router.use(protect, admin);

// Analytics
router.get('/stats', getAdminStats);

// User Management
router.get('/users', getAdminUsers);
router.patch('/users/:id/verify', toggleUserVerification);
router.patch('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);

// Service Moderation
router.get('/services', getAdminServices);
router.patch('/services/:id/status', updateServiceStatus);
router.delete('/services/:id', deleteAdminService);

// Bookings & Swaps Oversight
router.get('/bookings', getAdminBookings);

module.exports = router;
