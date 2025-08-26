const logger = require('../utils/logger');

/**
 * 404 错误处理中间件
 */
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * 全局错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
  // 如果响应状态码是 200，设置为 500
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;

  // Prisma 错误处理
  if (err.code) {
    switch (err.code) {
      case 'P2002':
        statusCode = 400;
        message = 'Duplicate field value entered';
        break;
      case 'P2014':
        statusCode = 400;
        message = 'Invalid ID';
        break;
      case 'P2003':
        statusCode = 400;
        message = 'Invalid input data';
        break;
      case 'P2025':
        statusCode = 404;
        message = 'Record not found';
        break;
      default:
        statusCode = 500;
        message = 'Database error';
    }
  }

  // JWT 错误处理
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Validation 错误处理
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(val => val.message).join(', ');
  }

  // 记录错误日志
  logger.logError(err, req);

  // 响应错误信息
  const errorResponse = {
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && {
        stack: err.stack,
        details: err
      })
    }
  };

  res.status(statusCode).json(errorResponse);
};

/**
 * 异步错误处理包装器
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * 自定义错误类
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 创建错误响应
 */
const createError = (message, statusCode = 500) => {
  return new AppError(message, statusCode);
};

module.exports = {
  notFound,
  errorHandler,
  asyncHandler,
  AppError,
  createError
};