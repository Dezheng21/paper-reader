@echo off
chcp 65001 >nul
title 论文阅读助手 v1.0 - 开发模式
cd /d "%~dp0\.."

echo.
echo ==========================================
echo    论文阅读助手 v1.0  启动中...
echo ==========================================
echo.

:: 选择 Python
set PY=.venv\Scripts\python.exe
if not exist "%PY%" (
    echo [警告] 未找到虚拟环境，请先运行 windows\install.bat
    echo.
    where python >nul 2>&1
    if errorlevel 1 (
        echo [错误] 未找到 Python。
        pause
        exit /b 1
    )
    set PY=python
    python -c "import fastapi, uvicorn, fitz" >nul 2>&1
    if errorlevel 1 (
        echo [错误] 缺少依赖，请先运行 windows\install.bat
        pause
        exit /b 1
    )
)

:: 选空闲端口
set PORT=8000
netstat -an | find "0.0.0.0:8000" >nul 2>&1 && set PORT=8001
netstat -an | find "0.0.0.0:%PORT%" >nul 2>&1 && set PORT=8002

echo [..] 使用端口 %PORT%

if not exist "uploads" mkdir uploads
if not exist "library" mkdir library

:: 启动服务
echo [..] 启动服务...
start "" /b %PY% -m uvicorn main:app --host 127.0.0.1 --port %PORT%

:: 等待就绪
echo [..] 等待服务就绪...
:wait_loop
timeout /t 1 /nobreak >nul
curl -sf http://127.0.0.1:%PORT%/ >nul 2>&1
if errorlevel 1 goto wait_loop

:: 打开浏览器
echo [OK] 就绪！正在打开浏览器...
start http://127.0.0.1:%PORT%/

echo.
echo    http://127.0.0.1:%PORT%/
echo    关闭此窗口 = 关闭应用
echo ==========================================
echo.
%PY% -m uvicorn main:app --host 127.0.0.1 --port %PORT%
pause
