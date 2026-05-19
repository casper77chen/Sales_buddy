const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const Client = require('../models/Client');
const User = require('../models/User');
const { ensureAuthenticated } = require('../middleware/auth');

const upload = multer({ dest: path.join(__dirname, '../public/uploads/') });

// 中文數字 <-> 阿拉伯數字 對照
const cnToDigit = { '零':'0','一':'1','二':'2','三':'3','四':'4','五':'5','六':'6','七':'7','八':'8','九':'9','十':'10' };
const digitToCn = { '0':'零','1':'一','2':'二','3':'三','4':'四','5':'五','6':'六','7':'七','8':'八','9':'九' };

function buildSearchRegex(term) {
  let pattern = '';
  for (const ch of term) {
    const code = ch.charCodeAt(0);
    if (code >= 0x30 && code <= 0x39) {
      // 半形數字 -> 比對半形、全形、中文
      const fw = String.fromCharCode(code + 0xFEE0);
      const cn = digitToCn[ch] || '';
      pattern += cn ? `(?:${ch}|${fw}|${cn})` : `[${ch}${fw}]`;
    } else if (code >= 0xFF10 && code <= 0xFF19) {
      // 全形數字 -> 比對半形、全形、中文
      const hw = String.fromCharCode(code - 0xFEE0);
      const cn = digitToCn[hw] || '';
      pattern += cn ? `(?:${hw}|${ch}|${cn})` : `[${hw}${ch}]`;
    } else if (cnToDigit[ch]) {
      // 中文數字 -> 比對中文、半形、全形
      const hw = cnToDigit[ch];
      if (hw.length === 1) {
        const fw = String.fromCharCode(hw.charCodeAt(0) + 0xFEE0);
        pattern += `(?:${ch}|${hw}|${fw})`;
      } else {
        // 十 -> 10
        pattern += `(?:${ch}|${hw})`;
      }
    } else {
      pattern += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
  }
  return pattern;
}

// 客戶列表
router.get('/', ensureAuthenticated, async (req, res) => {
  const search = req.query.search || '';
  const cityFilter = req.query.city || '';
  const districtFilter = req.query.district || '';
  const repFilter = req.query.rep || '';

  const query = {};
  if (search) {
    const searchPattern = buildSearchRegex(search);
    query.$or = [
      { name: { $regex: searchPattern, $options: 'i' } },
      { contactPerson: { $regex: searchPattern, $options: 'i' } },
      { address: { $regex: searchPattern, $options: 'i' } },
      { institutionCode: { $regex: searchPattern, $options: 'i' } },
      { owner: { $regex: searchPattern, $options: 'i' } },
    ];
  }
  if (cityFilter) query.city = cityFilter;
  if (districtFilter) query.district = districtFilter;
  if (repFilter === 'unassigned') {
    query.assignedTo = { $in: [null, undefined] };
  } else if (repFilter) {
    query.assignedTo = repFilter;
  }

  const clients = await Client.find(query).sort({ city: 1, district: 1, name: 1 }).populate('createdBy', 'name').populate('assignedTo', 'name');

  // 取得所有縣市和行政區供篩選
  const cities = await Client.distinct('city');
  const districts = cityFilter ? await Client.distinct('district', { city: cityFilter }) : [];
  const salesReps = await User.find({ role: { $in: ['sales', 'manager'] }, isApproved: true }).select('name').sort({ name: 1 });

  res.render('clients/index', { clients, search, cityFilter, districtFilter, repFilter, cities, districts, salesReps });
});

// 新增客戶頁
router.get('/new', ensureAuthenticated, async (req, res) => {
  const salesReps = await User.find({ role: 'sales', isApproved: true }).select('name').sort({ name: 1 });
  res.render('clients/form', { client: null, salesReps });
});

// 新增客戶處理
router.post('/', ensureAuthenticated, async (req, res) => {
  const { name, phone, address, owner, contactPerson, notes, institutionCode, city, district, website, facebook, hasDPlus, hasHIS, isShareholder, assignedTo, dPlusContractDate, dPlusStatus } = req.body;

  if (!name) {
    req.flash('error_msg', '請填寫診所名稱');
    return res.redirect('/clients/new');
  }

  await Client.create({
    name, phone, address, owner, contactPerson, notes,
    institutionCode, city, district, website, facebook,
    hasDPlus: hasDPlus === 'on', hasHIS: hasHIS === 'on', isShareholder: isShareholder === 'on',
    dPlusContractDate: dPlusContractDate || null,
    dPlusStatus: dPlusStatus || '',
    assignedTo: assignedTo || null,
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
  const salesReps = await User.find({ role: 'sales', isApproved: true }).select('name').sort({ name: 1 });
  res.render('clients/form', { client, salesReps });
});

// 更新客戶
router.put('/:id', ensureAuthenticated, async (req, res) => {
  const { name, phone, address, owner, contactPerson, notes, institutionCode, city, district, website, facebook, hasDPlus, hasHIS, isShareholder, assignedTo, dPlusContractDate, dPlusStatus } = req.body;
  await Client.findByIdAndUpdate(req.params.id, {
    name, phone, address, owner, contactPerson, notes,
    institutionCode, city, district, website, facebook,
    hasDPlus: hasDPlus === 'on', hasHIS: hasHIS === 'on', isShareholder: isShareholder === 'on',
    dPlusContractDate: dPlusContractDate || null,
    dPlusStatus: dPlusStatus || '',
    assignedTo: assignedTo || null,
  });
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
      const name = row['診所名稱'] || row.name || row['名稱'] || '';
      if (name) {
        results.push({
          name,
          phone: row['電話'] || row.phone || '',
          address: row['地址'] || row.address || '',
          owner: row['負責人'] || row.owner || '',
          contactPerson: row['聯絡人'] || row.contactPerson || '',
          notes: row['備註'] || row.notes || '',
          institutionCode: row['機構代碼'] || row.institutionCode || '',
          city: row['縣市'] || row.city || '',
          district: row['行政區'] || row.district || '',
          website: row['官網'] || row.website || '',
          facebook: row['FB連結'] || row.facebook || '',
          createdBy: req.user._id,
        });
      }
    })
    .on('end', async () => {
      fs.unlinkSync(filePath);
      if (results.length === 0) {
        req.flash('error_msg', 'CSV 中無有效資料，請確認欄位名稱');
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
