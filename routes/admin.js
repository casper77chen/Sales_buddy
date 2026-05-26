const express = require('express');
const router = express.Router();
const path = require('path');
const User = require('../models/User');
const Client = require('../models/Client');
const { ensureAuthenticated, ensureAdmin } = require('../middleware/auth');

// 使用者管理
router.get('/', ensureAuthenticated, ensureAdmin, async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  const managers = await User.find({ role: { $in: ['manager', 'gm', 'admin'] } }).select('name');
  res.render('admin/users', { users, managers });
});

// 審核使用者（核准）
router.put('/users/:id/approve', ensureAuthenticated, ensureAdmin, async (req, res) => {
  await User.findByIdAndUpdate(req.params.id, { isApproved: true });
  req.flash('success_msg', '使用者已核准');
  res.redirect('/admin');
});

// 更新使用者角色 / 指派主管
router.put('/users/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  const { role, manager } = req.body;

  const update = {};
  if (role) update.role = role;
  if (manager) {
    update.manager = manager === 'none' ? null : manager;
  }

  await User.findByIdAndUpdate(req.params.id, update);
  req.flash('success_msg', '使用者已更新');
  res.redirect('/admin');
});

// 刪除使用者
router.delete('/users/:id', ensureAuthenticated, ensureAdmin, async (req, res) => {
  if (req.params.id === req.user._id.toString()) {
    req.flash('error_msg', '不能刪除自己');
    return res.redirect('/admin');
  }
  await User.findByIdAndDelete(req.params.id);
  req.flash('success_msg', '使用者已刪除');
  res.redirect('/admin');
});

// ============ d+ 客戶匯入 ============

// 預覽 (dry run)
router.get('/import-dplus', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const importData = require('../scripts/dplus-import-data.json');
    const result = await runDPlusImport(importData, true);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 執行匯入
router.post('/import-dplus', ensureAuthenticated, ensureAdmin, async (req, res) => {
  try {
    const importData = require('../scripts/dplus-import-data.json');
    const result = await runDPlusImport(importData, false);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function runDPlusImport(importData, dryRun) {
  const allClients = await Client.find({}).lean();

  const stats = { total: importData.length, matched: 0, alreadyDPlus: 0, updated: 0, created: 0, fuzzyMatched: 0 };
  const details = { updated: [], created: [], alreadyDPlus: [], fuzzyMatched: [] };

  for (const clinic of importData) {
    // Exact match
    let match = allClients.find(c => c.name === clinic.name);
    let method = 'exact';

    // Fuzzy match
    if (!match) {
      const cleanName = clinic.name.replace(/牙醫診所|牙醫|診所/g, '');
      if (cleanName.length >= 2) {
        match = allClients.find(c => {
          const dbClean = c.name.replace(/牙醫診所|牙醫|診所/g, '');
          return dbClean.length >= 2 && (dbClean === cleanName || c.name.includes(cleanName) || clinic.name.includes(dbClean));
        });
        if (match) method = 'fuzzy';
      }
    }

    if (match) {
      stats.matched++;
      if (method === 'fuzzy') {
        stats.fuzzyMatched++;
        details.fuzzyMatched.push({ excel: clinic.name, db: match.name, raw: clinic.raw });
      }

      const contractDate = clinic.activationDate ? new Date(clinic.activationDate) : undefined;

      if (match.hasDPlus) {
        stats.alreadyDPlus++;
        details.alreadyDPlus.push(match.name);
        // 即使已是 d+，也補上合約日期和管理公司（如果原本沒有的話）
        if (!dryRun) {
          const patch = {};
          if (contractDate && !match.dPlusContractDate) patch.dPlusContractDate = contractDate;
          if (clinic.managementCompany && !match.managementCompany) patch.managementCompany = clinic.managementCompany;
          if (Object.keys(patch).length > 0) await Client.findByIdAndUpdate(match._id, patch);
        }
      } else {
        stats.updated++;
        details.updated.push({ name: match.name, id: match._id, method });
        if (!dryRun) {
          const update = { hasDPlus: true };
          if (contractDate) update.dPlusContractDate = contractDate;
          if (clinic.managementCompany) update.managementCompany = clinic.managementCompany;
          await Client.findByIdAndUpdate(match._id, update);
        }
      }
    } else {
      stats.created++;
      const contractDate = clinic.activationDate ? new Date(clinic.activationDate) : undefined;
      const newClient = {
        name: clinic.name,
        hasDPlus: true,
        city: clinic.city || undefined,
        district: clinic.district || undefined,
        dPlusContractDate: contractDate,
        managementCompany: clinic.managementCompany || undefined,
      };
      details.created.push(newClient);
      if (!dryRun) {
        await Client.create(newClient);
      }
    }
  }

  return { dryRun, stats, details };
}

module.exports = router;
