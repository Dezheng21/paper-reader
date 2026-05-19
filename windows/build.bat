@echo off
chcp 65001 >nul
title 论文阅读助手 - 打包 .exe
cd /d "%~dp0\.."

echo.
echo ==========================================
echo    论文阅读助手  --  Windows 打包
echo ==========================================
echo.

if not exist ".venv\Scripts\python.exe" (
    echo [错误] 未找到虚拟环境，请先运行 windows\install.bat
    pause
    exit /b 1
)

echo [..] 安装 PyInstaller...
.venv\Scripts\pip.exe install pyinstaller -q

echo [..] 清理旧构建...
if exist build rmdir /s /q build
if exist dist  rmdir /s /q dist

echo [..] 打包 .exe，约 3-8 分钟，请耐心等待...
.venv\Scripts\python.exe -m PyInstaller paper_reader.spec

if not exist "dist\PaperReader\PaperReader.exe" (
    echo [错误] 打包失败，请查看上方错误信息。
    pause
    exit /b 1
)

echo [..] 压缩为 zip...
powershell -NoProfile -Command "Compress-Archive -Path 'dist\PaperReader' -DestinationPath 'dist\PaperReader-Windows.zip' -Force"

echo.
echo ==========================================
echo    [OK] 打包完成！
echo.
echo    分发文件: dist\PaperReader-Windows.zip
echo    使用方法: 解压 zip，双击 PaperReader.exe
echo ==========================================
echo.
explorer dist\
pause
