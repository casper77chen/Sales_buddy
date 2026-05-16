const express = require('express');
const router = express.Router();
const MileageClaim = require('../models/MileageClaim');
const Visit = require('../models/Visit');
const { getDistance } = require('../config/maps');
const { ensureAuthenticated } = require('../middleware/auth');

// 我的油資申報清單
router.get('/', ensureAuthenticated, async (req, res) => {
  const claims = await MileageClaim.find({ salesRep: req.user._id })
    .populate({ path: 'visit', populate: { path: 'client', select: 'name' } })
    .sort({ createdAt: -1 });
  res.render('mileage/index', { claims });
});

// 油資確認頁（計算距離）
router.get('/confirm', ensureAuthenticated, async (req, res) => {
  const { visitId } = req.query;
  if (!visitId) {
    req.flash('error_msg', '缺少拜訪 ID');
    return res.redirect('/');
  }

  const visit = await Visit.findById(visitId).populate('client', 'name address');
  if (!visit) {
    req.flash('error_msg', '找不到此拜訪');
    return res.redirect('/');
  }

  // 已有申報則不允許重複
  const existing = await MileageClaim.findOne({ visit: visitId });
  if (existing) {
    req.flash('error_msg', '此拜訪已申報過油資');
    return res.redirect('/mileage');
  }

  const origin = process.env.COMPANY_ADDRESS || '台北市';
  const destination = visit.client ? visit.client.address : '';

  let distance = { distanceKm: 0, distanceText: '-', durationText: '-' };
  if (destination) {
    try {
      distance = await getDistance(origin, destination);
    } catch (err) {
      console.error('距離計算失敗:', err.message);
    }
  }

  res.render('mileage/confirm', {
    visit,
    origin,
    destination: destination || '(未填寫地址)',
    distance,
  });
});

// 送出油資申報
router.post('/', ensureAuthenticated, async (req, res) => {
  const { visitId, originAddress, destinationAddress, distanceKm, distanceText, durationText } = req.body;

  // 防重複
  const existing = await MileageClaim.findOne({ visit: visitId });
  if (existing) {
    req.flash('error_msg', '此拜訪已申報過油資');
    return res.redirect('/mileage');
  }

  await MileageClaim.create({
    visit: visitId,
    salesRep: req.user._id,
    originAddress,
    destinationAddress,
    distanceKm: parseFloat(distanceKm) || 0,
    distanceText,
    durationText,
    status: 'pending',
  });

  req.flash('success_msg', '油資已送審，等待主管審核');
  res.redirect('/mileage');
});

module.exports = router;
