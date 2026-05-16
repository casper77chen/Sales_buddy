const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const User = require('../models/User');
const { sendMail } = require('../config/mailer');

// 登入頁
router.get('/login', (req, res) => {
  res.render('auth/login');
});

// 登入處理
router.post('/login', (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/auth/login',
    failureFlash: true,
  })(req, res, next);
});

// 註冊頁
router.get('/register', (req, res) => {
  res.render('auth/register');
});

// 註冊處理
router.post('/register', async (req, res) => {
  const { name, email, password, password2, role } = req.body;
  const errors = [];

  if (!name || !email || !password || !password2) {
    errors.push('請填寫所有欄位');
  }
  if (password !== password2) {
    errors.push('兩次密碼不一致');
  }
  if (password && password.length < 6) {
    errors.push('密碼至少需要 6 個字元');
  }

  if (errors.length > 0) {
    return res.render('auth/register', { errors, name, email, role });
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      errors.push('此 Email 已被註冊');
      return res.render('auth/register', { errors, name, email, role });
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Admin 角色由 ADMIN_EMAIL 決定，其餘依選擇
    let userRole = role === 'manager' ? 'manager' : 'sales';
    if (email === process.env.ADMIN_EMAIL) {
      userRole = 'admin';
    }

    await User.create({ name, email, password: hash, role: userRole });

    req.flash('success_msg', '註冊成功，請登入');
    res.redirect('/auth/login');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', '註冊失敗，請稍後再試');
    res.redirect('/auth/register');
  }
});

// 忘記密碼頁
router.get('/forgot-password', (req, res) => {
  res.render('auth/forgot-password');
});

// 忘記密碼處理
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) {
    req.flash('success_msg', '如果此 Email 已註冊，重設連結已寄出');
    return res.redirect('/auth/forgot-password');
  }

  const token = jwt.sign({ id: user._id }, process.env.SESSION_SECRET, { expiresIn: '1h' });
  const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
  const resetUrl = `${baseUrl}/auth/reset-password/${token}`;

  await sendMail({
    to: user.email,
    subject: '【dentall 業務神隊友】重設密碼',
    html: `
      <h2>重設密碼</h2>
      <p>Hi ${user.name}，您收到此信是因為有人要求重設您的密碼。</p>
      <p><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background:#1B3A5C;color:#fff;border-radius:6px;text-decoration:none;">點擊重設密碼</a></p>
      <p>此連結將在 1 小時後失效。</p>
      <p style="color:#999; font-size:12px;">如果這不是您本人的操作，請忽略此信。</p>
    `,
  });

  req.flash('success_msg', '如果此 Email 已註冊，重設連結已寄出');
  res.redirect('/auth/forgot-password');
});

// 重設密碼頁
router.get('/reset-password/:token', (req, res) => {
  try {
    jwt.verify(req.params.token, process.env.SESSION_SECRET);
    res.render('auth/reset-password', { token: req.params.token });
  } catch (err) {
    req.flash('error_msg', '連結已失效或無效，請重新申請');
    res.redirect('/auth/forgot-password');
  }
});

// 重設密碼處理
router.post('/reset-password/:token', async (req, res) => {
  try {
    const decoded = jwt.verify(req.params.token, process.env.SESSION_SECRET);
    const { password, password2 } = req.body;

    if (password !== password2) {
      req.flash('error_msg', '兩次密碼不一致');
      return res.redirect(`/auth/reset-password/${req.params.token}`);
    }
    if (password.length < 6) {
      req.flash('error_msg', '密碼至少需要 6 個字元');
      return res.redirect(`/auth/reset-password/${req.params.token}`);
    }

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    await User.findByIdAndUpdate(decoded.id, { password: hash });

    req.flash('success_msg', '密碼已重設，請用新密碼登入');
    res.redirect('/auth/login');
  } catch (err) {
    req.flash('error_msg', '連結已失效或無效，請重新申請');
    res.redirect('/auth/forgot-password');
  }
});

// 修改密碼頁
router.get('/change-password', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/auth/login');
  res.render('auth/change-password');
});

// 修改密碼處理
router.post('/change-password', async (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/auth/login');

  const { currentPassword, password, password2 } = req.body;
  const isMatch = await bcrypt.compare(currentPassword, req.user.password);

  if (!isMatch) {
    req.flash('error_msg', '目前密碼錯誤');
    return res.redirect('/auth/change-password');
  }
  if (password !== password2) {
    req.flash('error_msg', '兩次新密碼不一致');
    return res.redirect('/auth/change-password');
  }
  if (password.length < 6) {
    req.flash('error_msg', '新密碼至少需要 6 個字元');
    return res.redirect('/auth/change-password');
  }

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  await User.findByIdAndUpdate(req.user._id, { password: hash });

  req.flash('success_msg', '密碼已修改');
  res.redirect('/');
});

// 登出
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) console.error(err);
    req.flash('success_msg', '已登出');
    res.redirect('/auth/login');
  });
});

module.exports = router;
