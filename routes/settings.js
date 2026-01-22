const express = require('express');
const CompanySettings = require('../models/CompanySettings');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Get company settings
router.get('/', async (req, res) => {
  try {
    let settings = await CompanySettings.findOne({ userId: req.userId });
    
    if (!settings) {
      settings = new CompanySettings({
        userId: req.userId,
        responseTone: 'friendly',
        allowedActions: '',
        prohibitedActions: '',
        limitations: '',
        uploadedFiles: []
      });
      await settings.save();
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Get Settings Error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الإعدادات' });
  }
});

// Update company settings
router.put('/', async (req, res) => {
  try {
    const { responseTone, allowedActions, prohibitedActions, limitations } = req.body;
    
    let settings = await CompanySettings.findOne({ userId: req.userId });
    
    if (!settings) {
      settings = new CompanySettings({ userId: req.userId });
    }
    
    settings.responseTone = responseTone || 'friendly';
    settings.allowedActions = allowedActions || '';
    settings.prohibitedActions = prohibitedActions || '';
    settings.limitations = limitations || '';
    
    await settings.save();
    
    res.json(settings);
  } catch (error) {
    console.error('Update Settings Error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حفظ الإعدادات' });
  }
});

module.exports = router;
