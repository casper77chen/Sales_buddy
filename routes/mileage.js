const express = require('express');
const router = express.Router();
const MileageClaim = require('../models/MileageClaim');
const Visit = require('../models/Visit');
const User = require('../models/User');
const { getDistance } = require('../config/maps');
const { sendMail } = require('../config/mailer');
const { ensureAuthenticated } = require('../middleware/auth');

// 油資申報 + 審查頁面
router.get('/', ensureAuthenticated, async (req, res) => {
  // 自己的油資申報
  const claims = await MileageClaim.find({ salesRep: req.user._id })
    .populate({ path: 'visit', populate: { path: 'client', select: 'name' } })
    .sort({ createdAt: -1 });

  // 待審油資（依角色）
  let pendingClaims = [];
  const role = req.user.role;

  if (role === 'admin') {
    // admin 看全部待審
    pendingClaims = await MileageClaim.find({ status: 'pending' })
      .populate('salesRep', 'name email')
      .populate({ path: 'visit', populate: { path: 'client', select: 'name address' } })
      .sort({ createdAt: 1 });
  } else if (role === 'gm') {
    // 總經理審主管的油資
    const managers = await User.find({ role: 'manager' }).select('_id');
    pendingClaims = await MileageClaim.find({ status: 'pending', salesRep: { $in: managers.map(m => m._id) } })
      .populate('salesRep', 'name email')
      .populate({ path: 'visit', populate: { path: 'client', select: 'name address' } })
      .sort({ createdAt: 1 });
  } else if (role === 'manager') {
    // 主管審所屬業務的油資
    const myReps = await User.find({ role: 'sales', manager: req.user._id }).select('_id');
    pendingClaims = await MileageClaim.find({ status: 'pending', salesRep: { $in: myReps.map(r => r._id) } })
      .populate('salesRep', 'name email')
      .populate({ path: 'visit', populate: { path: 'client', select: 'name address' } })
      .sort({ createdAt: 1 });
  }

  const canReview = ['admin', 'gm', 'manager'].includes(role);
  res.render('mileage/index', { claims, pendingClaims, canReview });
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

  const origin = req.query.origin || process.env.COMPANY_ADDRESS || '台北市';
  const destination = req.query.destination || (visit.client ? visit.client.address : '');

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

// 審核油資
router.put('/:id', ensureAuthenticated, async (req, res) => {
  const role = req.user.role;
  if (!['admin', 'gm', 'manager'].includes(role)) {
    req.flash('error_msg', '權限不足');
    return res.redirect('/mileage');
  }

  const { action, reviewNote } = req.body;
  const status = action === 'approve' ? 'approved' : 'rejected';

  const claim = await MileageClaim.findByIdAndUpdate(req.params.id, {
    status,
    reviewedBy: req.user._id,
    reviewedAt: Date.now(),
    reviewNote: reviewNote || '',
  }, { new: true }).populate('salesRep', 'name email')
    .populate({ path: 'visit', populate: { path: 'client', select: 'name address' } });

  // 若核准，寄 email 給財務
  if (status === 'approved' && process.env.FINANCE_EMAIL) {
    const clientName = claim.visit && claim.visit.client ? claim.visit.client.name : '未知';
    await sendMail({
      to: process.env.FINANCE_EMAIL,
      subject: `【油資核准通知】${claim.salesRep.name} - ${clientName}`,
      html: `
        <h2>油資申報已核准</h2>
        <table style="border-collapse:collapse; margin:10px 0;">
          <tr><td style="padding:5px 15px 5px 0; font-weight:bold;">業務人員</td><td>${claim.salesRep.name}</td></tr>
          <tr><td style="padding:5px 15px 5px 0; font-weight:bold;">拜訪客戶</td><td>${clientName}</td></tr>
          <tr><td style="padding:5px 15px 5px 0; font-weight:bold;">出發地</td><td>${claim.originAddress}</td></tr>
          <tr><td style="padding:5px 15px 5px 0; font-weight:bold;">目的地</td><td>${claim.destinationAddress}</td></tr>
          <tr><td style="padding:5px 15px 5px 0; font-weight:bold;">距離</td><td>${claim.distanceText || claim.distanceKm + ' km'}</td></tr>
          <tr><td style="padding:5px 15px 5px 0; font-weight:bold;">審核主管</td><td>${req.user.name}</td></tr>
        </table>
        <p style="color:#999; font-size:12px;">此信由 dentall 業務神隊友系統自動發送</p>
      `,
    });
  }

  req.flash('success_msg', status === 'approved' ? '油資已核准' : '油資已駁回');
  res.redirect('/mileage');
});

module.exports = router;
