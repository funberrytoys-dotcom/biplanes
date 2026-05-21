@echo off
chcp 65001 >nul
title Biplanes
cd /d "%~dp0"

REM Find pnpm: try PATH, then npm global folder explicitly.
set "PNPM_CMD=pnpm"
where pnpm >nul 2>&1
if errorlevel 1 (
    if exist "%APPDATA%\npm\pnpm.cmd" (
        set "PNPM_CMD=%APPDATA%\npm\pnpm.cmd"
    ) else (
        echo.
        echo  [ERROR] pnpm not found.
        echo.
        echo  To fix this, open PowerShell and run:
        echo      npm install -g pnpm
        echo.
        echo  If you don't have Node.js, install from https://nodejs.org first.
        echo.
        pause
        exit /b 1
    )
)

if not exist "node_modules\" (
    echo.
    echo  First run - installing dependencies (about a minute)...
    echo.
    call "%PNPM_CMD%" install
    if errorlevel 1 (
        echo.
        echo  [ERROR] Install failed. See messages above.
        pause
        exit /b 1
    )
)

echo.
echo  ==========================================
echo    BIPLANES
echo  ==========================================
echo.
echo    Starting the game on http://localhost:5173
echo    Browser will open in about 4 seconds.
echo.
echo    To STOP: close this window.
echo.

start "" cmd /c "timeout /t 4 /nobreak >nul && start http://localhost:5173"
call "%PNPM_CMD%" dev

echo.
echo  [Server stopped]
pause
