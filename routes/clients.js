const express = require('express');
const Client = require('../models/Client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Get all clients for current user
router.get('/', async (req, res) => {
  try {
    const clients = await Client.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(clients);
  } catch (error) {
    console.error('Get Clients Error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب العملاء' });
  }
});

// Get single client
router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findOne({ _id: req.params.id, userId: req.userId });
    
    if (!client) {
      return res.status(404).json({ error: 'العميل غير موجود' });
    }
    
    res.json(client);
  } catch (error) {
    console.error('Get Client Error:', error);
    res.status(500).json({ error: 'حدث خطأ' });
  }
});

// Create new client
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, interest, category } = req.body;
    
    if (!name || !phone) {
      return res.status(400).json({ error: 'الاسم ورقم الهاتف مطلوبان' });
    }
    
    const client = await Client.create({
      userId: req.userId,
      name,
      phone,
      email: email || '',
      interest: interest || '',
      category: category || 'interested',
      notes: [],
      lastInteraction: new Date()
    });
    
    res.status(201).json(client);
  } catch (error) {
    console.error('Create Client Error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إضافة العميل' });
  }
});

// Update client
router.put('/:id', async (req, res) => {
  try {
    const client = await Client.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { ...req.body, lastInteraction: new Date() },
      { new: true, runValidators: true }
    );
    
    if (!client) {
      return res.status(404).json({ error: 'العميل غير موجود' });
    }
    
    res.json(client);
  } catch (error) {
    console.error('Update Client Error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء تحديث العميل' });
  }
});

// Add note to client
router.post('/:id/notes', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'نص الملاحظة مطلوب' });
    }
    
    const client = await Client.findOne({ _id: req.params.id, userId: req.userId });
    
    if (!client) {
      return res.status(404).json({ error: 'العميل غير موجود' });
    }
    
    client.notes.push({ text });
    client.lastInteraction = new Date();
    await client.save();
    
    res.json(client);
  } catch (error) {
    console.error('Add Note Error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء إضافة الملاحظة' });
  }
});

// Delete client
router.delete('/:id', async (req, res) => {
  try {
    const client = await Client.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    
    if (!client) {
      return res.status(404).json({ error: 'العميل غير موجود' });
    }
    
    res.json({ message: 'تم حذف العميل بنجاح' });
  } catch (error) {
    console.error('Delete Client Error:', error);
    res.status(500).json({ error: 'حدث خطأ أثناء حذف العميل' });
  }
});

module.exports = router;
