#!/usr/bin/env bash
# Wrap the .app in a .dmg disk image for distribution.
set -e

cd "$(dirname "$0")/.."

APP_NAME="PaperKnowKnow"
DIST_DIR="dist"
APP_DIR="${DIST_DIR}/${APP_NAME}.app"
DMG_FILE="${DIST_DIR}/${APP_NAME}-$(uname -m).dmg"

# Build the .app first if missing
if [[ ! -d "${APP_DIR}" ]]; then
    bash mac/build_app.sh
fi

echo
echo "[..] Creating ${DMG_FILE}..."

rm -f "${DMG_FILE}"
hdiutil create \
    -volname "${APP_NAME}" \
    -srcfolder "${APP_DIR}" \
    -ov \
    -format UDZO \
    "${DMG_FILE}"

echo
echo "=========================================="
echo "  [OK] DMG ready: ${DMG_FILE}"
echo "  Size: $(du -sh "${DMG_FILE}" | cut -f1)"
echo "=========================================="
