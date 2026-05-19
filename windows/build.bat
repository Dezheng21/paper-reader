@echo off
chcp 65001 >nul
title 论文阅读助手 — 打包为 .exe
cd /d "%~dp0\.."

echo.
echo [▶] 安装 PyInstaller...
.venv\Scripts\pip.exe install pyinstaller -q

echo [▶] 清理旧构建...
if exist build rmdir /s /q build
if exist dist  rmdir /s /q dist

echo [▶] 打包 .exe（约 3-5 分钟）...
.venv\Scripts\python.exe -m PyInstaller paper_reader.spec

if not exist "dist\PaperReader\PaperReader.exe" (
    echo [错误] 打包失败。
    pause & exit /b 1
)

echo.
echo [✔] 打包完成！
echo     位置：%cd%\dist\PaperReader\PaperReader.exe
echo.
explorer dist\PaperReader\
pause
