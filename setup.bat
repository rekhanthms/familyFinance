@echo off
rem Double-click this file. It installs what is missing, then builds and starts the app.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\setup-windows.ps1"
echo.
pause
