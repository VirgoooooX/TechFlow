const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { errorHandler, notFound } = require('./src/middleware/errorMiddleware');
const logger = require('./src/utils/logger');
const { startCronJobs } = require('./src/cron/scheduler');

// 导入路由
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const articlesRoutes = require('./src/routes/articles');
const wordsRoutes = require('./src/routes/words');
const systemRoutes = require('./src/routes/system');

const vocabularyRoutes = require('./src/api/vocabulary.routes');
const newsSourcesRoutes = require('./src/api/newsSources.routes');

const app = express();
const PORT = process.env.PORT || 3001;

// 安全中间件
app.use(helmet());

// CORS 配置
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// 速率限制
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15分钟
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 限制每个IP 100个请求
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', limiter);

// 解析中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 请求日志
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/articles', articlesRoutes);
app.use('/api/words', wordsRoutes);
app.use('/api/system', systemRoutes);

app.use('/api/vocabulary', vocabularyRoutes);
app.use('/api/news-sources', newsSourcesRoutes);

// 静态文件服务 (用于前后端二合一部署)
if (process.env.NODE_ENV === 'production') {
  // 提供静态文件
  app.use(express.static(path.join(__dirname, 'public')));
  
  // 处理React路由 - 所有非API请求都返回index.html
  app.get('*', (req, res) => {
    // 跳过API路由和健康检查
    if (req.path.startsWith('/api') || req.path === '/health') {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
} else {
  // 开发环境的404处理
  app.use(notFound);
}

// 错误处理
app.use(errorHandler);

// 启动服务器
app.listen(PORT, () => {
  logger.info(`🚀 TechFlow Backend Server running on port ${PORT}`);
  logger.info(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // 启动定时任务
  if (process.env.NODE_ENV !== 'test') {
    startCronJobs();
    logger.info('📅 Cron jobs started');
  }
});

// 优雅关闭
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;