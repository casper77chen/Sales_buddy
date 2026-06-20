const mongoose = require('mongoose');

const MAX_DELAY_MS = 30000; // 重試間隔上限 30 秒

// 監聽連線狀態（部署時 Mongo 短暫抖動也能自動恢復）
mongoose.connection.on('connected', () => console.log('MongoDB 已連線'));
mongoose.connection.on('disconnected', () => console.warn('MongoDB 連線中斷，等待自動重連…'));
mongoose.connection.on('reconnected', () => console.log('MongoDB 已重新連線'));
mongoose.connection.on('error', (err) => console.error('MongoDB 連線錯誤:', err.message));

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_CONNECTION_STRING;
  if (!uri) {
    console.error('找不到 MongoDB 連線字串，請確認 .env 中的 MONGODB_URI');
  }

  let attempt = 0;
  // 無限重試 + backoff，啟動連不上時不讓程式崩潰退出（避免 502）
  while (true) {
    try {
      attempt += 1;
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
      });
      return; // 成功，後續斷線交給 mongoose 自動重連處理
    } catch (err) {
      const delay = Math.min(1000 * 2 ** (attempt - 1), MAX_DELAY_MS);
      console.error(`MongoDB 連線失敗（第 ${attempt} 次）: ${err.message}，${delay / 1000} 秒後重試`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

module.exports = connectDB;
