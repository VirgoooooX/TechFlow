const Joi = require('joi');
const { prisma } = require('../config/database');
const { asyncHandler, createError } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');
const llmService = require('../services/llmService');
const newsService = require('../services/newsService');

// 验证模式
const getArticlesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
  sourceId: Joi.string().optional(),
  search: Joi.string().max(100).optional(),
  sortBy: Joi.string().valid('publishedAt', 'createdAt', 'titleEn').default('publishedAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const translateSentenceSchema = Joi.object({
  sentence: Joi.string().min(1).max(1000).required().messages({
    'string.min': '句子不能为空',
    'string.max': '句子长度不能超过1000个字符',
    'any.required': '句子是必填项'
  })
});

/**
 * 获取文章列表
 */
const getArticles = asyncHandler(async (req, res) => {
  // 验证查询参数
  const { error, value } = getArticlesSchema.validate(req.query);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { page, limit, sourceId, search, sortBy, sortOrder } = value;
  const skip = (page - 1) * limit;

  // 构建查询条件
  const where = {};
  
  if (sourceId) {
    where.sourceId = sourceId;
  }

  if (search) {
    where.OR = [
      { titleEn: { contains: search, mode: 'insensitive' } },
      { titleCn: { contains: search, mode: 'insensitive' } },
      { summary: { contains: search, mode: 'insensitive' } }
    ];
  }

  // 获取所有默认新闻源
  const defaultSources = await prisma.newsSource.findMany({
    where: {
      isDefault: true,
      isActive: true
    },
    select: { id: true }
  });

  if (req.user) {
    // 用户已登录，显示其订阅的新闻源的文章
    // 获取用户的新闻源订阅关系
    const userSubscriptions = await prisma.userNewsSource.findMany({
      where: {
        userId: req.user.id,
        isEnabled: true  // 只获取启用的订阅
      },
      select: { sourceId: true }
    });

    const enabledSubscriptionIds = userSubscriptions.map(sub => sub.sourceId);

    // 获取用户明确禁用的默认新闻源
    const disabledDefaultSources = await prisma.userNewsSource.findMany({
      where: {
        userId: req.user.id,
        isEnabled: false,
        sourceId: { in: defaultSources.map(s => s.id) }
      },
      select: { sourceId: true }
    });

    const disabledDefaultSourceIds = disabledDefaultSources.map(sub => sub.sourceId);
    
    // 默认新闻源中未被明确禁用的源
    const enabledDefaultSourceIds = defaultSources
      .map(source => source.id)
      .filter(id => !disabledDefaultSourceIds.includes(id));
    
    // 合并启用的订阅源和默认启用的源
    const allSourceIds = [...new Set([...enabledSubscriptionIds, ...enabledDefaultSourceIds])];
    
    if (sourceId) {
      // 如果指定了sourceId，检查用户是否有权限访问
      if (!allSourceIds.includes(sourceId)) {
        throw createError('无权限访问该新闻源', 403);
      }
    } else {
      // 如果没有指定sourceId，只显示用户订阅的源
      where.sourceId = { in: allSourceIds };
    }
  } else {
    // 用户未登录，只显示默认新闻源的文章
    const defaultSourceIds = defaultSources.map(s => s.id);
    
    if (sourceId) {
      // 如果指定了sourceId，检查是否为默认新闻源
      if (!defaultSourceIds.includes(sourceId)) {
        throw createError('未登录用户只能访问默认新闻源', 403);
      }
    } else {
      // 如果没有指定sourceId，只显示默认新闻源
      where.sourceId = { in: defaultSourceIds };
    }
  }

  try {
    // 获取文章总数
    const total = await prisma.article.count({ where });

    // 获取文章列表
    const articles = await prisma.article.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      select: {
        id: true,
        titleEn: true,
        titleCn: true,
        summary: true,
        imageUrl: true,
        publishedAt: true,
        author: true,
        originalUrl: true,
        createdAt: true,
        contentHtml: true, // 添加内容字段用于计算字数
        source: {
          select: {
            id: true,
            name: true,
            sourceType: true,
            contentType: true
          }
        }
      }
    });

    // 计算分页信息
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // 计算字数的辅助函数
    const calculateWordCount = (htmlContent) => {
      if (!htmlContent) return 0;
      // 移除HTML标签
      const textContent = htmlContent.replace(/<[^>]*>/g, '');
      // 移除多余的空白字符
      const cleanText = textContent.replace(/\s+/g, ' ').trim();
      // 计算英文单词数（按空格分割）
      const words = cleanText.split(' ').filter(word => word.length > 0);
      return words.length;
    };

    // 获取用户设置（如果用户已登录）
    let userSettings = null;
    if (req.user) {
      userSettings = await prisma.userSettings.findUnique({
        where: { userId: req.user.id },
        select: { autoTranslate: true }
      });
    }

    // 映射字段名以匹配前端期望，并根据用户设置翻译标题
    const mappedArticles = await Promise.all(articles.map(async (article) => {
      let titleCn = article.titleCn;
      
      // 如果用户开启了自动翻译且文章没有中文标题，则翻译标题
      if (userSettings?.autoTranslate && !titleCn && article.titleEn) {
        try {
          titleCn = await newsService.translateTitle(article.titleEn);
        } catch (error) {
          logger.error('Failed to translate title for article:', article.id, error);
          // 翻译失败时保持原标题
        }
      }
      
      return {
        ...article,
        titleCn,
        url: article.originalUrl,
        wordCount: calculateWordCount(article.contentHtml) // 计算实际字数
      };
    }));

    // 移除contentHtml字段，避免传输大量数据
    const articlesWithoutContent = mappedArticles.map(({ contentHtml, ...article }) => article);

    res.json({
      success: true,
      data: {
        articles: articlesWithoutContent,
        pagination: {
          currentPage: page,
          totalPages,
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage,
          hasPrevPage
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get articles:', error);
    throw createError('获取文章列表失败', 500);
  }
});

/**
 * 获取文章详情
 */
const getArticleById = asyncHandler(async (req, res) => {
  const articleId = req.params.id;

  if (!articleId || typeof articleId !== 'string') {
    throw createError('无效的文章ID', 400);
  }

  try {
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      include: {
        source: {
          select: {
            id: true,
            name: true,
            sourceType: true,
            contentType: true,
            description: true
          }
        }
      }
    });

    if (!article) {
      throw createError('文章不存在', 404);
    }

    // 检查用户是否有权限访问该文章
    if (req.user) {
      // 用户已登录，检查订阅权限
      const hasAccess = await checkUserArticleAccess(req.user.id, article.sourceId);
      if (!hasAccess) {
        throw createError('无权限访问该文章', 403);
      }
    } else {
      // 用户未登录，只能访问默认新闻源的文章
      const isDefaultSource = await prisma.newsSource.findFirst({
        where: {
          id: article.sourceId,
          isDefault: true,
          isActive: true
        }
      });
      
      if (!isDefaultSource) {
        throw createError('未登录用户只能访问默认新闻源的文章', 403);
      }
    }

    // 获取用户设置（如果用户已登录）
    let userSettings = null;
    if (req.user) {
      userSettings = await prisma.userSettings.findUnique({
        where: { userId: req.user.id },
        select: { autoTranslate: true }
      });
    }

    // 翻译标题（如果需要）
    let titleCn = article.titleCn;
    if (userSettings?.autoTranslate && !titleCn && article.titleEn) {
      try {
        titleCn = await newsService.translateTitle(article.titleEn);
      } catch (error) {
        logger.error('Failed to translate title for article:', article.id, error);
        // 翻译失败时保持原标题
      }
    }

    // 将数据库字段映射为前端期望的字段
    const articleData = {
      ...article,
      titleCn,
      content: article.contentHtml, // 映射 contentHtml 为 content
      url: article.originalUrl // 映射 originalUrl 为 url
    };

    res.json({
      success: true,
      data: { article: articleData }
    });
  } catch (error) {
    if (error.statusCode) {
      throw error;
    }
    logger.error('Failed to get article:', error);
    throw createError('获取文章详情失败', 500);
  }
});

/**
 * 翻译句子
 */
const translateSentence = asyncHandler(async (req, res) => {
  // 验证输入数据
  const { error, value } = translateSentenceSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { sentence } = value;
  const userId = req.user.id;

  try {
    // 检查翻译缓存
    const cached = await prisma.sentenceTranslation.findUnique({
      where: { originalSentence: sentence }
    });

    let translation;
    if (cached) {
      translation = cached.translatedSentence;
    } else {
      // 调用LLM服务进行翻译
      translation = await llmService.translateSentence(sentence, userId);
      
      // 缓存翻译结果
      await prisma.sentenceTranslation.create({
        data: {
          originalSentence: sentence,
          translatedSentence: translation,
          language: 'zh-CN'
        }
      }).catch(error => {
        // 忽略重复键错误
        if (error.code !== 'P2002') {
          logger.error('Failed to cache sentence translation:', error);
        }
      });
    }

    res.json({
      success: true,
      data: {
        originalSentence: sentence,
        translatedSentence: translation
      }
    });
  } catch (error) {
    logger.error('Sentence translation failed:', error);
    throw createError('句子翻译失败', 500);
  }
});

/**
 * 获取热门文章
 */
const getTrendingArticles = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  
  if (limit > 20) {
    throw createError('限制数量不能超过20', 400);
  }

  try {
    // 获取最近7天的热门文章（基于创建时间，后续可以加入阅读量等指标）
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const articles = await prisma.article.findMany({
      where: {
        publishedAt: {
          gte: sevenDaysAgo
        }
      },
      take: limit,
      orderBy: [
        { publishedAt: 'desc' },
        { createdAt: 'desc' }
      ],
      select: {
        id: true,
        titleEn: true,
        titleCn: true,
        summary: true,
        imageUrl: true,
        publishedAt: true,
        author: true,
        source: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: { articles }
    });
  } catch (error) {
    logger.error('Failed to get trending articles:', error);
    throw createError('获取热门文章失败', 500);
  }
});

/**
 * 搜索文章
 */
const searchArticles = asyncHandler(async (req, res) => {
  const { q: query, page = 1, limit = 20 } = req.query;

  if (!query || query.trim().length === 0) {
    throw createError('搜索关键词不能为空', 400);
  }

  if (query.length > 100) {
    throw createError('搜索关键词长度不能超过100个字符', 400);
  }

  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  try {
    const searchConditions = {
      OR: [
        { titleEn: { contains: query, mode: 'insensitive' } },
        { titleCn: { contains: query, mode: 'insensitive' } },
        { summary: { contains: query, mode: 'insensitive' } },
        { author: { contains: query, mode: 'insensitive' } }
      ]
    };

    const [total, articles] = await Promise.all([
      prisma.article.count({ where: searchConditions }),
      prisma.article.findMany({
        where: searchConditions,
        skip,
        take: limitNum,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          titleEn: true,
          titleCn: true,
          summary: true,
          imageUrl: true,
          publishedAt: true,
          author: true,
          source: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      success: true,
      data: {
        articles,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: total,
          itemsPerPage: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1
        },
        query
      }
    });
  } catch (error) {
    logger.error('Article search failed:', error);
    throw createError('文章搜索失败', 500);
  }
});

/**
 * 手动刷新新闻源获取文章
 */
const refreshNews = asyncHandler(async (req, res) => {
  try {
    logger.info(`Manual news refresh triggered by user: ${req.user.email}`);
    
    const result = await newsService.fetchAllNews();
    
    res.json({
      success: true,
      message: '新闻刷新完成',
      data: {
        totalArticles: result.totalArticles,
        totalErrors: result.totalErrors
      }
    });
  } catch (error) {
    logger.error('Manual news refresh failed:', error);
    throw createError('新闻刷新失败', 500);
  }
});

/**
 * 刷新单个新闻源
 */
const refreshSingleSource = asyncHandler(async (req, res) => {
  try {
    const { sourceId } = req.params;
    logger.info(`Manual single source refresh triggered by user: ${req.user.email} for source: ${sourceId}`);
    
    const result = await newsService.fetchSingleSource(sourceId);
    
    res.json({
      success: true,
      message: '新闻源刷新完成',
      data: {
        totalArticles: result.totalArticles,
        totalErrors: result.totalErrors,
        sourceName: result.sourceName
      }
    });
  } catch (error) {
    logger.error('Manual single source refresh failed:', error);
    throw createError('单个新闻源刷新失败', 500);
  }
});

/**
 * 检查用户是否有权限访问文章
 */
async function checkUserArticleAccess(userId, sourceId) {
  try {
    logger.info(`Checking access for user ${userId} to source ${sourceId}`);
    
    // 获取新闻源信息
    const source = await prisma.newsSource.findUnique({
      where: { id: sourceId },
      select: {
        isDefault: true,
        id: true,
        name: true
      }
    });

    if (!source) {
      logger.warn(`Source ${sourceId} not found`);
      return false;
    }

    logger.info(`Source found: ${source.name}, isDefault: ${source.isDefault}`);

    // 如果是默认新闻源，检查用户是否订阅
    if (source.isDefault) {
      const subscription = await prisma.userNewsSource.findUnique({
        where: {
          userId_sourceId: {
            userId,
            sourceId
          }
        },
        select: {
          isEnabled: true
        }
      });

      logger.info(`Subscription found: ${subscription ? `enabled: ${subscription.isEnabled}` : 'none (defaulting to true)'}`);

      // 如果没有订阅记录，默认为订阅状态（允许访问）
      // 如果有订阅记录，则根据isEnabled字段决定
      const hasAccess = subscription ? subscription.isEnabled : true;
      logger.info(`Access result: ${hasAccess}`);
      return hasAccess;
    }

    // 如果是用户自定义新闻源，检查是否属于该用户
    // 这里需要根据实际的数据模型来实现
    // 暂时返回 false，因为当前模型中没有用户自定义新闻源的概念
    logger.info('Non-default source, access denied');
    return false;
  } catch (error) {
    logger.error('Error checking user article access:', error);
    return false;
  }
}

module.exports = {
  getArticles,
  getArticleById,
  translateSentence,
  getTrendingArticles,
  searchArticles,
  refreshNews,
  refreshSingleSource
};