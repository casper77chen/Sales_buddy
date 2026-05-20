const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
const Visit = require('../models/Visit');
const { ensureAuthenticated } = require('../middleware/auth');

// 客戶搜尋 API（autocomplete 用）
router.get('/clients/search', ensureAuthenticated, async (req, res) => {
  const q = req.query.q || '';
  if (!q) return res.json([]);

  const clients = await Client.find({
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { contactPerson: { $regex: q, $options: 'i' } },
    ]
  }).limit(10).select('name phone address contactPerson');

  res.json(clients);
});

// 快速新增客戶 API（從新增拜訪 modal 使用）
router.post('/clients/quick-create', ensureAuthenticated, async (req, res) => {
  const { name, phone, address } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '請填寫診所名稱' });
  }
  const client = await Client.create({
    name: name.trim(),
    phone: phone || '',
    address: address || '',
    createdBy: req.user._id,
  });
  res.json({ _id: client._id, name: client.name, phone: client.phone, address: client.address });
});

// 客戶拜訪紀錄 API
router.get('/clients/:id/visits', ensureAuthenticated, async (req, res) => {
  const visits = await Visit.find({ client: req.params.id })
    .populate('salesRep', 'name')
    .sort({ date: -1, timeSlot: -1 });
  res.json(visits);
});

module.exports = router;
