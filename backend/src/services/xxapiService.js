const axios = require('axios');
const logger = require('../utils/logger');

class XXAPIService {
  constructor() {
    this.baseURL = 'https://v2.xxapi.cn/api/englishwords';
  }

  /**
   * 查询单词详细信息
   * @param {string} word - 要查询的单词
   * @returns {Promise<Object>} 格式化后的单词信息
   */
  async lookupWord(word) {
    try {
      logger.info(`查询单词: ${word}`);
      
      const response = await axios.get(`${this.baseURL}?word=${encodeURIComponent(word)}`);
      
      if (response.data.code !== 200 || !response.data.data) {
        throw new Error(`API返回错误: ${response.data.msg || '未知错误'}`);
      }
      
      const data = response.data.data;
      return this.formatWordData(word, data);
      
    } catch (error) {
      logger.error(`查询单词失败: ${word}`, error);
      throw error;
    }
  }

  /**
   * 格式化单词数据为统一格式
   * @param {string} word - 单词
   * @param {Object} data - API返回的原始数据
   * @returns {Object} 格式化后的数据
   */
  formatWordData(word, data) {
    // 提取音标信息
    const phonetic = {
      text: data.ukphone || data.usphone || '',
      audio: data.ukspeech || data.usspeech || ''
    };

    // 提取翻译信息，转换为meanings格式
    const meanings = [];
    
    if (data.translations && data.translations.length > 0) {
      data.translations.forEach(trans => {
        meanings.push({
          partOfSpeech: trans.pos || 'unknown',
          definitions: [{
            definition: trans.tran_cn || '',
            example: '',
            synonyms: [],
            antonyms: []
          }]
        });
      });
    }

    // 如果没有translations，尝试从其他字段提取
    if (meanings.length === 0 && data.word) {
      meanings.push({
        partOfSpeech: 'unknown',
        definitions: [{
          definition: '暂无中文释义',
          example: '',
          synonyms: [],
          antonyms: []
        }]
      });
    }

    // 提取例句
    const examples = [];
    if (data.sentences && data.sentences.length > 0) {
      data.sentences.forEach(sentence => {
        examples.push({
          sentence: sentence.s_content || '',
          translation: sentence.s_cn || ''
        });
      });
    }

    // 提取短语
    const phrases = [];
    if (data.phrases && data.phrases.length > 0) {
      data.phrases.forEach(phrase => {
        phrases.push({
          phrase: phrase.p_content || '',
          translation: phrase.p_cn || ''
        });
      });
    }

    // 提取近义词
    const synonyms = [];
    if (data.synonyms && data.synonyms.length > 0) {
      data.synonyms.forEach(syn => {
        if (syn.Hwds && syn.Hwds.length > 0) {
          syn.Hwds.forEach(hwd => {
            synonyms.push(hwd.word || '');
          });
        }
      });
    }

    // 提取同根词
    const relatedWords = [];
    if (data.relWords && data.relWords.length > 0) {
      data.relWords.forEach(rel => {
        if (rel.Hwds && rel.Hwds.length > 0) {
          rel.Hwds.forEach(hwd => {
            relatedWords.push({
              word: hwd.hwd || '',
              translation: hwd.tran || '',
              partOfSpeech: rel.Pos || ''
            });
          });
        }
      });
    }

    return {
      word: word,
      phonetic: phonetic,
      meanings: meanings,
      examples: examples,
      phrases: phrases,
      synonyms: synonyms,
      relatedWords: relatedWords,
      sourceAPI: 'xxapi.cn',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 提取单词定义（兼容原有接口）
   * @param {Object} wordData - 格式化后的单词数据
   * @returns {Object} 提取的定义信息
   */
  extractDefinitions(wordData) {
    const definitions = [];
    
    if (wordData.meanings && wordData.meanings.length > 0) {
      wordData.meanings.forEach(meaning => {
        if (meaning.definitions && meaning.definitions.length > 0) {
          meaning.definitions.forEach(def => {
            definitions.push({
              partOfSpeech: meaning.partOfSpeech,
              definition: def.definition,
              example: def.example || '',
              exampleTranslation: '' // 例句翻译在examples字段中
            });
          });
        }
      });
    }

    return {
      word: wordData.word,
      phonetic: wordData.phonetic.text,
      definitions: definitions,
      examples: wordData.examples || [],
      phrases: wordData.phrases || [],
      synonyms: wordData.synonyms || [],
      relatedWords: wordData.relatedWords || []
    };
  }
}

module.exports = new XXAPIService();