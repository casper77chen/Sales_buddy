const mongoose = require('mongoose');

const MileageClaimSchema = new mongoose.Schema({
  visit: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit', required: true },
  salesRep: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  originAddress: { type: String, required: true },
  destinationAddress: { type: String, required: true },
  distanceKm: { type: Number, required: true },
  distanceText: { type: String },
  durationText: { type: String },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  reviewNote: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('MileageClaim', MileageClaimSchema);
