const mongoose = require('mongoose');

const companySettingsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  responseTone: {
    type: String,
    enum: ['formal', 'friendly', 'brief', 'marketing'],
    default: 'friendly'
  },
  allowedActions: {
    type: String,
    default: ''
  },
  prohibitedActions: {
    type: String,
    default: ''
  },
  limitations: {
    type: String,
    default: ''
  },
  uploadedFiles: [{
    filename: String,
    originalName: String,
    supabasePath: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('CompanySettings', companySettingsSchema);
