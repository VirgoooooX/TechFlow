const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();
const prisma = new PrismaClient();

// 获取用户生词本
router.get('/', auth, [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['learning', 'mastered', 'all'])
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
      limit = 20,
      status = 'all'
    } = req.query;

    const skip = (page - 1) * limit;
    const where = { userId: req.userId };

    if (status !== 'all') {
      where.status = status;
    }

    const [vocabulary, total] = await Promise.all([
      prisma.userVocabulary.findMany({
        where,
        skip,
        take: limit,
        include: {
          wordDefinition: {
            select: {
              word: true,
              definitionJson: true,
              sourceLlm: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.userVocabulary.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        vocabulary,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Get vocabulary error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// 添加单词到生词本
router.post('/', auth, [
  body('wordDefinitionId').isString(),
  body('context').optional().isString()
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

    const { wordDefinitionId, context } = req.body;

    // 检查单词是否已存在于生词本中
    const existing = await prisma.userVocabulary.findFirst({
      where: {
        userId: req.userId,
        wordDefinitionId
      }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Word already exists in vocabulary'
      });
    }

    const vocabularyItem = await prisma.userVocabulary.create({
      data: {
        userId: req.userId,
        wordDefinitionId,
        context,
        status: 'learning'
      },
      include: {
        wordDefinition: {
          select: {
            word: true,
            definitionJson: true,
            sourceLlm: true
          }
        }
      }
    });

    logger.info(`Word added to vocabulary: ${vocabularyItem.wordDefinition.word} for user ${req.userId}`);

    res.status(201).json({
      success: true,
      message: 'Word added to vocabulary',
      data: { vocabularyItem }
    });
  } catch (error) {
    logger.error('Add to vocabulary error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// 更新生词状态
router.put('/:id', auth, [
  body('status').isIn(['learning', 'mastered'])
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

    const { id } = req.params;
    const { status } = req.body;

    const vocabularyItem = await prisma.userVocabulary.update({
      where: {
        id: parseInt(id),
        userId: req.userId
      },
      data: { status },
      include: {
        wordDefinition: {
          select: {
            word: true,
            definitionJson: true,
            sourceLlm: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Vocabulary item updated',
      data: { vocabularyItem }
    });
  } catch (error) {
    logger.error('Update vocabulary error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// 删除生词
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.userVocabulary.delete({
      where: {
        id: parseInt(id),
        userId: req.userId
      }
    });

    res.json({
      success: true,
      message: 'Word removed from vocabulary'
    });
  } catch (error) {
    logger.error('Delete vocabulary error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;