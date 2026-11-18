const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const { isMongoConnected } = require('../config/db');
const { setRuntimeUsersRef } = require('../middleware/authMiddleware');

// In-memory runtime store for offline/local use when MongoDB is not connected
// NOTE: Initially EMPTY! No fake users are ever pre-seeded.
const runtimeUsers = [];
setRuntimeUsersRef(runtimeUsers);

const generateToken = (id) => {
  return jwt.sign(
    { id: id.toString() },
    process.env.JWT_SECRET || 'skillswap_jwt_dev_secret_key_2026_super_secure',
    { expiresIn: '30d' }
  );
};

/**
 * @desc Register a new student
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

    if (isMongoConnected()) {
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
        bio: bio || '',
        skillsOffered: Array.isArray(skillsOffered) ? skillsOffered : [],
        skillsWanted: Array.isArray(skillsWanted) ? skillsWanted : [],
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
    } else {
      // In-memory fallback
      const userExists = runtimeUsers.find((u) => u.email === cleanEmail);
      if (userExists) {
        return res.status(400).json({
          success: false,
          message: 'A student account with this email already exists.',
        });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const newId = new mongoose.Types.ObjectId().toString();

      const newUser = {
        _id: newId,
        id: newId,
        name: name.trim(),
        email: cleanEmail,
        password: hashedPassword,
        university: university.trim(),
        major: major ? major.trim() : 'Undergraduate',
        bio: bio || '',
        avatar: '',
        skillsOffered: Array.isArray(skillsOffered) ? skillsOffered : [],
        skillsWanted: Array.isArray(skillsWanted) ? skillsWanted : [],
        rating: 0,
        reviewsCount: 0,
        earningsTotal: 0,
        completedOrders: 0,
        role: 'student',
        isVerifiedStudent: true,
        createdAt: new Date().toISOString(),
      };

      runtimeUsers.push(newUser);
      const token = generateToken(newUser._id);

      const { password: _, ...safeUser } = newUser;
      return res.status(201).json({
        success: true,
        token,
        user: safeUser,
      });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration' });
  }
};

/**
 * @desc Login student & get token
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

    if (isMongoConnected()) {
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
    } else {
      // In-memory fallback
      const user = runtimeUsers.find((u) => u.email === cleanEmail);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password.',
        });
      }

      const token = generateToken(user._id);
      const { password: _, ...safeUser } = user;

      return res.json({
        success: true,
        token,
        user: safeUser,
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login' });
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
 * @desc Update student's own profile
 * @route PUT /api/auth/profile
 */
const updateProfile = async (req, res) => {
  try {
    const { name, university, major, bio, skillsOffered, skillsWanted, avatar } = req.body;
    const userId = req.user._id || req.user.id;

    if (isMongoConnected()) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Student account not found' });
      }

      if (name) user.name = name.trim();
      if (university) user.university = university.trim();
      if (major) user.major = major.trim();
      if (bio !== undefined) user.bio = bio.trim();
      if (avatar !== undefined) user.avatar = avatar;
      if (skillsOffered) {
        user.skillsOffered = Array.isArray(skillsOffered)
          ? skillsOffered
          : skillsOffered.split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (skillsWanted) {
        user.skillsWanted = Array.isArray(skillsWanted)
          ? skillsWanted
          : skillsWanted.split(',').map((s) => s.trim()).filter(Boolean);
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
    } else {
      const user = runtimeUsers.find(
        (u) => (u._id && u._id.toString() === userId.toString()) || u.id === userId
      );
      if (!user) {
        return res.status(404).json({ success: false, message: 'Student account not found' });
      }

      if (name) user.name = name.trim();
      if (university) user.university = university.trim();
      if (major) user.major = major.trim();
      if (bio !== undefined) user.bio = bio.trim();
      if (avatar !== undefined) user.avatar = avatar;
      if (skillsOffered) {
        user.skillsOffered = Array.isArray(skillsOffered)
          ? skillsOffered
          : skillsOffered.split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (skillsWanted) {
        user.skillsWanted = Array.isArray(skillsWanted)
          ? skillsWanted
          : skillsWanted.split(',').map((s) => s.trim()).filter(Boolean);
      }

      const { password: _, ...safeUser } = user;
      return res.json({
        success: true,
        message: 'Profile updated successfully',
        user: safeUser,
      });
    }
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error updating profile' });
  }
};

/**
 * @desc Get all real registered students (public profile cards, never passwords or private emails)
 * @route GET /api/auth/students
 */
const getAllStudents = async (req, res) => {
  try {
    if (isMongoConnected()) {
      const students = await User.find({}, 'name university major bio avatar skillsOffered skillsWanted rating reviewsCount createdAt')
        .sort({ createdAt: -1 });
      return res.json({ success: true, count: students.length, data: students });
    }

    const safeStudents = runtimeUsers.map((u) => ({
      _id: u._id,
      name: u.name,
      university: u.university,
      major: u.major,
      bio: u.bio,
      avatar: u.avatar,
      skillsOffered: u.skillsOffered,
      skillsWanted: u.skillsWanted,
      rating: u.rating,
      reviewsCount: u.reviewsCount,
      createdAt: u.createdAt,
    }));

    res.json({ success: true, count: safeStudents.length, data: safeStudents });
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
  runtimeUsers,
};
