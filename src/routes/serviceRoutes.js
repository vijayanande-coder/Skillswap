const express = require('express');
const router = express.Router();
const {
  getAllServices,
  getServiceById,
  createService,
  getMyServices,
  deleteService,
  getCategories,
  getStats,
} = require('../controllers/serviceController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.get('/services', getAllServices);
router.get('/services/my-services', protect, getMyServices);
router.get('/services/:id', getServiceById);
router.post('/services', protect, createService);
router.delete('/services/:id', protect, deleteService);

// Platform stats and categories
router.get('/categories', getCategories);
router.get('/stats', getStats);

module.exports = router;
