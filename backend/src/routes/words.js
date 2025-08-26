const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  queryWord,
  addToVocabulary,
  getVocabulary,
  updateStatus,
  removeFromVocabulary,
  getWordStats
} = require('../controllers/wordController');
const { authenticate, optionalAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// 单词查询的速率限制
const queryLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 50, // 限制每个IP 1分钟内最多50次查询请求
  message: {
    success: false,
    message: '单词查询请求过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 生词本操作的速率限制
const vocabularyLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1分钟
  max: 30, // 限制每个IP 1分钟内最多30次生词本操作
  message: {
    success: false,
    message: '生词本操作过于频繁，请稍后再试'
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
 * @route   POST /api/words/query
 * @desc    查询单词定义（优先从缓存获取）
 * @access  Public（但登录用户会记录查询历史）
 * @body    word - 要查询的单词（必需）
 * @body    context - 单词上下文（可选）
 */
router.post('/query', queryLimiter, optionalAuth, queryWord);

/**
 * @route   POST /api/words/vocabulary
 * @desc    添加单词到生词本
 * @access  Private
 * @body    word - 要添加的单词（必需）
 * @body    context - 单词上下文（可选）
 * @body    articleId - 文章ID（可选）
 */
router.post('/vocabulary', authenticate, vocabularyLimiter, addToVocabulary);

/**
 * @route   GET /api/words/vocabulary
 * @desc    获取用户生词本
 * @access  Private
 * @query   page - 页码（默认1）
 * @query   limit - 每页数量（默认20，最大50）
 * @query   status - 学习状态筛选（new, learning, mastered）
 * @query   search - 搜索关键词
 * @query   sortBy - 排序字段（createdAt, word, status）
 * @query   sortOrder - 排序方向（asc, desc）
 */
router.get('/vocabulary', authenticate, generalLimiter, getVocabulary);

/**
 * @route   PUT /api/words/vocabulary/:id/status
 * @desc    更新单词学习状态
 * @access  Private
 * @params  id - 生词ID
 * @body    status - 学习状态（new, learning, mastered）
 */
router.put('/vocabulary/:id/status', authenticate, vocabularyLimiter, updateStatus);

/**
 * @route   DELETE /api/words/vocabulary/:id
 * @desc    从生词本删除单词
 * @access  Private
 * @params  id - 生词ID
 */
router.delete('/vocabulary/:id', authenticate, vocabularyLimiter, removeFromVocabulary);

/**
 * @route   GET /api/words/stats
 * @desc    获取单词查询统计
 * @access  Private
 */
router.get('/stats', authenticate, generalLimiter, getWordStats);

module.exports = router;