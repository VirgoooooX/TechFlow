const express = require('express');
const { query, validationResult } = require('express-validator');
const articleService = require('../services/articleService');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// 获取文章列表
router.get('/', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().isString().trim(),
  query('sortBy').optional().isIn(['publishedAt', 'createdAt', 'titleEn']),
  query('sortOrder').optional().isIn(['asc', 'desc']),
  query('sourceId').optional().isString()
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

    const {
      page = 1,
      limit = 12,
      search = '',
      sortBy = 'publishedAt',
      sortOrder = 'desc',
      sourceId = null
    } = req.query;

    const result = await articleService.getArticles({
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      sourceId
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Get articles error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// 获取单篇文章详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const article = await articleService.getArticleById(id);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'Article not found'
      });
    }

    res.json({
      success: true,
      data: { article }
    });
  } catch (error) {
    logger.error('Get article by id error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// 获取新闻源列表
router.get('/sources/list', async (req, res) => {
  try {
    const sources = await articleService.getNewsSources();
    
    res.json({
      success: true,
      data: { sources }
    });
  } catch (error) {
    logger.error('Get news sources error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;