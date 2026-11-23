const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getConversations,
  getThread,
  getUnreadCount,
  markThreadAsRead,
} = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

// All message routes are private to authenticated students
router.use(protect);

router.post('/', sendMessage);
router.get('/conversations', getConversations);
router.get('/thread/:partnerId', getThread);
router.get('/unread-count', getUnreadCount);
router.put('/read/:partnerId', markThreadAsRead);

module.exports = router;
