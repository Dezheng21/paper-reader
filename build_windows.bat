@echo off
echo ==> Installing dependencies...
pip install -r requirements.txt
pip install pyinstaller

echo ==> Cleaning previous build...
if exist build rmdir /s /q build
if exist dist  rmdir /s /q dist

echo ==> Building .exe...
pyinstaller paper_reader.spec

echo.
echo Done! App is at: dist\PaperReader\PaperReader.exe
echo Data will be stored in: %%APPDATA%%\PaperReader\
pause
