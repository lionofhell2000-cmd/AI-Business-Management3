const supabase = require('../config/supabase');

class FileStorage {
  /**
   * رفع ملف إلى Supabase Storage
   */
  async uploadFile(userId, file) {
    const filename = `${Date.now()}-${file.originalname}`;
    const filepath = `${userId}/${filename}`;
    
    const { data, error } = await supabase.storage
      .from('company-files')
      .upload(filepath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });
    
    if (error) throw error;
    
    return {
      filename,
      originalName: file.originalname,
      supabasePath: filepath
    };
  }
  
  /**
   * قراءة ملف من Supabase
   */
  async downloadFile(filepath) {
    const { data, error } = await supabase.storage
      .from('company-files')
      .download(filepath);
    
    if (error) throw error;
    return data;
  }
  
  /**
   * حذف ملف
   */
  async deleteFile(filepath) {
    const { error } = await supabase.storage
      .from('company-files')
      .remove([filepath]);
    
    if (error) throw error;
  }
  
  /**
   * الحصول على رابط عام مؤقت (expires in 1 hour)
   */
  async getPublicUrl(filepath) {
    const { data } = supabase.storage
      .from('company-files')
      .getPublicUrl(filepath, {
        expiresIn: 3600 // ساعة واحدة
      });
    
    return data.publicUrl;
  }
}

module.exports = new FileStorage();
