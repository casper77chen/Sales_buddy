const express = require('express');
const router = express.Router();
const Visit = require('../models/Visit');
const Client = require('../models/Client');
const User = require('../models/User');
const MileageClaim = require('../models/MileageClaim');
const { sendMail } = require('../config/mailer');
const { ensureAuthenticated, ensureManager } = require('../middleware/auth');

// 主管 Dashboard
router.get('/', ensureAuthenticated, ensureManager, async (req, res) => {
  // 本週範圍
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  // 取得所有業務
  const salesReps = await User.find({ role: 'sales' }).select('name email');

  // 各業務本週拜訪統計
  const repStats = await Promise.all(salesReps.map(async (rep) => {
    const totalVisits = await Visit.countDocuments({
      salesRep: rep._id,
      date: { $gte: monday, $lte: sunday },
    });
    const completedVisits = await Visit.countDocuments({
      salesRep: rep._id,
      date: { $gte: monday, $lte: sunday },
      status: 'visited',
    });
    const newClients = await Client.countDocuments({
      createdBy: rep._id,
      createdAt: { $gte: monday, $lte: sunday },
    });
    const mileageClaims = await MileageClaim.countDocuments({
      salesRep: rep._id,
      createdAt: { $gte: monday, $lte: sunday },
    });
    return {
      rep,
      totalVisits,
      completedVisits,
      newClients,
      mileageClaims,
    };
  }));

  // 待審油資數量
  const pendingClaims = await MileageClaim.countDocuments({ status: 'pending' });

  res.render('manager/dashboard', { repStats, pendingClaims, monday, sunday });
});

// 待審油資清單
router.get('/claims', ensureAuthenticated, ensureManager, async (req, res) => {
  const claims = await MileageClaim.find({ status: 'pending' })
    .populate('salesRep', 'name email')
    .populate({ path: 'visit', populate: { path: 'client', select: 'name address' } })
    .sort({ createdAt: 1 });
  res.render('manager/claims', { claims });
});

// 審核油資
router.put('/claims/:id', ensureAuthenticated, ensureManager, async (req, res) => {
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
  res.redirect('/manager/claims');
});

module.exports = router;
