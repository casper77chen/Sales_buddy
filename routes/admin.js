const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');

// 使用者管理
router.get('/', ensureAuthenticated, ensureAdmin, async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  const managers = await User.find({ role: { $in: ['manager', 'admin'] } }).select('name');
  res.render('admin/users', { users, managers });
});

// 審核使用者（核准）
router.put('/users/:id/approve', ensureAuthenticated, ensureAdmin, async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, { isApproved: true });
  req.flash('success_msg', '使用者已核准');
  res.redirect('/admin');
});

// 更新使用者角色 / 指派主管
router.put('/users/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  const { role, manager } = req.body;

  const update = {};
  if (role) update.role = role;
  if (manager) {
    update.manager = manager === 'none' ? null : manager;
  }

  await User.findByIdAndUpdate(req.params.id, update);
  req.flash('success_msg', '使用者已更新');
  res.redirect('/admin');
});

// 刪除使用者
router.delete('/users/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  if (req.params.id === req.user._id.toString()) {
    req.flash('error_msg', '不能刪除自己');
    return res.redirect('/admin');
  }
  await User.findByIdAndDelete(req.params.id);
  req.flash('success_msg', '使用者已刪除');
  res.redirect('/admin');
});

module.exports = router;
