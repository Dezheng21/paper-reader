#!/usr/bin/env bash
# Smoke test for the EXPERIMENTAL python-build-standalone .app.
# A "pass" here only proves the server starts on a CI runner — it does
# NOT prove the .app launches via Finder on a real Mac. See mac/README.md.
set -e

cd "$(dirname "$0")/.."

APP_NAME="PaperKnowKnow"
APP_BIN="dist/${APP_NAME}.app/Contents/MacOS/${APP_NAME}"

if [[ ! -x "${APP_BIN}" ]]; then
    echo "[FAIL] App binary not found or not executable: ${APP_BIN}"
    exit 1
fi

echo "[..] Launching ${APP_NAME}..."
"${APP_BIN}" >/tmp/pkk_stdout.log 2>/tmp/pkk_stderr.log &
APP_PID=$!
echo "[OK] Started PID=${APP_PID}"

# Cleanup on exit
trap 'echo "[..] Cleanup: kill ${APP_PID}"; kill ${APP_PID} 2>/dev/null || true; wait ${APP_PID} 2>/dev/null || true' EXIT

# Wait up to 30s for the server to respond on any port 8000-8009
echo "[..] Waiting for server (max 30s)..."
SUCCESS_PORT=""
for i in $(seq 1 60); do
    for port in 8000 8001 8002 8003 8004 8005 8006 8007 8008 8009; do
        if curl -sf -o /dev/null --max-time 1 "http://127.0.0.1:${port}/"; then
            SUCCESS_PORT="${port}"
            break 2
        fi
    done
    sleep 0.5
done

if [[ -z "${SUCCESS_PORT}" ]]; then
    echo
    echo "[FAIL] Server did not respond within 30 seconds."
    echo "── stdout ──"
    cat /tmp/pkk_stdout.log || true
    echo "── stderr ──"
    cat /tmp/pkk_stderr.log || true
    exit 1
fi

echo "[OK] Server responding on port ${SUCCESS_PORT}"

# Probe a few endpoints
echo "[..] Verifying endpoints..."
for path in "/" "/static/app.js" "/favicon.ico"; do
    code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${SUCCESS_PORT}${path}")
    if [[ "${code}" =~ ^(200|404)$ ]]; then
        echo "    ${path} → ${code} ✓"
    else
        echo "    ${path} → ${code} ✗"
        exit 1
    fi
done

echo
echo "=========================================="
echo "  [OK] Smoke test passed"
echo "=========================================="
