const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  email: String,
  category: {
    type: String,
    enum: ['interested', 'potential', 'active'],
    default: 'interested'
  },
  interest: String,
  notes: [{
    text: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  registeredAt: {
    type: Date,
    default: Date.now
  },
  lastInteraction: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index للبحث السريع
clientSchema.index({ userId: 1, category: 1 });
clientSchema.index({ phone: 1 });

module.exports = mongoose.model('Client', clientSchema);
