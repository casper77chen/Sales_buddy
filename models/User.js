const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'manager', 'sales'], default: 'sales' },
  isApproved: { type: Boolean, default: false },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  googleCalendarUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', UserSchema);
