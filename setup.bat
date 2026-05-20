@echo off
title PaperKnowKnow - Setup
echo Installing dependencies...
cd /d "%~dp0"
pip install -r requirements.txt
echo.
echo Done. Run run.bat to start.
pause
