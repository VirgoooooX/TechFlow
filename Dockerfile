# 多阶段构建优化 Dockerfile
# 阶段1: 构建前端
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# 复制前端依赖文件
COPY frontend/package*.json ./

# 安装前端依赖（包含开发依赖用于构建）
RUN npm ci --no-audit --no-fund && npm cache clean --force

# 复制前端源码
COPY frontend/ ./

# 设置构建时环境变量
ARG VITE_API_BASE_URL=http://localhost:3000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# 构建前端应用
RUN npm run build

# 阶段2: 后端依赖安装
FROM node:18-alpine AS backend-deps

WORKDIR /app

# 复制后端依赖文件
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

# 安装后端生产依赖并生成Prisma客户端
RUN npm ci --only=production --no-audit --no-fund && \
    npx prisma generate && \
    npm cache clean --force

# 阶段3: 最终生产镜像
FROM node:18-alpine AS production

# 安装必要的系统依赖
RUN apk add --no-cache sqlite dumb-init openssl openssl-dev && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# 从依赖阶段复制node_modules和Prisma客户端
COPY --from=backend-deps --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=backend-deps --chown=nodejs:nodejs /app/prisma ./prisma

# 复制后端源码（排除不必要文件）
COPY --chown=nodejs:nodejs backend/server.js ./
COPY --chown=nodejs:nodejs backend/src ./src/
COPY --chown=nodejs:nodejs backend/package.json ./
COPY --chown=nodejs:nodejs backend/start.sh ./start.sh
COPY --chown=nodejs:nodejs backend/ecdict.csv ./ecdict.csv

# 从前端构建阶段复制构建产物和静态资源
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/dist ./public
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/public/favicon.svg ./public/
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/public/logo.svg ./public/
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/public/manifest.json ./public/
COPY --from=frontend-builder --chown=nodejs:nodejs /app/frontend/public/vite.svg ./public/

# 创建数据库和日志目录，设置启动脚本权限
RUN mkdir -p /app/data /app/logs && chown -R nodejs:nodejs /app/data /app/logs && \
    chmod +x /app/start.sh

# 设置环境变量
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL="file:./data/database.db" \
    NODE_OPTIONS="--max-old-space-size=512"

# 切换到非root用户
USER nodejs

# 暴露端口
EXPOSE 3000

# 使用dumb-init作为PID 1进程
ENTRYPOINT ["dumb-init", "--"]
CMD ["./start.sh"]