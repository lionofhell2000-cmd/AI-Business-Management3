const express = require('express');
const { getSuggestion } = require('../services/aiService');
const { parseAllCompanyFiles } = require('../services/fileParser');
const CompanySettings = require('../models/CompanySettings');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

// Build company context for AI
async function buildCompanyContext(userId) {
  try {
    const settings = await CompanySettings.findOne({ userId });
    const filesText = await parseAllCompanyFiles(userId);
    const user = await User.findById(userId);
    
    const context = `
أنت مساعد ذكاء اصطناعي لشركة ${user?.businessName || 'العميل'}.

## معلومات الشركة:
${filesText || 'لا توجد ملفات مرفوعة بعد'}

## أسلوب الرد المطلوب:
${settings?.responseTone || 'ودي ومحترف'}

## القوانين الواجب اتباعها:

### مسموح:
${settings?.allowedActions || '- الرد على استفسارات المنتجات والخدمات\n- تقديم معلومات عامة\n- حجز مواعيد'}

### ممنوع:
${settings?.prohibitedActions || '- لا تعطي خصومات بدون موافقة\n- لا تتحدث عن المنافسين\n- لا تعد بمواعيد تسليم محددة بدون تأكيد'}

### الحدود:
${settings?.limitations || '- أقصى خصم يمكن ذكره: 10%\n- الردود يجب أن لا تتجاوز 100 كلمة\n- دائماً اطلب من العميل التواصل للتفاصيل المعقدة'}

## تعليمات إضافية:
- كن دقيقاً ومحترفاً
- لا تخرج عن السياق المحدد
- إذا لم تكن متأكداً من معلومة، اطلب من العميل التواصل مباشرة
- استخدم اللغة العربية الفصحى البسيطة
- كن ودوداً ومهذباً
`;

    return context;
  } catch (error) {
    console.error('Build Context Error:', error);
    return 'أنت مساعد ذكاء اصطناعي محترف. قدم ردوداً ودية ومهذبة باللغة العربية.';
  }
}

// Get AI suggestion
router.post('/suggest', async (req, res) => {
  try {
    const { customerMessage } = req.body;
    
    if (!customerMessage) {
      return res.status(400).json({ error: 'رسالة العميل مطلوبة' });
    }
    
    const companyContext = await buildCompanyContext(req.userId);
    const suggestion = await getSuggestion(customerMessage, companyContext);
    
    res.json({ suggestion });
  } catch (error) {
    console.error('AI Suggest Error:', error);
    res.status(500).json({ 
      error: 'حدث خطأ أثناء الحصول على الاقتراح',
      message: error.message 
    });
  }
});

module.exports = router;
