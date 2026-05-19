@echo off
title Paper Reader - Install
cd /d "%~dp0\.."

echo.
echo ==========================================
echo    Paper Reader  --  First-time Install
echo ==========================================
echo.

:: Check Python
where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found.
    echo Please download and install Python, and check "Add to PATH":
    echo   https://www.python.org/downloads/windows/
    echo.
    pause
    exit /b 1
)

for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PY_VER=%%v
echo [OK] Python %PY_VER%

:: Create virtual environment
if exist ".venv" (
    echo [OK] Virtual environment already exists, skipping.
) else (
    echo [..] Creating virtual environment .venv ...
    python -m venv .venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo [OK] Virtual environment created.
)

:: Install dependencies
echo [..] Installing packages (first time: ~2-5 min) ...
.venv\Scripts\python.exe -m pip install --upgrade pip -q
.venv\Scripts\pip.exe install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Package installation failed. Check your network connection.
    pause
    exit /b 1
)

if not exist "uploads" mkdir uploads
if not exist "library" mkdir library

echo.
echo ==========================================
echo    [OK] Installation complete!
echo.
echo    Next step: run windows\build.bat to build PaperReader.exe
echo ==========================================
echo.
pause
