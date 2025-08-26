const { verifyToken, extractTokenFromHeader } = require('../config/jwt');
const { prisma } = require('../config/database');
const { asyncHandler, createError } = require('./errorMiddleware');
const logger = require('../utils/logger');

/**
 * 验证用户身份的中间件
 */
const authenticate = asyncHandler(async (req, res, next) => {
  // 从请求头中提取 token
  const token = extractTokenFromHeader(req);
  
  if (!token) {
    throw createError('Access denied. No token provided.', 401);
  }

  try {
    // 验证 token
    const decoded = verifyToken(token);
    
    // 从数据库中获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        createdAt: true,
        settings: true
      }
    });

    if (!user) {
      throw createError('Invalid token. User not found.', 401);
    }

    // 将用户信息添加到请求对象中
    req.user = user;
    next();
  } catch (error) {
    if (error.message === 'Token expired' || error.message === 'Invalid token') {
      throw createError(error.message, 401);
    }
    throw createError('Token verification failed', 401);
  }
});

/**
 * 可选的身份验证中间件（不强制要求登录）
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = extractTokenFromHeader(req);
  
  if (token) {
    try {
      const decoded = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          username: true,
          avatar: true,
          createdAt: true,
          settings: true
        }
      });
      
      if (user) {
        req.user = user;
      }
    } catch (error) {
      // 可选认证失败时不抛出错误，继续执行
      logger.warn('Optional auth failed:', error.message);
    }
  }
  
  next();
});

/**
 * 检查用户是否有管理员权限（预留功能）
 */
const requireAdmin = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw createError('Access denied. Authentication required.', 401);
  }

  // 这里可以添加管理员权限检查逻辑
  // 例如检查用户角色或特定权限
  // if (req.user.role !== 'admin') {
  //   throw createError('Access denied. Admin privileges required.', 403);
  // }

  next();
});

/**
 * 检查用户是否拥有资源的访问权限
 */
const checkResourceOwnership = (resourceIdParam = 'id') => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw createError('Access denied. Authentication required.', 401);
    }

    const resourceId = req.params[resourceIdParam];
    const userId = req.user.id;

    // 这里可以根据具体的资源类型进行权限检查
    // 例如检查生词本、用户设置等是否属于当前用户
    
    next();
  });
};

/**
 * 速率限制中间件（基于用户）
 */
const userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();
  
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;

    // 清理过期的请求记录
    if (requests.has(userId)) {
      const userRequests = requests.get(userId).filter(time => time > windowStart);
      requests.set(userId, userRequests);
    } else {
      requests.set(userId, []);
    }

    const userRequests = requests.get(userId);
    
    if (userRequests.length >= maxRequests) {
      throw createError('Too many requests. Please try again later.', 429);
    }

    userRequests.push(now);
    next();
  });
};

module.exports = {
  authenticate,
  optionalAuth,
  requireAdmin,
  checkResourceOwnership,
  userRateLimit
};