require('dotenv').config();
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const methodOverride = require('method-override');
const connectDB = require('./config/db');

const app = express();

// 連線資料庫
connectDB();

// Passport 設定
require('./config/passport')(passport);

// EJS
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('layout', 'layouts/main');

// 靜態檔案
app.use(express.static('public'));

// Body parser
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Method override (PUT/DELETE)
app.use(methodOverride('_method'));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Flash messages
app.use(flash());

// 全域變數（讓 views 可用）
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.user = req.user || null;
  next();
});

// Routes
app.use('/', require('./routes/dashboard'));
app.use('/auth', require('./routes/auth'));
app.use('/clients', require('./routes/clients'));
app.use('/visits', require('./routes/visits'));
app.use('/mileage', require('./routes/mileage'));
app.use('/manager', require('./routes/manager'));
app.use('/admin', require('./routes/admin'));
app.use('/api', require('./routes/api'));
app.use('/settings', require('./routes/settings'));

// 使用說明頁
app.get('/guide', (req, res) => {
  res.render('guide');
});

// 啟動 Google Calendar 定時同步
const { startCalendarSync } = require('./config/calendar-sync');
startCalendarSync();

// Dashboard pending count API
const User = require('./models/User');
app.get('/api/dashboard/pending', async (req, res) => {
  const key = req.query.key;
  if (key !== (process.env.DASHBOARD_API_KEY || 'casper-dash-2025')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const count = await User.countDocuments({ isApproved: false });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`伺服器啟動於 http://localhost:${PORT}`));
