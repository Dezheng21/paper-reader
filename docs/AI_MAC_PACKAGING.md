# PaperKnowKnow macOS unsigned packaging playbook for AI agents

本文档写给后续接手项目的 AI。目标是阶段性地在 Mac 上为普通 macOS 用户打包未签名版本，不购买 Apple Developer Program。

## 目标产物

- 分发文件：`dist/PaperKnowKnow-Mac-arm64-unsigned.zip`
- App 文件：压缩包内的 `PaperKnowKnow.app`
- 适用架构：在 Apple Silicon Mac 上打出的包只保证适用于 Apple Silicon / arm64 Mac。
- 签名状态：未使用 Apple Developer ID，不做 notarization。首次运行仍需要用户右键打开。

## 当前稳定方案

1. 在 macOS 上进入项目根目录。
2. 确认没有其他 PyInstaller 打包进程正在运行。
3. 清理旧环境和旧产物：

```bash
find .venv build dist .pip-cache .pyinstaller-cache .pycache-build .pycache-check -depth \( -type f -o -type l \) -delete 2>/dev/null || true
find .venv build dist .pip-cache .pyinstaller-cache .pycache-build .pycache-check -depth -type d -empty -delete 2>/dev/null || true
```

4. 创建干净虚拟环境并安装依赖：

```bash
python3 -m venv --clear .venv
.venv/bin/python -m pip install --upgrade pip setuptools wheel
.venv/bin/pip install -r requirements.txt pyinstaller==6.10.0
```

5. 做快速导入检查：

```bash
PYTHONPYCACHEPREFIX=.pycache-check .venv/bin/python -m py_compile main.py ai_analyzer.py pdf_parser.py
.venv/bin/python - <<'PY'
import fastapi, starlette, uvicorn, fitz
from starlette.middleware.base import BaseHTTPMiddleware
from google import genai
from google.genai import types
print("ok", fastapi.__version__, starlette.__version__, uvicorn.__version__)
PY
```

6. 打包：

```bash
PYINSTALLER_CONFIG_DIR=.pyinstaller-cache \
PYTHONPYCACHEPREFIX=.pycache-build \
.venv/bin/python -m PyInstaller --noconfirm --clean --distpath dist --workpath build paper_reader.spec
```

7. 清除隔离属性并做 ad-hoc 签名：

```bash
xattr -cr dist/PaperKnowKnow.app 2>/dev/null || true
codesign --force --deep --sign - dist/PaperKnowKnow.app 2>/dev/null || true
```

8. 生成最终 ZIP：

```bash
rm -f dist/PaperKnowKnow-Mac-arm64-unsigned.zip
ditto -c -k --keepParent dist/PaperKnowKnow.app dist/PaperKnowKnow-Mac-arm64-unsigned.zip
```

9. 做最小启动检查：

```bash
./dist/PaperKnowKnow.app/Contents/MacOS/PaperKnowKnow &
sleep 2
curl -fsS http://127.0.0.1:8000/ | head -3
```

如果网页返回 `<!DOCTYPE html>`，说明后端和静态页面基本可用。检查后结束测试进程。

10. 清理不需要提交的产物：

```bash
find build .venv .pip-cache .pyinstaller-cache .pycache-build .pycache-check -depth \( -type f -o -type l \) -delete 2>/dev/null || true
find build .venv .pip-cache .pyinstaller-cache .pycache-build .pycache-check -depth -type d -empty -delete 2>/dev/null || true
```

不要提交 `dist/`，最终 ZIP 只用于本地分发。

## 已知问题和规避方法

### 1. Gatekeeper 提示“无法验证开发者”

原因：未购买 Apple Developer ID，未 notarize。

规避：

- 这是未签名版的预期行为，不能完全消除。
- 用户首次打开时使用：右键 `PaperKnowKnow.app` -> `打开` -> 再点 `打开`。
- 如果仍被拦截，让用户到 `系统设置` -> `隐私与安全性` -> `仍要打开`。

不要承诺未签名版本可以像正式签名软件一样无提示启动。

### 2. `tkinter` / Tcl/Tk 崩溃

现象：macOS 崩溃报告里出现 `TkpInit`、`Tcl_Panic`、`_tkinter.cpython-39-darwin.so`。

原因：PyInstaller 打包后调用系统 Tk，某些 macOS 版本会直接 abort。

规避：

- 打包入口不要使用 `tkinter`。
- `paper_reader.spec` 里排除 `tkinter` 和 `_tkinter`。
- App 模式只启动本地 FastAPI 服务并自动打开浏览器。
- 只在启动失败时尝试用 `osascript` 弹错误提示，不要用常驻弹窗挡住网页。

### 3. 常驻运行提示弹窗遮挡浏览器

现象：页面能打开，但中央一直显示 “PaperKnowKnow 正在运行” 对话框。

原因：使用 `osascript display dialog` 作为运行状态窗口。

规避：

- 不要在服务正常运行时弹常驻对话框。
- 正常路径只打开浏览器并让进程保持运行。
- 失败路径才显示一次错误提示。

### 4. 缺失 `battle.py` 导致启动失败

现象：仓库中引用 `import battle as bt`，但仓库没有 `battle.py` 时，应用启动失败。

规避：

- `main.py` 里用 `try/except ImportError` 包住 `battle`。
- 缺失时只让 `/battle/*` 接口返回 503，不影响论文阅读主流程。

### 5. 用户目录缓存不可写

现象：

- `PermissionError: ~/Library/Application Support/pyinstaller`
- `PermissionError: ~/Library/Caches/...`

规避：

- 打包时设置项目内缓存目录：

```bash
PYINSTALLER_CONFIG_DIR=.pyinstaller-cache
PYTHONPYCACHEPREFIX=.pycache-build
```

- pip 安装时可使用项目内缓存：

```bash
--cache-dir "$(pwd)/.pip-cache"
```

### 6. 不要并发运行 PyInstaller

现象：

- `rthooks.dat: unexpected EOF`
- `modulegraph.util has no attribute iterate_instructions`
- 一些模块明明存在却导入失败

原因：同时或连续异常中断多个 PyInstaller 进程，可能造成缓存或环境处于半写入状态。

规避：

- 同一时间只跑一个打包进程。
- 如果打包异常慢或被中断，先完整清理 `.venv`、`build`、`dist`、`.pyinstaller-cache`，再重建环境。
- 不要在一个半坏的 `.venv` 里继续修修补补。

### 7. `collect_all('uvicorn')` / `collect_all('fastapi')` 不稳定

现象：

- PyInstaller 尝试收集已经不存在的 uvicorn 文件。
- 打包变慢，或者因依赖版本变化失败。

规避：

- 不要全量 `collect_all('uvicorn')` 或 `collect_all('fastapi')`。
- 在 `paper_reader.spec` 中保留必要 hidden imports 即可。

### 8. `hdiutil create` 失败

现象：`hdiutil: create failed - 设备未配置`。

原因：某些受限环境不能创建 DMG。

规避：

- `mac/build.sh` 优先创建 DMG。
- 如果 DMG 失败，自动 fallback 到 ZIP。
- 阶段性分发给测试用户时，ZIP 足够。

### 9. 代码签名警告

现象：`resource fork, Finder information, or similar detritus not allowed`。

规避：

```bash
xattr -cr dist/PaperKnowKnow.app
codesign --force --deep --sign - dist/PaperKnowKnow.app
```

这是 ad-hoc 签名，不等同于 Apple Developer ID 签名，也不会消除 Gatekeeper 首次打开提示。

### 10. App 图标

当前图标文件：

- 源图：`assets/app-icon-source.jpg`
- macOS 图标：`icon.icns`

`paper_reader.spec` 会在 macOS 打包时自动使用根目录的 `icon.icns`。

注意：

- 不要在每次打包时重新生成图标。
- 如果必须换图标，生成新的 `icon.icns` 后先确认：

```bash
file icon.icns
```

应显示 `Mac OS X icon`。

## 发给 Mac 用户的简短说明

1. 下载 `PaperKnowKnow-Mac-arm64-unsigned.zip`。
2. 双击解压。
3. 把 `PaperKnowKnow.app` 拖到「应用程序」。
4. 第一次不要直接双击，右键选择「打开」。
5. macOS 弹出提示后，再点「打开」。

## 提交规则

应该提交：

- `main.py`
- `paper_reader.spec`
- `requirements.txt`
- `build_mac.sh`
- `mac/build.sh`
- `mac/build.command`
- `icon.icns`
- `assets/app-icon-source.jpg`
- `docs/AI_MAC_PACKAGING.md`

不要提交：

- `dist/`
- `build/`
- `.venv/`
- `.pip-cache/`
- `.pyinstaller-cache/`
- `.pycache-*`
- 用户本地上传的 PDF 或分析数据
