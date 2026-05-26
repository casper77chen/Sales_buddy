/**
 * d+ 客戶匯入腳本
 *
 * 使用方式：
 *   MONGODB_URI=mongodb://... node scripts/import-dplus.js [--dry-run]
 *
 * 邏輯：
 * 1. 讀取 dplus-import-data.json（從 Excel 解析出的資料）
 * 2. 比對現有客戶（用名稱模糊比對）
 * 3. 已存在的客戶 → 設定 hasDPlus = true
 * 4. 不存在的客戶 → 新增，並設定 hasDPlus = true
 */

const mongoose = require('mongoose');
const path = require('path');

// Load env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Client = require('../models/Client');
const importData = require('./dplus-import-data.json');

const DRY_RUN = process.argv.includes('--dry-run');

async function findMatch(clinic, allClients) {
  // Try exact match first
  let match = allClients.find(c => c.name === clinic.name);
  if (match) return { match, method: 'exact' };

  // Try contains match (clinic name contains or is contained by DB name)
  // Remove common suffixes for comparison
  const cleanName = clinic.name.replace(/牙醫診所|牙醫|診所/g, '');
  if (cleanName.length >= 2) {
    match = allClients.find(c => {
      const dbClean = c.name.replace(/牙醫診所|牙醫|診所/g, '');
      return dbClean.length >= 2 && (dbClean === cleanName || c.name.includes(cleanName) || clinic.name.includes(dbClean));
    });
    if (match) return { match, method: 'fuzzy' };
  }

  return null;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ERROR: MONGODB_URI not set');
    process.exit(1);
  }

  console.log(`Connecting to MongoDB...`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log(`Total d+ clinics to import: ${importData.length}`);
  console.log('');

  await mongoose.connect(uri);

  const allClients = await Client.find({}).lean();
  console.log(`Existing clients in DB: ${allClients.length}`);
  console.log('');

  const stats = {
    matched: 0,
    alreadyDPlus: 0,
    updated: 0,
    created: 0,
    fuzzyMatched: 0,
  };

  const results = {
    updated: [],
    created: [],
    alreadyDPlus: [],
    fuzzyMatched: [],
  };

  for (const clinic of importData) {
    const found = await findMatch(clinic, allClients);

    if (found) {
      const { match, method } = found;
      stats.matched++;

      if (method === 'fuzzy') {
        stats.fuzzyMatched++;
        results.fuzzyMatched.push({ excel: clinic.name, db: match.name, raw: clinic.raw });
      }

      const contractDate = clinic.activationDate ? new Date(clinic.activationDate) : undefined;

      if (match.hasDPlus) {
        stats.alreadyDPlus++;
        results.alreadyDPlus.push(match.name);
        if (!DRY_RUN && contractDate && !match.dPlusContractDate) {
          await Client.findByIdAndUpdate(match._id, { dPlusContractDate: contractDate });
        }
      } else {
        stats.updated++;
        results.updated.push({ name: match.name, id: match._id, method });

        if (!DRY_RUN) {
          const update = { hasDPlus: true };
          if (contractDate) update.dPlusContractDate = contractDate;
          await Client.findByIdAndUpdate(match._id, update);
        }
      }
    } else {
      // Create new client
      stats.created++;
      const contractDate = clinic.activationDate ? new Date(clinic.activationDate) : undefined;
      const newClient = {
        name: clinic.name,
        hasDPlus: true,
        city: clinic.city || undefined,
        district: clinic.district || undefined,
        dPlusContractDate: contractDate,
      };
      results.created.push(newClient);

      if (!DRY_RUN) {
        await Client.create(newClient);
      }
    }
  }

  console.log('=== 匯入結果 ===');
  console.log(`比對成功（已存在）: ${stats.matched}`);
  console.log(`  - 已經是 d+ 客戶: ${stats.alreadyDPlus}`);
  console.log(`  - 新標記為 d+: ${stats.updated}`);
  console.log(`  - 模糊比對: ${stats.fuzzyMatched}`);
  console.log(`新建客戶: ${stats.created}`);
  console.log('');

  if (results.fuzzyMatched.length > 0) {
    console.log('--- 模糊比對的客戶（請確認是否正確）---');
    for (const f of results.fuzzyMatched) {
      console.log(`  Excel: "${f.excel}" → DB: "${f.db}" (原始: ${f.raw})`);
    }
    console.log('');
  }

  if (results.updated.length > 0) {
    console.log('--- 更新為 d+ 的客戶 ---');
    for (const u of results.updated) {
      console.log(`  ${u.name} (${u.method})`);
    }
    console.log('');
  }

  if (results.created.length > 0) {
    console.log('--- 新建的客戶 ---');
    for (const c of results.created) {
      console.log(`  ${c.name} | ${c.city || '未知'} ${c.district || ''}`);
    }
    console.log('');
  }

  if (DRY_RUN) {
    console.log('⚠ DRY RUN 模式 - 以上為預覽，沒有實際寫入資料庫');
  } else {
    console.log('✅ 匯入完成！');
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
