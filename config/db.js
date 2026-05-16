const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGO_CONNECTION_STRING;
    await mongoose.connect(uri);
    console.log('MongoDB 已連線');
  } catch (err) {
    console.error('MongoDB 連線失敗:', err.message);
    console.error('請確認 .env 中的 MONGODB_URI 是否正確');
    process.exit(1);
  }
};

module.exports = connectDB;
