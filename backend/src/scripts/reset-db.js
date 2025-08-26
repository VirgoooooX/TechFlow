const { PrismaClient } = require('@prisma/client');
const { main: seedMain } = require('./seed');

const prisma = new PrismaClient();

/**
 * 重置数据库脚本
 * 删除所有数据并重新初始化
 */
async function resetDatabase() {
  try {
    console.log('🔄 开始重置数据库...');
    
    // 1. 清理所有数据
    console.log('🗑️  清理现有数据...');
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
    
    console.log('✅ 数据清理完成');
    
    // 2. 重新初始化数据
    console.log('🔄 重新初始化数据...');
    await seedMain();
    
    console.log('\n🎉 数据库重置完成！');
    
  } catch (error) {
    console.error('❌ 数据库重置失败:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  resetDatabase();
}

module.exports = { resetDatabase };