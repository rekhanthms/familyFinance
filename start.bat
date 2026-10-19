@echo off
rem Double-click to start the app again after setup.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\setup-windows.ps1" -Start
echo.
pause
