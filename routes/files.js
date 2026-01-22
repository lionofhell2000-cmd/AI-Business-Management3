const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middleware/auth');
const fileStorage = require('../services/fileStorage');
const CompanySettings = require('../models/CompanySettings');

// إعداد Multer لاستقبال الملفات في الذاكرة
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|doc|docx|txt/;
    const ext = file.originalname.split('.').pop().toLowerCase();
    
    if (allowedTypes.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, TXT files are allowed'));
    }
  }
});

// رفع ملف
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'لم يتم رفع أي ملف' });
    }

    const userId = req.userId;
    
    // رفع إلى Supabase
    const fileData = await fileStorage.uploadFile(userId, req.file);
    
    // حفظ المعلومات في MongoDB
    let settings = await CompanySettings.findOne({ userId });
    
    if (!settings) {
      settings = new CompanySettings({ userId });
    }
    
    settings.uploadedFiles.push(fileData);
    await settings.save();
    
    res.json({
      success: true,
      file: fileData
    });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء رفع الملف' });
  }
});

// حذف ملف
router.delete('/:filename', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const filename = req.params.filename;
    
    const settings = await CompanySettings.findOne({ userId });
    
    if (!settings) {
      return res.status(404).json({ error: 'الإعدادات غير موجودة' });
    }
    
    const fileIndex = settings.uploadedFiles.findIndex(
      f => f.filename === filename
    );
    
    if (fileIndex === -1) {
      return res.status(404).json({ error: 'الملف غير موجود' });
    }
    
    const file = settings.uploadedFiles[fileIndex];
    
    // حذف من Supabase
    await fileStorage.deleteFile(file.supabasePath);
    
    // حذف من MongoDB
    settings.uploadedFiles.splice(fileIndex, 1);
    await settings.save();
    
    res.json({ success: true, message: 'تم حذف الملف بنجاح' });
  } catch (error) {
    console.error('Delete File Error:', error);
    res.status(500).json({ error: error.message || 'حدث خطأ أثناء حذف الملف' });
  }
});

// عرض قائمة الملفات
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const settings = await CompanySettings.findOne({ userId });
    
    if (!settings) {
      return res.json({ files: [] });
    }
    
    res.json({ files: settings.uploadedFiles });
  } catch (error) {
    console.error('Get Files Error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب الملفات' });
  }
});

module.exports = router;
