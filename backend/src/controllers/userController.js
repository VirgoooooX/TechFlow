const Joi = require('joi');
const { prisma } = require('../config/database');
const { asyncHandler, createError } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');

// 验证模式
const updateSettingsSchema = Joi.object({
  theme: Joi.string().valid('light', 'dark').optional(),
  language: Joi.string().valid('zh-CN', 'en-US').optional(),
  fontSize: Joi.string().valid('small', 'medium', 'large').optional(),
  autoTranslate: Joi.boolean().optional(),
  showPhonetic: Joi.boolean().optional(),
  enableNotifications: Joi.boolean().optional(),
  translationLanguage: Joi.string().valid('zh-CN', 'zh-TW', 'ja', 'ko').optional(),
  autoHighlight: Joi.boolean().optional(),
  llmProvider: Joi.string().valid('openai', 'anthropic', 'gemini', 'qianwen', 'ernie', 'glm', 'custom').optional(),
  llmApiKey: Joi.string().max(500).optional().allow(''),
  llmBaseUrl: Joi.string().uri().optional().allow(''),
  llmModel: Joi.string().max(100).optional(),
  maxTokens: Joi.number().integer().min(100).max(4000).optional(),
  temperature: Joi.number().min(0).max(2).optional()
});

const addNewsSourceSchema = Joi.object({
  name: Joi.string().min(1).max(100).required().messages({
    'string.min': '新闻源名称不能为空',
    'string.max': '新闻源名称不能超过100个字符',
    'any.required': '新闻源名称是必填项'
  }),
  url: Joi.string().uri().required().messages({
    'string.uri': '请输入有效的URL地址',
    'any.required': 'URL是必填项'
  }),
  sourceType: Joi.string().valid('rss', 'api').required().messages({
    'any.only': '源类型必须是rss或api',
    'any.required': '源类型是必填项'
  }),
  contentType: Joi.string().valid('text', 'media').required().messages({
    'any.only': '内容类型必须是text或media',
    'any.required': '内容类型是必填项'
  }),
  description: Joi.string().max(500).optional()
});

/**
 * 获取用户设置
 */
const getSettings = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const settings = await prisma.userSettings.findUnique({
    where: { userId }
  });

  if (!settings) {
    // 如果没有设置记录，创建默认设置
    const defaultSettings = await prisma.userSettings.create({
      data: {
        userId,
        theme: 'light',
        language: 'zh-CN',
        autoHighlight: true
      }
    });

    return res.json({
      success: true,
      data: { settings: defaultSettings }
    });
  }

  // 隐藏敏感信息（API Key）
  const { llmApiKey, ...safeSettings } = settings;
  const maskedSettings = {
    ...safeSettings,
    llmApiKey: llmApiKey ? '***' + llmApiKey.slice(-4) : null
  };

  res.json({
    success: true,
    data: { settings: maskedSettings }
  });
});

/**
 * 更新用户设置
 */
const updateSettings = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // 验证输入数据
  const { error, value } = updateSettingsSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  // 更新设置
  const updatedSettings = await prisma.userSettings.upsert({
    where: { userId },
    update: value,
    create: {
      userId,
      theme: 'light',
      language: 'zh-CN',
      autoHighlight: true,
      ...value
    }
  });

  // 隐藏敏感信息
  const { llmApiKey, ...safeSettings } = updatedSettings;
  const maskedSettings = {
    ...safeSettings,
    llmApiKey: llmApiKey ? '***' + llmApiKey.slice(-4) : null
  };

  logger.info(`User settings updated: ${req.user.email}`);

  res.json({
    success: true,
    message: '设置更新成功',
    data: { settings: maskedSettings }
  });
});

/**
 * 获取用户新闻源
 */
const getNewsSources = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // 获取默认新闻源
  const defaultSources = await prisma.newsSource.findMany({
    where: { isDefault: true },
    select: {
        id: true,
        name: true,
        url: true,
        sourceType: true,
        contentType: true,
        description: true,
        isDefault: true,
        isActive: true
      }
  });

  // 获取用户自定义新闻源（通过关联表）
  const userSources = await prisma.userNewsSource.findMany({
    where: {
      userId,
      source: {
        isDefault: false
      }
    },
    include: {
      source: {
        select: {
          id: true,
          name: true,
          url: true,
          sourceType: true,
          contentType: true,
          description: true,
          isDefault: true,
          isActive: true,
          createdAt: true
        }
      }
    },
    orderBy: { source: { createdAt: 'desc' } }
  });

  // 获取用户对默认新闻源的订阅状态
  const userNewsSourceRelations = await prisma.userNewsSource.findMany({
    where: { userId },
    select: {
      sourceId: true,
      isEnabled: true
    }
  });

  // 创建订阅状态映射
  const subscriptionMap = new Map(
    userNewsSourceRelations.map(relation => [relation.sourceId, relation.isEnabled])
  );

  // 为默认新闻源添加订阅状态
  const defaultSourcesWithSubscription = defaultSources.map(source => ({
    ...source,
    subscribed: subscriptionMap.has(source.id) ? subscriptionMap.get(source.id) : true // 默认新闻源默认为启用状态
  }));

  // 提取用户自定义新闻源数据
  const userSourcesData = userSources.map(us => us.source);

  res.json({
    success: true,
    data: {
      defaultSources: defaultSourcesWithSubscription,
      userSources: userSourcesData
    }
  });
});

/**
 * 添加自定义新闻源
 */
const addNewsSource = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // 验证输入数据
  const { error, value } = addNewsSourceSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { name, url, sourceType, contentType, description } = value;

  // 检查用户是否已经添加了相同的URL
  const existingSource = await prisma.newsSource.findFirst({
    where: {
      url
    }
  });

  if (existingSource) {
    throw createError('您已经添加了相同的新闻源', 400);
  }

  // 创建新闻源
  const newsSource = await prisma.newsSource.create({
    data: {
      name,
      url,
      sourceType,
      contentType,
      description,
      isDefault: false,
      isActive: true
    }
  });

  logger.info(`User added news source: ${name} (${url}) by ${req.user.email}`);

  res.status(201).json({
    success: true,
    message: '新闻源添加成功',
    data: { newsSource }
  });
});

/**
 * 更新新闻源
 */
const updateNewsSource = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const sourceId = req.params.id;
  const { name, url, type, description, isActive } = req.body;

  if (!sourceId || typeof sourceId !== 'string') {
    throw createError('无效的新闻源ID', 400);
  }

  // 验证新闻源是否属于当前用户
  const existingSource = await prisma.newsSource.findFirst({
    where: {
      id: sourceId,
      userId,
      isDefault: false // 只能更新自定义新闻源
    }
  });

  if (!existingSource) {
    throw createError('新闻源不存在或无权限修改', 404);
  }

  // 构建更新数据
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (url !== undefined) updateData.url = url;
  if (type !== undefined) updateData.type = type;
  if (description !== undefined) updateData.description = description;
  if (isActive !== undefined) updateData.isActive = isActive;

  // 更新新闻源
  const updatedSource = await prisma.newsSource.update({
    where: { id: sourceId },
    data: updateData
  });

  logger.info(`User updated news source: ${updatedSource.name} by ${req.user.email}`);

  res.json({
    success: true,
    message: '新闻源更新成功',
    data: { newsSource: updatedSource }
  });
});

/**
 * 删除新闻源
 */
const deleteNewsSource = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const sourceId = req.params.id;

  if (!sourceId || typeof sourceId !== 'string') {
    throw createError('无效的新闻源ID', 400);
  }

  // 验证新闻源是否属于当前用户
  const existingSource = await prisma.newsSource.findFirst({
    where: {
      id: sourceId,
      userId,
      isDefault: false // 只能删除自定义新闻源
    }
  });

  if (!existingSource) {
    throw createError('新闻源不存在或无权限删除', 404);
  }

  // 删除新闻源
  await prisma.newsSource.delete({
    where: { id: sourceId }
  });

  logger.info(`User deleted news source: ${existingSource.name} by ${req.user.email}`);

  res.json({
    success: true,
    message: '新闻源删除成功'
  });
});

/**
 * 订阅/取消订阅默认新闻源
 */
const toggleNewsSourceSubscription = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const sourceId = req.params.id;
  const { isEnabled } = req.body;

  if (!sourceId || typeof sourceId !== 'string') {
    throw createError('无效的新闻源ID', 400);
  }

  if (typeof isEnabled !== 'boolean') {
    throw createError('isEnabled必须是布尔值', 400);
  }

  // 验证新闻源是否存在且为默认新闻源
  const newsSource = await prisma.newsSource.findFirst({
    where: {
      id: sourceId,
      isDefault: true
    }
  });

  if (!newsSource) {
    throw createError('默认新闻源不存在', 404);
  }

  // 更新或创建订阅关系
  const subscription = await prisma.userNewsSource.upsert({
    where: {
      userId_sourceId: {
        userId,
        sourceId
      }
    },
    update: {
      isEnabled
    },
    create: {
      userId,
      sourceId,
      isEnabled
    }
  });

  logger.info(`User ${isEnabled ? 'subscribed to' : 'unsubscribed from'} news source: ${newsSource.name} by ${req.user.email}`);

  res.json({
    success: true,
    message: `${isEnabled ? '订阅' : '取消订阅'}成功`,
    data: { subscription }
  });
});

/**
 * 获取用户统计信息
 */
const getUserStats = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // 获取各种统计数据
  const [vocabularyCount, readArticlesCount, customSourcesCount] = await Promise.all([
    prisma.userVocabulary.count({
      where: { userId }
    }),
    prisma.article.count({
      where: {
        // 这里可以添加用户阅读记录的逻辑
        // 暂时返回0，后续可以添加阅读记录表
      }
    }),
    prisma.newsSource.count({
      where: {
        userId,
        isDefault: false
      }
    })
  ]);

  // 获取最近学习的单词
  const recentWords = await prisma.userVocabulary.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      word: true,
      status: true,
      createdAt: true
    }
  });

  res.json({
    success: true,
    data: {
      stats: {
        vocabularyCount,
        readArticlesCount: 0, // 暂时返回0
        customSourcesCount
      },
      recentWords
    }
  });
});

/**
 * 测试LLM配置
 */
const testLLM = asyncHandler(async (req, res) => {
  const { provider, apiKey, model, baseUrl } = req.body;
  const userId = req.user.id;

  // 验证必需参数
  if (!provider) {
    throw createError('LLM提供商是必需的', 400);
  }

  const llmService = require('../services/llmService');
  
  let actualApiKey = apiKey;
  
  // 如果API密钥是掩码格式（***xxxx），从数据库获取真实密钥
  if (!apiKey || apiKey.startsWith('***')) {
    const settings = await prisma.userSettings.findUnique({
      where: { userId }
    });
    
    if (!settings || !settings.llmApiKey) {
      throw createError('请先配置API密钥', 400);
    }
    
    actualApiKey = settings.llmApiKey;
  }
  
  // 构建测试配置
  const testConfig = {
    provider,
    apiKey: actualApiKey,
    model: model || 'gpt-3.5-turbo',
    endpoint: baseUrl,
    maxTokens: 100,
    temperature: 0.3
  };

  try {
    const result = await llmService.testLLMConfig(testConfig);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'LLM配置测试成功',
        data: {
          response: result.response
        }
      });
    } else {
      throw createError(result.error || 'LLM配置测试失败', 400);
    }
  } catch (error) {
    logger.error('LLM test failed:', error);
    throw createError(error.message || 'LLM配置测试失败', 400);
  }
});

module.exports = {
  getSettings,
  updateSettings,
  getNewsSources,
  addNewsSource,
  updateNewsSource,
  deleteNewsSource,
  toggleNewsSourceSubscription,
  getUserStats,
  testLLM
};