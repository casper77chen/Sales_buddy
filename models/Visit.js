const mongoose = require('mongoose');

const VisitSchema = new mongoose.Schema({
  salesRep: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  date: { type: Date, required: true },
  timeSlot: { type: String, required: true },
  status: { type: String, enum: ['scheduled', 'visited', 'cancelled'], default: 'scheduled' },
  contactPerson: { type: String },
  content: { type: String },
  followUp: { type: String },
  visitedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

VisitSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Visit', VisitSchema);
