#!/bin/bash
# P2P-IM Portal Web 前端部署脚本
# 使用方法: ./deploy.sh

set -e

echo "===== P2P-IM Portal Web 前端部署 ====="

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 检查是否是 Git 仓库
if [ ! -d ".git" ]; then
    echo "错误: 当前目录不是 Git 仓库"
    exit 1
fi

# 拉取最新代码
echo "1. 拉取最新代码..."
git pull origin master

# 静态文件位置（根据实际情况修改）
STATIC_DIR="${STATIC_DIR:-/var/www/portal-web}"

if [ -d "$STATIC_DIR" ]; then
    echo "2. 复制静态文件到 $STATIC_DIR..."
    cp index.html style.css app.js "$STATIC_DIR/"
    echo "静态文件已更新"
else
    echo "警告: 静态文件目录 $STATIC_DIR 不存在，跳过复制"
    echo "请手动复制 index.html, style.css, app.js 到 Web 服务器"
fi

echo "===== 部署完成 ====="
