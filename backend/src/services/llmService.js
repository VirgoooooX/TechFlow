const axios = require('axios');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');

class LLMService {
  constructor() {
    this.defaultConfig = {
      provider: 'openai',
      model: 'gpt-3.5-turbo',
      maxTokens: 1000,
      temperature: 0.3
    };
  }

  /**
   * 获取用户的LLM配置
   */
  async getUserLLMConfig(userId) {
    try {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
        select: {
          llmProvider: true,
          llmApiKey: true,
          llmBaseUrl: true,
          llmModel: true,
          maxTokens: true,
          temperature: true
        }
      });

      if (!settings || !settings.llmApiKey) {
        throw new Error('用户未配置LLM API密钥');
      }

      return {
        provider: settings.llmProvider || this.defaultConfig.provider,
        apiKey: settings.llmApiKey,
        endpoint: settings.llmBaseUrl,
        model: settings.llmModel || this.defaultConfig.model,
        maxTokens: settings.maxTokens || this.defaultConfig.maxTokens,
        temperature: settings.temperature || this.defaultConfig.temperature
      };
    } catch (error) {
      logger.error('Failed to get user LLM config:', error);
      throw error;
    }
  }

  /**
   * 获取系统默认LLM配置（用于标题翻译等系统任务）
   */
  async getSystemLLMConfig() {
    try {
      const systemSettings = await prisma.systemSettings.findUnique({
        where: { id: 'system' }
      });

      if (systemSettings && systemSettings.llmApiKey) {
        return {
          provider: systemSettings.llmProvider || this.defaultConfig.provider,
          apiKey: systemSettings.llmApiKey,
          endpoint: systemSettings.llmBaseUrl,
          model: systemSettings.llmModel || this.defaultConfig.model,
          maxTokens: systemSettings.maxTokens || this.defaultConfig.maxTokens,
          temperature: systemSettings.temperature || this.defaultConfig.temperature
        };
      }

      // 如果数据库中没有配置，回退到环境变量
      const envConfig = {
        provider: process.env.DEFAULT_LLM_PROVIDER || 'openai',
        apiKey: process.env.DEFAULT_LLM_API_KEY,
        endpoint: process.env.DEFAULT_LLM_ENDPOINT,
        model: process.env.DEFAULT_LLM_MODEL || 'gpt-3.5-turbo',
        maxTokens: parseInt(process.env.DEFAULT_LLM_MAX_TOKENS) || 1000,
        temperature: parseFloat(process.env.DEFAULT_LLM_TEMPERATURE) || 0.3
      };

      if (!envConfig.apiKey) {
        throw new Error('系统LLM API密钥未配置');
      }

      return envConfig;
    } catch (error) {
      logger.error('Failed to get system LLM config:', error);
      throw error;
    }
  }

  /**
   * 调用OpenAI API
   */
  async callOpenAI(config, messages) {
    try {
      const endpoint = config.endpoint || 'https://api.openai.com/v1/chat/completions';
      
      const response = await axios.post(endpoint, {
        model: config.model,
        messages: messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature
      }, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      logger.error('OpenAI API call failed:', error.response?.data || error.message);
      throw new Error('LLM API调用失败');
    }
  }

  /**
   * 调用Anthropic API
   */
  async callAnthropic(config, messages) {
    try {
      const endpoint = config.endpoint || 'https://api.anthropic.com/v1/messages';
      
      // 转换消息格式
      const anthropicMessages = messages.filter(msg => msg.role !== 'system').map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      const systemMessage = messages.find(msg => msg.role === 'system');

      const response = await axios.post(endpoint, {
        model: config.model || 'claude-3-sonnet-20240229',
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        system: systemMessage?.content,
        messages: anthropicMessages
      }, {
        headers: {
          'x-api-key': config.apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        timeout: 30000
      });

      return response.data.content[0].text.trim();
    } catch (error) {
      logger.error('Anthropic API call failed:', error.response?.data || error.message);
      throw new Error('LLM API调用失败');
    }
  }

  /**
   * 调用Google Gemini API
   */
  async callGemini(config, messages) {
    try {
      const endpoint = config.endpoint || `https://generativelanguage.googleapis.com/v1beta/models/${config.model || 'gemini-pro'}:generateContent`;
      
      // 转换消息格式为Gemini格式
      const parts = messages.map(msg => ({
        text: msg.content
      }));

      const response = await axios.post(`${endpoint}?key=${config.apiKey}`, {
        contents: [{
          parts: parts
        }],
        generationConfig: {
          temperature: config.temperature,
          maxOutputTokens: config.maxTokens
        }
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      return response.data.candidates[0].content.parts[0].text.trim();
    } catch (error) {
      logger.error('Gemini API call failed:', error.response?.data || error.message);
      throw new Error('Gemini API调用失败');
    }
  }

  /**
   * 调用通义千问API
   */
  async callQianwen(config, messages) {
    try {
      const endpoint = config.endpoint || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
      
      const response = await axios.post(endpoint, {
        model: config.model || 'qwen-turbo',
        input: {
          messages: messages
        },
        parameters: {
          max_tokens: config.maxTokens,
          temperature: config.temperature
        }
      }, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      return response.data.output.text.trim();
    } catch (error) {
      logger.error('Qianwen API call failed:', error.response?.data || error.message);
      throw new Error('通义千问API调用失败');
    }
  }

  /**
   * 调用百度文心一言API
   */
  async callErnie(config, messages) {
    try {
      const endpoint = config.endpoint || 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions';
      
      const response = await axios.post(`${endpoint}?access_token=${config.apiKey}`, {
        messages: messages,
        max_output_tokens: config.maxTokens,
        temperature: config.temperature
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      return response.data.result.trim();
    } catch (error) {
      logger.error('Ernie API call failed:', error.response?.data || error.message);
      throw new Error('文心一言API调用失败');
    }
  }

  /**
   * 调用智谱GLM API
   */
  async callGLM(config, messages) {
    try {
      const endpoint = config.endpoint || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
      
      const response = await axios.post(endpoint, {
        model: config.model || 'glm-4',
        messages: messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature
      }, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      logger.error('GLM API call failed:', error.response?.data || error.message);
      throw new Error('智谱GLM API调用失败');
    }
  }

  /**
   * 调用自定义API (OpenAI兼容)
   */
  async callCustomAPI(config, messages) {
    try {
      if (!config.endpoint) {
        throw new Error('自定义API需要配置endpoint');
      }

      // 确保endpoint以/chat/completions结尾
      let endpoint = config.endpoint;
      if (!endpoint.endsWith('/chat/completions')) {
        endpoint = endpoint.replace(/\/$/, '') + '/chat/completions';
      }

      const response = await axios.post(endpoint, {
        model: config.model,
        messages: messages,
        max_tokens: config.maxTokens,
        temperature: config.temperature
      }, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      // 验证返回格式是否符合OpenAI规范
      if (!response.data) {
        throw new Error(`自定义API返回数据为空。实际响应: ${JSON.stringify(response.data)}`);
      }
      
      if (!response.data.choices) {
        throw new Error(`自定义API响应缺少choices字段。实际响应: ${JSON.stringify(response.data)}`);
      }
      
      if (!response.data.choices[0]) {
        throw new Error(`自定义API响应choices数组为空。实际响应: ${JSON.stringify(response.data)}`);
      }
      
      if (!response.data.choices[0].message) {
        throw new Error(`自定义API响应缺少message字段。实际响应: ${JSON.stringify(response.data.choices[0])}`);
      }
      
      if (!response.data.choices[0].message.content) {
        throw new Error(`自定义API响应message缺少content字段。实际响应: ${JSON.stringify(response.data.choices[0].message)}`);
      }

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      logger.error('Custom API call failed:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        endpoint: config.endpoint
      });
      
      if (error.response) {
        // HTTP错误
        const status = error.response.status;
        const data = error.response.data;
        throw new Error(`自定义API调用失败 (HTTP ${status}): ${JSON.stringify(data)}`);
      } else if (error.request) {
        // 网络错误
        throw new Error(`无法连接到自定义API: ${config.endpoint}`);
      } else {
        // 其他错误（包括格式验证错误）
        throw error;
      }
    }
  }

  /**
   * 通用LLM调用方法
   */
  async callLLM(config, messages) {
    switch (config.provider) {
      case 'openai':
        return await this.callOpenAI(config, messages);
      case 'anthropic':
        return await this.callAnthropic(config, messages);
      case 'gemini':
        return await this.callGemini(config, messages);
      case 'qianwen':
        return await this.callQianwen(config, messages);
      case 'ernie':
        return await this.callErnie(config, messages);
      case 'glm':
        return await this.callGLM(config, messages);
      case 'custom':
        return await this.callCustomAPI(config, messages);
      default:
        throw new Error(`不支持的LLM提供商: ${config.provider}`);
    }
  }

  /**
   * 翻译文本
   */
  async translateText(text, targetLanguage = 'zh-CN', userId = null) {
    try {
      const config = userId 
        ? await this.getUserLLMConfig(userId)
        : await this.getSystemLLMConfig();

      if (!config.apiKey) {
        throw new Error('LLM API密钥未配置');
      }

      const messages = [
        {
          role: 'system',
          content: `你是一个专业的翻译助手。请将以下文本翻译成${targetLanguage === 'zh-CN' ? '中文' : targetLanguage}。要求：
1. 保持原文的语气和风格
2. 确保翻译准确、自然
3. 对于专业术语，提供准确的翻译
4. 只返回翻译结果，不要添加任何解释`
        },
        {
          role: 'user',
          content: text
        }
      ];

      const translation = await this.callLLM(config, messages);
      return translation;
    } catch (error) {
      logger.error('Translation failed:', error);
      throw error;
    }
  }

  /**
   * 查询单词释义
   */
  async lookupWord(word, userId) {
    try {
      const config = await this.getUserLLMConfig(userId);

      const messages = [
        {
          role: 'system',
          content: `你是一个专业的英语词典助手。请为用户提供单词的详细释义。返回格式必须是JSON，包含以下字段：
{
  "word": "单词原形",
  "pronunciation": "音标",
  "partOfSpeech": "词性",
  "definitions": [
    {
      "meaning": "中文释义",
      "example": "英文例句",
      "exampleTranslation": "例句中文翻译"
    }
  ],
  "synonyms": ["同义词列表"],
  "antonyms": ["反义词列表"],
  "etymology": "词源信息（可选）",
  "difficulty": "难度等级(1-5)"
}`
        },
        {
          role: 'user',
          content: `请查询单词: ${word}`
        }
      ];

      const response = await this.callLLM(config, messages);
      
      // 记录LLM原始响应用于调试
      logger.info('LLM原始响应:', { response: response.substring(0, 500) + (response.length > 500 ? '...' : '') });
      
      // 尝试解析JSON响应
      try {
        const wordData = JSON.parse(response);
        return wordData;
      } catch (parseError) {
        // 如果JSON解析失败，尝试提取有用信息或返回简化格式
        logger.warn('Failed to parse LLM JSON response, using fallback format', { parseError: parseError.message, response: response.substring(0, 200) });
        
        // 尝试清理响应文本，移除可能的JSON标记
        let cleanResponse = response.trim();
        if (cleanResponse.startsWith('```json')) {
          cleanResponse = cleanResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
        }
        if (cleanResponse.startsWith('```')) {
          cleanResponse = cleanResponse.replace(/```\s*/, '').replace(/```\s*$/, '');
        }
        
        // 再次尝试解析清理后的响应
        try {
          const wordData = JSON.parse(cleanResponse);
          return wordData;
        } catch (secondParseError) {
          // 如果仍然失败，返回简化格式，确保与前端期望的数据结构一致
          logger.warn('二次JSON解析也失败，返回简化格式', { word, secondParseError: secondParseError.message });
          return {
            word: word,
            pronunciation: '',
            partOfSpeech: '专有名词',
            definitions: [{
              meaning: `"${word}" 是一个专有名词或技术术语，建议查阅相关资料了解具体含义。`,
              example: '',
              exampleTranslation: ''
            }],
            synonyms: [],
            antonyms: [],
            difficulty: 3
          };
        }
      }
    } catch (error) {
      logger.error('Word lookup failed:', error);
      throw error;
    }
  }

  /**
   * 翻译句子
   */
  async translateSentence(sentence, userId) {
    try {
      const config = await this.getUserLLMConfig(userId);

      const messages = [
        {
          role: 'system',
          content: `你是一个专业的翻译助手。请将以下英文句子翻译成中文。要求：
1. 保持原句的语气和语境
2. 确保翻译自然、流畅
3. 对于专业术语，提供准确的翻译
4. 只返回翻译结果，不要添加任何解释或标点`
        },
        {
          role: 'user',
          content: sentence
        }
      ];

      const translation = await this.callLLM(config, messages);
      return translation;
    } catch (error) {
      logger.error('Sentence translation failed:', error);
      throw error;
    }
  }

  /**
   * 生成文章摘要
   */
  async generateSummary(content, userId = null) {
    try {
      const config = userId 
        ? await this.getUserLLMConfig(userId)
        : await this.getSystemLLMConfig();

      if (!config.apiKey) {
        throw new Error('LLM API密钥未配置');
      }

      const messages = [
        {
          role: 'system',
          content: `你是一个专业的文章摘要助手。请为以下文章生成一个简洁的中文摘要。要求：
1. 摘要长度控制在100-200字
2. 突出文章的核心观点和重要信息
3. 使用简洁、清晰的语言
4. 只返回摘要内容，不要添加任何前缀或后缀`
        },
        {
          role: 'user',
          content: content.substring(0, 3000) // 限制输入长度
        }
      ];

      const summary = await this.callLLM(config, messages);
      return summary;
    } catch (error) {
      logger.error('Summary generation failed:', error);
      throw error;
    }
  }

  /**
   * 测试LLM配置
   */
  async testLLMConfig(config) {
    try {
      const messages = [
        {
          role: 'system',
          content: '你是一个测试助手。'
        },
        {
          role: 'user',
          content: '请回复"配置测试成功"'
        }
      ];

      const response = await this.callLLM(config, messages);
      return {
        success: true,
        response: response
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new LLMService();