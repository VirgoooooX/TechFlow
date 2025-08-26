# TechFlow - 科技英语悦读

一个现代化的科技英语学习平台，通过阅读前沿科技资讯提升英语水平。

## 🌟 项目特色

- **📰 智能资讯聚合** - 自动抓取多个科技媒体的最新文章
- **🔤 智能生词管理** - AI驱动的单词查询和生词本功能
- **🌐 实时翻译** - 支持句子翻译和标题翻译
- **🎯 个性化学习** - 用户自定义新闻源和学习设置
- **📱 响应式设计** - 完美适配桌面和移动设备
- **🤖 多LLM支持** - 支持OpenAI、Claude、Gemini等多种AI模型

## 🏗️ 技术架构

### 前端技术栈
- **React 18** + **TypeScript** - 现代化前端框架
- **Material-UI (MUI)** - 优雅的UI组件库
- **Redux Toolkit** - 状态管理
- **React Query** - 数据获取和缓存
- **React Router** - 路由管理
- **Vite** - 快速构建工具

### 后端技术栈
- **Node.js** + **Express** - 服务端框架
- **Prisma** - 现代化ORM
- **SQLite** - 轻量级数据库
- **JWT** - 身份认证
- **Winston** - 日志管理
- **Node-cron** - 定时任务

### 核心功能模块
- **新闻聚合服务** - RSS解析和内容抓取
- **LLM集成服务** - 多平台AI模型支持
- **用户管理系统** - 注册、登录、个人设置
- **生词本系统** - 智能单词管理和学习追踪
- **翻译服务** - 实时翻译和缓存机制

## 🚀 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm 或 yarn

### 安装步骤

1. **克隆项目**
```bash
git clone <repository-url>
cd TechFlow
```

2. **安装依赖**
```bash
# 安装根目录依赖
npm install

# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

3. **配置环境变量**

在 `backend` 目录下创建 `.env` 文件：
```env
# 数据库配置
DATABASE_URL="file:./dev.db"

# JWT配置
JWT_SECRET="your-jwt-secret-key"
JWT_REFRESH_SECRET="your-jwt-refresh-secret"
JWT_EXPIRES_IN="24h"
JWT_REFRESH_EXPIRES_IN="7d"

# 服务器配置
PORT=3001
FRONTEND_URL="http://localhost:3000"
NODE_ENV="development"

# LLM配置（可选）
DEFAULT_LLM_PROVIDER="openai"
DEFAULT_LLM_API_KEY="your-openai-api-key"
DEFAULT_LLM_MODEL="gpt-3.5-turbo"
DEFAULT_LLM_MAX_TOKENS=1000
DEFAULT_LLM_TEMPERATURE=0.3

# 速率限制
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

4. **初始化数据库**
```bash
cd backend
npm run init-db
```

5. **启动开发服务器**

```bash
# 启动后端服务 (端口 3001)
cd backend
npm run dev

# 新开终端，启动前端服务 (端口 3000)
cd frontend
npm run dev
```

6. **访问应用**
- 前端地址: http://localhost:3000
- 后端API: http://localhost:3001
- 数据库管理: http://localhost:5555 (运行 `npx prisma studio`)

### 测试账户
初始化数据库后，可使用以下测试账户：
- 管理员: `admin@techflow.com` / `admin123`
- 普通用户: `user@techflow.com` / `user123`
- 演示用户: `demo@techflow.com` / `demo123`

## 📖 功能说明

### 🏠 首页 - 文章浏览
- 展示最新科技资讯
- 支持按新闻源筛选
- 搜索功能
- 分页浏览
- 一键刷新新闻

### 📄 文章详情
- 完整文章内容展示
- 智能单词高亮
- 点击查词功能
- 句子翻译
- 文章分享

### 📚 生词本
- 收藏的单词管理
- 单词详细释义
- 学习状态追踪
- 复习模式
- 关联文章跳转

### ⚙️ 设置中心
- 个人信息管理
- LLM配置
- 新闻源订阅
- 界面个性化
- 系统设置（管理员）

## 🔧 开发指南

### 项目结构
```
TechFlow/
├── frontend/                 # 前端应用
│   ├── src/
│   │   ├── components/       # 通用组件
│   │   ├── pages/           # 页面组件
│   │   ├── services/        # API服务
│   │   ├── store/           # Redux状态管理
│   │   ├── hooks/           # 自定义Hooks
│   │   ├── contexts/        # React Context
│   │   └── utils/           # 工具函数
│   └── public/              # 静态资源
├── backend/                 # 后端应用
│   ├── src/
│   │   ├── api/             # API路由
│   │   ├── controllers/     # 控制器
│   │   ├── services/        # 业务服务
│   │   ├── middleware/      # 中间件
│   │   ├── config/          # 配置文件
│   │   ├── utils/           # 工具函数
│   │   ├── cron/            # 定时任务
│   │   └── scripts/         # 脚本文件
│   ├── prisma/              # 数据库模型
│   └── logs/                # 日志文件
└── package.json             # 根配置文件
```

### 可用脚本

#### 后端脚本
```bash
npm start          # 生产环境启动
npm run dev        # 开发环境启动
npm run migrate    # 数据库迁移
npm run generate   # 生成Prisma客户端
npm run seed       # 数据库种子数据
npm run init-db    # 初始化数据库
npm test           # 运行测试
```

#### 前端脚本
```bash
npm run dev        # 开发服务器
npm run build      # 构建生产版本
npm run preview    # 预览构建结果
npm run lint       # 代码检查
npm run type-check # 类型检查
npm test           # 运行测试
```

### API文档

#### 认证接口
- `POST /api/auth/login` - 用户登录
- `POST /api/auth/register` - 用户注册
- `POST /api/auth/logout` - 用户登出
- `GET /api/auth/verify` - 验证Token

#### 文章接口
- `GET /api/articles` - 获取文章列表
- `GET /api/articles/:id` - 获取文章详情
- `POST /api/articles/refresh` - 刷新所有新闻
- `POST /api/articles/translate` - 翻译句子

#### 单词接口
- `POST /api/words/query` - 查询单词
- `GET /api/words/vocabulary` - 获取生词本
- `POST /api/words/vocabulary` - 添加到生词本
- `DELETE /api/words/vocabulary/:id` - 从生词本删除

#### 用户接口
- `GET /api/users/profile` - 获取用户信息
- `PUT /api/users/profile` - 更新用户信息
- `GET /api/users/settings` - 获取用户设置
- `PUT /api/users/settings` - 更新用户设置

## 🤖 LLM配置

支持多种AI模型提供商：

### OpenAI
```env
DEFAULT_LLM_PROVIDER="openai"
DEFAULT_LLM_API_KEY="sk-..."
DEFAULT_LLM_MODEL="gpt-3.5-turbo"
```

### Claude (Anthropic)
```env
DEFAULT_LLM_PROVIDER="anthropic"
DEFAULT_LLM_API_KEY="sk-ant-..."
DEFAULT_LLM_MODEL="claude-3-sonnet-20240229"
```

### Gemini (Google)
```env
DEFAULT_LLM_PROVIDER="gemini"
DEFAULT_LLM_API_KEY="AIza..."
DEFAULT_LLM_MODEL="gemini-pro"
```

### 自定义API
```env
DEFAULT_LLM_PROVIDER="custom"
DEFAULT_LLM_API_KEY="your-api-key"
DEFAULT_LLM_ENDPOINT="https://your-api-endpoint.com/v1/chat/completions"
DEFAULT_LLM_MODEL="your-model-name"
```

## 📦 部署

### 生产环境部署

1. **构建前端**
```bash
cd frontend
npm run build
```

2. **配置生产环境变量**
```bash
cp backend/.env.example backend/.env.production
# 编辑 .env.production 文件
```

3. **启动生产服务**
```bash
cd backend
NODE_ENV=production npm start
```

### Docker部署

```dockerfile
# Dockerfile示例
FROM node:18-alpine

WORKDIR /app

# 复制依赖文件
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# 安装依赖
RUN npm install
RUN cd backend && npm install
RUN cd frontend && npm install

# 复制源代码
COPY . .

# 构建前端
RUN cd frontend && npm run build

# 初始化数据库
RUN cd backend && npm run init-db

EXPOSE 3001

CMD ["npm", "start"]
```

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [React](https://reactjs.org/) - 前端框架
- [Material-UI](https://mui.com/) - UI组件库
- [Express](https://expressjs.com/) - 后端框架
- [Prisma](https://www.prisma.io/) - 数据库ORM
- [OpenAI](https://openai.com/) - AI服务支持

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 项目Issues: [GitHub Issues](https://github.com/your-repo/issues)
- 邮箱: techflow@example.com

---

**TechFlow Team** - 让科技英语学习更简单、更高效！