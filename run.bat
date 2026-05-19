@echo off
title Paper Reader
echo ============================
echo   Paper Reader - Starting
echo ============================
echo.
echo Browser will open automatically.
echo Press Ctrl+C to stop.
echo.
cd /d "%~dp0"
python main.py
pause
