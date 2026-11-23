const express = require('express');
const router = express.Router();
const {
  createReview,
  getServiceReviews,
  getUserReviews,
} = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');

// Public read routes
router.get('/service/:serviceId', getServiceReviews);
router.get('/user/:userId', getUserReviews);

// Protected submit review route
router.post('/', protect, createReview);

module.exports = router;
