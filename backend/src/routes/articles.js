const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  getArticles,
  getArticleById,
  translateSentence,
  getTrendingArticles,
  searchArticles,
  refreshNews,
  refreshSingleSource
} = require('../controllers/articleController');
const { authenticate, optionalAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// 翻译相关的速率限制
const translateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 30, // 限制每个IP 1分钟内最多30次翻译请求
  message: {
    success: false,
    message: '翻译请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 搜索的速率限制
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 20, // 限制每个IP 1分钟内最多20次搜索请求
  message: {
    success: false,
    message: '搜索请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 一般API的速率限制
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 100, // 限制每个IP 1分钟内最多100次请求
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * @route   GET /api/articles
 * @desc    获取文章列表（支持分页、筛选、搜索）
 * @access  Public（但登录用户会看到个性化内容）
 * @query   page - 页码（默认1）
 * @query   limit - 每页数量（默认20，最大50）
 * @query   sourceId - 新闻源ID筛选
 * @query   search - 搜索关键词
 * @query   sortBy - 排序字段（publishedAt, createdAt, titleEn）
 * @query   sortOrder - 排序方向（asc, desc）
 */
router.get('/', generalLimiter, optionalAuth, getArticles);

/**
 * @route   GET /api/articles/trending
 * @desc    获取热门文章
 * @access  Public
 * @query   limit - 返回数量（默认10，最大20）
 */
router.get('/trending', generalLimiter, getTrendingArticles);

/**
 * @route   GET /api/articles/search
 * @desc    搜索文章
 * @access  Public
 * @query   q - 搜索关键词（必需）
 * @query   page - 页码（默认1）
 * @query   limit - 每页数量（默认20）
 */
router.get('/search', searchLimiter, searchArticles);

/**
 * @route   GET /api/articles/:id
 * @desc    获取文章详情
 * @access  Public（但登录用户会有权限检查）
 */
router.get('/:id', generalLimiter, optionalAuth, getArticleById);

/**
 * @route   POST /api/articles/translate
 * @desc    翻译句子
 * @access  Private
 * @body    sentence - 要翻译的句子
 */
router.post('/translate', authenticate, translateLimiter, translateSentence);

/**
 * @route   POST /api/articles/refresh
 * @desc    手动刷新新闻源获取文章
 * @access  Private
 */
router.post('/refresh', authenticate, generalLimiter, refreshNews);

/**
 * @route   POST /api/articles/refresh/:sourceId
 * @desc    手动刷新单个新闻源获取文章
 * @access  Private
 */
router.post('/refresh/:sourceId', authenticate, generalLimiter, refreshSingleSource);

module.exports = router;