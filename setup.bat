@echo off
chcp 65001 >nul
title 一天 · Yi Tian — 安装与启动

echo.
echo  ╔══════════════════════════════════════════╗
echo  ║         一 天 · Yi Tian                 ║
echo  ║      24小时生命画布                      ║
echo  ║      一键安装与启动                      ║
echo  ╚══════════════════════════════════════════╝
echo.

:: 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js，请先安装：https://nodejs.org/
    echo        推荐版本：18.0.0 或以上
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [✓] Node.js %NODE_VER%

:: 检查 npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 npm
    pause
    exit /b 1
)
echo [✓] npm 已就绪
echo.

:: 复制环境变量
if not exist ".env" (
    copy .env.example .env >nul
    echo [✓] 已创建 .env 配置文件
) else (
    echo [i] .env 已存在，跳过
)

:: 安装依赖
echo.
echo [1/2] 正在安装依赖（首次需要 1-2 分钟）...
call npm install --production
if %errorlevel% neq 0 (
    echo.
    echo [错误] 依赖安装失败，请检查网络连接
    pause
    exit /b 1
)
echo [✓] 依赖安装完成

:: 启动服务
echo.
echo [2/2] 正在启动服务器...
echo.
echo ──────────────────────────────────────────
echo   打开浏览器访问: http://localhost:3000
echo   按 Ctrl+C 停止服务器
echo ──────────────────────────────────────────
echo.

call npm start
