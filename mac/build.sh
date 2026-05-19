#!/usr/bin/env bash
# 论文阅读助手 — 打包为独立 .app（可选）
# 在 Mac 上运行此脚本，生成无需 Python 的独立应用

set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}==> $*${NC}"; }
warn()  { echo -e "${YELLOW}>>> $*${NC}"; }
error() { echo -e "${RED}!!! $*${NC}"; exit 1; }

VENV_PY=".venv/bin/python"
[ -f "$VENV_PY" ] || error "请先运行 mac/install.command"

ARCH=$(uname -m)
warn "目标架构：$ARCH（.app 只能在同架构 Mac 上运行）"
warn "Intel Mac 需在 M 系列 Mac 上交叉编译：arch -x86_64 bash mac/build.sh"

info "安装 PyInstaller…"
"$VENV_PY" -m pip install pyinstaller -q

info "清理旧构建…"
rm -rf build dist

if [ ! -f icon.icns ]; then
    warn "icon.icns 不存在，将使用默认图标。"
fi

info "打包 .app…"
"$VENV_PY" -m PyInstaller paper_reader.spec

APP="dist/论文阅读助手.app"
[ -d "$APP" ] || error "打包失败，未找到 $APP"

info "打包完成！大小：$(du -sh "$APP" | cut -f1)"
echo ""
echo "  位置：$(pwd)/$APP"
echo ""
warn "macOS Gatekeeper 警告处理："
warn "  方法一：右键 → 打开 → 在弹框中点「打开」"
warn "  方法二：终端执行  xattr -cr \"$(pwd)/$APP\""
echo ""
open dist/
