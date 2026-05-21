@echo off
chcp 65001 >nul
title Biplanes
cd /d "%~dp0"

where pnpm >nul 2>&1
if errorlevel 1 (
    echo.
    echo  [!] pnpm not found.
    echo  Install Node.js from https://nodejs.org and run in PowerShell:
    echo      npm install -g pnpm
    echo.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo.
    echo  First run - installing dependencies (takes about a minute)...
    echo.
    call pnpm install
    if errorlevel 1 (
        echo  [!] pnpm install failed. See errors above.
        pause
        exit /b 1
    )
)

echo.
echo  ==========================================
echo    BIPLANES
echo  ==========================================
echo.
echo    Starting the game...
echo    Browser opens in a few seconds.
echo.
echo    To STOP the game: close this window.
echo.

start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:5173"
call pnpm dev
