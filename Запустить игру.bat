@echo off
cd /d "%~dp0"
title Biplanes

echo.
echo  ==========================================
echo    BIPLANES - dev server
echo  ==========================================
echo.
echo  Working directory: %CD%
echo.

REM Resolve pnpm path with fallback
set "PNPM_CMD=pnpm"
where pnpm >nul 2>&1
if errorlevel 1 (
    if exist "%APPDATA%\npm\pnpm.cmd" (
        set "PNPM_CMD=%APPDATA%\npm\pnpm.cmd"
        echo  Using pnpm at: %APPDATA%\npm\pnpm.cmd
    ) else (
        echo.
        echo  [ERROR] pnpm not found in PATH and not at %APPDATA%\npm\pnpm.cmd
        echo  Install Node.js from https://nodejs.org then run in PowerShell:
        echo      npm install -g pnpm
        echo.
        pause
        exit /b 1
    )
) else (
    echo  pnpm found in PATH.
)

echo.
echo  Open this URL in your browser when ready:
echo      http://localhost:5173
echo.
echo  (Wait ~5 seconds after server says "ready" before refreshing.)
echo.
echo  To stop the game: close this window.
echo  ==========================================
echo.

"%PNPM_CMD%" dev

echo.
echo  [Server stopped — press any key to close]
pause >nul
