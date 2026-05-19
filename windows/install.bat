@echo off
chcp 65001 >nul
title 论文阅读助手 - 首次安装
cd /d "%~dp0\.."

echo.
echo ==========================================
echo    论文阅读助手  --  Windows 首次安装
echo ==========================================
echo.

:: 检查 Python
where python >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python。
    echo 请从以下地址下载安装，安装时勾选 Add to PATH：
    echo   https://www.python.org/downloads/windows/
    echo.
    pause
    exit /b 1
)

for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PY_VER=%%v
echo [OK] Python %PY_VER%

:: 创建虚拟环境
if exist ".venv" (
    echo [OK] 已检测到虚拟环境，跳过创建。
) else (
    echo [..] 创建虚拟环境 .venv ...
    python -m venv .venv
    if errorlevel 1 (
        echo [错误] 无法创建虚拟环境。
        pause
        exit /b 1
    )
    echo [OK] 虚拟环境创建完成
)

:: 安装依赖
echo [..] 安装依赖包（首次约 2-5 分钟）...
.venv\Scripts\python.exe -m pip install --upgrade pip -q
.venv\Scripts\pip.exe install -r requirements.txt
if errorlevel 1 (
    echo [错误] 依赖安装失败，请检查网络连接。
    pause
    exit /b 1
)

if not exist "uploads" mkdir uploads
if not exist "library" mkdir library

echo.
echo ==========================================
echo    [OK] 安装完成！
echo.
echo    下一步：双击 windows\build.bat 打包为 .exe
echo ==========================================
echo.
pause
