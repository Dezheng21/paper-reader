@echo off
title PaperKnowKnow - Build EXE
cd /d "%~dp0\.."

echo.
echo ==========================================
echo    PaperKnowKnow  --  Build Windows EXE
echo ==========================================
echo.

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found.
    echo Please run windows\install.bat first.
    pause
    exit /b 1
)

echo [..] Installing PyInstaller...
.venv\Scripts\pip.exe install pyinstaller -q

echo [..] Cleaning previous build...
if exist build rmdir /s /q build
if exist dist  rmdir /s /q dist

echo [..] Building EXE (this takes 3-8 minutes, please wait)...
.venv\Scripts\python.exe -m PyInstaller paper_reader.spec

if not exist "dist\PaperKnowKnow\PaperKnowKnow.exe" (
    echo [ERROR] Build failed. Check the output above for details.
    pause
    exit /b 1
)

echo [..] Creating ZIP archive...
powershell -NoProfile -Command "Compress-Archive -Path 'dist\PaperKnowKnow' -DestinationPath 'dist\PaperKnowKnow-Windows.zip' -Force"

echo [..] Adding Windows Defender exclusion (speeds up first launch)...
powershell -NoProfile -Command "Add-MpPreference -ExclusionPath '%cd%\dist\PaperKnowKnow'" 2>nul
echo [OK] Defender exclusion added for dist\PaperKnowKnow

echo.
echo ==========================================
echo    [OK] Build complete!
echo.
echo    Distributable: dist\PaperKnowKnow-Windows.zip
echo    Usage: unzip, then double-click PaperKnowKnow.exe
echo    Note: unzip folder should also be added to Defender exclusion
echo          on the user's PC for fast startup.
echo ==========================================
echo.
explorer dist\
pause
