/**
 * ═══════════════════════════════════════════════════════════════
 *  一天（Yi Tian）— 服务器入口
 * ═══════════════════════════════════════════════════════════════
 *  24小时生命画布：追踪你的时间、活动、心情和目标
 *  用一天的视角，看清一生的轮廓
 * ═══════════════════════════════════════════════════════════════
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

import { initializeDatabase, closeDatabase, saveDatabase } from './db/database.js';
import { seedDatabase } from './db/seed.js';
import { apiRouter } from './routes/index.js';
import { errorHandler, requestLogger, rateLimiter, corsOptions } from './middleware/index.js';

// ─── 路径解析 ────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// ─── 配置 ────────────────────────────────────────────────────
const CONFIG = {
  port: parseInt(process.env.PORT || '3000', 10),
  env: process.env.NODE_ENV || 'development',
  dbPath: process.env.DB_PATH || path.join(ROOT_DIR, 'data', 'yi-tian.db'),
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigins: process.env.CORS_ORIGINS || '*',
  rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  seedOnStart: process.env.SEED_ON_START !== 'false',
  staticDir: process.env.STATIC_DIR || path.join(ROOT_DIR, 'public'),
  compressionEnabled: process.env.COMPRESSION_ENABLED !== 'false',
  backupDir: process.env.BACKUP_DIR || path.join(ROOT_DIR, 'backups'),
};

// ─── Express 应用初始化 ──────────────────────────────────────
const app = express();

// 安全头
app.use(helmet({
  contentSecurityPolicy: CONFIG.env === 'production' ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors(corsOptions(CONFIG.corsOrigins)));

// 请求体解析
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 响应压缩
if (CONFIG.compressionEnabled) {
  app.use(compression());
}

// 请求日志
if (CONFIG.env !== 'test') {
  app.use(morgan(CONFIG.env === 'production' ? 'combined' : 'dev'));
}
app.use(requestLogger);

// 速率限制
app.use('/api', rateLimiter(CONFIG.rateLimitMax, 15 * 60 * 1000));

// ─── 静态文件服务 ────────────────────────────────────────────
// 优先使用用户指定的静态目录，否则使用 public/
const staticPath = fs.existsSync(CONFIG.staticDir)
  ? CONFIG.staticDir
  : path.join(ROOT_DIR, 'public');

app.use(express.static(staticPath));

// ─── API 路由 ─────────────────────────────────────────────────
app.use('/api', apiRouter);

// ─── 健康检查 ─────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: '一天（Yi Tian）',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: CONFIG.env,
  });
});

// ─── SPA 回退路由 ─────────────────────────────────────────────
// 所有非 API 路由都返回前端页面
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }

  const indexPath = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // 如果没有 index.html，返回欢迎页面
    res.status(200).send(generateWelcomePage());
  }
});

// ─── 错误处理 ─────────────────────────────────────────────────
app.use(errorHandler);

// ─── 欢迎页 HTML ──────────────────────────────────────────────
function generateWelcomePage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>一天 — Yi Tian</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container { text-align: center; padding: 2rem; }
    h1 { font-size: 4rem; margin-bottom: 0.5rem; }
    .subtitle { font-size: 1.2rem; opacity: 0.7; margin-bottom: 2rem; }
    .time-display {
      font-size: 8rem;
      font-weight: 200;
      letter-spacing: 0.1em;
      font-variant-numeric: tabular-nums;
      margin-bottom: 2rem;
    }
    .hours {
      display: grid;
      grid-template-columns: repeat(24, 1fr);
      gap: 4px;
      margin-bottom: 2rem;
    }
    .hour-block {
      aspect-ratio: 1;
      border-radius: 4px;
      background: rgba(255,255,255,0.1);
      transition: all 0.3s;
    }
    .hour-block.past { background: rgba(255,255,255,0.3); }
    .hour-block.current {
      background: #ff6b6b;
      box-shadow: 0 0 20px rgba(255,107,107,0.5);
    }
    .info { opacity: 0.5; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>一天</h1>
    <p class="subtitle">24小时生命画布</p>
    <div class="time-display" id="clock"></div>
    <div class="hours" id="hours"></div>
    <p class="info">请将前端文件放置在 public/ 目录中，或访问 /api 了解 API 接口</p>
  </div>
  <script>
    function updateClock() {
      const now = new Date();
      const h = String(now.getHours()).padStart(2,'0');
      const m = String(now.getMinutes()).padStart(2,'0');
      const s = String(now.getSeconds()).padStart(2,'0');
      document.getElementById('clock').textContent = h + ':' + m + ':' + s;

      const hoursDiv = document.getElementById('hours');
      if (hoursDiv.children.length === 0) {
        for (let i = 0; i < 24; i++) {
          const block = document.createElement('div');
          block.className = 'hour-block';
          block.title = i + ':00';
          hoursDiv.appendChild(block);
        }
      }

      const blocks = hoursDiv.children;
      const currentHour = now.getHours();
      for (let i = 0; i < 24; i++) {
        blocks[i].className = 'hour-block';
        if (i < currentHour) blocks[i].classList.add('past');
        if (i === currentHour) blocks[i].classList.add('current');
      }
    }
    updateClock();
    setInterval(updateClock, 1000);
  </script>
</body>
</html>`;
}

// ─── 服务器启动 ───────────────────────────────────────────────
let server;

async function start() {
  try {
    // 确保数据目录存在
    const dataDir = path.dirname(CONFIG.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 确保备份目录存在
    if (!fs.existsSync(CONFIG.backupDir)) {
      fs.mkdirSync(CONFIG.backupDir, { recursive: true });
    }

    // 初始化数据库
    console.log('📦 正在初始化数据库...');
    await initializeDatabase(CONFIG.dbPath);

    // 填充种子数据
    if (CONFIG.seedOnStart) {
      console.log('🌱 正在填充示例数据...');
      seedDatabase();
    }

    // 启动服务器
    server = app.listen(CONFIG.port, () => {
      console.log('');
      console.log('╔══════════════════════════════════════════╗');
      console.log('║           一 天 · Yi Tian               ║');
      console.log('║        24小时生命画布                    ║');
      console.log('╠══════════════════════════════════════════╣');
      console.log(`║  🌐 服务地址: http://localhost:${CONFIG.port}       ║`);
      console.log(`║  📊 API 文档: http://localhost:${CONFIG.port}/api   ║`);
      console.log(`║  🗄️  数据库: ${CONFIG.dbPath.slice(-26).padEnd(28)}║`);
      console.log(`║  🌍 环境: ${CONFIG.env.padEnd(29)}║`);
      console.log('╚══════════════════════════════════════════╝');
      console.log('');
    });

    // 优雅关闭
    const shutdown = (signal) => {
      console.log(`\n🛑 收到 ${signal} 信号，正在优雅关闭...`);
      server.close(() => {
        closeDatabase();
        console.log('👋 一天服务器已关闭。珍惜每一天！\n');
        process.exit(0);
      });

      // 强制关闭超时
      setTimeout(() => {
        console.error('⚠️ 强制关闭');
        process.exit(1);
      }, 5000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // 未捕获异常处理
    process.on('uncaughtException', (err) => {
      console.error('❌ 未捕获异常:', err);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ 未处理的 Promise 拒绝:', reason);
    });

  } catch (err) {
    console.error('❌ 启动失败:', err);
    process.exit(1);
  }
}

start();

export { app, CONFIG };
