const mongoose = require('mongoose');

const VisitSchema = new mongoose.Schema({
  salesRep: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
  date: { type: Date, required: true },
  timeSlot: { type: String, required: true },
  duration: { type: Number, default: 1 },
  status: { type: String, enum: ['scheduled', 'visited', 'cancelled'], default: 'scheduled' },
  contactPerson: { type: String },
  content: { type: String },
  followUp: { type: String },
  visitedAt: { type: Date },
  source: { type: String, enum: ['manual', 'google'], default: 'manual' },
  googleEventId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

VisitSchema.pre('save', function () {
  this.updatedAt = Date.now();
});

module.exports = mongoose.model('Visit', VisitSchema);
