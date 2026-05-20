#!/usr/bin/env bash
# Build a self-contained PaperKnowKnow.app bundle for macOS.
# Uses python-build-standalone (relocatable Python) — no system Python required.
set -e

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

APP_NAME="PaperKnowKnow"
APP_VERSION="2.0.0"
BUNDLE_ID="com.aiknowknow.paperknowknow"
DIST_DIR="dist"
APP_DIR="${DIST_DIR}/${APP_NAME}.app"

# Detect architecture (arm64 for Apple Silicon, x86_64 for Intel)
ARCH="$(uname -m)"
if [[ "$ARCH" == "arm64" ]]; then
    PY_ARCH="aarch64-apple-darwin"
elif [[ "$ARCH" == "x86_64" ]]; then
    PY_ARCH="x86_64-apple-darwin"
else
    echo "[ERROR] Unsupported architecture: $ARCH"
    exit 1
fi

# python-build-standalone — latest 3.12 LTS release
# Update the date+version as new releases come out
PY_VERSION="3.12.10"
PY_BUILD_DATE="20251007"  # update from https://github.com/astral-sh/python-build-standalone/releases
PY_FILE="cpython-${PY_VERSION}+${PY_BUILD_DATE}-${PY_ARCH}-install_only.tar.gz"
PY_URL="https://github.com/astral-sh/python-build-standalone/releases/download/${PY_BUILD_DATE}/${PY_FILE}"

echo
echo "=========================================="
echo "  ${APP_NAME} — Build macOS .app bundle"
echo "  arch: ${ARCH}  ·  py: ${PY_VERSION}"
echo "=========================================="
echo

# ── Step 1: Download python-build-standalone ─────────────────
mkdir -p "${DIST_DIR}"
if [[ ! -d "${DIST_DIR}/python-standalone" ]]; then
    echo "[..] Downloading python-build-standalone (~30 MB)..."
    curl -L --fail --progress-bar -o "${DIST_DIR}/python.tar.gz" "${PY_URL}"
    echo "[..] Extracting..."
    tar -xzf "${DIST_DIR}/python.tar.gz" -C "${DIST_DIR}"
    mv "${DIST_DIR}/python" "${DIST_DIR}/python-standalone"
    rm "${DIST_DIR}/python.tar.gz"
    echo "[OK] Python ${PY_VERSION} ready."
else
    echo "[OK] Python already downloaded, skipping."
fi

# ── Step 2: Install dependencies into bundled Python ─────────
if [[ ! -d "${DIST_DIR}/python-standalone/lib/python3.12/site-packages/fastapi" ]]; then
    echo "[..] Installing dependencies (~2 min)..."
    "${DIST_DIR}/python-standalone/bin/python3" -m pip install --no-warn-script-location -q -r requirements.txt
    echo "[OK] Dependencies installed."
else
    echo "[OK] Dependencies already installed, skipping."
fi

# ── Step 3: Build .app bundle skeleton ───────────────────────
echo "[..] Building .app bundle..."
rm -rf "${APP_DIR}"
mkdir -p "${APP_DIR}/Contents/MacOS"
mkdir -p "${APP_DIR}/Contents/Resources/app"

# Copy source
cp main.py ai_analyzer.py pdf_parser.py battle.py requirements.txt "${APP_DIR}/Contents/Resources/app/"
cp -r static "${APP_DIR}/Contents/Resources/app/"

# Copy bundled Python
cp -r "${DIST_DIR}/python-standalone" "${APP_DIR}/Contents/Resources/python"

# ── Step 4: Generate Info.plist ──────────────────────────────
cat > "${APP_DIR}/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleDisplayName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleIdentifier</key>
    <string>${BUNDLE_ID}</string>
    <key>CFBundleVersion</key>
    <string>${APP_VERSION}</string>
    <key>CFBundleShortVersionString</key>
    <string>${APP_VERSION}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>CFBundleExecutable</key>
    <string>${APP_NAME}</string>
    <key>CFBundleIconFile</key>
    <string>icon.icns</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSUIElement</key>
    <false/>
</dict>
</plist>
PLIST

# ── Step 5: Generate launcher (entry point) ──────────────────
cat > "${APP_DIR}/Contents/MacOS/${APP_NAME}" <<'LAUNCHER'
#!/usr/bin/env bash
# Entry point — invoked by macOS when user opens the .app
HERE="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON="${HERE}/Resources/python/bin/python3"
APP_ROOT="${HERE}/Resources/app"

cd "${APP_ROOT}"
exec "${PYTHON}" main.py
LAUNCHER
chmod +x "${APP_DIR}/Contents/MacOS/${APP_NAME}"

# ── Step 6: Build .icns icon from mac/icon.png ───────────────
if [[ -f "mac/icon.png" ]]; then
    echo "[..] Generating icon.icns..."
    ICONSET="${DIST_DIR}/icon.iconset"
    rm -rf "${ICONSET}"
    mkdir -p "${ICONSET}"
    SRC="mac/icon.png"
    sips -z 16 16     "${SRC}" --out "${ICONSET}/icon_16x16.png"      >/dev/null
    sips -z 32 32     "${SRC}" --out "${ICONSET}/icon_16x16@2x.png"   >/dev/null
    sips -z 32 32     "${SRC}" --out "${ICONSET}/icon_32x32.png"      >/dev/null
    sips -z 64 64     "${SRC}" --out "${ICONSET}/icon_32x32@2x.png"   >/dev/null
    sips -z 128 128   "${SRC}" --out "${ICONSET}/icon_128x128.png"    >/dev/null
    sips -z 256 256   "${SRC}" --out "${ICONSET}/icon_128x128@2x.png" >/dev/null
    sips -z 256 256   "${SRC}" --out "${ICONSET}/icon_256x256.png"    >/dev/null
    sips -z 512 512   "${SRC}" --out "${ICONSET}/icon_256x256@2x.png" >/dev/null
    sips -z 512 512   "${SRC}" --out "${ICONSET}/icon_512x512.png"    >/dev/null
    sips -z 1024 1024 "${SRC}" --out "${ICONSET}/icon_512x512@2x.png" >/dev/null
    iconutil -c icns "${ICONSET}" -o "${APP_DIR}/Contents/Resources/icon.icns"
    rm -rf "${ICONSET}"
    echo "[OK] Icon generated."
fi

# ── Step 7: Remove quarantine on the bundled binaries ────────
# (in case extracted archives carry the com.apple.quarantine attribute)
xattr -dr com.apple.quarantine "${APP_DIR}" 2>/dev/null || true

echo
echo "=========================================="
echo "  [OK] Built: ${APP_DIR}"
echo "  Size: $(du -sh "${APP_DIR}" | cut -f1)"
echo "=========================================="
