const express = require('express');
const router = express.Router();
const Client = require('../models/Client');
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

module.exports = router;
