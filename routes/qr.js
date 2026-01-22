const express = require('express');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Generate QR code data
router.get('/generate', (req, res) => {
  try {
    const { type, campaignId } = req.query;
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    
    let registrationUrl;
    
    if (type === 'campaign' && campaignId) {
      registrationUrl = `${baseUrl}/register?campaign=${campaignId}&userId=${req.userId}`;
    } else if (type === 'employee' && req.query.employeeId) {
      registrationUrl = `${baseUrl}/register?employee=${req.query.employeeId}&userId=${req.userId}`;
    } else {
      registrationUrl = `${baseUrl}/register?userId=${req.userId}`;
    }
    
    res.json({ 
      url: registrationUrl,
      qrData: registrationUrl
    });
  } catch (error) {
    console.error('QR Generate Error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء توليد QR Code' });
  }
});

module.exports = router;
