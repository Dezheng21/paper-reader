#!/usr/bin/env bash
# 论文阅读助手 — Mac 首次安装  /  논문 읽기 도우미 — Mac 최초 설치
# 双击此文件完成一键安装  /  이 파일을 더블클릭하여 설치하세요

set -e
cd "$(dirname "$0")/.."   # 回到项目根目录

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}✔  $*${NC}"; }
step()  { echo -e "${CYAN}▶  $*${NC}"; }
warn()  { echo -e "${YELLOW}⚠  $*${NC}"; }
error() { echo -e "${RED}✘  $*${NC}"; echo ""; echo "安装失败，请截图此窗口反馈。"; read -p "按回车关闭…"; exit 1; }

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   论文阅读助手  —  Mac 首次安装"
echo "   논문 읽기 도우미  —  Mac 최초 설치"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 检查 Python ──────────────────────────────────────────────
step "检查 Python 版本…"
if command -v python3 &>/dev/null; then
    PY=python3
elif command -v python &>/dev/null; then
    PY=python
else
    error "未找到 Python。\n请先安装：https://www.python.org/downloads/macos/\n或通过 Homebrew：brew install python"
fi

PY_VER=$($PY -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PY_MAJOR=$($PY -c "import sys; print(sys.version_info.major)")
PY_MINOR=$($PY -c "import sys; print(sys.version_info.minor)")
if [ "$PY_MAJOR" -lt 3 ] || { [ "$PY_MAJOR" -eq 3 ] && [ "$PY_MINOR" -lt 9 ]; }; then
    error "Python 版本过低（当前 $PY_VER），需要 3.9 或以上。"
fi
info "Python $PY_VER  ($($PY -c 'import platform; print(platform.machine())'))"

# ── 创建虚拟环境 ─────────────────────────────────────────────
VENV_DIR="$(pwd)/.venv"
if [ -d "$VENV_DIR" ]; then
    warn "已检测到虚拟环境，跳过创建。"
else
    step "创建虚拟环境 .venv …"
    $PY -m venv "$VENV_DIR" || error "无法创建虚拟环境。"
    info "虚拟环境创建完成"
fi

PY_VENV="$VENV_DIR/bin/python"
PIP_VENV="$VENV_DIR/bin/pip"

step "升级 pip …"
"$PY_VENV" -m pip install --upgrade pip -q

step "安装依赖包（首次约 2-5 分钟）…"
"$PIP_VENV" install -r requirements.txt -q || error "依赖安装失败，请检查网络连接。"
info "所有依赖已安装"

mkdir -p uploads library
info "数据目录就绪"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}  ✅ 安装完成！  /  설치 완료!${NC}"
echo ""
echo "  下次使用：双击  mac/run.command  启动"
echo "  다음 사용：mac/run.command 더블클릭"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "按回车关闭…  /  엔터를 눌러 닫기…  "
