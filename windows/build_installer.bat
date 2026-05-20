@echo off
title PaperKnowKnow - Build Installer
cd /d "%~dp0\.."

echo.
echo ==========================================
echo    PaperKnowKnow - Build Windows Installer
echo ==========================================
echo.

:: ── Step 1: Download Python embeddable ──────────────────────
set PY_VER=3.12.10
set PY_ZIP=python-%PY_VER%-embed-amd64.zip
set PY_URL=https://www.python.org/ftp/python/%PY_VER%/%PY_ZIP%
set EMBED_DIR=dist\python-embed

if exist "%EMBED_DIR%\python.exe" (
    echo [OK] Python embeddable already downloaded, skipping.
) else (
    echo [..] Downloading Python %PY_VER% embeddable...
    if not exist "dist" mkdir dist
    curl -L --progress-bar -o "dist\%PY_ZIP%" "%PY_URL%"
    if errorlevel 1 (
        echo [ERROR] Download failed.
        pause
        exit /b 1
    )
    echo [..] Extracting...
    if exist "%EMBED_DIR%" rd /s /q "%EMBED_DIR%"
    mkdir "%EMBED_DIR%"
    powershell -NoProfile -Command "Expand-Archive -Path 'dist\%PY_ZIP%' -DestinationPath '%EMBED_DIR%' -Force"
    del "dist\%PY_ZIP%"
    echo [OK] Python embeddable ready.
)

:: ── Step 2: Enable pip + add install-root to sys.path ──────────
:: Remove "import site" comment to enable pip, and add "..\" so
:: main.py's directory (one level up from python\) is on sys.path.
for %%f in (%EMBED_DIR%\python*._pth) do (
    powershell -NoProfile -Command "(Get-Content '%%f') -replace '^#import site','import site' | Set-Content '%%f' -Encoding ascii"
    powershell -NoProfile -Command "if (-not (Select-String -Path '%%f' -Pattern '^\.\.\\$' -Quiet)) { Add-Content -Path '%%f' -Value '..\' -Encoding ascii }"
    echo [OK] Configured %%~nxf
)

:: Download get-pip.py (embeddable Python doesn't ship with ensurepip)
if exist "dist\get-pip.py" (
    echo [OK] get-pip.py already downloaded, skipping.
) else (
    echo [..] Downloading get-pip.py...
    curl -L --progress-bar -o "dist\get-pip.py" "https://bootstrap.pypa.io/get-pip.py"
    if errorlevel 1 (
        echo [ERROR] Failed to download get-pip.py
        pause
        exit /b 1
    )
    echo [OK] get-pip.py downloaded.
)

:: ── Step 3: Create launcher script ──────────────────────────
echo [..] Creating launcher script...
(
echo @echo off
echo title PaperKnowKnow
echo cd /d "%%~dp0"
echo echo.
echo echo    PaperKnowKnow  --  Starting...
echo echo.
echo echo    Keep this window open while using the app.
echo echo    Close this window to stop the server.
echo echo.
echo python\python.exe main.py
) > dist\launch.bat
echo [OK] Launcher created.

:: ── Step 4: Compile installer ───────────────────────────────
echo [..] Compiling installer with Inno Setup...

:: Find ISCC.exe
set ISCC=
for %%p in (
    "%ProgramFiles%\Inno Setup 6\ISCC.exe"
    "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
    "%LocalAppData%\Programs\Inno Setup 6\ISCC.exe"
) do (
    if exist %%p set ISCC=%%~p
)

if "%ISCC%"=="" (
    echo [ERROR] Inno Setup not found. Please install it first.
    echo   winget install -e --id JRSoftware.InnoSetup
    pause
    exit /b 1
)

"%ISCC%" windows\installer.iss
if errorlevel 1 (
    echo [ERROR] Installer build failed.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo    [OK] Build complete!
echo.
echo    Installer: dist\PaperKnowKnow-Setup.exe
echo ==========================================
echo.
pause
