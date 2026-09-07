@echo off
setlocal enabledelayedexpansion

:: Anchor to current directory
cd /d "%~dp0"

title OmniNode AI - Universal PC and Android ADB Sync Agent

echo =====================================================================
echo          OmniNode AI - Universal PC and Android ADB Sync Agent        
echo =====================================================================
echo.

:: 1. Auto-Pull Latest Updates from GitHub
where git >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    if exist "..\.git" (
        echo [*] Checking for latest OmniNode AI updates from GitHub...
        pushd ..
        git pull origin main --quiet 2>nul
        popd
        echo [OK] Codebase is up to date.
    )
)

:: 2. Check Node.js installation
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed on this system.
    echo Please install Node.js from https://nodejs.org or run:
    echo     winget install OpenJS.NodeJS.LTS
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js detected: 
node --version

:: 3. Check and Install Dependencies
if not exist "node_modules" (
    echo.
    echo [*] Installing minimal required agent dependencies...
    call npm install --no-audit --no-fund
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
)

:: 4. Check for .env or configuration
if not exist ".env" (
    if exist "..\.env" (
        copy ..\.env .env >nul
        echo [*] Copied .env configuration.
    ) else if exist ".env.example" (
        copy .env.example .env >nul
        echo [*] Created .env configuration from template.
    )
)

:: 5. Check ADB (Android Debug Bridge)
where adb >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Android Debug Bridge ADB detected.
) else (
    echo [!] ADB not found in system PATH.
)

echo.
echo =====================================================================
echo   Starting OmniNode Agent... (Connecting PC assets + Android ADB)
echo   Press Ctrl+C at any time to stop.
echo =====================================================================
echo.

node agent.js

echo.
echo [!] OmniNode Agent stopped.
pause
