const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      unique: true, // Only 1 review per completed booking
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    serviceTitle: {
      type: String,
      required: true,
    },
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reviewerName: {
      type: String,
      required: true,
    },
    reviewerUniversity: {
      type: String,
      default: 'University Student',
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: [true, 'Please provide a rating between 1 and 5'],
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: [true, 'Please provide a feedback comment'],
      trim: true,
      minlength: 3,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Review', reviewSchema);
