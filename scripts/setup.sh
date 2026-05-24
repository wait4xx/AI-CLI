#!/usr/bin/env bash
set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# 检测系统
if ! grep -q "Debian" /etc/os-release 2>/dev/null; then
    warn "此脚本为 Debian 13 设计，在其他系统上可能需要调整"
fi

info "安装系统依赖..."
sudo apt-get update
sudo apt-get install -y build-essential python3 tmux git curl

# Node.js
if ! command -v node &>/dev/null; then
    info "安装 Node.js 20 (通过 nvm)..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    nvm install 20
    nvm use 20
fi

# pnpm
if ! command -v pnpm &>/dev/null; then
    info "安装 pnpm 8.15.4..."
    corepack enable
    corepack prepare pnpm@8.15.4 --activate
fi

# 安装依赖
info "安装项目依赖..."
pnpm install

# 环境变量
if [ ! -f .env ]; then
    info "创建 .env 文件..."
    cp .env.example .env
    warn "请编辑 .env 文件，设置安全的 JWT_SECRET 和 ADMIN_PASSWORD"
fi

info "初始化完成！"
echo ""
echo "  下一步："
echo "    1. 编辑 .env 文件设置安全密钥"
echo "    2. 运行 pnpm dev 启动开发环境"
echo "    3. 或运行 docker compose up --build -d 启动生产环境"
