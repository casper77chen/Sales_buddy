const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String },
  address: { type: String },
  isDigital: { type: Boolean, default: false },
  hasDPlus: { type: Boolean, default: false },
  dPlusContractDate: { type: Date },
  dPlusStatus: { type: String, enum: ['', 'extended', 'achieved'], default: '' },
  hasHIS: { type: Boolean, default: false },
  isShareholder: { type: Boolean, default: false },
  owner: { type: String },
  contactPerson: { type: String },
  notes: { type: String },
  institutionCode: { type: String },
  city: { type: String },
  district: { type: String },
  website: { type: String },
  facebook: { type: String },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Client', ClientSchema);
