const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

// 获取所有新闻源
router.get('/', async (req, res) => {
  try {
    const { category, isActive } = req.query;
    const where = {};

    if (category) {
      where.category = category;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const newsSources = await prisma.newsSource.findMany({
      where,
      select: {
        id: true,
        name: true,
        url: true,
        sourceType: true,
        contentType: true,
        category: true,
        description: true,
        language: true,
        isDefault: true,
        isActive: true,
        createdAt: true
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }]
    });

    res.json({
      success: true,
      data: { newsSources }
    });
  } catch (error) {
    logger.error('Get news sources error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// 获取用户订阅的新闻源
router.get('/subscriptions', auth, async (req, res) => {
  try {
    const userNewsSources = await prisma.userNewsSource.findMany({
      where: { userId: req.userId },
      include: {
        newsSource: {
          select: {
            id: true,
            name: true,
            url: true,
            sourceType: true,
            contentType: true,
            category: true,
            description: true,
            language: true,
            isActive: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      data: { subscriptions: userNewsSources }
    });
  } catch (error) {
    logger.error('Get user news sources error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// 订阅新闻源
router.post('/subscribe', auth, [
  body('newsSourceId').isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { newsSourceId } = req.body;

    // 检查新闻源是否存在
    const newsSource = await prisma.newsSource.findUnique({
      where: { id: newsSourceId }
    });

    if (!newsSource) {
      return res.status(404).json({
        success: false,
        message: 'News source not found'
      });
    }

    // 检查是否已订阅
    const existing = await prisma.userNewsSource.findFirst({
      where: {
        userId: req.userId,
        newsSourceId
      }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Already subscribed to this news source'
      });
    }

    const subscription = await prisma.userNewsSource.create({
      data: {
        userId: req.userId,
        newsSourceId
      },
      include: {
        newsSource: {
          select: {
            id: true,
            name: true,
            category: true,
            description: true
          }
        }
      }
    });

    logger.info(`User ${req.userId} subscribed to news source: ${newsSource.name}`);

    res.status(201).json({
      success: true,
      message: 'Successfully subscribed to news source',
      data: { subscription }
    });
  } catch (error) {
    logger.error('Subscribe to news source error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// 取消订阅新闻源
router.delete('/subscribe/:newsSourceId', auth, async (req, res) => {
  try {
    const { newsSourceId } = req.params;

    const deleted = await prisma.userNewsSource.deleteMany({
      where: {
        userId: req.userId,
        newsSourceId
      }
    });

    if (deleted.count === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    logger.info(`User ${req.userId} unsubscribed from news source: ${newsSourceId}`);

    res.json({
      success: true,
      message: 'Successfully unsubscribed from news source'
    });
  } catch (error) {
    logger.error('Unsubscribe from news source error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;