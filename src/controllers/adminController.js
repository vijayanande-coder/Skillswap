const User = require('../models/User');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const { ensureMongoConnected } = require('../config/db');

/**
 * @desc Get comprehensive admin platform statistics
 * @route GET /api/admin/stats
 * @access Private/Admin
 */
const getAdminStats = async (req, res) => {
  try {
    const connected = await ensureMongoConnected(6000);
    if (!connected) {
      return res.status(503).json({ success: false, message: 'Database connecting, please retry shortly.' });
    }

    const [
      totalUsers,
      totalAdmins,
      verifiedUsers,
      totalServices,
      activeServices,
      pausedServices,
      totalBookings,
      completedBookings,
      pendingBookings,
      barterBookings,
      distinctColleges,
      recentUsers,
      recentServices,
      recentBookings,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ isVerifiedStudent: true }),
      Service.countDocuments(),
      Service.countDocuments({ status: 'active' }),
      Service.countDocuments({ status: 'paused' }),
      Booking.countDocuments(),
      Booking.countDocuments({ status: 'completed' }),
      Booking.countDocuments({ status: 'pending' }),
      Booking.countDocuments({ serviceType: 'exchange' }),
      User.distinct('university'),
      User.find({}, 'name email university role isVerifiedStudent createdAt')
        .sort({ createdAt: -1 })
        .limit(5),
      Service.find({}, 'title category serviceType price status provider createdAt')
        .sort({ createdAt: -1 })
        .limit(5),
      Booking.find({}, 'serviceTitle serviceType clientName providerName price status createdAt')
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    // Calculate total simulated transaction volume in INR (₹)
    const completedOrdersList = await Booking.find({ status: 'completed', price: { $gt: 0 } }, 'price');
    const totalVolume = completedOrdersList.reduce((acc, curr) => acc + (curr.price || 0), 0);

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          students: totalUsers - totalAdmins,
          admins: totalAdmins,
          verified: verifiedUsers,
        },
        services: {
          total: totalServices,
          active: activeServices,
          paused: pausedServices,
        },
        bookings: {
          total: totalBookings,
          completed: completedBookings,
          pending: pendingBookings,
          barter: barterBookings,
        },
        financials: {
          totalSimulatedVolumeINR: totalVolume,
        },
        collegesCount: distinctColleges.filter(Boolean).length,
        recentActivity: {
          users: recentUsers,
          services: recentServices,
          bookings: recentBookings,
        },
      },
    });
  } catch (error) {
    console.error('getAdminStats error:', error);
    res.status(500).json({ success: false, message: 'Server error loading admin stats' });
  }
};

/**
 * @desc Get all registered users for administration
 * @route GET /api/admin/users
 * @access Private/Admin
 */
const getAdminUsers = async (req, res) => {
  try {
    const connected = await ensureMongoConnected(6000);
    if (!connected) {
      return res.status(503).json({ success: false, message: 'Database connecting, please retry.' });
    }

    const { search, role } = req.query;
    const query = {};

    if (role && role !== 'all') {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { university: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(
      query,
      'name email university major role isVerifiedStudent rating reviewsCount earningsTotal completedOrders createdAt'
    ).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    console.error('getAdminUsers error:', error);
    res.status(500).json({ success: false, message: 'Server error loading users' });
  }
};

/**
 * @desc Toggle student verification status
 * @route PATCH /api/admin/users/:id/verify
 * @access Private/Admin
 */
const toggleUserVerification = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    user.isVerifiedStudent = !user.isVerifiedStudent;
    await user.save();

    // Also update provider verification on their published services
    await Service.updateMany(
      { 'provider.userId': user._id },
      { 'provider.isVerifiedStudent': user.isVerifiedStudent }
    );

    res.json({
      success: true,
      message: `Student verification updated to: ${user.isVerifiedStudent ? 'Verified' : 'Unverified'}`,
      isVerifiedStudent: user.isVerifiedStudent,
    });
  } catch (error) {
    console.error('toggleUserVerification error:', error);
    res.status(500).json({ success: false, message: 'Server error updating verification' });
  }
};

/**
 * @desc Update user role (promote to admin or demote to student)
 * @route PATCH /api/admin/users/:id/role
 * @access Private/Admin
 */
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['student', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role specified' });
    }

    if (id === req.user._id.toString() && role !== 'admin') {
      return res.status(400).json({ success: false, message: 'You cannot remove your own admin privileges.' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: `User role updated to ${role}`,
      data: { id: user._id, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error('updateUserRole error:', error);
    res.status(500).json({ success: false, message: 'Server error updating role' });
  }
};

/**
 * @desc Delete user and clean up their listings
 * @route DELETE /api/admin/users/:id
 * @access Private/Admin
 */
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own admin account.' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Clean up their services
    await Service.deleteMany({ 'provider.userId': user._id });
    await user.deleteOne();

    res.json({ success: true, message: 'User account and associated services removed by admin' });
  } catch (error) {
    console.error('deleteUser error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting user' });
  }
};

/**
 * @desc Get all marketplace services across platform
 * @route GET /api/admin/services
 * @access Private/Admin
 */
const getAdminServices = async (req, res) => {
  try {
    const connected = await ensureMongoConnected(6000);
    if (!connected) {
      return res.status(503).json({ success: false, message: 'Database connecting, please retry.' });
    }

    const { search, category, status } = req.query;
    const query = {};

    if (category && category !== 'All') query.category = category;
    if (status && status !== 'all') query.status = status;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { 'provider.name': { $regex: search, $options: 'i' } },
      ];
    }

    const services = await Service.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: services.length,
      data: services,
    });
  } catch (error) {
    console.error('getAdminServices error:', error);
    res.status(500).json({ success: false, message: 'Server error loading services' });
  }
};

/**
 * @desc Toggle service status (active / paused)
 * @route PATCH /api/admin/services/:id/status
 * @access Private/Admin
 */
const updateServiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'paused'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    service.status = status;
    await service.save();

    res.json({
      success: true,
      message: `Service status updated to ${status}`,
      data: service,
    });
  } catch (error) {
    console.error('updateServiceStatus error:', error);
    res.status(500).json({ success: false, message: 'Server error updating service status' });
  }
};

/**
 * @desc Delete service as administrator
 * @route DELETE /api/admin/services/:id
 * @access Private/Admin
 */
const deleteAdminService = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    await service.deleteOne();
    res.json({ success: true, message: 'Service permanently removed by administrator' });
  } catch (error) {
    console.error('deleteAdminService error:', error);
    res.status(500).json({ success: false, message: 'Server error removing service' });
  }
};

/**
 * @desc Get all platform bookings and barter swaps
 * @route GET /api/admin/bookings
 * @access Private/Admin
 */
const getAdminBookings = async (req, res) => {
  try {
    const connected = await ensureMongoConnected(6000);
    if (!connected) {
      return res.status(503).json({ success: false, message: 'Database connecting, please retry.' });
    }

    const { status, type } = req.query;
    const query = {};

    if (status && status !== 'all') query.status = status;
    if (type && type !== 'all') query.serviceType = type;

    const bookings = await Booking.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: bookings.length,
      data: bookings,
    });
  } catch (error) {
    console.error('getAdminBookings error:', error);
    res.status(500).json({ success: false, message: 'Server error loading bookings' });
  }
};

/**
 * @desc Claim admin privileges if no admin currently exists
 * @route POST /api/admin/claim-owner
 * @access Private (Any authenticated student can claim if 0 admins exist)
 */
const claimInitialAdmin = async (req, res) => {
  try {
    const connected = await ensureMongoConnected(6000);
    if (!connected) {
      return res.status(503).json({ success: false, message: 'Database connecting, please retry.' });
    }

    const existingAdminsCount = await User.countDocuments({ role: 'admin' });
    if (existingAdminsCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'An administrator account already exists on SkillSwap. Contact the current admin for access.',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Student account not found' });
    }

    user.role = 'admin';
    await user.save();

    res.json({
      success: true,
      message: `🎉 Congratulations ${user.name}! You are now the Platform Administrator of SkillSwap.`,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('claimInitialAdmin error:', error);
    res.status(500).json({ success: false, message: 'Server error claiming admin' });
  }
};

module.exports = {
  getAdminStats,
  getAdminUsers,
  toggleUserVerification,
  updateUserRole,
  deleteUser,
  getAdminServices,
  updateServiceStatus,
  deleteAdminService,
  getAdminBookings,
  claimInitialAdmin,
};
