const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
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
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    fromUserName: {
      type: String,
      required: true,
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    toUserName: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['freelance_payment', 'lesson_payment', 'skill_barter'],
      required: true,
    },
    amount: {
      type: Number,
      default: 0, // In Indian Rupees (₹)
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['simulated_escrow', 'simulated_credited', 'simulated_refunded', 'barter_completed'],
      default: 'simulated_escrow',
    },
    description: {
      type: String,
      default: 'Simulated marketplace transaction',
    },
    isSimulated: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Transaction', transactionSchema);
