# 一天 · 部署指南

> 从开发环境到生产部署的完整指南

---

## 本地开发

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0

### 安装与启动

```bash
# 克隆或复制项目
cd yi-tian

# 安装依赖
npm install

# 复制环境变量配置
cp .env.example .env

# 启动开发服务器（自动重启）
npm run dev

# 或启动生产模式
npm start
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage
```

---

## 生产部署

### 方式一：直接运行

```bash
# 设置环境变量
export NODE_ENV=production
export PORT=3000
export DB_PATH=/var/data/yi-tian/yi-tian.db

# 安装生产依赖
npm ci --production

# 启动
node src/server.js
```

### 方式二：使用 PM2

PM2 是 Node.js 进程管理器，推荐用于生产环境。

```bash
# 安装 PM2
npm install -g pm2

# 创建 ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'yi-tian',
    script: 'src/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '256M',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      DB_PATH: '/var/data/yi-tian/yi-tian.db',
      SEED_ON_START: 'false',
    },
  }],
};
EOF

# 启动
pm2 start ecosystem.config.js --env production

# 常用命令
pm2 status          # 查看状态
pm2 logs yi-tian    # 查看日志
pm2 restart yi-tian # 重启
pm2 stop yi-tian    # 停止

# 设置开机自启
pm2 startup
pm2 save
```

### 方式三：Docker 部署

创建 `Dockerfile`：

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY src/ ./src/
COPY public/ ./public/

RUN mkdir -p /app/data /app/backups

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/yi-tian.db
ENV SEED_ON_START=true

EXPOSE 3000

CMD ["node", "src/server.js"]
```

构建与运行：

```bash
# 构建镜像
docker build -t yi-tian .

# 运行容器
docker run -d \
  --name yi-tian \
  -p 3000:3000 \
  -v yi-tian-data:/app/data \
  -v yi-tian-backups:/app/backups \
  yi-tian

# 查看日志
docker logs -f yi-tian
```

Docker Compose（`docker-compose.yml`）：

```yaml
version: '3.8'

services:
  yi-tian:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - yi-tian-data:/app/data
      - yi-tian-backups:/app/backups
    environment:
      - NODE_ENV=production
      - PORT=3000
      - SEED_ON_START=true
    restart: unless-stopped

volumes:
  yi-tian-data:
  yi-tian-backups:
```

---

## 反向代理配置

### Nginx

```nginx
server {
    listen 80;
    server_name yitian.example.com;

    # 强制 HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yitian.example.com;

    ssl_certificate /etc/ssl/certs/yitian.crt;
    ssl_certificate_key /etc/ssl/private/yitian.key;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 反向代理
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 30s;
        proxy_connect_timeout 5s;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        proxy_pass http://127.0.0.1:3000;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # 限制上传大小
    client_max_body_size 10M;
}
```

### Caddy

```
yitian.example.com {
    reverse_proxy localhost:3000
    encode gzip
    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
    }
}
```

---

## 数据备份

### 手动备份

```bash
# 通过 API 触发备份
curl -X POST http://localhost:3000/api/system/backup

# 或直接复制数据库文件
cp data/yi-tian.db backups/yi-tian-$(date +%Y%m%d).db
```

### 自动备份（Cron）

```bash
# 编辑 crontab
crontab -e

# 每天凌晨3点备份
0 3 * * * cp /var/data/yi-tian/yi-tian.db /var/backups/yi-tian/yi-tian-$(date +\%Y\%m\%d).db

# 每周清理30天前的备份
0 4 * * 0 find /var/backups/yi-tian -name "*.db" -mtime +30 -delete
```

---

## 性能优化

### SQLite 优化

项目已内置以下优化：
- WAL 日志模式（提升并发性能）
- 64MB 缓存
- 256MB 内存映射
- 合理的索引设计

### 系统级优化

```bash
# 增加文件描述符限制
ulimit -n 65535

# 使用 SSD 存储数据库
# 确保 DB_PATH 指向 SSD 挂载点
```

---

## 监控

### 健康检查

```bash
curl http://localhost:3000/api/health
```

响应示例：
```json
{
  "status": "ok",
  "name": "一天（Yi Tian）",
  "version": "1.0.0",
  "uptime": 3600,
  "environment": "production"
}
```

### 系统统计

```bash
curl http://localhost:3000/api/system/stats
```

### PM2 监控

```bash
pm2 monit
```

---

## 故障排除

### 数据库锁定

如果遇到 `SQLITE_BUSY` 错误：
- 检查是否有多个进程同时写入
- WAL 模式应该能避免大部分锁定问题
- 必要时重启应用

### 内存占用过高

- 检查 `cache_size` 设置
- 减少 `mmap_size`
- 使用 PM2 的 `max_memory_restart` 自动重启

### 端口被占用

```bash
# 查看端口占用
lsof -i :3000

# 杀掉占用进程
kill -9 <PID>
```

---

## 升级流程

```bash
# 1. 备份数据库
cp data/yi-tian.db backups/pre-upgrade.db

# 2. 拉取新代码
git pull origin main

# 3. 安装新依赖
npm ci --production

# 4. 重启服务
pm2 restart yi-tian

# 5. 验证
curl http://localhost:3000/api/health
```

---

*用一天的视角，看清一生的轮廓。*
