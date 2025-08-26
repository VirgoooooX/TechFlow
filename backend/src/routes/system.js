const express = require('express');
const systemController = require('../controllers/systemController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// 获取系统设置（需要管理员权限）
router.get('/settings', authenticate, systemController.getSystemSettings);

// 更新系统设置（需要管理员权限）
router.put('/settings', authenticate, systemController.updateSystemSettings);

// 测试系统LLM配置（需要管理员权限）
router.post('/test-llm', authenticate, systemController.testSystemLLMConfig);

module.exports = router;