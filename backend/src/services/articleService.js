const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class ArticleService {
  async getArticles(options = {}) {
    const {
      page = 1,
      limit = 12,
      search = '',
      sortBy = 'publishedAt',
      sortOrder = 'desc',
      sourceId = null
    } = options;

    const skip = (page - 1) * limit;
    const where = {};

    // 搜索条件
    if (search) {
      where.OR = [
        { titleEn: { contains: search, mode: 'insensitive' } },
        { titleCn: { contains: search, mode: 'insensitive' } },
        { summary: { contains: search, mode: 'insensitive' } }
      ];
    }

    // 新闻源过滤
    if (sourceId) {
      where.newsSourceId = sourceId;
    }

    // 排序配置
    const orderBy = {};
    orderBy[sortBy] = sortOrder;

    try {
      const [articles, total] = await Promise.all([
        prisma.article.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            source: {
              select: {
                id: true,
                name: true,
                category: true
              }
            }
          }
        }),
        prisma.article.count({ where })
      ]);

      return {
        articles,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error fetching articles:', error);
      throw error;
    }
  }

  async getArticleById(id) {
    try {
      const article = await prisma.article.findUnique({
        where: { id },
        include: {
          source: {
            select: {
              id: true,
              name: true,
              category: true
            }
          }
        }
      });

      return article;
    } catch (error) {
      console.error('Error fetching article by id:', error);
      throw error;
    }
  }

  async createArticle(articleData) {
    try {
      const article = await prisma.article.create({
        data: articleData,
        include: {
          newsSource: {
            select: {
              id: true,
              name: true,
              category: true
            }
          }
        }
      });

      return article;
    } catch (error) {
      console.error('Error creating article:', error);
      throw error;
    }
  }

  async updateArticle(id, updateData) {
    try {
      const article = await prisma.article.update({
        where: { id },
        data: updateData,
        include: {
          newsSource: {
            select: {
              id: true,
              name: true,
              category: true
            }
          }
        }
      });

      return article;
    } catch (error) {
      console.error('Error updating article:', error);
      throw error;
    }
  }

  async deleteArticle(id) {
    try {
      await prisma.article.delete({
        where: { id }
      });

      return { success: true };
    } catch (error) {
      console.error('Error deleting article:', error);
      throw error;
    }
  }

  async getNewsSources() {
    try {
      const sources = await prisma.newsSource.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          category: true
        },
        orderBy: { name: 'asc' }
      });

      return sources;
    } catch (error) {
      console.error('Error fetching news sources:', error);
      throw error;
    }
  }
}

module.exports = new ArticleService();