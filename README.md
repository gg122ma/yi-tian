# 🌅 一天 · Yi Tian

> 24小时生命画布 — 用一天的视角，看清一生的轮廓。

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![License](https://img.shields.io/badge/License-MIT-blue)
![SQLite](https://img.shields.io/badge/SQLite-sql.js-003B57)

一个全栈时间追踪与生活记录应用。记录每小时在做什么、心情如何、目标完成得怎样，让每一天都清晰可见。

![Dashboard](https://img.shields.io/badge/功能-24h时间轴_心情追踪_目标管理_习惯打卡_数据统计-7C3AED)

## 一键启动

### Windows

```bash
git clone https://github.com/你的用户名/yi-tian.git
cd yi-tian
setup.bat
```

### Mac / Linux

```bash
git clone https://github.com/你的用户名/yi-tian.git
cd yi-tian
chmod +x setup.sh
./setup.sh
```

浏览器打开 **http://localhost:3000** 即可使用。

### 手动启动

```bash
git clone https://github.com/你的用户名/yi-tian.git
cd yi-tian
npm install
npm start
```

## 功能

| 功能 | 说明 |
|------|------|
| ⏰ 24小时时间轴 | 点击格子记录每小时活动，8大分类60+活动 |
| 😊 心情追踪 | 心情/精力/压力/专注四维评分 |
| 🎯 目标管理 | 每日目标设定与完成率统计 |
| ✅ 习惯打卡 | 连续天数追踪，最佳纪录 |
| 📊 数据统计 | 日/周/月多维度分析图表 |
| 📝 每日总结 | 亮点/遗憾/感恩/教训/明日计划 |
| 📤 数据导出 | JSON / CSV 格式导出 |

## 技术栈

- **前端**: React 18 · Chart.js 4 · 原生 CSS
- **后端**: Express.js 4 · Node.js
- **数据库**: SQLite (sql.js — 纯 JS，零编译依赖)
- **测试**: Jest 29 · Supertest

## 项目结构

```
yi-tian/
├── src/
│   ├── server.js           # 服务器入口
│   ├── db/
│   │   ├── database.js     # 数据库初始化 + 迁移
│   │   └── seed.js         # 种子数据（60+活动）
│   ├── routes/index.js     # 全部 REST API
│   └── middleware/index.js # 错误处理/验证/限流
├── public/index.html       # React 前端（单文件）
├── tests/                  # 3个测试文件
├── docs/                   # API文档/用户手册/部署指南
├── setup.bat               # Windows 一键启动
├── setup.sh                # Mac/Linux 一键启动
└── package.json
```

## API

启动后访问 `http://localhost:3000/api` 查看可用端点。完整文档见 [docs/API.md](docs/API.md)。

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/activities` | GET/POST | 活动列表/创建 |
| `/api/timeline/:date` | GET | 某天的时间轴 |
| `/api/timeline` | POST | 记录时间 |
| `/api/goals/:date` | GET | 每日目标 |
| `/api/moods` | POST | 心情记录 |
| `/api/habits` | GET | 习惯列表 |
| `/api/stats/overview` | GET | 全局统计 |

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3000 | 服务端口 |
| `NODE_ENV` | development | 运行环境 |
| `SEED_ON_START` | true | 首次运行填充示例数据 |

## 要求

- Node.js >= 18.0.0

## License

MIT
