const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { prisma } = require('../config/database');
const { generateToken, generateRefreshToken } = require('../config/jwt');
const { asyncHandler, createError } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');

// 验证模式
const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': '请输入有效的邮箱地址',
    'any.required': '邮箱是必填项'
  }),
  password: Joi.string().min(6).max(128).required().messages({
    'string.min': '密码至少需要6个字符',
    'string.max': '密码不能超过128个字符',
    'any.required': '密码是必填项'
  }),
  username: Joi.string().min(2).max(50).optional().messages({
    'string.min': '用户名至少需要2个字符',
    'string.max': '用户名不能超过50个字符'
  })
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': '请输入有效的邮箱地址',
    'any.required': '邮箱是必填项'
  }),
  password: Joi.string().required().messages({
    'any.required': '密码是必填项'
  })
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    'any.required': '当前密码是必填项'
  }),
  newPassword: Joi.string().min(6).max(128).required().messages({
    'string.min': '新密码至少需要6个字符',
    'string.max': '新密码不能超过128个字符',
    'any.required': '新密码是必填项'
  })
});

/**
 * 用户注册
 */
const register = asyncHandler(async (req, res) => {
  // 验证输入数据
  const { error, value } = registerSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { email, password, username } = value;

  // 检查邮箱是否已存在
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (existingUser) {
    throw createError('该邮箱已被注册', 400);
  }

  // 检查用户名是否已存在（如果提供了用户名）
  if (username) {
    const existingUsername = await prisma.user.findUnique({
      where: { username }
    });

    if (existingUsername) {
      throw createError('该用户名已被使用', 400);
    }
  }

  // 加密密码
  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // 创建用户
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      username: username || null,
      settings: {
        create: {
          theme: 'light',
          language: 'zh-CN',
          autoHighlight: true
        }
      }
    },
    select: {
      id: true,
      email: true,
      username: true,
      avatar: true,
      createdAt: true,
      settings: true
    }
  });

  // 为新用户自动订阅所有默认新闻源
  try {
    const defaultSources = await prisma.newsSource.findMany({
      where: { isDefault: true },
      select: { id: true, name: true }
    });

    if (defaultSources.length > 0) {
      const subscriptions = defaultSources.map(source => ({
        userId: user.id,
        sourceId: source.id,
        isEnabled: true
      }));

      await prisma.userNewsSource.createMany({
        data: subscriptions
      });

      logger.info(`Auto-subscribed user ${email} to ${defaultSources.length} default news sources: ${defaultSources.map(s => s.name).join(', ')}`);
    }
  } catch (error) {
    logger.error(`Failed to auto-subscribe user ${email} to default news sources:`, error);
    // 不抛出错误，因为用户注册已经成功，订阅失败不应该影响注册流程
  }

  // 生成 JWT Token
  const token = generateToken({ userId: user.id, email: user.email });
  const refreshToken = generateRefreshToken({ userId: user.id });

  logger.info(`New user registered: ${email}`);

  res.status(201).json({
    success: true,
    message: '注册成功',
    data: {
      user,
      token,
      refreshToken
    }
  });
});

/**
 * 用户登录
 */
const login = asyncHandler(async (req, res) => {
  // 验证输入数据
  const { error, value } = loginSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { email, password } = value;

  // 查找用户
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      settings: true
    }
  });

  if (!user) {
    throw createError('邮箱或密码错误', 401);
  }

  // 验证密码
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw createError('邮箱或密码错误', 401);
  }

  // 生成 JWT Token
  const token = generateToken({ userId: user.id, email: user.email });
  const refreshToken = generateRefreshToken({ userId: user.id });

  // 移除密码哈希
  const { passwordHash, ...userWithoutPassword } = user;

  logger.info(`User logged in: ${email}`);

  res.json({
    success: true,
    message: '登录成功',
    data: {
      user: userWithoutPassword,
      token,
      refreshToken
    }
  });
});

/**
 * 获取当前用户信息
 */
const getProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      avatar: true,
      createdAt: true,
      updatedAt: true,
      settings: true,
      _count: {
        select: {
          vocabulary: true
        }
      }
    }
  });

  if (!user) {
    throw createError('用户不存在', 404);
  }

  res.json({
    success: true,
    data: { user }
  });
});

/**
 * 更新用户资料
 */
const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { username, avatar } = req.body;

  // 验证输入
  const updateData = {};
  if (username !== undefined) {
    if (username && (username.length < 2 || username.length > 50)) {
      throw createError('用户名长度应在2-50个字符之间', 400);
    }
    
    // 检查用户名是否已被其他用户使用
    if (username) {
      const existingUser = await prisma.user.findFirst({
        where: {
          username,
          id: { not: userId }
        }
      });
      
      if (existingUser) {
        throw createError('该用户名已被使用', 400);
      }
    }
    
    updateData.username = username || null;
  }

  if (avatar !== undefined) {
    updateData.avatar = avatar;
  }

  // 更新用户信息
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      username: true,
      avatar: true,
      createdAt: true,
      updatedAt: true,
      settings: true
    }
  });

  logger.info(`User profile updated: ${req.user.email}`);

  res.json({
    success: true,
    message: '资料更新成功',
    data: { user: updatedUser }
  });
});

/**
 * 修改密码
 */
const changePassword = asyncHandler(async (req, res) => {
  // 验证输入数据
  const { error, value } = changePasswordSchema.validate(req.body);
  if (error) {
    throw createError(error.details[0].message, 400);
  }

  const { currentPassword, newPassword } = value;
  const userId = req.user.id;

  // 获取用户当前密码哈希
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true }
  });

  if (!user) {
    throw createError('用户不存在', 404);
  }

  // 验证当前密码
  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCurrentPasswordValid) {
    throw createError('当前密码错误', 400);
  }

  // 检查新密码是否与当前密码相同
  const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
  if (isSamePassword) {
    throw createError('新密码不能与当前密码相同', 400);
  }

  // 加密新密码
  const saltRounds = 12;
  const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

  // 更新密码
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newPasswordHash }
  });

  logger.info(`Password changed for user: ${req.user.email}`);

  res.json({
    success: true,
    message: '密码修改成功'
  });
});

/**
 * 刷新 Token
 */
const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    throw createError('刷新令牌是必需的', 400);
  }

  try {
    const { verifyToken } = require('../config/jwt');
    const decoded = verifyToken(token);

    // 验证用户是否仍然存在
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true }
    });

    if (!user) {
      throw createError('用户不存在', 404);
    }

    // 生成新的访问令牌
    const newAccessToken = generateToken({ userId: user.id, email: user.email });
    const newRefreshToken = generateRefreshToken({ userId: user.id });

    res.json({
      success: true,
      data: {
        token: newAccessToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    throw createError('无效的刷新令牌', 401);
  }
});

/**
 * 登出（客户端处理，服务端记录日志）
 */
const logout = asyncHandler(async (req, res) => {
  logger.info(`User logged out: ${req.user.email}`);

  res.json({
    success: true,
    message: '登出成功'
  });
});

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  refreshToken,
  logout
};