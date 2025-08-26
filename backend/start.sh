#!/bin/sh

# 启动脚本 - 处理数据库初始化和应用启动

echo "🚀 Starting TechFlow application..."

# 运行数据库迁移
echo "📊 Running database migrations..."
npx prisma migrate deploy

# 检查数据库是否为空（检查users表是否有数据）
echo "🔍 Checking if database needs initialization..."
USER_COUNT=$(sqlite3 /app/data/database.db "SELECT COUNT(*) FROM users;" 2>/dev/null || echo "0")

if [ "$USER_COUNT" = "0" ]; then
    echo "📦 Database is empty, running seed script..."
    # 先尝试同步数据库schema
    echo "🔄 Synchronizing database schema..."
    npx prisma db push --accept-data-loss
    
    # 然后运行seed脚本
    npm run seed
    if [ $? -eq 0 ]; then
        echo "✅ Database initialization completed successfully"
    else
        echo "⚠️ Database initialization failed, but continuing to start application"
    fi
else
    echo "✅ Database already contains data, skipping initialization"
fi

# 启动应用服务器
echo "🌐 Starting application server..."
exec node server.js