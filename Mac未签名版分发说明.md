# PaperKnowKnow Mac 未签名版分发说明

这个版本没有 Apple Developer ID 签名，也没有 Apple 公证，所以 macOS 第一次打开时会提示无法验证开发者。这是 Gatekeeper 的正常安全提示，不代表软件一定有问题。

## 给开发者：打包步骤

1. 在 Mac 上打开项目目录。
2. 双击 `mac/install.command`，完成依赖安装。
3. 双击 `mac/build.command`，生成安装包。
4. 打包结果优先生成 `dist/PaperKnowKnow-Mac.dmg`。如果当前 Mac 环境无法创建 DMG，会自动生成 `dist/PaperKnowKnow-Mac-arm64-unsigned.zip`。

注意：在 M 系列 Mac 上打出来的版本只能给 M 系列 Mac 使用；在 Intel Mac 上打出来的版本只能给 Intel Mac 使用。要同时分发给两类用户，最好分别在两种机器上各打一个包。

打包脚本会把 pip 和 PyInstaller 缓存放在项目目录里，避免因为用户目录权限或系统缓存目录不可写导致失败。

## 给用户：安装步骤

1. 下载 `PaperKnowKnow-Mac.dmg` 或 `PaperKnowKnow-Mac-arm64-unsigned.zip`。
2. 如果是 ZIP，先双击解压；如果是 DMG，双击打开。
3. 把 `PaperKnowKnow.app` 拖到「应用程序」文件夹。
4. 第一次启动时，不要直接双击。
5. 在「应用程序」里找到 `PaperKnowKnow.app`，右键点击它，选择「打开」。
6. macOS 弹出安全提示后，再点一次「打开」。

这一步通常只需要做一次。之后就可以像普通应用一样双击启动。

## 如果还是打不开

打开「系统设置」→「隐私与安全性」，在页面下方找到 PaperKnowKnow 的拦截提示，点击「仍要打开」。

如果是从压缩包或聊天软件转发后被额外加了隔离标记，可以在终端运行：

```bash
xattr -dr com.apple.quarantine /Applications/PaperKnowKnow.app
```

## 建议发布文案

这是未签名的 macOS 测试版。由于没有购买 Apple Developer 证书，首次打开需要右键选择「打开」。软件本地运行，PDF 文件保存在本机；AI 分析时会把提取出的论文文本发送给你选择的 AI 服务商。
