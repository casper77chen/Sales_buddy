const express = require('express');
const router = express.Router();
const Visit = require('../models/Visit');
const { ensureAuthenticated } = require('../middleware/auth');

// 新增拜訪
router.post('/', ensureAuthenticated, async (req, res) => {
  const { clientId, date, timeSlot } = req.body;

  if (!clientId || !date || !timeSlot) {
    req.flash('error_msg', '請填寫完整資訊');
    return res.redirect('/');
  }

  await Visit.create({
    salesRep: req.user._id,
    client: clientId,
    date: new Date(date + 'T00:00:00'),
    timeSlot,
    status: 'scheduled',
  });

  req.flash('success_msg', '拜訪行程已新增');
  res.redirect(`/?week=${date}`);
});

// 取得拜訪詳情（JSON，供 modal 使用）
router.get('/:id/json', ensureAuthenticated, async (req, res) => {
  const visit = await Visit.findById(req.params.id).populate('client', 'name phone address contactPerson');
  if (!visit) return res.status(404).json({ error: '找不到此拜訪' });
  res.json(visit);
});

// 更新拜訪紀錄
router.put('/:id', ensureAuthenticated, async (req, res) => {
  const { contactPerson, content, followUp, status } = req.body;
  const update = { contactPerson, content, followUp, updatedAt: Date.now() };

  if (status) {
    update.status = status;
    if (status === 'visited') {
      update.visitedAt = Date.now();
    }
  }

  const visit = await Visit.findByIdAndUpdate(req.params.id, update, { new: true });

  if (req.query.json === '1') {
    return res.json({ success: true, visit });
  }

  req.flash('success_msg', '拜訪紀錄已更新');

  // 若狀態為已拜訪，帶出油資申報提示
  if (status === 'visited') {
    return res.redirect(`/?week=${visit.date.toISOString().split('T')[0]}&showMileage=${visit._id}`);
  }

  res.redirect(`/?week=${visit.date.toISOString().split('T')[0]}`);
});

// 更新狀態（快速切換）
router.put('/:id/status', ensureAuthenticated, async (req, res) => {
  const { status } = req.body;
  const update = { status, updatedAt: Date.now() };
  if (status === 'visited') update.visitedAt = Date.now();

  await Visit.findByIdAndUpdate(req.params.id, update);
  res.json({ success: true });
});

// 刪除拜訪
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  const visit = await Visit.findByIdAndDelete(req.params.id);
  req.flash('success_msg', '拜訪行程已刪除');
  const weekDate = visit ? visit.date.toISOString().split('T')[0] : '';
  res.redirect(`/?week=${weekDate}`);
});

module.exports = router;
