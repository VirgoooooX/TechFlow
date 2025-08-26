const { prisma } = require('../config/database');
const logger = require('../utils/logger');
const llmService = require('../services/llmService');

class SystemController {
  /**
   * 获取系统设置
   */
  async getSystemSettings(req, res) {
    try {
      let systemSettings = await prisma.systemSettings.findUnique({
        where: { id: 'system' }
      });

      // 如果不存在系统设置，创建默认设置
      if (!systemSettings) {
        systemSettings = await prisma.systemSettings.create({
          data: {
            id: 'system',
            autoTranslate: true
          }
        });
      }

      // 不返回敏感信息（API密钥）
      const { llmApiKey, ...safeSettings } = systemSettings;
      
      res.json({
        success: true,
        data: {
          ...safeSettings,
          hasApiKey: !!llmApiKey
        }
      });
    } catch (error) {
      logger.error('Failed to get system settings:', error);
      res.status(500).json({
        success: false,
        message: '获取系统设置失败'
      });
    }
  }

  /**
   * 更新系统设置
   */
  async updateSystemSettings(req, res) {
    try {
      const {
        llmProvider,
        llmApiKey,
        llmBaseUrl,
        llmModel,
        maxTokens,
        temperature,
        autoTranslate
      } = req.body;

      // 验证必要字段
      if (llmProvider && !llmApiKey) {
        return res.status(400).json({
          success: false,
          message: '配置LLM提供商时必须提供API密钥'
        });
      }

      // 准备更新数据
      const updateData = {};
      if (llmProvider !== undefined) updateData.llmProvider = llmProvider;
      if (llmApiKey !== undefined) updateData.llmApiKey = llmApiKey;
      if (llmBaseUrl !== undefined) updateData.llmBaseUrl = llmBaseUrl;
      if (llmModel !== undefined) updateData.llmModel = llmModel;
      if (maxTokens !== undefined) updateData.maxTokens = parseInt(maxTokens);
      if (temperature !== undefined) updateData.temperature = parseFloat(temperature);
      if (autoTranslate !== undefined) updateData.autoTranslate = autoTranslate;

      // 更新或创建系统设置
      const systemSettings = await prisma.systemSettings.upsert({
        where: { id: 'system' },
        update: updateData,
        create: {
          id: 'system',
          ...updateData
        }
      });

      // 不返回敏感信息
      const { llmApiKey: _, ...safeSettings } = systemSettings;

      res.json({
        success: true,
        message: '系统设置更新成功',
        data: {
          ...safeSettings,
          hasApiKey: !!systemSettings.llmApiKey
        }
      });
    } catch (error) {
      logger.error('Failed to update system settings:', error);
      res.status(500).json({
        success: false,
        message: '更新系统设置失败'
      });
    }
  }

  /**
   * 测试系统LLM配置
   */
  async testSystemLLMConfig(req, res) {
    try {
      const config = await llmService.getSystemLLMConfig();
      const result = await llmService.testLLMConfig(config);

      if (result.success) {
        res.json({
          success: true,
          message: '系统LLM配置测试成功',
          data: { response: result.response }
        });
      } else {
        res.status(400).json({
          success: false,
          message: '系统LLM配置测试失败',
          error: result.error
        });
      }
    } catch (error) {
      logger.error('System LLM config test failed:', error);
      res.status(500).json({
        success: false,
        message: '测试失败',
        error: error.message
      });
    }
  }
}

module.exports = new SystemController();