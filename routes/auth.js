const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Helper function to generate JWT
function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'default-secret', {
    expiresIn: '7d'
  });
}

// Register new business owner
router.post('/register', async (req, res) => {
  try {
    const { email, password, businessName, whatsappNumber } = req.body;
    
    // Validation
    if (!email || !password || !businessName || !whatsappNumber) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'البريد الإلكتروني مستخدم بالفعل' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = await User.create({
      email,
      password: hashedPassword,
      businessName,
      whatsappNumber
    });
    
    // Generate token
    const token = generateToken(user._id.toString());
    
    res.status(201).json({
      message: 'تم إنشاء الحساب بنجاح',
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        businessName: user.businessName,
        whatsappNumber: user.whatsappNumber
      }
    });
  } catch (error) {
    console.error('Register Error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء التسجيل' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبان' });
    }
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }
    
    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' });
    }
    
    // Generate token
    const token = generateToken(user._id.toString());
    
    res.json({
      message: 'تم تسجيل الدخول بنجاح',
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        businessName: user.businessName,
        whatsappNumber: user.whatsappNumber
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الدخول' });
  }
});

// استيراد authMiddleware من middleware
const authMiddleware = require('../middleware/auth');

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'المستخدم غير موجود' });
    }
    
    res.json({
      id: user._id.toString(),
      email: user.email,
      businessName: user.businessName,
      whatsappNumber: user.whatsappNumber,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('Get User Error:', error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

module.exports = router;
