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

// 格式化 UTC 日期為 YYYY-MM-DD
function formatDate(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 取得一週的起始（週一）和結束（週日）
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

// 取得月份的起始和結束
function getMonthRange(yearMonth) {
  const str = yearMonth || getTaiwanToday().substring(0, 7);
  const [y, m] = str.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const last = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return { first, last, year: y, month: m };
}

// 計算 ISO 週數（W01-W52）
function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return weekNo;
}

// 共用：取得目標業務 ID 和業務清單
async function getTargetRep(req) {
  let targetRepId = req.user._id;
  let salesReps = [];
  const repId = req.query.rep || null;

  if (['admin', 'gm', 'manager'].includes(req.user.role)) {
    salesReps = await User.find({ role: { $in: ['sales', 'manager', 'gm', 'admin'] } }).select('name email role').sort({ name: 1 });
    if (repId) targetRepId = repId;
  }

  return { targetRepId, salesReps, selectedRep: targetRepId.toString() };
}

// 週檢視
router.get('/', ensureAuthenticated, async (req, res) => {
  // 即時同步 Google Calendar
  if (req.user.googleCalendarUrl) {
    const { syncUserCalendar } = require('../config/calendar-sync');
    syncUserCalendar(req.user).catch(err => console.error('[Calendar Sync] 即時同步失敗:', err.message));
  }

  const weekParam = req.query.week || null;
  const { monday, sunday } = getWeekRange(weekParam);
  const { targetRepId, salesReps, selectedRep } = await getTargetRep(req);

  // 前一週 / 後一週
  const prevMonday = new Date(monday);
  prevMonday.setUTCDate(monday.getUTCDate() - 7);
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(monday.getUTCDate() + 7);

  // 查詢該週拜訪資料
  const visits = await Visit.find({
    salesRep: targetRepId,
    date: { $gte: monday, $lte: sunday },
  }).populate('client', 'name phone address').sort({ date: 1, timeSlot: 1 });

  // 建立 lookup map + 標記被佔用的時段
  const visitMap = {};
  const occupiedSlots = {};
  visits.forEach(v => {
    const dateKey = formatDate(v.date);
    const key = `${dateKey}_${v.timeSlot}`;
    if (!visitMap[key]) visitMap[key] = [];
    visitMap[key].push(v);

    // 標記此拜訪佔用的後續時段
    const dur = v.duration || 1;
    if (dur > 1) {
      const startHour = parseInt(v.timeSlot.split(':')[0]);
      for (let h = 1; h < dur; h++) {
        const occSlot = `${String(startHour + h).padStart(2, '0')}:00`;
        const occKey = `${dateKey}_${occSlot}`;
        if (!occupiedSlots[occKey]) occupiedSlots[occKey] = [];
        occupiedSlots[occKey].push(v._id.toString());
      }
    }
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

  const timeSlots = [];
  for (let h = 8; h <= 18; h++) {
    timeSlots.push(`${String(h).padStart(2, '0')}:00`);
  }

  const weekNumber = getWeekNumber(monday);
  const year = monday.getUTCFullYear();

  res.render('dashboard/index', {
    view: 'week',
    weekDays,
    timeSlots,
    visitMap,
    occupiedSlots,
    prevWeek: formatDate(prevMonday),
    nextWeek: formatDate(nextMonday),
    currentWeek: formatDate(monday),
    selectedRep,
    salesReps,
    isManager: ['admin', 'gm', 'manager'].includes(req.user.role),
    weekLabel: `W${String(weekNumber).padStart(2, '0')}`,
    year,
  });
});

// 月檢視
router.get('/month', ensureAuthenticated, async (req, res) => {
  if (req.user.googleCalendarUrl) {
    const { syncUserCalendar } = require('../config/calendar-sync');
    syncUserCalendar(req.user).catch(err => console.error('[Calendar Sync] 即時同步失敗:', err.message));
  }

  const monthParam = req.query.month || null;
  const { first, last, year, month } = getMonthRange(monthParam);
  const { targetRepId, salesReps, selectedRep } = await getTargetRep(req);

  // 前一月 / 後一月
  const prevMonth = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
  const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;

  // 查詢該月拜訪資料
  const visits = await Visit.find({
    salesRep: targetRepId,
    date: { $gte: first, $lte: last },
  }).populate('client', 'name phone address').sort({ date: 1, timeSlot: 1 });

  // 建立 lookup map: { 'YYYY-MM-DD': [visits] }
  const visitMap = {};
  visits.forEach(v => {
    const dateKey = formatDate(v.date);
    if (!visitMap[dateKey]) visitMap[dateKey] = [];
    visitMap[dateKey].push(v);
  });

  // 產生月曆格子（從該月第一天的週一開始，到最後一天的週日結束）
  const dayNames = ['一', '二', '三', '四', '五', '六', '日'];
  const firstDay = first.getUTCDay();
  const startOffset = firstDay === 0 ? -6 : 1 - firstDay;
  const calendarStart = new Date(first);
  calendarStart.setUTCDate(first.getUTCDate() + startOffset);

  const weeks = [];
  let current = new Date(calendarStart);
  while (true) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const dateStr = formatDate(current);
      week.push({
        date: dateStr,
        day: current.getUTCDate(),
        isCurrentMonth: current.getUTCMonth() + 1 === month,
        visits: visitMap[dateStr] || [],
      });
      current.setUTCDate(current.getUTCDate() + 1);
    }
    weeks.push(week);
    if (current.getUTCMonth() + 1 !== month && current.getUTCDay() === 1) break;
    if (weeks.length >= 6) break;
  }

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

  res.render('dashboard/index', {
    view: 'month',
    weeks,
    dayNames,
    visitMap,
    prevMonth,
    nextMonth,
    currentMonth: `${year}-${String(month).padStart(2, '0')}`,
    monthLabel: `${year} ${monthNames[month - 1]}`,
    selectedRep,
    salesReps,
    isManager: ['admin', 'gm', 'manager'].includes(req.user.role),
    year,
  });
});

module.exports = router;
