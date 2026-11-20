const Service = require('../models/Service');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { categories } = require('../data/seedData');
const { ensureMongoConnected, isMongoConnected } = require('../config/db');
const mongoose = require('mongoose');

/**
 * @desc Get all real active services with search, category, and type filters from MongoDB Atlas
 * @route GET /api/services
 */
const getAllServices = async (req, res) => {
  try {
    const { search, category, type, sort } = req.query;

    const connected = await ensureMongoConnected(6000);
    if (!connected) {
      return res.status(503).json({
        success: false,
        retryable: true,
        message: 'Database is connecting. Please retry shortly.',
      });
    }

    const query = { status: 'active' };

    if (category && category !== 'All') {
      query.category = category;
    }

    if (type && type !== 'all') {
      query.serviceType = type;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
        { 'provider.name': { $regex: search, $options: 'i' } },
      ];
    }

    let sortOptions = { createdAt: -1 };
    if (sort === 'price-low') {
      sortOptions = { price: 1 };
    } else if (sort === 'price-high') {
      sortOptions = { price: -1 };
    } else if (sort === 'rating') {
      sortOptions = { 'provider.rating': -1 };
    }

    const services = await Service.find(query).sort(sortOptions);

    res.json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (error) {
    console.error('Error in getAllServices:', error);
    res.status(500).json({ success: false, message: 'Server error while fetching services' });
  }
};

/**
 * @desc Get single service by ID from MongoDB Atlas
 * @route GET /api/services/:id
 */
const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const connected = await ensureMongoConnected(6000);
    if (!connected) {
      return res.status(503).json({
        success: false,
        retryable: true,
        message: 'Database is connecting. Please retry shortly.',
      });
    }

    if (mongoose.Types.ObjectId.isValid(id)) {
      const service = await Service.findById(id);
      if (service) {
        return res.json({ success: true, data: service });
      }
    }

    return res.status(404).json({ success: false, message: 'Service not found' });
  } catch (error) {
    console.error('Error in getServiceById:', error);
    res.status(500).json({ success: false, message: 'Server error fetching service' });
  }
};

/**
 * @desc Create new student service or barter exchange permanently in MongoDB Atlas
 * @route POST /api/services (Protected)
 */
const createService = async (req, res) => {
  try {
    const { title, description, category, serviceType, price, priceUnit, exchangeFor, deliveryTime, tags, thumbnail } = req.body;

    if (!title || !description || !category || !serviceType) {
      return res.status(400).json({
        success: false,
        message: 'Please provide title, description, category, and service type.',
      });
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Must be logged in as a student to post a service.' });
    }

    const connected = await ensureMongoConnected(6000);
    if (!connected) {
      return res.status(503).json({
        success: false,
        retryable: true,
        message: 'Database is connecting. Please wait a moment and try again.',
      });
    }

    const newServiceData = {
      title: title.trim(),
      description: description.trim(),
      category,
      serviceType,
      price: serviceType === 'exchange' ? 0 : Math.max(0, Number(price) || 0),
      priceUnit: serviceType === 'exchange' ? 'free_exchange' : (priceUnit || 'fixed'),
      exchangeFor: serviceType === 'exchange' ? (exchangeFor || '').trim() : '',
      deliveryTime: deliveryTime ? deliveryTime.trim() : 'Flexible delivery',
      tags: Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map((t) => t.trim()).filter(Boolean) : []),
      thumbnail: thumbnail || '',
      status: 'active',
      provider: {
        userId: user._id || user.id,
        name: user.name,
        university: user.university,
        avatar: user.avatar || '',
        rating: user.rating || 0,
        reviewsCount: user.reviewsCount || 0,
        isVerifiedStudent: true,
      },
    };

    const created = await Service.create(newServiceData);
    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ success: false, message: 'Server error creating service: ' + error.message });
  }
};

/**
 * @desc Get services created by the logged-in student from MongoDB Atlas
 * @route GET /api/services/my-services (Protected)
 */
const getMyServices = async (req, res) => {
  try {
    const userId = (req.user._id || req.user.id).toString();

    const connected = await ensureMongoConnected(6000);
    if (!connected) {
      return res.status(503).json({
        success: false,
        retryable: true,
        message: 'Database is connecting. Please retry shortly.',
      });
    }

    const services = await Service.find({ 'provider.userId': userId }).sort({ createdAt: -1 });
    return res.json({ success: true, count: services.length, data: services });
  } catch (error) {
    console.error('Error fetching student services:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc Delete service (only creator can delete) in MongoDB Atlas
 * @route DELETE /api/services/:id (Protected)
 */
const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.user._id || req.user.id).toString();

    const connected = await ensureMongoConnected(6000);
    if (!connected) {
      return res.status(503).json({
        success: false,
        retryable: true,
        message: 'Database is connecting. Please retry shortly.',
      });
    }

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    if (service.provider.userId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this service' });
    }

    await service.deleteOne();
    return res.json({ success: true, message: 'Service removed successfully' });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting service' });
  }
};

/**
 * @desc Get categories with real live counts of active services from MongoDB Atlas
 * @route GET /api/categories
 */
const getCategories = async (req, res) => {
  try {
    const connected = await ensureMongoConnected(6000);
    let serviceList = [];
    if (connected) {
      serviceList = await Service.find({ status: 'active' }, 'category');
    }

    // Compute live counts
    const categoryCounts = {};
    serviceList.forEach((s) => {
      categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
    });

    const populatedCategories = categories.map((cat) => ({
      ...cat,
      count: categoryCounts[cat.name] || 0,
    }));

    res.json({
      success: true,
      data: populatedCategories,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc Get real platform statistics from MongoDB Atlas (no fake numbers)
 * @route GET /api/stats
 */
const getStats = async (req, res) => {
  try {
    const connected = await ensureMongoConnected(6000);
    let studentCount = 0;
    let servicesCount = 0;
    let completedBookings = 0;
    let barterCount = 0;
    let collegesCount = 0;

    if (connected) {
      studentCount = await User.countDocuments();
      servicesCount = await Service.countDocuments({ status: 'active' });
      completedBookings = await Booking.countDocuments({ status: 'completed' });
      barterCount = await Service.countDocuments({ serviceType: 'exchange', status: 'active' });
      const colleges = await User.distinct('university');
      collegesCount = colleges.filter(Boolean).length;
    }

    res.json({
      success: true,
      data: {
        activeStudents: studentCount,
        activeServices: servicesCount,
        skillsExchanged: barterCount,
        completedProjects: completedBookings,
        collegesRepresented: collegesCount,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  getAllServices,
  getServiceById,
  createService,
  getMyServices,
  deleteService,
  getCategories,
  getStats,
};
