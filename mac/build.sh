#!/usr/bin/env bash
# PaperKnowKnow — Mac 打包脚本
# 生成 .app 和 .dmg，无需 Python 环境，双击即可运行

set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}==> $*${NC}"; }
warn()  { echo -e "${YELLOW}>>> $*${NC}"; }
error() { echo -e "${RED}!!! $*${NC}"; exit 1; }

VENV_PY=".venv/bin/python"
[ -f "$VENV_PY" ] || error "请先运行 mac/install.command"

export PYINSTALLER_CONFIG_DIR="$(pwd)/.pyinstaller-cache"
export PYTHONPYCACHEPREFIX="$(pwd)/.pycache-build"

ARCH=$(uname -m)
warn "目标架构：$ARCH"
warn "注意：.app 只能在同架构 Mac 上运行（M 系列 / Intel 各自编译）"

# ── 安装 PyInstaller ──────────────────────────────────────────────────────────
info "安装 PyInstaller…"
"$VENV_PY" -m pip install pyinstaller==6.10.0 -q --cache-dir "$(pwd)/.pip-cache"

# ── 清理旧构建 ────────────────────────────────────────────────────────────────
info "清理旧构建…"
rm -rf build dist

# ── 打包 .app ─────────────────────────────────────────────────────────────────
info "打包 .app（约 3-8 分钟）…"
"$VENV_PY" -m PyInstaller paper_reader.spec

APP="dist/PaperKnowKnow.app"
[ -d "$APP" ] || error "打包失败，未找到 $APP"
info "打包完成！大小：$(du -sh "$APP" | cut -f1)"

# ── 去除隔离属性（避免 Gatekeeper 拦截本地测试）────────────────────────────
info "清除隔离标记…"
xattr -cr "$APP" 2>/dev/null || true
codesign --force --deep --sign - "$APP" 2>/dev/null || true

# ── 创建 DMG ─────────────────────────────────────────────────────────────────
DMG="dist/PaperKnowKnow-Mac.dmg"
info "创建 DMG…"
if hdiutil create \
    -volname "PaperKnowKnow" \
    -srcfolder "$APP" \
    -ov \
    -format UDZO \
    "$DMG"; then

    info "DMG 已生成：$(pwd)/$DMG"
    DIST_FILE="$DMG"
else
    warn "DMG 创建失败，改为生成 ZIP 分发包…"
    ZIP="dist/PaperKnowKnow-Mac-arm64-unsigned.zip"
    rm -f "$ZIP"
    ditto -c -k --keepParent "$APP" "$ZIP"
    info "ZIP 已生成：$(pwd)/$ZIP"
    DIST_FILE="$ZIP"
fi

echo ""
echo "  ✅ 打包完成！"
echo ""
echo "  分发文件：$DIST_FILE"
echo "  用户安装：解压或打开分发包 → 把 .app 拖入「应用程序」文件夹"
echo ""
warn "首次运行提示（未签名应用）："
warn "  右键点击 .app → 打开 → 在弹框中点「打开」（仅需一次）"
echo ""

open dist/ 2>/dev/null || true

echo ""
read -p "按回车关闭…  " || true
