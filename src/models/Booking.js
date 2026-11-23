const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    serviceTitle: {
      type: String,
      required: true,
    },
    serviceType: {
      type: String,
      enum: ['exchange', 'freelance', 'lesson'],
      required: true,
    },
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    clientName: {
      type: String,
      required: true,
    },
    clientUniversity: {
      type: String,
      default: '',
    },
    provider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    providerName: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      default: 0, // In Indian Rupees (₹)
    },
    exchangeOffer: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'completed', 'cancelled'],
      default: 'pending',
    },
    simulatedPaymentStatus: {
      type: String,
      enum: ['free_exchange', 'simulated_held_in_escrow', 'simulated_credited'],
      default: 'free_exchange',
    },
    isReviewed: {
      type: Boolean,
      default: false,
    },
    reviewRating: {
      type: Number,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Booking', bookingSchema);
