# macOS 打包脚本说明

本目录有 **两套 Mac 打包方案**。**只有 PyInstaller 这一套是验证过的**。

---

## ✅ 推荐：PyInstaller 路径（已在真实 Mac 上验证可用）

| 脚本 | 作用 |
|------|------|
| `install.command` | 一次性安装：创建 `.venv`、装依赖、装 PyInstaller 6.10.0（用 `.pip-cache` 隔离） |
| `build.command` | 调用 `build_mac.sh` 打包 `.app`，输出到 `dist/` |
| `build.sh` | `build.command` 的底层实现 |
| `run.command` | 开发模式直接运行（不打包，启动 `python main.py`） |

**使用流程：**

```bash
chmod +x mac/*.command mac/*.sh
bash mac/install.command   # 一次
bash mac/build.command     # 每次更新代码后跑一次
```

详细打包注意事项见 [`../docs/AI_MAC_PACKAGING.md`](../docs/AI_MAC_PACKAGING.md)。
分发给用户怎么走见 [`../Mac未签名版分发说明.md`](../Mac未签名版分发说明.md)。

---

## ⚠️ 实验性：python-build-standalone 路径（**未验证可用**）

| 脚本 | 作用 |
|------|------|
| `build_app.sh` | 下载 [python-build-standalone](https://github.com/astral-sh/python-build-standalone)，把它+源码打成 `.app` |
| `build_dmg.sh` | 把上面的 `.app` 装进 `.dmg` |
| `smoke_test.sh` | 启动 `.app`、curl localhost 验证 server 响应 |
| `icon.png` | 用作 `build_app.sh` 在线生成 `.icns` 的源图 |

**这套方案的问题：**

GitHub Actions（`.github/workflows/mac-build.yml`）会在 macOS-14（arm64）和 macOS-13（x86_64）runner 上跑这三个脚本，CI 显示绿色 ✓。但是——

> **绿色 ✓ 只代表 server 在 CI runner 上能启动；不代表生成的 `.app` 在用户真实 Mac 上能正常双击运行。**

在 2026-05 实测中，PBS 产出的 `.app` 在真实 Mac 上**无法工作**。具体原因尚未定位，可能涉及：

- `python-build-standalone` 在 `.app` 包结构里的相对路径解析问题
- Gatekeeper 对未签名的可重定位 Python 二进制的额外校验
- `Info.plist` 中 `LSMinimumSystemVersion` 与 runtime 不一致

如果未来要复活这个路径，**必须在真实 Mac 上做端到端验证**（双击 `.app`，看浏览器是否弹出，使用是否流畅）。CI 绿色不能作为唯一标准。

---

## 不要混用

- 不要在 PyInstaller 路径里调用 PBS 脚本，反之亦然
- 不要给最终用户分发 PBS 路径的产物
- 文档（`使用方法_中文.md`、`User_Guide_English.md`）只指向 PyInstaller 路径
