#!/usr/bin/env bash
# 论文阅读助手 — Mac 启动  /  논문 읽기 도우미 — Mac 실행
# 双击此文件启动应用  /  이 파일을 더블클릭하여 앱을 실행하세요

cd "$(dirname "$0")/.."   # 回到项目根目录

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}✔  $*${NC}"; }
step()  { echo -e "${CYAN}▶  $*${NC}"; }
warn()  { echo -e "${YELLOW}⚠  $*${NC}"; }
error() { echo -e "${RED}✘  $*${NC}"; echo ""; read -p "按回车关闭…"; exit 1; }

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   论文阅读助手  v1.0  启动中…"
echo "   논문 읽기 도우미  v1.0  시작 중…"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── 选择 Python ──────────────────────────────────────────────
VENV_PY="$(pwd)/.venv/bin/python"
if [ ! -f "$VENV_PY" ]; then
    warn "未找到虚拟环境，请先运行 mac/install.command"
    command -v python3 &>/dev/null && VENV_PY=python3 || \
    command -v python  &>/dev/null && VENV_PY=python  || \
    error "未找到 Python。请先运行 mac/install.command"
    "$VENV_PY" -c "import fastapi, uvicorn, fitz" 2>/dev/null || \
        error "缺少依赖。请先运行 mac/install.command"
fi

# ── 端口检测 ─────────────────────────────────────────────────
PORT=8000
for p in 8000 8001 8002 8003; do
    if ! lsof -iTCP:$p -sTCP:LISTEN -q 2>/dev/null; then
        PORT=$p; break
    fi
done
step "使用端口 $PORT"

mkdir -p uploads library

# ── 启动服务 ─────────────────────────────────────────────────
step "启动后端服务…"
"$VENV_PY" -m uvicorn main:app --host 127.0.0.1 --port $PORT &
SERVER_PID=$!

step "等待服务就绪…"
for i in $(seq 1 30); do
    curl -sf "http://127.0.0.1:$PORT/" >/dev/null 2>&1 && break
    sleep 0.5
done

kill -0 $SERVER_PID 2>/dev/null || error "服务启动失败。\n请先运行 mac/install.command"

info "就绪！正在打开浏览器…"
sleep 0.2
open "http://127.0.0.1:$PORT/"

echo ""
echo "  🌐  http://127.0.0.1:$PORT/"
echo ""
echo -e "${YELLOW}  关闭此窗口 = 关闭应用  /  이 창을 닫으면 앱이 종료됩니다${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

trap "echo ''; echo '正在关闭…'; kill $SERVER_PID 2>/dev/null; exit 0" INT TERM
wait $SERVER_PID
warn "服务已停止。"
read -p "按回车关闭…"
