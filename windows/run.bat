@echo off
title Paper Reader - Dev Mode
cd /d "%~dp0\.."

echo.
echo ==========================================
echo    Paper Reader  --  Starting (Dev Mode)
echo ==========================================
echo.

:: Select Python
set PY=.venv\Scripts\python.exe
if not exist "%PY%" (
    echo [WARN] Virtual environment not found. Run windows\install.bat first.
    echo.
    where python >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Python not found.
        pause
        exit /b 1
    )
    set PY=python
    python -c "import fastapi, uvicorn, fitz" >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Missing dependencies. Run windows\install.bat first.
        pause
        exit /b 1
    )
)

:: Find free port
set PORT=8000
netstat -an | find "0.0.0.0:8000" >nul 2>&1 && set PORT=8001
netstat -an | find "0.0.0.0:%PORT%" >nul 2>&1 && set PORT=8002

echo [..] Using port %PORT%

if not exist "uploads" mkdir uploads
if not exist "library" mkdir library

:: Start server
echo [..] Starting server...
start "" /b %PY% -m uvicorn main:app --host 127.0.0.1 --port %PORT%

:: Wait until ready
echo [..] Waiting for server...
:wait_loop
timeout /t 1 /nobreak >nul
curl -sf http://127.0.0.1:%PORT%/ >nul 2>&1
if errorlevel 1 goto wait_loop

:: Open browser
echo [OK] Ready! Opening browser...
start http://127.0.0.1:%PORT%/

echo.
echo    http://127.0.0.1:%PORT%/
echo    Close this window to stop the server.
echo ==========================================
echo.
%PY% -m uvicorn main:app --host 127.0.0.1 --port %PORT%
pause
