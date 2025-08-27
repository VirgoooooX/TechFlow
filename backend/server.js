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
app.use(helmet({
  hsts: false, // 禁用 HSTS
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "http:", "*.techcrunch.com", "techcrunch.com", "https://techcrunch.com", "https://*.techcrunch.com", "*.slashdot.org", "slashdot.org", "https://slashdot.org", "https://*.slashdot.org", "*.rsshub.app", "rsshub.app", "https://rsshub.app", "https://*.rsshub.app"],
      connectSrc: ["'self'", "http://localhost:3001", "ws://localhost:3000"],
      frameAncestors: ["'self'"]
    }
  }
}));

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

// 图片代理路由
app.get('/api/proxy/image', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    // 验证URL格式
    let imageUrl;
    try {
      imageUrl = new URL(url);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // 只允许代理特定域名的图片
    const allowedDomains = [
      'techcrunch.com',
      'slashdot.org',
      'rsshub.app',
      'unsplash.com',
      'images.unsplash.com'
    ];
    
    const isAllowed = allowedDomains.some(domain => 
      imageUrl.hostname === domain || imageUrl.hostname.endsWith('.' + domain)
    );
    
    if (!isAllowed) {
      return res.status(403).json({ error: 'Domain not allowed' });
    }

    // 代理图片请求
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch image' });
    }

    // 设置响应头
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.startsWith('image/')) {
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=86400'); // 缓存24小时
      res.set('Access-Control-Allow-Origin', '*'); // 允许跨域访问图片
      res.set('Access-Control-Allow-Methods', 'GET');
      res.set('Access-Control-Allow-Headers', 'Content-Type');
      
      // 获取图片数据并发送
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    } else {
      res.status(400).json({ error: 'URL does not point to an image' });
    }
  } catch (error) {
    logger.error('Image proxy error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
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
app.listen(PORT, '0.0.0.0', () => {
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