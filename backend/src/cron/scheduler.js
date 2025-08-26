const cron = require('node-cron');
const logger = require('../utils/logger');
const newsService = require('../services/newsService');
const articleService = require('../services/articleService');

// 定时任务实现
class CronTaskManager {
  /**
   * 新闻抓取任务
   */
  async fetchNews() {
    try {
      logger.info('Executing news fetching task...');
      const result = await newsService.fetchAllNews();
      logger.info(`News fetching completed: ${result.totalArticles} articles created, ${result.totalErrors} errors`);
    } catch (error) {
      logger.error('News fetching task failed:', error);
      throw error;
    }
  }

  /**
   * 清理旧文章任务 - 按用户保留最近100篇文章
   */
  async cleanupOldArticles() {
    try {
      logger.info('Executing article cleanup task...');
      const deletedCount = await newsService.cleanupOldArticles();
      logger.info(`Article cleanup completed: ${deletedCount} articles deleted`);
    } catch (error) {
      logger.error('Article cleanup task failed:', error);
      throw error;
    }
  }
}

const taskManager = new CronTaskManager();

// 定时任务配置
const CRON_JOBS = {
  // 新闻抓取 - 每30分钟执行一次
  NEWS_FETCH: {
    schedule: process.env.NEWS_FETCH_INTERVAL || '*/30 * * * *',
    name: 'News Fetching',
    task: taskManager.fetchNews.bind(taskManager)
  },
  
  // 清理旧文章 - 每天凌晨2点执行
  CLEANUP_ARTICLES: {
    schedule: '0 2 * * *',
    name: 'Article Cleanup',
    task: taskManager.cleanupOldArticles.bind(taskManager)
  }
};

// 存储活跃的定时任务
const activeTasks = new Map();

/**
 * 启动所有定时任务
 */
const startCronJobs = () => {
  logger.info('🕐 Starting cron jobs...');
  
  Object.entries(CRON_JOBS).forEach(([key, config]) => {
    try {
      const task = cron.schedule(config.schedule, async () => {
        const startTime = Date.now();
        logger.info(`⏰ Starting cron job: ${config.name}`);
        
        try {
          await config.task();
          const duration = Date.now() - startTime;
          logger.info(`✅ Cron job completed: ${config.name} (${duration}ms)`);
        } catch (error) {
          logger.error(`❌ Cron job failed: ${config.name}`, error);
        }
      }, {
        scheduled: false,
        timezone: 'Asia/Shanghai'
      });
      
      activeTasks.set(key, task);
      task.start();
      
      logger.info(`📅 Scheduled: ${config.name} - ${config.schedule}`);
    } catch (error) {
      logger.error(`Failed to schedule cron job: ${config.name}`, error);
    }
  });
  
  logger.info(`🚀 ${activeTasks.size} cron jobs started successfully`);
};

/**
 * 停止所有定时任务
 */
const stopCronJobs = () => {
  logger.info('🛑 Stopping cron jobs...');
  
  activeTasks.forEach((task, key) => {
    try {
      task.stop();
      logger.info(`⏹️ Stopped cron job: ${key}`);
    } catch (error) {
      logger.error(`Failed to stop cron job: ${key}`, error);
    }
  });
  
  activeTasks.clear();
  logger.info('✅ All cron jobs stopped');
};

/**
 * 停止特定的定时任务
 * @param {string} jobKey - 任务键名
 */
const stopCronJob = (jobKey) => {
  const task = activeTasks.get(jobKey);
  if (task) {
    task.stop();
    activeTasks.delete(jobKey);
    logger.info(`⏹️ Stopped cron job: ${jobKey}`);
    return true;
  }
  return false;
};

/**
 * 重启特定的定时任务
 * @param {string} jobKey - 任务键名
 */
const restartCronJob = (jobKey) => {
  const config = CRON_JOBS[jobKey];
  if (!config) {
    logger.error(`Cron job not found: ${jobKey}`);
    return false;
  }
  
  // 停止现有任务
  stopCronJob(jobKey);
  
  // 重新启动任务
  try {
    const task = cron.schedule(config.schedule, async () => {
      const startTime = Date.now();
      logger.info(`⏰ Starting cron job: ${config.name}`);
      
      try {
        await config.task();
        const duration = Date.now() - startTime;
        logger.info(`✅ Cron job completed: ${config.name} (${duration}ms)`);
      } catch (error) {
        logger.error(`❌ Cron job failed: ${config.name}`, error);
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Shanghai'
    });
    
    activeTasks.set(jobKey, task);
    task.start();
    
    logger.info(`🔄 Restarted cron job: ${config.name}`);
    return true;
  } catch (error) {
    logger.error(`Failed to restart cron job: ${config.name}`, error);
    return false;
  }
};

/**
 * 手动执行特定任务
 * @param {string} jobKey - 任务键名
 */
const runJobManually = async (jobKey) => {
  const config = CRON_JOBS[jobKey];
  if (!config) {
    throw new Error(`Cron job not found: ${jobKey}`);
  }
  
  const startTime = Date.now();
  logger.info(`🔧 Manually executing: ${config.name}`);
  
  try {
    await config.task();
    const duration = Date.now() - startTime;
    logger.info(`✅ Manual execution completed: ${config.name} (${duration}ms)`);
    return { success: true, duration };
  } catch (error) {
    logger.error(`❌ Manual execution failed: ${config.name}`, error);
    throw error;
  }
};

/**
 * 获取所有定时任务的状态
 */
const getCronJobsStatus = () => {
  const status = {};
  
  Object.entries(CRON_JOBS).forEach(([key, config]) => {
    const task = activeTasks.get(key);
    status[key] = {
      name: config.name,
      schedule: config.schedule,
      isRunning: task ? task.running : false,
      nextRun: task ? task.nextDate() : null
    };
  });
  
  return status;
};

/**
 * 验证 cron 表达式
 * @param {string} cronExpression - cron 表达式
 */
const validateCronExpression = (cronExpression) => {
  try {
    return cron.validate(cronExpression);
  } catch (error) {
    return false;
  }
};

// 优雅关闭处理
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, stopping cron jobs...');
  stopCronJobs();
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, stopping cron jobs...');
  stopCronJobs();
});

module.exports = {
  startCronJobs,
  stopCronJobs,
  stopCronJob,
  restartCronJob,
  runJobManually,
  getCronJobsStatus,
  validateCronExpression,
  CRON_JOBS
};