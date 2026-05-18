const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { syncUserCalendar } = require('../config/calendar-sync');
const { ensureAuthenticated } = require('../middleware/auth');

// 設定頁
router.get('/', ensureAuthenticated, (req, res) => {
  res.render('settings/index');
});

// 儲存 Google Calendar URL
router.post('/calendar', ensureAuthenticated, async (req, res) => {
  const { googleCalendarUrl } = req.body;

  await User.findByIdAndUpdate(req.user._id, { googleCalendarUrl: googleCalendarUrl || '' });

  if (googleCalendarUrl) {
    // 立即同步一次
    const user = await User.findById(req.user._id);
    await syncUserCalendar(user);
    req.flash('success_msg', 'Google Calendar 已設定並完成同步');
  } else {
    req.flash('success_msg', 'Google Calendar 連結已清除');
  }

  res.redirect('/settings');
});

module.exports = router;
