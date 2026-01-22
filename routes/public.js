const express = require('express');
const User = require('../models/User');
const Client = require('../models/Client');

const router = express.Router();

// Get business info for public registration
router.get('/business/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'الشركة غير موجودة' });
    }
    
    res.json({
      businessName: user.businessName,
      whatsappNumber: user.whatsappNumber
    });
  } catch (error) {
    console.error('Get Business Error:', error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Public client registration (no auth required)
router.post('/register-client', async (req, res) => {
  try {
    const { userId, name, phone, email, interest } = req.body;
    
    if (!userId || !name || !phone) {
      return res.status(400).json({ error: 'البيانات المطلوبة غير مكتملة' });
    }
    
    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'الشركة غير موجودة' });
    }
    
    // Create client
    const client = await Client.create({
      userId,
      name,
      phone,
      email: email || '',
      interest: interest || '',
      category: 'interested',
      notes: [],
      lastInteraction: new Date()
    });
    
    res.json({
      success: true,
      client,
      whatsappNumber: user.whatsappNumber
    });
  } catch (error) {
    console.error('Public Register Error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء التسجيل' });
  }
});

module.exports = router;
