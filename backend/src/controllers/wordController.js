const Joi = require('joi');
const { PrismaClient } = require('@prisma/client');
const csvDictionaryService = require('../services/csvDictionaryService');
const xxapiService = require('../services/xxapiService');
const llmService = require('../services/llmService');
const { createError } = require('../middleware/errorMiddleware');

const prisma = new PrismaClient();

/**
 * 查询单词定义（优先从缓存获取）
 */
const queryWord = async (req, res, next) => {
  try {
    const schema = Joi.object({
      word: Joi.string().trim().min(1).max(100).required(),
      context: Joi.string().trim().max(500).optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return next(createError(error.details[0].message, 400));
    }

    const { word, context } = value;
    const userId = req.user?.id;
    const wordLower = word.toLowerCase();

    // 首先尝试从CSV词典查询（第一优先级）
    try {
      const csvResult = await csvDictionaryService.findWord(wordLower);
      
      if (csvResult) {
        // 从definition中提取词性信息
        let partOfSpeech = csvResult.pos || 'unknown';
        if (!csvResult.pos && csvResult.definition) {
          // 从definition开头提取词性标记（支持 "prep." 或 "v" 等格式）
          const posMatch = csvResult.definition.match(/^([a-z]+)\.?\s/);
          if (posMatch) {
            const posAbbr = posMatch[1];
            // 将缩写转换为完整词性
            const posMap = {
              'n': 'noun',
              'v': 'verb', 
              'adj': 'adjective',
              'adv': 'adverb',
              'prep': 'preposition',
              'conj': 'conjunction',
              'pron': 'pronoun',
              'int': 'interjection',
              'art': 'article'
            };
            partOfSpeech = posMap[posAbbr] || posAbbr;
          }
        }
        
        // 构建完整的定义数据
        const fullDefinition = {
          word: csvResult.word,
          phonetic: csvResult.phonetic,
          pronunciation: csvResult.phonetic,
          meanings: [{
            partOfSpeech: partOfSpeech,
            definition: csvResult.definition,
            translation: csvResult.translation
          }],
          translation: csvResult.translation,
          collins: csvResult.collins,
          oxford: csvResult.oxford,
          bnc: csvResult.bnc,
          frq: csvResult.frq,
          tag: csvResult.tag,
          exchange: csvResult.exchange,
          sourceAPI: 'csv-dictionary'
        };
        
        // 保存到缓存（如果不存在则创建，存在则更新）
        let wordDefinition = await prisma.wordDefinition.upsert({
          where: { word: wordLower },
          update: {
            definitionJson: JSON.stringify(fullDefinition),
            sourceLlm: 'csv-dictionary'
          },
          create: {
            word: wordLower,
            definitionJson: JSON.stringify(fullDefinition),
            sourceLlm: 'csv-dictionary'
          }
        });

        // 如果用户已登录，记录查询历史
        if (userId) {
          await recordWordQuery(userId, wordDefinition.id, context);
        }

        return res.json({
          success: true,
          data: {
            word: wordLower,
            definition: fullDefinition,
            phonetic: csvResult.phonetic,
            cached: false,
            source: 'csv-dictionary'
          }
        });
      }
    } catch (csvError) {
      console.log('CSV词典查询失败，尝试缓存:', csvError.message);
    }

    // CSV词典没有找到，从缓存中查找
    let wordDefinition = await prisma.wordDefinition.findUnique({
      where: { word: wordLower }
    });

    if (wordDefinition) {
      // 如果用户已登录，记录查询历史
      if (userId) {
        await recordWordQuery(userId, wordDefinition.id, context);
      }

      return res.json({
        success: true,
        data: {
          word: wordDefinition.word,
          definition: JSON.parse(wordDefinition.definitionJson),
          phonetic: JSON.parse(wordDefinition.definitionJson).pronunciation || null,
          cached: true
        }
      });
    }

    // 缓存中也没有，使用外部API查询
    try {
      const wordData = await xxapiService.lookupWord(wordLower);
      const definition = xxapiService.extractDefinitions(wordData);
      
      // 构建完整的定义数据，包含中文翻译
      const fullDefinition = {
        word: wordData.word,
        phonetic: wordData.phonetic.text,
        pronunciation: wordData.phonetic.text,
        meanings: wordData.meanings,
        examples: wordData.examples,
        phrases: wordData.phrases,
        synonyms: wordData.synonyms,
        relatedWords: wordData.relatedWords,
        sourceAPI: 'xxapi.cn'
      };
      
      // 保存到缓存
      wordDefinition = await prisma.wordDefinition.create({
        data: {
          word: wordLower,
          definitionJson: JSON.stringify(fullDefinition),
          sourceLlm: 'xxapi'
        }
      });

      // 如果用户已登录，记录查询历史
      if (userId) {
        await recordWordQuery(userId, wordDefinition.id, context);
      }

      return res.json({
        success: true,
        data: {
          word: wordLower,
          definition: fullDefinition,
          phonetic: wordData.phonetic.text,
          cached: false
        }
      });
    } catch (apiError) {
      console.error('xxapi查询失败，尝试使用备用服务:', apiError);
      
      // 如果用户已登录，优先尝试LLM服务（提供中文翻译）
      if (userId) {
        try {
          const llmService = require('../services/llmService');
          const llmDefinition = await llmService.lookupWord(wordLower, userId);
          
          // 转换LLM返回格式为统一格式
          const formattedDefinition = {
            word: llmDefinition.word,
            phonetic: llmDefinition.pronunciation,
            pronunciation: llmDefinition.pronunciation,
            partOfSpeech: llmDefinition.partOfSpeech,
            // 转换为前端期望的meanings格式
            meanings: [{
              partOfSpeech: llmDefinition.partOfSpeech,
              definitions: llmDefinition.definitions.map(def => ({
                definition: def.meaning,
                example: def.example,
                exampleTranslation: def.exampleTranslation
              }))
            }],
            // 保留旧格式以兼容
            definitions: llmDefinition.definitions.map(def => ({
              partOfSpeech: llmDefinition.partOfSpeech,
              definition: def.meaning,
              example: def.example,
              exampleTranslation: def.exampleTranslation
            })),
            synonyms: llmDefinition.synonyms || [],
            antonyms: llmDefinition.antonyms || [],
            etymology: llmDefinition.etymology || '',
            difficulty: llmDefinition.difficulty || 3
          };
          
          // 保存到缓存
          wordDefinition = await prisma.wordDefinition.create({
            data: {
              word: wordLower,
              definitionJson: JSON.stringify(formattedDefinition),
              sourceLlm: 'llm-service'
            }
          });

          await recordWordQuery(userId, wordDefinition.id, context);

          return res.json({
            success: true,
            data: {
              word: wordLower,
              definition: formattedDefinition,
              phonetic: formattedDefinition.pronunciation || null,
              cached: false
            }
          });
        } catch (llmError) {
          console.error('LLM服务也失败，使用英文词典服务:', llmError);
        }
      }
      
      // 所有查询都失败
      console.error('所有词典查询都失败');
      return next(createError('单词查询服务暂时不可用，请稍后再试', 503));
    }
  } catch (error) {
    console.error('查询单词错误:', error);
    next(createError('查询单词失败', 500));
  }
};

/**
 * 添加单词到生词本
 */
const addToVocabulary = async (req, res, next) => {
  try {
    const schema = Joi.object({
      word: Joi.string().trim().min(1).max(100).required(),
      context: Joi.string().trim().max(500).optional(),
      articleId: Joi.number().integer().positive().optional()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return next(createError(error.details[0].message, 400));
    }

    const { word, context, articleId } = value;
    const userId = req.user.id;
    const wordLower = word.toLowerCase();

    // 确保单词定义存在于缓存中
    let wordDefinition = await prisma.wordDefinition.findUnique({
      where: { word: wordLower }
    });

    if (!wordDefinition) {
      return next(createError('无法获取单词定义，请稍后再试', 503));
    }

    // 检查是否已经在生词本中
    const existingVocab = await prisma.userVocabulary.findUnique({
      where: {
        userId_word: {
          userId,
          word: wordLower
        }
      }
    });

    if (existingVocab) {
      return res.json({
        success: true,
        message: '该单词已在您的生词本中',
        data: {
          word: wordLower,
          alreadyExists: true
        }
      });
    }

    // 添加到生词本
    const vocabulary = await prisma.userVocabulary.create({
      data: {
        userId,
        word: wordLower,
        status: 'new'
      }
    });

    res.status(201).json({
      success: true,
      message: '单词已添加到生词本',
      data: {
        id: vocabulary.id,
        word: vocabulary.word,
        definition: JSON.parse(wordDefinition.definitionJson),
        status: vocabulary.status,
        addedAt: vocabulary.createdAt
      }
    });
  } catch (error) {
    console.error('添加生词错误:', error);
    next(createError('添加生词失败', 500));
  }
};

/**
 * 获取用户生词本
 */
const getVocabulary = async (req, res, next) => {
  try {
    const schema = Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(50).default(20),
      status: Joi.string().valid('new', 'learning', 'mastered').optional(),
      search: Joi.string().trim().max(100).optional(),
      sortBy: Joi.string().valid('createdAt', 'word', 'status').default('createdAt'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc')
    });

    const { error, value } = schema.validate(req.query);
    if (error) {
      return next(createError(error.details[0].message, 400));
    }

    const { page, limit, status, search, sortBy, sortOrder } = value;
    const userId = req.user.id;
    const skip = (page - 1) * limit;

    // 构建查询条件
    const where = {
      userId,
      ...(status !== undefined && { status }),
      ...(search && {
        word: {
          contains: search.toLowerCase()
        }
      })
    };

    // 构建排序条件
    let orderBy = {};
    orderBy[sortBy] = sortOrder;

    const [vocabulary, total] = await Promise.all([
      prisma.userVocabulary.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          article: {
            select: {
              id: true,
              titleEn: true,
              titleCn: true
            }
          }
        }
      }),
      prisma.userVocabulary.count({ where })
    ]);

    // 获取所有单词的释义信息
    const words = vocabulary.map(item => item.word);
    const wordDefinitions = await prisma.wordDefinition.findMany({
      where: {
        word: {
          in: words
        }
      }
    });

    // 创建单词释义映射
    const definitionMap = new Map();
    wordDefinitions.forEach(def => {
      try {
        const parsedDefinition = JSON.parse(def.definitionJson);
        
        // 转换数据结构：将不同格式转换为前端期望的meanings格式
        let formattedDefinition;
        if (parsedDefinition.meanings) {
          // 检查meanings格式：CSV词典格式 vs LLM服务格式
          const firstMeaning = parsedDefinition.meanings[0];
          if (firstMeaning && typeof firstMeaning.definition === 'string') {
            // CSV词典格式：meanings[].definition是字符串，meanings[].translation是翻译
            formattedDefinition = {
              ...parsedDefinition,
              meanings: parsedDefinition.meanings.map(meaning => ({
                partOfSpeech: meaning.partOfSpeech,
                definitions: [{
                  definition: meaning.translation || meaning.definition,
                  example: meaning.example || null
                }]
              }))
            };
          } else if (firstMeaning && firstMeaning.definitions) {
            // LLM服务格式：meanings[].definitions已经是数组
            formattedDefinition = parsedDefinition;
          } else {
            // 其他格式，尝试创建基本结构
            formattedDefinition = {
              ...parsedDefinition,
              meanings: parsedDefinition.meanings.map(meaning => ({
                partOfSpeech: meaning.partOfSpeech || 'unknown',
                definitions: [{
                  definition: meaning.definition || meaning.meaning || '无释义',
                  example: meaning.example || null
                }]
              }))
            };
          }
        } else if (parsedDefinition.definitions) {
          // 将definitions转换为meanings格式
          const groupedByPartOfSpeech = {};
          parsedDefinition.definitions.forEach(def => {
            const pos = def.partOfSpeech || 'unknown';
            if (!groupedByPartOfSpeech[pos]) {
              groupedByPartOfSpeech[pos] = [];
            }
            groupedByPartOfSpeech[pos].push({
              definition: def.definition || def.meaning,
              example: def.example
            });
          });
          
          formattedDefinition = {
            ...parsedDefinition,
            meanings: Object.entries(groupedByPartOfSpeech).map(([partOfSpeech, definitions]) => ({
              partOfSpeech,
              definitions
            }))
          };
        } else {
          // 如果没有definitions或meanings，创建空的meanings
          formattedDefinition = {
            ...parsedDefinition,
            meanings: []
          };
        }
        
        definitionMap.set(def.word, {
          definition: formattedDefinition,
          phonetic: parsedDefinition.phonetic || parsedDefinition.pronunciation
        });
      } catch (error) {
        console.error(`解析单词 ${def.word} 的释义失败:`, error);
      }
    });

    const formattedVocabulary = vocabulary.map(item => {
      const wordInfo = definitionMap.get(item.word) || {
        definition: { meanings: [] },
        phonetic: null
      };
      
      return {
        id: item.id,
        word: item.word,
        definition: wordInfo.definition,
        phonetic: wordInfo.phonetic,
        context: item.context,
        article: item.article,
        status: item.status,
        addedAt: item.createdAt,
        lastReviewedAt: item.lastReviewedAt
      };
    });

    res.json({
      success: true,
      data: {
        vocabulary: formattedVocabulary,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('获取生词本错误:', error);
    next(createError('获取生词本失败', 500));
  }
};

/**
 * 更新单词状态
 */
const updateStatus = async (req, res, next) => {
  try {
    const schema = Joi.object({
      status: Joi.string().valid('new', 'learning', 'mastered').required()
    });

    const { error, value } = schema.validate(req.body);
    if (error) {
      return next(createError(error.details[0].message, 400));
    }

    const { status } = value;
    const vocabularyId = req.params.id;
    const userId = req.user.id;

    const vocabulary = await prisma.userVocabulary.findFirst({
      where: {
        id: vocabularyId,
        userId
      }
    });

    if (!vocabulary) {
      return next(createError('生词不存在', 404));
    }

    const updatedVocabulary = await prisma.userVocabulary.update({
      where: { id: vocabularyId },
      data: {
        status,
        lastReviewedAt: new Date()
      }
    });

    res.json({
      success: true,
      message: '单词状态已更新',
      data: {
        id: updatedVocabulary.id,
        word: updatedVocabulary.word,
        status: updatedVocabulary.status,
        lastReviewedAt: updatedVocabulary.lastReviewedAt
      }
    });
  } catch (error) {
    console.error('更新单词状态错误:', error);
    next(createError('更新单词状态失败', 500));
  }
};

/**
 * 从生词本删除单词
 */
const removeFromVocabulary = async (req, res, next) => {
  try {
    const vocabularyId = req.params.id;
    const userId = req.user.id;

    const vocabulary = await prisma.userVocabulary.findFirst({
      where: {
        id: vocabularyId,
        userId
      }
    });

    if (!vocabulary) {
      return next(createError('生词不存在', 404));
    }

    await prisma.userVocabulary.delete({
      where: { id: vocabularyId }
    });

    res.json({
      success: true,
      message: '单词已从生词本中删除'
    });
  } catch (error) {
    console.error('删除生词错误:', error);
    next(createError('删除生词失败', 500));
  }
};

/**
 * 获取单词查询统计
 */
const getWordStats = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [totalWords, totalQueries, recentWords] = await Promise.all([
      // 生词本总数
      prisma.userVocabulary.count({
        where: { userId }
      }),
      // 总查询次数
      prisma.wordQueryHistory.count({
        where: { userId }
      }),
      // 最近7天查询的单词
      prisma.wordQueryHistory.count({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    // 掌握程度分布
    const masteryDistribution = await prisma.userVocabulary.groupBy({
      by: ['status'],
      where: { userId },
      _count: {
        status: true
      }
    });

    const masteryStats = masteryDistribution.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        totalWords,
        totalQueries,
        recentWords,
        masteryDistribution: masteryStats
      }
    });
  } catch (error) {
    console.error('获取单词统计错误:', error);
    next(createError('获取单词统计失败', 500));
  }
};

/**
 * 记录单词查询历史（辅助函数）
 */
const recordWordQuery = async (userId, wordDefinitionId, context = null) => {
  try {
    await prisma.wordQueryHistory.create({
      data: {
        userId,
        wordDefinitionId,
        context
      }
    });
  } catch (error) {
    console.error('记录查询历史失败:', error);
    // 不抛出错误，避免影响主要功能
  }
};

module.exports = {
  queryWord,
  addToVocabulary,
  getVocabulary,
  updateStatus,
  removeFromVocabulary,
  getWordStats
};