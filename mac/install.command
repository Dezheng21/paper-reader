#!/usr/bin/env bash
# 论文阅读助手 — Mac 首次安装
# 双击此文件完成一键安装

set -e
cd "$(dirname "$0")/.."

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}✔  $*${NC}"; }
step()  { echo -e "${CYAN}▶  $*${NC}"; }
warn()  { echo -e "${YELLOW}⚠  $*${NC}"; }
error() { echo -e "${RED}✘  $*${NC}"; echo ""; echo "安装失败，请截图此窗口反馈。"; read -p "按回车关闭…"; exit 1; }

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   论文阅读助手  —  Mac 首次安装"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 加载 Homebrew 环境（M 系列 Mac 路径）────────────────────────
_load_brew() {
    if [ -f /opt/homebrew/bin/brew ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [ -f /usr/local/bin/brew ]; then
        eval "$(/usr/local/bin/brew shellenv)"
    fi
}
_load_brew

# ── 查找可用 Python（≥3.9）──────────────────────────────────────
_find_python() {
    for candidate in python3 python3.13 python3.12 python3.11 python3.10 python3.9; do
        if command -v "$candidate" &>/dev/null; then
            local ver
            ver=$("$candidate" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null) || continue
            local major minor
            major=$(echo "$ver" | cut -d. -f1)
            minor=$(echo "$ver" | cut -d. -f2)
            if [ "$major" -ge 3 ] && [ "$minor" -ge 9 ]; then
                echo "$candidate"; return 0
            fi
        fi
    done
    return 1
}

# ── 检查 / 自动安装 Python ───────────────────────────────────────
step "检查 Python 版本…"
if PY=$(_find_python); then
    PY_VER=$("$PY" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    info "Python $PY_VER 已就绪"
else
    warn "未找到 Python 3.9+，即将自动安装…"
    echo ""

    # 尝试通过 Homebrew 安装
    if ! command -v brew &>/dev/null; then
        step "安装 Homebrew（这需要几分钟，过程中可能要求输入密码）…"
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" \
            || error "Homebrew 安装失败。\n请手动安装 Python：https://www.python.org/downloads/macos/"
        _load_brew
        info "Homebrew 安装完成"
    fi

    step "通过 Homebrew 安装 Python 3…"
    brew install python3 || error "Python 安装失败。\n请手动安装：https://www.python.org/downloads/macos/"
    _load_brew

    if PY=$(_find_python); then
        PY_VER=$("$PY" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
        info "Python $PY_VER 安装完成"
    else
        error "Python 安装后仍无法找到，请手动安装：\nhttps://www.python.org/downloads/macos/"
    fi
fi

# ── 创建虚拟环境 ─────────────────────────────────────────────────
VENV_DIR="$(pwd)/.venv"
if [ -d "$VENV_DIR" ]; then
    warn "已检测到虚拟环境，跳过创建。"
else
    step "创建虚拟环境 .venv …"
    "$PY" -m venv "$VENV_DIR" || error "无法创建虚拟环境。"
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
echo -e "${GREEN}  ✅ 安装完成！${NC}"
echo ""
echo "  下一步：双击 mac/build.sh 打包为 .app"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
read -p "按回车关闭…  "
