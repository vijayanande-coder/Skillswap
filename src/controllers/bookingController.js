const Booking = require('../models/Booking');
const Service = require('../models/Service');
const User = require('../models/User');
const { isMongoConnected } = require('../config/db');
const { inMemoryServices } = require('./serviceController');
const { runtimeUsers } = require('./authController');
const mongoose = require('mongoose');

// In-memory runtime bookings store for offline testing
const inMemoryBookings = [];

/**
 * @desc Create a new hiring request, barter proposal, or lesson booking
 * @route POST /api/bookings (Protected)
 */
const createBooking = async (req, res) => {
  try {
    const { serviceId, exchangeOffer, notes } = req.body;
    const client = req.user;
    const clientId = (client._id || client.id).toString();

    if (!serviceId) {
      return res.status(400).json({ success: false, message: 'Please provide a valid serviceId' });
    }

    let service = null;

    if (isMongoConnected()) {
      if (mongoose.Types.ObjectId.isValid(serviceId)) {
        service = await Service.findById(serviceId);
      }
    } else {
      service = inMemoryServices.find(
        (s) => (s._id && s._id.toString() === serviceId) || s.id === serviceId
      );
    }

    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found or no longer active' });
    }

    const providerId = (service.provider.userId || service.provider._id || '').toString();

    // Prevent booking your own service
    if (providerId === clientId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot book or propose an exchange on your own service.',
      });
    }

    const bookingData = {
      service: service._id || service.id,
      serviceTitle: service.title,
      serviceType: service.serviceType,
      client: client._id || client.id,
      clientName: client.name,
      clientUniversity: client.university || 'University Student',
      provider: service.provider.userId,
      providerName: service.provider.name,
      price: service.price || 0, // Stored in INR (₹)
      exchangeOffer: service.serviceType === 'exchange' ? (exchangeOffer || 'Skill barter proposal') : '',
      notes: notes || '',
      status: 'pending',
      simulatedPaymentStatus:
        service.serviceType === 'exchange'
          ? 'free_exchange'
          : 'simulated_held_in_escrow',
    };

    if (isMongoConnected()) {
      const created = await Booking.create(bookingData);
      return res.status(201).json({
        success: true,
        message: 'Request submitted successfully to student provider',
        data: created,
      });
    }

    const fallbackBooking = {
      ...bookingData,
      _id: new mongoose.Types.ObjectId().toString(),
      id: new mongoose.Types.ObjectId().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    inMemoryBookings.unshift(fallbackBooking);

    res.status(201).json({
      success: true,
      message: 'Request submitted successfully to student provider',
      data: fallbackBooking,
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ success: false, message: 'Server error creating request' });
  }
};

/**
 * @desc Get all bookings for current student (both as client and as provider)
 * @route GET /api/bookings/my-bookings (Protected)
 */
const getMyBookings = async (req, res) => {
  try {
    const userId = (req.user._id || req.user.id).toString();

    if (isMongoConnected()) {
      const asClient = await Booking.find({ client: userId }).sort({ createdAt: -1 });
      const asProvider = await Booking.find({ provider: userId }).sort({ createdAt: -1 });

      return res.json({
        success: true,
        data: {
          sentRequests: asClient,
          receivedOrders: asProvider,
        },
      });
    }

    const asClient = inMemoryBookings.filter(
      (b) => b.client && b.client.toString() === userId
    );
    const asProvider = inMemoryBookings.filter(
      (b) => b.provider && b.provider.toString() === userId
    );

    res.json({
      success: true,
      data: {
        sentRequests: asClient,
        receivedOrders: asProvider,
      },
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc Update booking status (accept, complete, cancel)
 * @route PATCH /api/bookings/:id/status (Protected)
 */
const updateBookingStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'accepted', 'completed', 'cancelled'
    const userId = (req.user._id || req.user.id).toString();

    if (!['accepted', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    if (isMongoConnected()) {
      const booking = await Booking.findById(id);
      if (!booking) {
        return res.status(404).json({ success: false, message: 'Request not found' });
      }

      const isProvider = booking.provider.toString() === userId;
      const isClient = booking.client.toString() === userId;

      if (!isProvider && !isClient) {
        return res.status(403).json({ success: false, message: 'Not authorized to modify this request' });
      }

      // Only provider can accept or complete
      if (['accepted', 'completed'].includes(status) && !isProvider) {
        return res.status(403).json({ success: false, message: 'Only the service provider can accept or complete orders' });
      }

      booking.status = status;

      // When completed, credit simulated earnings to provider
      if (status === 'completed') {
        booking.simulatedPaymentStatus = booking.serviceType === 'exchange' ? 'free_exchange' : 'simulated_credited';
        if (booking.price > 0) {
          await User.findByIdAndUpdate(booking.provider, {
            $inc: { earningsTotal: booking.price, completedOrders: 1 },
          });
        } else {
          await User.findByIdAndUpdate(booking.provider, {
            $inc: { completedOrders: 1 },
          });
        }
      }

      const updated = await booking.save();
      return res.json({ success: true, message: `Request status updated to ${status}`, data: updated });
    }

    // In-memory fallback
    const booking = inMemoryBookings.find(
      (b) => (b._id && b._id.toString() === id) || b.id === id
    );

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    const isProvider = booking.provider.toString() === userId;
    const isClient = booking.client.toString() === userId;

    if (!isProvider && !isClient) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this request' });
    }

    if (['accepted', 'completed'].includes(status) && !isProvider) {
      return res.status(403).json({ success: false, message: 'Only the service provider can accept or complete orders' });
    }

    booking.status = status;
    booking.updatedAt = new Date().toISOString();

    if (status === 'completed') {
      booking.simulatedPaymentStatus = booking.serviceType === 'exchange' ? 'free_exchange' : 'simulated_credited';
      const providerUser = runtimeUsers.find(
        (u) => (u._id && u._id.toString() === booking.provider.toString()) || u.id === booking.provider
      );
      if (providerUser) {
        providerUser.completedOrders = (providerUser.completedOrders || 0) + 1;
        if (booking.price > 0) {
          providerUser.earningsTotal = (providerUser.earningsTotal || 0) + booking.price;
        }
      }
    }

    res.json({ success: true, message: `Request status updated to ${status}`, data: booking });
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({ success: false, message: 'Server error updating request' });
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  updateBookingStatus,
};
