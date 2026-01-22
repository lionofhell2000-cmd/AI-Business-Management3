const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fileStorage = require('./fileStorage');
const CompanySettings = require('../models/CompanySettings');

async function parseFile(filepath) {
  try {
    // تحميل الملف من Supabase
    const fileBuffer = await fileStorage.downloadFile(filepath);
    
    const ext = filepath.split('.').pop().toLowerCase();
    
    if (ext === 'pdf') {
      const data = await pdfParse(fileBuffer);
      return data.text;
    }
    
    if (ext === 'docx' || ext === 'doc') {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return result.value;
    }
    
    if (ext === 'txt') {
      return fileBuffer.toString('utf8');
    }
    
    throw new Error(`Unsupported file type: ${ext}`);
  } catch (error) {
    console.error('File Parser Error:', error);
    throw error;
  }
}

async function parseAllCompanyFiles(userId) {
  try {
    // جلب إعدادات الشركة من MongoDB
    const settings = await CompanySettings.findOne({ userId });
    
    if (!settings || !settings.uploadedFiles.length) {
      return '';
    }
    
    let combinedText = '';
    
    for (const file of settings.uploadedFiles) {
      try {
        const text = await parseFile(file.supabasePath);
        combinedText += `\n\n=== ${file.originalName} ===\n${text}`;
      } catch (error) {
        console.error(`Error parsing ${file.originalName}:`, error);
      }
    }
    
    return combinedText;
  } catch (error) {
    console.error('Parse All Files Error:', error);
    return '';
  }
}

module.exports = { parseFile, parseAllCompanyFiles };
