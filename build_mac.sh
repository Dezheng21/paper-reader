#!/usr/bin/env bash
set -e

# ── 颜色输出 ─────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}==> $*${NC}"; }
warn()  { echo -e "${YELLOW}>>> $*${NC}"; }
error() { echo -e "${RED}!!! $*${NC}"; exit 1; }

# ── 检查 Python ───────────────────────────────────────────────────────────
info "Checking Python..."
if command -v python3 &>/dev/null; then
    PY=python3
elif command -v python &>/dev/null; then
    PY=python
else
    error "Python not found. Install via: brew install python"
fi
info "Using $PY  ($($PY --version))"

# 提醒架构问题
ARCH=$(uname -m)
warn "Building for architecture: $ARCH"
warn "The resulting .app only runs on $ARCH Macs."
warn "To build for Intel on an M-series Mac: arch -x86_64 bash build_mac.sh"

# ── 安装依赖 ──────────────────────────────────────────────────────────────
info "Installing dependencies..."
$PY -m pip install --upgrade pip -q
$PY -m pip install -r requirements.txt -q
$PY -m pip install pyinstaller -q

# ── 清理旧构建 ────────────────────────────────────────────────────────────
info "Cleaning previous build..."
rm -rf build dist

# ── 可选：生成 icon.icns ──────────────────────────────────────────────────
if [ ! -f icon.icns ]; then
    warn "icon.icns not found — building without custom icon."
    warn "To add an icon later:"
    warn "  1. Prepare a 1024x1024 PNG named icon.png"
    warn "  2. mkdir icon.iconset"
    warn "  3. sips -z 512 512 icon.png --out icon.iconset/icon_512x512.png"
    warn "  4. iconutil -c icns icon.iconset"
    warn "  5. rm -rf icon.iconset  &&  rerun this script"
fi

# ── 打包 ──────────────────────────────────────────────────────────────────
info "Building .app with PyInstaller..."
$PY -m PyInstaller paper_reader.spec

# ── 验证输出 ──────────────────────────────────────────────────────────────
APP_PATH="dist/PaperKnowKnow.app"
if [ ! -d "$APP_PATH" ]; then
    error "Build failed — $APP_PATH not found."
fi

APP_SIZE=$(du -sh "$APP_PATH" | cut -f1)
info "Build complete!"
echo ""
echo "  App:   $(pwd)/$APP_PATH  ($APP_SIZE)"
echo "  Data:  ~/Library/Application Support/PaperKnowKnow/"
echo ""

# ── Gatekeeper 提示 ───────────────────────────────────────────────────────
warn "App is NOT code-signed. macOS Gatekeeper will block it on first launch."
warn "Fix with one of these:"
warn "  a) xattr -cr \"$(pwd)/$APP_PATH\""
warn "  b) Right-click the .app → Open → click 'Open' in the dialog"
echo ""

# ── 打开 dist 目录 ────────────────────────────────────────────────────────
info "Opening dist folder..."
open dist/
