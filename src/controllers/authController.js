const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const { ensureMongoConnected, isMongoConnected } = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'skillswap_dev_jwt_secret_key_2026_super_secure';

const generateToken = (id) => {
  return jwt.sign(
    { id: id.toString() },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
};

/**
 * @desc Register a new student into MongoDB Atlas
 * @route POST /api/auth/register
 */
const registerUser = async (req, res) => {
  try {
    const { name, email, password, university, major, bio, skillsOffered, skillsWanted } = req.body;

    if (!name || !email || !password || !university) {
      return res.status(400).json({
        success: false,
        message: 'Please provide full name, email, password, and university.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Ensure MongoDB connection is active
    const connected = await ensureMongoConnected(6000);
    if (!connected) {
      return res.status(503).json({
        success: false,
        retryable: true,
        message: 'Database is connecting to MongoDB Atlas. Please wait 5 seconds and retry.',
      });
    }

    const userExists = await User.findOne({ email: cleanEmail });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'A student account with this email already exists.',
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password,
      university: university.trim(),
      major: major ? major.trim() : 'Undergraduate',
      bio: bio ? bio.trim() : '',
      skillsOffered: Array.isArray(skillsOffered)
        ? skillsOffered
        : (skillsOffered ? String(skillsOffered).split(',').map((s) => s.trim()).filter(Boolean) : []),
      skillsWanted: Array.isArray(skillsWanted)
        ? skillsWanted
        : (skillsWanted ? String(skillsWanted).split(',').map((s) => s.trim()).filter(Boolean) : []),
    });

    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        university: user.university,
        major: user.major,
        bio: user.bio,
        avatar: user.avatar,
        skillsOffered: user.skillsOffered,
        skillsWanted: user.skillsWanted,
        rating: user.rating,
        reviewsCount: user.reviewsCount,
        earningsTotal: user.earningsTotal,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A student account with this email already exists.',
      });
    }
    res.status(500).json({ success: false, message: 'Server error during registration: ' + error.message });
  }
};

/**
 * @desc Login student & get token from MongoDB Atlas
 * @route POST /api/auth/login
 */
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password.',
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Ensure MongoDB connection is active
    const connected = await ensureMongoConnected(6000);
    if (!connected) {
      return res.status(503).json({
        success: false,
        retryable: true,
        message: 'Database is connecting to MongoDB Atlas. Please wait 5 seconds and retry.',
      });
    }

    const user = await User.findOne({ email: cleanEmail }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(user._id);

    return res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        university: user.university,
        major: user.major,
        bio: user.bio,
        avatar: user.avatar,
        skillsOffered: user.skillsOffered,
        skillsWanted: user.skillsWanted,
        rating: user.rating,
        reviewsCount: user.reviewsCount,
        earningsTotal: user.earningsTotal,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login: ' + error.message });
  }
};

/**
 * @desc Get current logged-in student profile
 * @route GET /api/auth/me
 */
const getCurrentUser = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    res.json({ success: true, user: req.user });
  } catch (error) {
    console.error('getCurrentUser error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/**
 * @desc Update student's own profile permanently in MongoDB Atlas
 * @route PUT /api/auth/profile
 */
const updateProfile = async (req, res) => {
  try {
    const { name, university, major, bio, skillsOffered, skillsWanted, avatar } = req.body;
    const userId = req.user._id || req.user.id;

    const connected = await ensureMongoConnected(6000);
    if (!connected) {
      return res.status(503).json({
        success: false,
        retryable: true,
        message: 'Database is connecting. Please retry shortly.',
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Student account not found' });
    }

    if (name) user.name = name.trim();
    if (university) user.university = university.trim();
    if (major) user.major = major.trim();
    if (bio !== undefined) user.bio = bio.trim();
    if (avatar !== undefined) user.avatar = avatar;
    if (skillsOffered !== undefined) {
      user.skillsOffered = Array.isArray(skillsOffered)
        ? skillsOffered
        : String(skillsOffered).split(',').map((s) => s.trim()).filter(Boolean);
    }
    if (skillsWanted !== undefined) {
      user.skillsWanted = Array.isArray(skillsWanted)
        ? skillsWanted
        : String(skillsWanted).split(',').map((s) => s.trim()).filter(Boolean);
    }

    const updated = await user.save();
    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: updated._id,
        name: updated.name,
        email: updated.email,
        university: updated.university,
        major: updated.major,
        bio: updated.bio,
        avatar: updated.avatar,
        skillsOffered: updated.skillsOffered,
        skillsWanted: updated.skillsWanted,
        rating: updated.rating,
        reviewsCount: updated.reviewsCount,
        earningsTotal: updated.earningsTotal,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
};

/**
 * @desc Get all real registered students from MongoDB Atlas
 * @route GET /api/auth/students
 */
const getAllStudents = async (req, res) => {
  try {
    const connected = await ensureMongoConnected(6000);
    if (!connected) {
      return res.status(503).json({
        success: false,
        retryable: true,
        message: 'Database is connecting. Please retry shortly.',
      });
    }

    const students = await User.find(
      {},
      'name university major bio avatar skillsOffered skillsWanted rating reviewsCount createdAt'
    ).sort({ createdAt: -1 });

    return res.json({ success: true, count: students.length, data: students });
  } catch (error) {
    console.error('getAllStudents error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getCurrentUser,
  updateProfile,
  getAllStudents,
};
