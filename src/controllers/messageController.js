const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const Service = require('../models/Service');
const Booking = require('../models/Booking');
const { ensureMongoConnected } = require('../config/db');

/**
 * @desc Send a direct message to another student
 * @route POST /api/messages
 * @access Private
 */
const sendMessage = async (req, res) => {
  try {
    const connected = await ensureMongoConnected(6000);
    if (!connected) {
      return res.status(503).json({
        success: false,
        retryable: true,
        message: 'Database is connecting. Please retry in a moment.',
      });
    }

    const { recipientId, content, serviceId, bookingId } = req.body;

    if (!recipientId) {
      return res.status(400).json({ success: false, message: 'Recipient student ID is required.' });
    }

    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      return res.status(400).json({ success: false, message: 'Invalid recipient ID format.' });
    }

    if (recipientId.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot send a message to yourself.' });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message content cannot be empty.' });
    }

    // Verify recipient student exists
    const recipientUser = await User.findById(recipientId).select('name university avatar rating');
    if (!recipientUser) {
      return res.status(404).json({ success: false, message: 'Recipient student not found.' });
    }

    // Optional reference checks
    let validServiceId = null;
    if (serviceId && mongoose.Types.ObjectId.isValid(serviceId)) {
      const s = await Service.findById(serviceId).select('_id');
      if (s) validServiceId = s._id;
    }

    let validBookingId = null;
    if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
      const b = await Booking.findById(bookingId).select('_id');
      if (b) validBookingId = b._id;
    }

    const message = await Message.create({
      sender: req.user._id,
      recipient: recipientId,
      content: content.trim(),
      service: validServiceId,
      booking: validBookingId,
    });

    const populated = await Message.findById(message._id)
      .populate('sender', 'name university avatar rating isVerifiedStudent')
      .populate('recipient', 'name university avatar rating isVerifiedStudent')
      .populate('service', 'title category serviceType price');

    res.status(201).json({
      success: true,
      message: 'Message sent successfully.',
      data: populated,
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message.',
      error: error.message,
    });
  }
};

/**
 * @desc Get all conversations for current student
 * @route GET /api/messages/conversations
 * @access Private
 */
const getConversations = async (req, res) => {
  try {
    const connected = await ensureMongoConnected(6000);
    if (!connected) {
      return res.status(503).json({ success: false, retryable: true, message: 'Database connecting...' });
    }

    const currentUserId = req.user._id;

    // Find all messages involving current user
    const messages = await Message.find({
      $or: [{ sender: currentUserId }, { recipient: currentUserId }],
    })
      .sort({ createdAt: -1 })
      .populate('sender', 'name university avatar rating isVerifiedStudent')
      .populate('recipient', 'name university avatar rating isVerifiedStudent')
      .lean();

    // Group messages by partner
    const conversationMap = new Map();

    for (const msg of messages) {
      const isSender = msg.sender && msg.sender._id.toString() === currentUserId.toString();
      const partner = isSender ? msg.recipient : msg.sender;

      if (!partner || !partner._id) continue;
      const partnerId = partner._id.toString();

      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, {
          partner: {
            _id: partner._id,
            name: partner.name,
            university: partner.university,
            avatar: partner.avatar,
            rating: partner.rating,
            isVerifiedStudent: partner.isVerifiedStudent,
          },
          lastMessage: {
            content: msg.content,
            createdAt: msg.createdAt,
            isMine: isSender,
            read: msg.read,
          },
          unreadCount: 0,
        });
      }

      // Count unread incoming messages from this partner
      if (!isSender && !msg.read) {
        const conv = conversationMap.get(partnerId);
        conv.unreadCount += 1;
      }
    }

    const conversations = Array.from(conversationMap.values());

    res.json({
      success: true,
      count: conversations.length,
      data: conversations,
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations.',
      error: error.message,
    });
  }
};

/**
 * @desc Get chat thread between current user and partner student
 * @route GET /api/messages/thread/:partnerId
 * @access Private
 */
const getThread = async (req, res) => {
  try {
    const connected = await ensureMongoConnected(6000);
    if (!connected) {
      return res.status(503).json({ success: false, retryable: true, message: 'Database connecting...' });
    }

    const { partnerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(partnerId)) {
      return res.status(400).json({ success: false, message: 'Invalid partner student ID.' });
    }

    const partner = await User.findById(partnerId).select('name university avatar rating isVerifiedStudent major bio');
    if (!partner) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const currentUserId = req.user._id;

    // Fetch messages between current user and partner
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: partnerId },
        { sender: partnerId, recipient: currentUserId },
      ],
    })
      .sort({ createdAt: 1 })
      .populate('service', 'title category serviceType price')
      .populate('booking', 'serviceTitle serviceType status price')
      .lean();

    // Mark unread messages sent by partner to current user as read
    await Message.updateMany(
      {
        sender: partnerId,
        recipient: currentUserId,
        read: false,
      },
      {
        $set: { read: true, readAt: new Date() },
      }
    );

    res.json({
      success: true,
      partner,
      count: messages.length,
      data: messages,
    });
  } catch (error) {
    console.error('Get thread error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch message thread.',
      error: error.message,
    });
  }
};

/**
 * @desc Get total unread message count for current user
 * @route GET /api/messages/unread-count
 * @access Private
 */
const getUnreadCount = async (req, res) => {
  try {
    const connected = await ensureMongoConnected(4000);
    if (!connected) {
      return res.json({ success: true, unreadCount: 0 });
    }

    const unreadCount = await Message.countDocuments({
      recipient: req.user._id,
      read: false,
    });

    res.json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      unreadCount: 0,
      error: error.message,
    });
  }
};

/**
 * @desc Mark a conversation thread as read
 * @route PUT /api/messages/read/:partnerId
 * @access Private
 */
const markThreadAsRead = async (req, res) => {
  try {
    const { partnerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(partnerId)) {
      return res.status(400).json({ success: false, message: 'Invalid student ID.' });
    }

    await Message.updateMany(
      {
        sender: partnerId,
        recipient: req.user._id,
        read: false,
      },
      {
        $set: { read: true, readAt: new Date() },
      }
    );

    res.json({ success: true, message: 'Thread marked as read.' });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ success: false, message: 'Failed to mark thread as read.' });
  }
};

module.exports = {
  sendMessage,
  getConversations,
  getThread,
  getUnreadCount,
  markThreadAsRead,
};
