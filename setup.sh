#!/usr/bin/env bash
set -e

echo ""
echo "  ╔══════════════════════════════════════════╗"
echo "  ║         一 天 · Yi Tian                 ║"
echo "  ║      24小时生命画布                      ║"
echo "  ║      一键安装与启动                      ║"
echo "  ╚══════════════════════════════════════════╝"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 未检测到 Node.js，请先安装：https://nodejs.org/"
    echo "   推荐版本：18.0.0 或以上"
    exit 1
fi

NODE_VER=$(node -v)
echo "✅ Node.js $NODE_VER"

if ! command -v npm &> /dev/null; then
    echo "❌ 未检测到 npm"
    exit 1
fi
echo "✅ npm 已就绪"
echo ""

# 复制环境变量
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ 已创建 .env 配置文件"
else
    echo "ℹ️  .env 已存在，跳过"
fi

# 安装依赖
echo ""
echo "📦 [1/2] 正在安装依赖（首次需要 1-2 分钟）..."
npm install --production
echo "✅ 依赖安装完成"

# 启动服务
echo ""
echo "🚀 [2/2] 正在启动服务器..."
echo ""
echo "──────────────────────────────────────────"
echo "  打开浏览器访问: http://localhost:3000"
echo "  按 Ctrl+C 停止服务器"
echo "──────────────────────────────────────────"
echo ""

npm start
