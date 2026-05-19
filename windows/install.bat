@echo off
title Paper Reader - Install
cd /d "%~dp0\.."
set ROOT=%cd%

echo.
echo ==========================================
echo    Paper Reader  --  First-time Install
echo ==========================================
echo.

:: ── Check / auto-install Python ──────────────────────────────
:check_python
where python >nul 2>&1
if errorlevel 1 goto install_python

for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PY_VER=%%v
echo [OK] Python %PY_VER%
goto python_ready

:install_python
echo [WARN] Python not found. Attempting automatic installation...
echo.

:: Try winget first (Windows 10 1809+ / Windows 11)
where winget >nul 2>&1
if not errorlevel 1 (
    echo [..] Installing Python via winget...
    winget install -e --id Python.Python.3 --silent --accept-package-agreements --accept-source-agreements
    if not errorlevel 1 (
        echo [OK] Python installed via winget.
        for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set "USER_PATH=%%b"
        for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PATH 2^>nul') do set "SYS_PATH=%%b"
        set "PATH=%SYS_PATH%;%USER_PATH%"
        goto check_python
    )
    echo [WARN] winget install failed, trying direct download...
)

:: Fallback: download Python installer silently
echo [..] Downloading Python 3.12 installer (this may take a minute)...
curl -L --progress-bar -o "%TEMP%\python_setup.exe" "https://www.python.org/ftp/python/3.12.10/python-3.12.10-amd64.exe"
if errorlevel 1 (
    echo [ERROR] Download failed. Please install Python manually:
    echo   https://www.python.org/downloads/windows/
    echo   (Check "Add Python to PATH" during installation)
    pause
    exit /b 1
)

echo [..] Installing Python silently...
"%TEMP%\python_setup.exe" /quiet PrependPath=1 Include_test=0
if errorlevel 1 (
    echo [ERROR] Python installation failed.
    echo Please install manually: https://www.python.org/downloads/windows/
    pause
    exit /b 1
)
del "%TEMP%\python_setup.exe" >nul 2>&1

for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set "USER_PATH=%%b"
for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PATH 2^>nul') do set "SYS_PATH=%%b"
set "PATH=%SYS_PATH%;%USER_PATH%"

where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python installed but still not found in PATH.
    echo Please close this window and run install.bat again.
    pause
    exit /b 1
)
echo [OK] Python installed successfully.

:python_ready

:: ── Create virtual environment ────────────────────────────────
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

:: ── Install dependencies ──────────────────────────────────────
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

:: ── Create desktop shortcut ───────────────────────────────────
echo [..] Creating desktop shortcut...
powershell -NoProfile -Command ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$lnk = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Paper Reader.lnk');" ^
  "$lnk.TargetPath = '%ROOT%\windows\run.bat';" ^
  "$lnk.WorkingDirectory = '%ROOT%';" ^
  "$lnk.Description = 'Paper Reader - AI Paper Analysis';" ^
  "$lnk.Save()"
echo [OK] Shortcut created on Desktop: Paper Reader.lnk

echo.
echo ==========================================
echo    [OK] Installation complete!
echo.
echo    Launch: double-click "Paper Reader" on your Desktop
echo    Or run: windows\run.bat
echo ==========================================
echo.
pause
