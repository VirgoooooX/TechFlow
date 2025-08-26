const express = require('express');
const rateLimit = require('express-rate-limit');
const {
  getSettings,
  updateSettings,
  getNewsSources,
  addNewsSource,
  updateNewsSource,
  deleteNewsSource,
  toggleNewsSourceSubscription,
  getUserStats
} = require('../controllers/userController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// 新闻源管理的速率限制
const newsSourceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 20, // 限制每个IP 15分钟内最多20次新闻源操作
  message: {
    success: false,
    message: '新闻源操作过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 设置更新的速率限制
const settingsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5分钟
  max: 10, // 限制每个IP 5分钟内最多10次设置更新
  message: {
    success: false,
    message: '设置更新过于频繁，请稍后再试'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// 所有路由都需要认证
router.use(authenticate);

/**
 * @route   GET /api/users/settings
 * @desc    获取用户设置
 * @access  Private
 */
router.get('/settings', getSettings);

/**
 * @route   PUT /api/users/settings
 * @desc    更新用户设置
 * @access  Private
 */
router.put('/settings', settingsLimiter, updateSettings);

/**
 * @route   GET /api/users/news-sources
 * @desc    获取用户新闻源列表
 * @access  Private
 */
router.get('/news-sources', getNewsSources);

/**
 * @route   POST /api/users/news-sources
 * @desc    添加自定义新闻源
 * @access  Private
 */
router.post('/news-sources', newsSourceLimiter, addNewsSource);

/**
 * @route   PUT /api/users/news-sources/:id
 * @desc    更新自定义新闻源
 * @access  Private
 */
router.put('/news-sources/:id', newsSourceLimiter, updateNewsSource);

/**
 * @route   DELETE /api/users/news-sources/:id
 * @desc    删除自定义新闻源
 * @access  Private
 */
router.delete('/news-sources/:id', newsSourceLimiter, deleteNewsSource);

/**
 * @route   PUT /api/users/news-sources/:id/subscription
 * @desc    订阅/取消订阅默认新闻源
 * @access  Private
 */
router.put('/news-sources/:id/subscription', newsSourceLimiter, toggleNewsSourceSubscription);

/**
 * @route   GET /api/users/stats
 * @desc    获取用户统计信息
 * @access  Private
 */
router.get('/stats', getUserStats);

/**
 * @route   POST /api/users/test-llm
 * @desc    测试LLM配置
 * @access  Private
 */
router.post('/test-llm', settingsLimiter, require('../controllers/userController').testLLM);

module.exports = router;