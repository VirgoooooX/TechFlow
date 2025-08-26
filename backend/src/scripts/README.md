# 数据库初始化脚本

本目录包含用于初始化和管理 TechFlow 数据库的脚本文件。

## 脚本文件说明

### 1. `seed.js` - 数据库种子数据脚本

用于创建初始数据，包括：
- 测试用户账户
- 默认新闻源
- 用户订阅关系
- 示例文章数据

**使用方法：**
```bash
# 运行种子数据脚本
npm run seed

# 清理数据库后重新初始化
node src/scripts/seed.js --clean
```

### 2. `reset-db.js` - 数据库重置脚本

完全清理数据库并重新初始化所有数据。

**使用方法：**
```bash
# 重置数据库
npm run reset-db
```

## 快速开始

### 首次设置数据库

```bash
# 1. 运行数据库迁移并生成客户端
npm run init-db
```

### 重置开发环境

```bash
# 完全重置数据库（清理所有数据并重新初始化）
npm run reset-db
```

## 测试账户

脚本会自动创建以下测试账户：

| 角色 | 邮箱 | 密码 | 用户名 |
|------|------|------|--------|
| 管理员 | admin@techflow.com | admin123 | admin |
| 普通用户 | user@techflow.com | user123 | testuser |
| 演示用户 | demo@techflow.com | demo123 | demo |

## 默认新闻源

脚本会创建以下默认新闻源：

### 默认订阅（所有用户自动订阅）
- **TechCrunch** - 全球领先的科技媒体
- **Hacker News** - 程序员和创业者社区
- **MIT Technology Review** - MIT科技评论
- **Ars Technica** - 深度技术新闻
- **The Verge** - 科技、文化和娱乐
- **AI News** - 人工智能资讯

### 可选订阅
- **VentureBeat** - 创业投资新闻
- **Wired** - 科技文化报道

## 示例数据

脚本会创建一些示例文章，包括：
- OpenAI GPT-5 发布新闻
- IBM 量子计算突破
- Tesla 电池技术革新

## 注意事项

1. **数据安全**：重置脚本会删除所有现有数据，请谨慎使用
2. **环境变量**：确保 `.env` 文件中的数据库连接配置正确
3. **依赖关系**：运行脚本前请确保已安装所有依赖：`npm install`
4. **数据库状态**：如果数据库结构发生变化，请先运行 `npm run migrate`

## 故障排除

### 常见问题

**1. 数据库连接失败**
```bash
# 检查数据库连接
npx prisma db push
```

**2. Prisma 客户端未生成**
```bash
# 重新生成 Prisma 客户端
npm run generate
```

**3. 迁移文件冲突**
```bash
# 重置迁移状态
npx prisma migrate reset
```

**4. 权限问题**
- 确保数据库文件有读写权限
- 检查 SQLite 数据库文件路径是否正确

### 调试模式

设置环境变量启用详细日志：
```bash
# 启用 Prisma 调试日志
DEBUG=prisma:* npm run seed
```

## 开发建议

1. **开发环境**：建议使用 `npm run reset-db` 快速重置开发数据
2. **测试环境**：每次测试前运行重置脚本确保数据一致性
3. **生产环境**：生产环境请勿使用这些脚本，应使用专门的数据迁移策略

## 扩展脚本

如需添加更多初始数据，可以修改 `seed.js` 文件中的相应函数：

- `createTestUsers()` - 添加更多测试用户
- `createDefaultNewsSources()` - 添加更多新闻源
- `createSampleArticles()` - 添加更多示例文章

每个函数都包含重复检查逻辑，可以安全地多次运行。