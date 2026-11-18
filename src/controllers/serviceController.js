const Service = require('../models/Service');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { categories } = require('../data/seedData');
const { isMongoConnected } = require('../config/db');
const { runtimeUsers } = require('./authController');
const mongoose = require('mongoose');

// In-memory runtime services store for offline testing
// NOTE: Strictly EMPTY initially. Populated only by real registered student posts.
const inMemoryServices = [];

/**
 * @desc Get all real active services with search, category, and type filters
 * @route GET /api/services
 */
const getAllServices = async (req, res) => {
  try {
    const { search, category, type, sort } = req.query;

    let services = [];

    if (isMongoConnected()) {
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

      services = await Service.find(query).sort(sortOptions);
    } else {
      // In-memory fallback
      services = [...inMemoryServices];

      if (category && category !== 'All') {
        services = services.filter((s) => s.category.toLowerCase() === category.toLowerCase());
      }

      if (type && type !== 'all') {
        services = services.filter((s) => s.serviceType === type);
      }

      if (search) {
        const q = search.toLowerCase();
        services = services.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            s.provider.name.toLowerCase().includes(q) ||
            (s.tags && s.tags.some((tag) => tag.toLowerCase().includes(q)))
        );
      }

      // Sort
      if (sort === 'price-low') {
        services.sort((a, b) => a.price - b.price);
      } else if (sort === 'price-high') {
        services.sort((a, b) => b.price - a.price);
      } else if (sort === 'rating') {
        services.sort((a, b) => b.provider.rating - a.provider.rating);
      } else {
        services.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
    }

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
 * @desc Get single service by ID
 * @route GET /api/services/:id
 */
const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (isMongoConnected()) {
      if (mongoose.Types.ObjectId.isValid(id)) {
        const service = await Service.findById(id);
        if (service) {
          return res.json({ success: true, data: service });
        }
      }
    }

    const found = inMemoryServices.find((s) => (s.id && s.id === id) || (s._id && s._id.toString() === id));
    if (!found) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    res.json({ success: true, data: found });
  } catch (error) {
    console.error('Error in getServiceById:', error);
    res.status(500).json({ success: false, message: 'Server error fetching service' });
  }
};

/**
 * @desc Create new student service or barter exchange
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

    const newServiceData = {
      title: title.trim(),
      description: description.trim(),
      category,
      serviceType,
      price: serviceType === 'exchange' ? 0 : Math.max(0, Number(price) || 0),
      priceUnit: serviceType === 'exchange' ? 'free_exchange' : (priceUnit || 'fixed'),
      exchangeFor: serviceType === 'exchange' ? (exchangeFor || '').trim() : '',
      deliveryTime: deliveryTime ? deliveryTime.trim() : 'Flexible delivery',
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : []),
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

    if (isMongoConnected()) {
      const created = await Service.create(newServiceData);
      return res.status(201).json({ success: true, data: created });
    }

    const fallbackCreated = {
      ...newServiceData,
      _id: new mongoose.Types.ObjectId().toString(),
      id: new mongoose.Types.ObjectId().toString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    inMemoryServices.unshift(fallbackCreated);

    res.status(201).json({ success: true, data: fallbackCreated });
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ success: false, message: 'Server error creating service' });
  }
};

/**
 * @desc Get services created by the logged-in student
 * @route GET /api/services/my-services (Protected)
 */
const getMyServices = async (req, res) => {
  try {
    const userId = (req.user._id || req.user.id).toString();

    if (isMongoConnected()) {
      const services = await Service.find({ 'provider.userId': userId }).sort({ createdAt: -1 });
      return res.json({ success: true, count: services.length, data: services });
    }

    const services = inMemoryServices.filter(
      (s) => s.provider && s.provider.userId && s.provider.userId.toString() === userId
    );

    res.json({ success: true, count: services.length, data: services });
  } catch (error) {
    console.error('Error fetching student services:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc Delete service (only creator can delete)
 * @route DELETE /api/services/:id (Protected)
 */
const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req.user._id || req.user.id).toString();

    if (isMongoConnected()) {
      const service = await Service.findById(id);
      if (!service) {
        return res.status(404).json({ success: false, message: 'Service not found' });
      }

      if (service.provider.userId.toString() !== userId) {
        return res.status(403).json({ success: false, message: 'Not authorized to delete this service' });
      }

      await service.deleteOne();
      return res.json({ success: true, message: 'Service removed successfully' });
    }

    const index = inMemoryServices.findIndex(
      (s) => (s._id && s._id.toString() === id) || s.id === id
    );

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    if (inMemoryServices[index].provider.userId.toString() !== userId) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this service' });
    }

    inMemoryServices.splice(index, 1);
    res.json({ success: true, message: 'Service removed successfully' });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting service' });
  }
};

/**
 * @desc Get categories with real live counts of active services
 * @route GET /api/categories
 */
const getCategories = async (req, res) => {
  try {
    let serviceList = [];
    if (isMongoConnected()) {
      serviceList = await Service.find({ status: 'active' }, 'category');
    } else {
      serviceList = inMemoryServices.filter((s) => s.status === 'active');
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
 * @desc Get real platform statistics (no fake numbers)
 * @route GET /api/stats
 */
const getStats = async (req, res) => {
  try {
    let studentCount = 0;
    let servicesCount = 0;
    let completedBookings = 0;
    let barterCount = 0;
    let collegesCount = 0;

    if (isMongoConnected()) {
      studentCount = await User.countDocuments();
      servicesCount = await Service.countDocuments({ status: 'active' });
      completedBookings = await Booking.countDocuments({ status: 'completed' });
      barterCount = await Service.countDocuments({ serviceType: 'exchange', status: 'active' });
      const colleges = await User.distinct('university');
      collegesCount = colleges.filter(Boolean).length;
    } else {
      studentCount = runtimeUsers.length;
      servicesCount = inMemoryServices.filter((s) => s.status === 'active').length;
      barterCount = inMemoryServices.filter((s) => s.serviceType === 'exchange' && s.status === 'active').length;
      const colleges = [...new Set(runtimeUsers.map((u) => u.university).filter(Boolean))];
      collegesCount = colleges.length;
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
  inMemoryServices,
};
