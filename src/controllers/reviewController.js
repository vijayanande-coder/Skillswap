const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const User = require('../models/User');
const { ensureMongoConnected } = require('../config/db');

/**
 * @desc Submit a review and rating for a completed booking
 * @route POST /api/reviews (Protected)
 */
const createReview = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;
    const reviewerId = req.user._id.toString();

    if (!bookingId || !rating || !comment) {
      return res.status(400).json({
        success: false,
        message: 'Please provide booking ID, star rating (1-5), and feedback comment.',
      });
    }

    const numRating = Number(rating);
    if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be an integer between 1 and 5 stars.',
      });
    }

    if (comment.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: 'Comment must be at least 3 characters long.',
      });
    }

    const connected = await ensureMongoConnected(6000);
    if (!connected) {
      return res.status(503).json({
        success: false,
        retryable: true,
        message: 'Database is connecting. Please retry shortly.',
      });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Reviews can only be submitted after a service or barter is marked completed.',
      });
    }

    if (booking.client.toString() !== reviewerId) {
      return res.status(403).json({
        success: false,
        message: 'Only the student who requested this service can submit a review.',
      });
    }

    if (booking.isReviewed) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted a review for this completed request.',
      });
    }

    // Create the review
    const newReview = await Review.create({
      booking: booking._id,
      service: booking.service,
      serviceTitle: booking.serviceTitle,
      reviewer: req.user._id,
      reviewerName: req.user.name,
      reviewerUniversity: req.user.university || 'University Student',
      recipient: booking.provider,
      rating: numRating,
      comment: comment.trim(),
    });

    // Mark booking as reviewed
    booking.isReviewed = true;
    booking.reviewRating = numRating;
    await booking.save();

    // Recalculate average rating & reviewsCount for the provider
    const recipientReviews = await Review.find({ recipient: booking.provider });
    const count = recipientReviews.length;
    const sum = recipientReviews.reduce((acc, curr) => acc + curr.rating, 0);
    const avgRating = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;

    // Update recipient User document
    await User.findByIdAndUpdate(booking.provider, {
      rating: avgRating,
      reviewsCount: count,
    });

    // Update all Service listings belonging to this provider
    await Service.updateMany(
      { 'provider.userId': booking.provider },
      {
        'provider.rating': avgRating,
        'provider.reviewsCount': count,
      }
    );

    res.status(201).json({
      success: true,
      message: '⭐ Thank you! Your review and rating have been recorded.',
      data: newReview,
      updatedStats: {
        averageRating: avgRating,
        totalReviews: count,
      },
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'This booking has already been reviewed.' });
    }
    res.status(500).json({ success: false, message: 'Server error submitting review: ' + error.message });
  }
};

/**
 * @desc Get all reviews for a specific service listing
 * @route GET /api/reviews/service/:serviceId
 */
const getServiceReviews = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const connected = await ensureMongoConnected(6000);
    if (!connected) {
      return res.status(503).json({ success: false, message: 'Database connecting, please retry.' });
    }

    const reviews = await Review.find({ service: serviceId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    console.error('Error fetching service reviews:', error);
    res.status(500).json({ success: false, message: 'Server error loading reviews' });
  }
};

/**
 * @desc Get all reviews received by a student provider
 * @route GET /api/reviews/user/:userId
 */
const getUserReviews = async (req, res) => {
  try {
    const { userId } = req.params;

    const connected = await ensureMongoConnected(6000);
    if (!connected) {
      return res.status(503).json({ success: false, message: 'Database connecting, please retry.' });
    }

    const reviews = await Review.find({ recipient: userId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    console.error('Error fetching user reviews:', error);
    res.status(500).json({ success: false, message: 'Server error loading reviews' });
  }
};

module.exports = {
  createReview,
  getServiceReviews,
  getUserReviews,
};
