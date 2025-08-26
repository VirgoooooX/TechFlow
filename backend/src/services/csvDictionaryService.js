const fs = require('fs');
const path = require('path');

class CSVDictionaryService {
  constructor() {
    this.csvPath = path.join(__dirname, '../../ecdict.csv');
    this.cache = new Map();
    this.isLoaded = false;
    this.headers = [];
  }

  // 解析CSV行，处理引号和逗号
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  }

  // 将CSV行转换为词典对象
  parseWordData(values) {
    return {
      word: values[0]?.toLowerCase().trim() || '',
      phonetic: values[1] || null,
      definition: values[2] ? values[2].replace(/\\n/g, '\n') : null,
      translation: values[3] ? values[3].replace(/\\n/g, '\n') : null,
      pos: values[4] || null,
      collins: values[5] ? parseInt(values[5]) : null,
      oxford: values[6] === '1' || values[6] === 'true',
      tag: values[7] || null,
      bnc: values[8] ? parseInt(values[8]) : null,
      frq: values[9] ? parseInt(values[9]) : null,
      exchange: values[10] || null,
      detail: values[11] || null,
      audio: values[12] || null
    };
  }

  // 查找单词（精确匹配）
  async findWord(word) {
    const searchWord = word.toLowerCase().trim();
    
    try {
      const fileContent = fs.readFileSync(this.csvPath, 'utf8');
      const lines = fileContent.split('\n');
      
      // 跳过标题行
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = this.parseCSVLine(line);
        const wordData = this.parseWordData(values);
        
        if (wordData.word === searchWord) {
          return wordData;
        }
      }
      
      return null;
    } catch (error) {
      console.error('查询单词时出错:', error);
      throw new Error('词典查询失败');
    }
  }

  // 模糊搜索（前缀匹配）
  async searchWords(query, limit = 10) {
    const searchQuery = query.toLowerCase().trim();
    const results = [];
    
    try {
      const fileContent = fs.readFileSync(this.csvPath, 'utf8');
      const lines = fileContent.split('\n');
      
      // 跳过标题行
      for (let i = 1; i < lines.length && results.length < limit; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = this.parseCSVLine(line);
        const wordData = this.parseWordData(values);
        
        if (wordData.word.startsWith(searchQuery)) {
          results.push(wordData);
        }
      }
      
      return results;
    } catch (error) {
      console.error('搜索单词时出错:', error);
      throw new Error('词典搜索失败');
    }
  }

  // 获取随机单词
  async getRandomWords(count = 5) {
    try {
      const fileContent = fs.readFileSync(this.csvPath, 'utf8');
      const lines = fileContent.split('\n');
      const dataLines = lines.slice(1).filter(line => line.trim());
      
      const results = [];
      const usedIndexes = new Set();
      
      while (results.length < count && usedIndexes.size < dataLines.length) {
        const randomIndex = Math.floor(Math.random() * dataLines.length);
        
        if (!usedIndexes.has(randomIndex)) {
          usedIndexes.add(randomIndex);
          const line = dataLines[randomIndex].trim();
          
          if (line) {
            const values = this.parseCSVLine(line);
            const wordData = this.parseWordData(values);
            
            if (wordData.word) {
              results.push(wordData);
            }
          }
        }
      }
      
      return results;
    } catch (error) {
      console.error('获取随机单词时出错:', error);
      throw new Error('获取随机单词失败');
    }
  }

  // 获取词典统计信息
  async getStats() {
    try {
      const fileContent = fs.readFileSync(this.csvPath, 'utf8');
      const lines = fileContent.split('\n');
      const dataLines = lines.slice(1).filter(line => line.trim());
      
      let oxfordCount = 0;
      let collinsCount = 0;
      
      // 采样统计（避免处理所有数据）
      const sampleSize = Math.min(10000, dataLines.length);
      const step = Math.floor(dataLines.length / sampleSize);
      
      for (let i = 0; i < dataLines.length; i += step) {
        const line = dataLines[i].trim();
        if (!line) continue;
        
        const values = this.parseCSVLine(line);
        const wordData = this.parseWordData(values);
        
        if (wordData.oxford) oxfordCount++;
        if (wordData.collins && wordData.collins > 0) collinsCount++;
      }
      
      // 按比例估算
      const ratio = dataLines.length / sampleSize;
      
      return {
        total: dataLines.length,
        oxford: Math.round(oxfordCount * ratio),
        collins: Math.round(collinsCount * ratio)
      };
    } catch (error) {
      console.error('获取统计信息时出错:', error);
      throw new Error('获取统计信息失败');
    }
  }
}

module.exports = new CSVDictionaryService();