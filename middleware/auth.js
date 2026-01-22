const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware للتحقق من JWT Token
 * يستخدم في جميع Routes التي تحتاج Authentication
 */
const authMiddleware = async (req, res, next) => {
  try {
    // الحصول على Token من Header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
    }
    
    // استخراج Token (Bearer <token>)
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.slice(7) 
      : authHeader;
    
    if (!token) {
      return res.status(401).json({ error: 'رمز غير صالح' });
    }
    
    // التحقق من Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
    
    // التحقق من وجود المستخدم
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'المستخدم غير موجود' });
    }
    
    // إضافة userId إلى Request
    req.userId = decoded.id;
    req.user = user;
    
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'رمز غير صالح' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'انتهت صلاحية الرمز' });
    }
    
    console.error('Auth Middleware Error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء التحقق من الهوية' });
  }
};

module.exports = authMiddleware;
