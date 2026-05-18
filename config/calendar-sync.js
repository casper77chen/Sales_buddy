const ical = require('node-ical');
const cron = require('node-cron');
const User = require('../models/User');
const Visit = require('../models/Visit');

// 同步單一使用者的 Google Calendar
async function syncUserCalendar(user) {
  if (!user.googleCalendarUrl) return;

  try {
    const events = await ical.async.fromURL(user.googleCalendarUrl);

    // 只同步未來 4 週 + 過去 1 週的事件
    const now = new Date();
    const pastLimit = new Date(now);
    pastLimit.setDate(pastLimit.getDate() - 7);
    const futureLimit = new Date(now);
    futureLimit.setDate(futureLimit.getDate() + 28);

    const googleEventIds = [];

    for (const [key, event] of Object.entries(events)) {
      if (event.type !== 'VEVENT') continue;
      if (!event.start) continue;

      const start = new Date(event.start);
      if (start < pastLimit || start > futureLimit) continue;

      const eventId = event.uid || key;
      googleEventIds.push(eventId);

      // 取得日期和時間
      const dateUtc = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
      const hour = start.getHours();
      const timeSlot = `${String(hour).padStart(2, '0')}:00`;

      const summary = event.summary || '(無標題)';
      const description = event.description || '';
      const location = event.location || '';
      const content = [summary, description, location].filter(Boolean).join('\n');

      // 計算跨幾個小時
      const end = event.end ? new Date(event.end) : new Date(start.getTime() + 60 * 60 * 1000);
      const durationHours = Math.ceil((end - start) / (60 * 60 * 1000));

      // 為每個小時建立一筆 visit（或更新）
      for (let h = 0; h < durationHours && (hour + h) <= 18; h++) {
        const slotHour = hour + h;
        if (slotHour < 8) continue; // 跳過 08:00 之前
        const slot = `${String(slotHour).padStart(2, '0')}:00`;
        const slotEventId = `${eventId}_h${h}`;

        const existing = await Visit.findOne({
          salesRep: user._id,
          googleEventId: slotEventId,
          source: 'google',
        });

        if (existing) {
          // 更新
          existing.date = dateUtc;
          existing.timeSlot = slot;
          existing.content = h === 0 ? content : `${summary} (續)`;
          existing.status = 'scheduled';
          await existing.save();
        } else {
          // 新增
          await Visit.create({
            salesRep: user._id,
            date: dateUtc,
            timeSlot: slot,
            status: 'scheduled',
            content: h === 0 ? content : `${summary} (續)`,
            source: 'google',
            googleEventId: slotEventId,
          });
        }
      }
    }

    // 刪除已從 Google Calendar 移除的事件（只刪未來的）
    await Visit.deleteMany({
      salesRep: user._id,
      source: 'google',
      date: { $gte: pastLimit },
      googleEventId: { $nin: googleEventIds.flatMap((id) => {
        // 保留所有可能的 _hN 後綴
        const ids = [];
        for (let h = 0; h < 12; h++) ids.push(`${id}_h${h}`);
        return ids;
      })},
    });

    console.log(`[Calendar Sync] ${user.name}: 同步完成`);
  } catch (err) {
    console.error(`[Calendar Sync] ${user.name}: 同步失敗 -`, err.message);
  }
}

// 同步所有有設定 iCal URL 的使用者
async function syncAllCalendars() {
  const users = await User.find({ googleCalendarUrl: { $exists: true, $ne: '' } });
  console.log(`[Calendar Sync] 開始同步 ${users.length} 位使用者的行事曆...`);
  for (const user of users) {
    await syncUserCalendar(user);
  }
  console.log('[Calendar Sync] 全部同步完成');
}

// 啟動定時同步（每 30 分鐘）
function startCalendarSync() {
  cron.schedule('*/30 * * * *', () => {
    syncAllCalendars();
  });
  console.log('[Calendar Sync] 排程已啟動（每 30 分鐘同步一次）');

  // 啟動時立即同步一次
  setTimeout(() => syncAllCalendars(), 5000);
}

module.exports = { syncUserCalendar, syncAllCalendars, startCalendarSync };
