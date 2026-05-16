const express = require('express');
const router = express.Router();
const Visit = require('../models/Visit');
const User = require('../models/User');
const { ensureAuthenticated } = require('../middleware/auth');

// 取得一週的起始（週一）和結束（週日）
function getWeekRange(dateStr) {
  let date;
  if (dateStr) {
    date = new Date(dateStr + 'T00:00:00');
  } else {
    date = new Date();
  }
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { monday, sunday };
}

// 格式化日期為 YYYY-MM-DD
function formatDate(d) {
  return d.toISOString().split('T')[0];
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
    salesReps = await User.find({ role: 'sales' }).select('name email').sort({ name: 1 });
    if (repId) {
      targetRepId = repId;
    } else if (salesReps.length > 0) {
      targetRepId = salesReps[0]._id;
    }
  }

  // 查詢該週拜訪資料
  const visits = await Visit.find({
    salesRep: targetRepId,
    date: { $gte: monday, $lte: sunday },
  }).populate('client', 'name phone address').sort({ date: 1, timeSlot: 1 });

  // 建立 lookup map: { 'YYYY-MM-DD_HH:00': [visits] }
  const visitMap = {};
  visits.forEach(v => {
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
    d.setDate(monday.getDate() + i);
    weekDays.push({
      date: formatDate(d),
      label: `${d.getMonth() + 1}/${d.getDate()} (${dayNames[i]})`,
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
