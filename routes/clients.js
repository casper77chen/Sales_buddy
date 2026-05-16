const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const Client = require('../models/Client');
const { ensureAuthenticated } = require('../middleware/auth');

const upload = multer({ dest: path.join(__dirname, '../public/uploads/') });

// 客戶列表
router.get('/', ensureAuthenticated, async (req, res) => {
  const search = req.query.search || '';
  const query = search
    ? { $or: [
        { name: { $regex: search, $options: 'i' } },
        { contactPerson: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
      ]}
    : {};

  const clients = await Client.find(query).sort({ createdAt: -1 }).populate('createdBy', 'name');
  res.render('clients/index', { clients, search });
});

// 新增客戶頁
router.get('/new', ensureAuthenticated, (req, res) => {
  res.render('clients/form', { client: null });
});

// 新增客戶處理
router.post('/', ensureAuthenticated, async (req, res) => {
  const { name, phone, address, contactPerson, notes } = req.body;

  if (!name) {
    req.flash('error_msg', '請填寫客戶名稱');
    return res.redirect('/clients/new');
  }

  await Client.create({
    name, phone, address, contactPerson, notes,
    createdBy: req.user._id,
  });

  req.flash('success_msg', '客戶已新增');
  res.redirect('/clients');
});

// 編輯客戶頁
router.get('/:id/edit', ensureAuthenticated, async (req, res) => {
  const client = await Client.findById(req.params.id);
  if (!client) {
    req.flash('error_msg', '找不到此客戶');
    return res.redirect('/clients');
  }
  res.render('clients/form', { client });
});

// 更新客戶
router.put('/:id', ensureAuthenticated, async (req, res) => {
  const { name, phone, address, contactPerson, notes } = req.body;
  await Client.findByIdAndUpdate(req.params.id, { name, phone, address, contactPerson, notes });
  req.flash('success_msg', '客戶已更新');
  res.redirect('/clients');
});

// 刪除客戶
router.delete('/:id', ensureAuthenticated, async (req, res) => {
  await Client.findByIdAndDelete(req.params.id);
  req.flash('success_msg', '客戶已刪除');
  res.redirect('/clients');
});

// CSV 匯入頁
router.get('/import/csv', ensureAuthenticated, (req, res) => {
  res.render('clients/import');
});

// CSV 匯入處理
router.post('/import/csv', ensureAuthenticated, upload.single('file'), async (req, res) => {
  if (!req.file) {
    req.flash('error_msg', '請選擇 CSV 檔案');
    return res.redirect('/clients/import/csv');
  }

  const results = [];
  const filePath = req.file.path;

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      if (row.name || row['名稱']) {
        results.push({
          name: row.name || row['名稱'] || '',
          phone: row.phone || row['電話'] || '',
          address: row.address || row['地址'] || '',
          contactPerson: row.contactPerson || row['聯絡人'] || '',
          notes: row.notes || row['備註'] || '',
          createdBy: req.user._id,
        });
      }
    })
    .on('end', async () => {
      fs.unlinkSync(filePath);
      if (results.length === 0) {
        req.flash('error_msg', 'CSV 中無有效資料，請確認欄位名稱（name/名稱, phone/電話, address/地址, contactPerson/聯絡人, notes/備註）');
        return res.redirect('/clients/import/csv');
      }
      await Client.insertMany(results);
      req.flash('success_msg', `成功匯入 ${results.length} 筆客戶`);
      res.redirect('/clients');
    })
    .on('error', (err) => {
      console.error('CSV 解析失敗:', err);
      fs.unlinkSync(filePath);
      req.flash('error_msg', 'CSV 解析失敗');
      res.redirect('/clients/import/csv');
    });
});

module.exports = router;
