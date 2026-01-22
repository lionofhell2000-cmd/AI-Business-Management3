const fs = require('fs').promises;
const path = require('path');

class JSONStorage {
  constructor(filepath) {
    this.filepath = filepath;
    this.ensureDirectory();
  }
  
  async ensureDirectory() {
    const dir = path.dirname(this.filepath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (e) {
      // Directory already exists
    }
  }
  
  async read() {
    try {
      const data = await fs.readFile(this.filepath, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      return [];
    }
  }
  
  async write(data) {
    await this.ensureDirectory();
    await fs.writeFile(this.filepath, JSON.stringify(data, null, 2), 'utf8');
  }
  
  async add(item) {
    const data = await this.read();
    const id = item.id || `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newItem = { ...item, id };
    data.push(newItem);
    await this.write(data);
    return newItem;
  }
  
  async findById(id) {
    const data = await this.read();
    return data.find(item => item.id === id);
  }
  
  async findBy(field, value) {
    const data = await this.read();
    return data.find(item => item[field] === value);
  }
  
  async findAll(field, value) {
    const data = await this.read();
    if (field && value) {
      return data.filter(item => item[field] === value);
    }
    return data;
  }
  
  async update(id, updates) {
    const data = await this.read();
    const index = data.findIndex(item => item.id === id);
    if (index !== -1) {
      data[index] = { ...data[index], ...updates };
      await this.write(data);
      return data[index];
    }
    return null;
  }
  
  async delete(id) {
    const data = await this.read();
    const filtered = data.filter(item => item.id !== id);
    await this.write(filtered);
    return filtered.length < data.length;
  }
}

module.exports = JSONStorage;
