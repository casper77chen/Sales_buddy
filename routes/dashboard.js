const express = require('express');
const router = express.Router();
const Visit = require('../models/Visit');
const User = require('../models/User');
const { ensureAuthenticated } = require('../middleware/auth');

// 取得台灣時間的今天 YYYY-MM-DD
function getTaiwanToday() {
  const now = new Date();
  const tw = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return tw.toISOString().split('T')[0];
}

// 取得一週的起始（週一）和結束（週日），使用 UTC 日期避免時區偏移
function getWeekRange(dateStr) {
  const str = dateStr || getTaiwanToday();
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));

  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() + diffToMonday);
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  return { monday, sunday };
}

// 格式化 UTC 日期為 YYYY-MM-DD
function formatDate(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 計算 ISO 週數（W01-W52）
function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

router.get('/', ensureAuthenticated, async (req, res) => {
  // 每次載入行事曆時，同步該使用者的 Google Calendar
  if (req.user.googleCalendarUrl) {
    const { syncUserCalendar } = require('../config/calendar-sync');
    syncUserCalendar(req.user).catch(err => console.error('[Calendar Sync] 即時同步失敗:', err.message));
  }

  const weekParam = req.query.week || null;
  const repId = req.query.rep || null;
  const { monday, sunday } = getWeekRange(weekParam);

  // 前一週 / 後一週
  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

  // 決定要看哪位業務的行程
  let targetRepId = req.user._id;
  let salesReps = [];

  if (['admin', 'manager'].includes(req.user.role)) {
    // 主管/Admin 可看所有人的行程（含自己）
    salesReps = await User.find({ role: { $in: ['sales', 'manager', 'admin'] } }).select('name email role').sort({ name: 1 });
    if (repId) {
      targetRepId = repId;
    }
    // 不指定 rep 時預設看自己的行程
  }

  // 查詢該週拜訪資料
  const visits = await Visit.find({
    salesRep: targetRepId,
    date: { $gte: monday, $lte: sunday },
  }).populate('client', 'name phone address').sort({ date: 1, timeSlot: 1 });

  // 建立 lookup map: { 'YYYY-MM-DD_HH:00': [visits] }
  const visitMap = {};
  visits.forEach(v => {
    // visit.date 儲存為 UTC 00:00，直接用 formatDate 取得正確日期
    const dateKey = formatDate(v.date);
    const key = `${dateKey}_${v.timeSlot}`;
    if (!visitMap[key]) visitMap[key] = [];
    visitMap[key].push(v);
  });

  // 產生一週日期陣列
  const weekDays = [];
  const dayNames = ['一', '二', '三', '四', '五', '六', '日'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    weekDays.push({
      date: formatDate(d),
      label: `${d.getUTCMonth() + 1}/${d.getUTCDate()} (${dayNames[i]})`,
    });
  }

  // 時間格：08:00 - 18:00
  const timeSlots = [];
  for (let h = 8; h <= 18; h++) {
    timeSlots.push(`${String(h).padStart(2, '0')}:00`);
  }

  const weekNumber = getWeekNumber(monday);
  const year = monday.getFullYear();

  res.render('dashboard/index', {
    weekDays,
    timeSlots,
    visitMap,
    prevWeek: formatDate(prevMonday),
    nextWeek: formatDate(nextMonday),
    currentWeek: formatDate(monday),
    selectedRep: targetRepId.toString(),
    salesReps,
    isManager: ['admin', 'manager'].includes(req.user.role),
    weekLabel: `W${String(weekNumber).padStart(2, '0')}`,
    year,
  });
});

module.exports = router;
