const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide service title'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide service description'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Please select a category'],
      enum: [
        'Web & Programming',
        'Academic Tutoring',
        'Design & Creative',
        'Writing & Translation',
        'AI & Data Science',
        'Video & Audio',
        'Business & Marketing',
      ],
    },
    serviceType: {
      type: String,
      required: true,
      enum: ['freelance', 'exchange', 'lesson'],
      default: 'freelance',
    },
    price: {
      type: Number,
      default: 0, // Stored in Indian Rupees (₹)
    },
    priceUnit: {
      type: String,
      enum: ['fixed', 'per_hour', 'free_exchange'],
      default: 'fixed',
    },
    exchangeFor: {
      type: String,
      default: '',
    },
    deliveryTime: {
      type: String,
      default: '2 days delivery',
    },
    tags: {
      type: [String],
      default: [],
    },
    thumbnail: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'paused'],
      default: 'active',
    },
    provider: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
      name: { type: String, required: true },
      university: { type: String, required: true },
      avatar: { type: String, default: '' },
      rating: { type: Number, default: 0 },
      reviewsCount: { type: Number, default: 0 },
      isVerifiedStudent: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Service', serviceSchema);
