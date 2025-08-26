const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * 创建测试用户
 */
async function createTestUsers() {
  console.log('🔄 创建测试用户...');
  
  const testUsers = [
    {
      email: 'admin@techflow.com',
      password: 'admin123',
      username: 'admin',
      isAdmin: true
    },
  ];

  for (const userData of testUsers) {
    // 检查用户是否已存在（邮箱或用户名）
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: userData.email },
          { username: userData.username }
        ]
      }
    });

    if (existingUser) {
      console.log(`⚠️  用户 ${userData.email} 或用户名 ${userData.username} 已存在，跳过创建`);
      continue;
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(userData.password, 12);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email: userData.email,
        passwordHash,
        username: userData.username,
        settings: {
          create: {
            theme: 'light',
            fontSize: 'medium',
            autoTranslate: true,
            enableNotifications: false,
            translationLanguage: 'zh-CN'
          }
        }
      }
    });

    console.log(`✅ 创建用户: ${user.email} (${user.username})`);
  }
}

/**
 * 创建默认新闻源
 */
async function createDefaultNewsSources() {
  console.log('🔄 创建默认新闻源...');
  
  const newsSources = [
    {
      name: 'TechCrunch',
      url: 'https://rsshub.app/techcrunch/news',
      sourceType: 'rss',
      contentType: 'media',
      isDefault: true,
      description: '全球领先的科技媒体，专注创业公司和科技新闻',
      category: 'tech',
      language: 'en'
    },
    {
      name: 'Slashdot',
      url: 'https://rss.slashdot.org/Slashdot/slashdot',
      sourceType: 'rss', 
      contentType: 'text',
      isDefault: true,
      description: 'News for nerds, stuff that matters',
      category: 'tech',
      language: 'en'
    },
  ];

  for (const sourceData of newsSources) {
    // 检查新闻源是否已存在
    const existingSource = await prisma.newsSource.findFirst({
      where: { 
        OR: [
          { name: sourceData.name },
          { url: sourceData.url }
        ]
      }
    });

    if (existingSource) {
      console.log(`⚠️  新闻源 ${sourceData.name} 已存在，跳过创建`);
      continue;
    }

    const newsSource = await prisma.newsSource.create({
      data: sourceData
    });

    console.log(`✅ 创建新闻源: ${newsSource.name}`);
  }
}

/**
 * 为测试用户订阅默认新闻源
 */
async function subscribeUsersToDefaultSources() {
  console.log('🔄 为用户订阅默认新闻源...');
  
  // 获取所有用户
  const users = await prisma.user.findMany();
  
  // 获取所有默认新闻源
  const defaultSources = await prisma.newsSource.findMany({
    where: { isDefault: true }
  });

  for (const user of users) {
    for (const source of defaultSources) {
      // 检查是否已订阅
      const existingSubscription = await prisma.userNewsSource.findUnique({
        where: {
          userId_sourceId: {
            userId: user.id,
            sourceId: source.id
          }
        }
      });

      if (!existingSubscription) {
        await prisma.userNewsSource.create({
          data: {
            userId: user.id,
            sourceId: source.id
          }
        });
        console.log(`✅ ${user.username} 订阅了 ${source.name}`);
      }
    }
  }
}

/**
 * 创建示例文章数据
 */
async function createSampleArticles() {
  console.log('🔄 创建示例文章...');
  
  // 获取第一个新闻源
  const newsSource = await prisma.newsSource.findFirst();
  
  if (!newsSource) {
    console.log('⚠️  没有找到新闻源，跳过创建示例文章');
    return;
  }

  const sampleArticles = [
    {
      titleEn: 'OpenAI Announces GPT-5: The Next Generation of AI',
      titleCn: 'OpenAI 发布 GPT-5：下一代人工智能',
      contentHtml: '<p>OpenAI has announced the release of GPT-5, marking a significant milestone in artificial intelligence development. The new model demonstrates unprecedented capabilities in reasoning, creativity, and problem-solving.</p><p>Key improvements include enhanced multimodal understanding, better factual accuracy, and more nuanced conversation abilities. The model has been trained on a diverse dataset and incorporates advanced safety measures.</p>',
      originalUrl: 'https://example.com/gpt5-announcement',
      imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800',
      author: 'Sarah Johnson',
      summary: 'OpenAI unveils GPT-5 with groundbreaking AI capabilities and enhanced safety features.',
      publishedAt: new Date('2024-01-15T10:00:00Z')
    },
    {
      titleEn: 'Quantum Computing Breakthrough: IBM Achieves 1000-Qubit Milestone',
      titleCn: '量子计算突破：IBM 实现 1000 量子比特里程碑',
      contentHtml: '<p>IBM researchers have successfully demonstrated a 1000-qubit quantum processor, representing a major leap forward in quantum computing technology. This achievement brings us closer to practical quantum advantage in real-world applications.</p><p>The new processor, called "Quantum Condor," features improved error correction and longer coherence times. Potential applications include drug discovery, financial modeling, and cryptography.</p>',
      originalUrl: 'https://example.com/ibm-quantum-breakthrough',
      imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800',
      author: 'Dr. Michael Chen',
      summary: 'IBM achieves quantum computing milestone with 1000-qubit processor breakthrough.',
      publishedAt: new Date('2024-01-14T14:30:00Z')
    },
  ];

  for (const articleData of sampleArticles) {
    // 检查文章是否已存在
    const existingArticle = await prisma.article.findFirst({
      where: { 
        originalUrl: articleData.originalUrl
      }
    });

    if (existingArticle) {
      console.log(`⚠️  文章 "${articleData.titleEn}" 已存在，跳过创建`);
      continue;
    }

    const article = await prisma.article.create({
      data: {
        ...articleData,
        sourceId: newsSource.id
      }
    });

    console.log(`✅ 创建文章: ${article.titleEn}`);
  }
}

/**
 * 清理数据库（可选）
 */
async function cleanDatabase() {
  console.log('🔄 清理数据库...');
  
  // 按依赖关系顺序删除
  await prisma.wordQueryHistory.deleteMany();
  await prisma.userVocabulary.deleteMany();
  await prisma.userNewsSource.deleteMany();
  await prisma.article.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.user.deleteMany();
  await prisma.newsSource.deleteMany();
  await prisma.wordDefinition.deleteMany();
  await prisma.titleTranslation.deleteMany();
  await prisma.sentenceTranslation.deleteMany();
  
  console.log('✅ 数据库清理完成');
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('🚀 开始数据库初始化...');
    
    // 检查命令行参数
    const args = process.argv.slice(2);
    const shouldClean = args.includes('--clean');
    
    if (shouldClean) {
      await cleanDatabase();
    }
    
    // 创建基础数据
    await createTestUsers();
    await createDefaultNewsSources();
    await subscribeUsersToDefaultSources();
    await createSampleArticles();
    
    console.log('\n🎉 数据库初始化完成！');
    console.log('\n📋 测试账户信息:');
    console.log('管理员: admin@techflow.com / admin123');
    console.log('普通用户: user@techflow.com / user123');
    console.log('演示用户: demo@techflow.com / demo123');
    console.log('\n🌐 访问地址:');
    console.log('前端: http://localhost:3000');
    console.log('后端: http://localhost:3001');
    console.log('数据库管理: http://localhost:5555 (Prisma Studio)');
    
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = {
  createTestUsers,
  createDefaultNewsSources,
  subscribeUsersToDefaultSources,
  createSampleArticles,
  cleanDatabase,
  main
};