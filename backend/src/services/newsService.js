const axios = require('axios');
const Parser = require('rss-parser');
const { JSDOM } = require('jsdom');
const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const llmService = require('./llmService');

class NewsService {
  constructor() {
    this.parser = new Parser({
      timeout: 30000, // 增加到30秒
      headers: {
        'User-Agent': 'TechFlow/1.0 (+https://techflow.app)'
      },
      maxRedirects: 5,
      requestOptions: {
        rejectUnauthorized: false // 允许自签名证书
      }
    });
  }

  /**
   * 获取所有活跃的新闻源
   */
  async getActiveNewsSources() {
    try {
      const sources = await prisma.newsSource.findMany({
        where: {
          isActive: true
        },
        include: {
          users: {
            where: {
              isEnabled: true
            }
          }
        }
      });

      return sources.filter(source => {
        // 默认新闻源：只有当至少有一个用户启用时才包含
        if (source.isDefault) {
          return source.users.length > 0;
        }
        // 自定义新闻源：直接包含
        return true;
      });
    } catch (error) {
      logger.error('Failed to get active news sources:', error);
      throw error;
    }
  }

  /**
   * 从RSS源抓取文章
   */
  async fetchFromRSS(source) {
    const maxRetries = 3;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Fetching RSS from: ${source.name} (${source.url}) - Attempt ${attempt}/${maxRetries}`);
        
        const feed = await this.parser.parseURL(source.url);
        logger.info(`Found ${feed.items.length} items in RSS feed`);
        
        const articles = [];
        let skippedExisting = 0;
        let skippedInvalid = 0;

        for (const item of feed.items) {
          if (!item.title || !item.link) {
            skippedInvalid++;
            continue;
          }

          // 检查文章是否已存在
          const existingArticle = await prisma.article.findFirst({
            where: {
              originalUrl: item.link
            }
          });

          if (existingArticle) {
            skippedExisting++;
            continue;
          }

          // 提取和清理内容
          const content = await this.extractContent(item.contentSnippet || item.content || '', item.link, source.contentType);
          
          // 实现混合翻译策略：检查是否需要翻译标题
          let titleCn = null;
          const shouldTranslate = await this.shouldTranslateTitle(source.id);
          
          if (shouldTranslate) {
            try {
              titleCn = await this.translateTitle(item.title);
              logger.info(`Translated title for article from ${source.name}: "${item.title}" -> "${titleCn}"`);
            } catch (error) {
              logger.warn(`Failed to translate title for article from ${source.name}:`, error.message);
              // 翻译失败时保持为null，后续可以在用户请求时重试
            }
          }

          const article = {
            sourceId: source.id,
            titleEn: item.title,
            titleCn: titleCn, // 根据策略决定是否翻译
            contentHtml: content,
            originalUrl: item.link,
            imageUrl: source.contentType === 'text' ? null : this.extractImageUrl(item),
            publishedAt: this.parsePublishedDate(item),
            author: item.creator || item['dc:creator'] || null,
            summary: this.generateSummary(item.contentSnippet || item.content || '')
          };

          articles.push(article);
        }

        logger.info(`RSS processing completed for ${source.name}: ${articles.length} new articles, ${skippedExisting} existing, ${skippedInvalid} invalid`);
        return articles;
      } catch (error) {
        lastError = error;
        logger.warn(`Attempt ${attempt}/${maxRetries} failed for ${source.name}:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = attempt * 2000; // 递增延迟：2s, 4s
          logger.info(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    logger.error(`Failed to fetch RSS from ${source.name} after ${maxRetries} attempts:`, lastError);
    return [];
  }

  /**
   * 从API源抓取文章（预留接口）
   */
  async fetchFromAPI(source) {
    try {
      logger.info(`Fetching API from: ${source.name} (${source.url})`);
      
      // 这里可以根据不同的API源实现不同的抓取逻辑
      // 目前先返回空数组，后续可以扩展
      logger.warn(`API fetching not implemented for ${source.name}`);
      return [];
    } catch (error) {
      logger.error(`Failed to fetch API from ${source.name}:`, error);
      return [];
    }
  }

  /**
   * 提取文章内容
   */
  async extractContent(rawContent, url, contentType = 'media') {
    try {
      // 如果内容太短，尝试从原始URL获取完整内容
      if (rawContent.length < 200 && url) {
        const fullContent = await this.fetchFullContent(url);
        if (fullContent) {
          rawContent = fullContent;
        }
      }

      // 根据内容类型清理HTML内容
      const cleanContent = this.cleanHtmlContent(rawContent, contentType);
      return cleanContent;
    } catch (error) {
      logger.error('Failed to extract content:', error);
      return rawContent;
    }
  }

  /**
   * 从原始URL获取完整内容
   */
  async fetchFullContent(url) {
    try {
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      const dom = new JSDOM(response.data);
      const document = dom.window.document;

      // 尝试多种选择器来提取主要内容
      const contentSelectors = [
        'article',
        '.post-content',
        '.entry-content',
        '.article-content',
        '.content',
        'main',
        '.main-content'
      ];

      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.length > 500) {
          return element.innerHTML;
        }
      }

      return null;
    } catch (error) {
      logger.warn(`Failed to fetch full content from ${url}:`, error.message);
      return null;
    }
  }

  /**
   * 清理HTML内容
   */
  cleanHtmlContent(html, contentType = 'media') {
    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // 移除不需要的元素
      const unwantedSelectors = [
        'script',
        'style',
        'nav',
        'header',
        'footer',
        '.advertisement',
        '.ads',
        '.social-share',
        '.comments'
      ];

      // 对于text类型，额外移除图片相关元素
      if (contentType === 'text') {
        unwantedSelectors.push('img', 'figure', '.image', '.photo', 'video', 'iframe');
      }

      unwantedSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      });

      // 清理属性
      const allElements = document.querySelectorAll('*');
      allElements.forEach(el => {
        // 根据内容类型设置允许的标签和属性
        let allowedTags, allowedAttrs;
        
        if (contentType === 'text') {
          // text类型只保留基本文本格式标签
          allowedTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre', 'br'];
          allowedAttrs = ['href', 'title'];
        } else {
          // media类型保留图片等媒体标签
          allowedTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'code', 'pre', 'br'];
          allowedAttrs = ['href', 'src', 'alt', 'title'];
        }
        
        if (!allowedTags.includes(el.tagName.toLowerCase())) {
          // 将不允许的标签替换为div
          const div = document.createElement('div');
          div.innerHTML = el.innerHTML;
          el.parentNode.replaceChild(div, el);
        } else {
          // 清理属性
          const attrs = Array.from(el.attributes);
          attrs.forEach(attr => {
            if (!allowedAttrs.includes(attr.name)) {
              el.removeAttribute(attr.name);
            }
          });
        }
      });

      return document.body.innerHTML;
    } catch (error) {
      logger.error('Failed to clean HTML content:', error);
      return html;
    }
  }

  /**
   * 提取图片URL
   */
  extractImageUrl(item) {
    // 尝试从多个可能的字段提取图片URL
    if (item.enclosure && item.enclosure.url && item.enclosure.type && item.enclosure.type.startsWith('image/')) {
      return item.enclosure.url;
    }

    if (item['media:thumbnail'] && item['media:thumbnail']['$'] && item['media:thumbnail']['$'].url) {
      return item['media:thumbnail']['$'].url;
    }

    if (item['media:content'] && item['media:content']['$'] && item['media:content']['$'].url) {
      return item['media:content']['$'].url;
    }

    // 从内容中提取第一张图片
    if (item.content) {
      const imgMatch = item.content.match(/<img[^>]+src="([^"]+)"/i);
      if (imgMatch) {
        return imgMatch[1];
      }
    }

    return null;
  }

  /**
   * 生成文章摘要
   */
  generateSummary(content, maxLength = 200) {
    if (!content) return '';
    
    // 移除HTML标签
    const textContent = content.replace(/<[^>]*>/g, '').trim();
    
    if (textContent.length <= maxLength) {
      return textContent;
    }
    
    // 在单词边界截断
    const truncated = textContent.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(' ');
    
    return lastSpaceIndex > 0 
      ? truncated.substring(0, lastSpaceIndex) + '...'
      : truncated + '...';
  }

  /**
   * 检查是否应该翻译标题
   * 实现混合翻译策略：
   * 1. 检查是否有用户订阅了该新闻源且开启了自动翻译
   * 2. 如果没有用户订阅，检查系统默认配置
   */
  async shouldTranslateTitle(sourceId) {
    try {
      // 1. 检查是否有用户订阅了该新闻源且开启了自动翻译
      const userSubscriptions = await prisma.userNewsSource.findMany({
        where: {
          newsSourceId: sourceId,
          isEnabled: true,
          autoTranslate: true
        },
        include: {
          user: {
            include: {
              settings: {
                select: {
                  autoTranslate: true
                }
              }
            }
          }
        }
      });

      // 如果有用户订阅且开启了自动翻译，则翻译
      const hasActiveUserSubscription = userSubscriptions.some(subscription => 
        subscription.user.settings?.autoTranslate === true
      );

      if (hasActiveUserSubscription) {
        logger.info(`Found active user subscriptions with auto-translate enabled for source ${sourceId}`);
        return true;
      }

      // 2. 检查系统默认配置
      const systemSettings = await prisma.systemSettings.findFirst();
      if (systemSettings?.autoTranslate) {
        logger.info(`System-level auto-translate enabled for source ${sourceId}`);
        return true;
      }

      logger.debug(`No translation needed for source ${sourceId}`);
      return false;
    } catch (error) {
      logger.error('Failed to check translation requirements:', error);
      // 出错时默认不翻译，避免影响抓取流程
      return false;
    }
  }

  /**
   * 翻译标题
   */
  async translateTitle(title) {
    try {
      // 检查是否已有翻译缓存
      const cached = await prisma.titleTranslation.findUnique({
        where: { originalTitle: title }
      });

      if (cached) {
        return cached.translatedTitle;
      }

      // 调用LLM服务进行翻译
      const translation = await llmService.translateText(title, 'zh-CN');
      
      // 缓存翻译结果 - 使用upsert避免唯一约束冲突
      await prisma.titleTranslation.upsert({
        where: {
          originalTitle: title
        },
        update: {
          translatedTitle: translation,
          language: 'zh-CN'
        },
        create: {
          originalTitle: title,
          translatedTitle: translation,
          language: 'zh-CN'
        }
      }).catch(error => {
        logger.error('Failed to cache title translation:', error);
      });

      return translation;
    } catch (error) {
      logger.error('Failed to translate title:', error);
      return title; // 翻译失败时返回原标题
    }
  }

  /**
   * 批量保存文章
   */
  async saveArticles(articles) {
    if (articles.length === 0) {
      return { created: 0, errors: 0 };
    }

    let created = 0;
    let errors = 0;

    for (const article of articles) {
      try {
        await prisma.article.create({
          data: article
        });
        created++;
      } catch (error) {
        if (error.code === 'P2002') {
          // 重复文章，跳过
          continue;
        }
        logger.error('Failed to save article:', error);
        errors++;
      }
    }

    return { created, errors };
  }

  /**
   * 执行新闻抓取任务
   */
  async fetchAllNews() {
    try {
      logger.info('Starting news fetching task...');
      
      const sources = await this.getActiveNewsSources();
      logger.info(`Found ${sources.length} active news sources`);

      let totalArticles = 0;
      let totalErrors = 0;

      for (const source of sources) {
        try {
          let articles = [];
          
          if (source.sourceType === 'rss') {
            articles = await this.fetchFromRSS(source);
          } else if (source.sourceType === 'api') {
            articles = await this.fetchFromAPI(source);
          }

          const result = await this.saveArticles(articles);
          totalArticles += result.created;
          totalErrors += result.errors;

          // 注意：lastFetchedAt字段暂未在数据库模式中定义，暂时移除更新操作

        } catch (error) {
          logger.error(`Failed to process source ${source.name}:`, error);
          totalErrors++;
        }
      }

      logger.info(`News fetching completed. Created: ${totalArticles}, Errors: ${totalErrors}`);
      return { totalArticles, totalErrors };
    } catch (error) {
      logger.error('News fetching task failed:', error);
      throw error;
    }
  }

  /**
   * 刷新单个新闻源
   */
  async fetchSingleSource(sourceId) {
    try {
      logger.info(`Starting single source fetching task for source: ${sourceId}`);
      
      // 获取指定的新闻源
      const source = await prisma.newsSource.findUnique({
        where: {
          id: sourceId,
          isActive: true
        },
        include: {
          users: {
            where: {
              isEnabled: true
            }
          }
        }
      });

      if (!source) {
        throw new Error(`News source with id ${sourceId} not found or inactive`);
      }

      // 检查是否有用户订阅（对于默认新闻源）
      if (source.isDefault && source.users.length === 0) {
        throw new Error(`No users subscribed to default source ${source.name}`);
      }

      let articles = [];
      let totalArticles = 0;
      let totalErrors = 0;
      
      try {
        if (source.sourceType === 'rss') {
          articles = await this.fetchFromRSS(source);
        } else if (source.sourceType === 'api') {
          articles = await this.fetchFromAPI(source);
        }

        const result = await this.saveArticles(articles);
        totalArticles = result.created;
        totalErrors = result.errors;

      } catch (error) {
        logger.error(`Failed to process source ${source.name}:`, error);
        totalErrors = 1;
      }

      logger.info(`Single source fetching completed for ${source.name}. Created: ${totalArticles}, Errors: ${totalErrors}`);
      return { 
        totalArticles, 
        totalErrors, 
        sourceName: source.name 
      };
    } catch (error) {
      logger.error('Single source fetching task failed:', error);
      throw error;
    }
  }

  /**
   * 清理旧文章 - 按用户保留最近100篇文章
   */
  async cleanupOldArticles() {
    try {
      logger.info('Starting article cleanup - keeping latest 100 articles per user subscription');
      
      // 获取所有用户及其订阅的新闻源
      const users = await prisma.user.findMany({
        include: {
          newsSources: {
            where: { isEnabled: true },
            include: { source: true }
          }
        }
      });

      let totalDeleted = 0;

      for (const user of users) {
        // 为每个用户处理其订阅的新闻源
        for (const userSource of user.newsSources) {
          const sourceId = userSource.sourceId;
          
          // 获取该新闻源的所有文章，按发布时间倒序
          const articles = await prisma.article.findMany({
            where: { sourceId },
            orderBy: { publishedAt: 'desc' },
            select: { id: true }
          });

          // 如果文章数量超过100篇，删除多余的
          if (articles.length > 100) {
            const articlesToDelete = articles.slice(100); // 保留前100篇，删除其余的
            const articleIds = articlesToDelete.map(a => a.id);
            
            const deleteResult = await prisma.article.deleteMany({
              where: {
                id: { in: articleIds },
                sourceId: sourceId
              }
            });
            
            totalDeleted += deleteResult.count;
            logger.info(`Cleaned up ${deleteResult.count} articles from source ${userSource.source.name} for user ${user.email}`);
          }
        }
      }

      // 同时清理没有用户订阅的新闻源的旧文章（保留最近30天）
      const subscribedSourceIds = await prisma.userNewsSource.findMany({
        where: { isEnabled: true },
        select: { sourceId: true },
        distinct: ['sourceId']
      });
      
      const subscribedIds = subscribedSourceIds.map(s => s.sourceId);
      
      if (subscribedIds.length > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        
        const unsubscribedCleanup = await prisma.article.deleteMany({
          where: {
            sourceId: { notIn: subscribedIds },
            publishedAt: { lt: cutoffDate }
          }
        });
        
        totalDeleted += unsubscribedCleanup.count;
        logger.info(`Cleaned up ${unsubscribedCleanup.count} articles from unsubscribed sources`);
      }

      logger.info(`Article cleanup completed: ${totalDeleted} articles deleted`);
      return totalDeleted;
    } catch (error) {
      logger.error('Failed to cleanup old articles:', error);
      throw error;
    }
  }

  /**
   * 解析文章发布时间
   * 支持多种时间字段格式：pubDate, isoDate, date, dc:date
   */
  parsePublishedDate(item) {
    // 尝试多种时间字段
    const timeFields = [
      item.pubDate,
      item.isoDate, 
      item.date,
      item['dc:date']
    ];

    for (const timeField of timeFields) {
      if (timeField) {
        try {
          const parsedDate = new Date(timeField);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
          }
        } catch (error) {
          // 继续尝试下一个字段
          continue;
        }
      }
    }

    // 如果所有时间字段都无效，使用当前时间
    logger.warn('No valid date found in RSS item, using current time');
    return new Date();
  }
}

module.exports = new NewsService();