@echo off
setlocal enabledelayedexpansion

:: Anchor to current directory
cd /d "%~dp0"

title OmniNode AI - Universal Launcher and Installer

echo =====================================================================
echo          OmniNode AI - Universal All-in-One Setup and Launcher        
echo =====================================================================
echo.

set "REPO_URL=https://github.com/sammysam254/omninode-ai.git"

:: 1. Check Git and Bootstrap Repository if needed
where git >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    if not exist "web" (
        echo [*] Fresh standalone installation detected.
        echo [*] Cloning OmniNode AI codebase from GitHub...
        git clone %REPO_URL% temp_clone
        if exist "temp_clone" (
            xcopy /E /Y /Q temp_clone\* . >nul
            rmdir /S /Q temp_clone
            echo [OK] Codebase cloned successfully.
        )
    ) else if exist ".git" (
        echo [*] Checking for latest updates from GitHub...
        git pull origin main --quiet 2>nul
        echo [OK] Codebase is up to date.
    )
) else (
    echo [!] Git not found in system PATH. Proceeding with local files.
)

:: 2. Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] Node.js not found on this system.
    echo [*] Attempting automated installation via winget...
    winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Automated Node.js installation failed.
        echo Please download and install Node.js from https://nodejs.org
        pause
        exit /b 1
    )
    echo [OK] Node.js installed.
)

echo [OK] Node.js detected:
node --version

:: 3. Setup Agent Dependencies
echo.
echo [*] Checking Agent dependencies...
if not exist "agent\node_modules" (
    echo [*] Installing Agent dependencies in agent folder...
    pushd agent
    call npm install --no-audit --no-fund
    popd
)

:: 4. Setup Web Dashboard Dependencies
echo [*] Checking Web Dashboard dependencies...
if not exist "web\node_modules" (
    echo [*] Installing Web dependencies in web folder...
    pushd web
    call npm install --no-audit --no-fund
    popd
)

:: 5. Ensure Environment Configurations
if not exist "agent\.env" (
    if exist ".env" (
        copy .env agent\.env >nul
    ) else (
        (
            echo SUPABASE_URL=https://xfednxvbjzfssxyaurbc.supabase.co
            echo SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmZWRueHZianpmc3N4eWF1cmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MDQxNzIsImV4cCI6MjEwNDM4MDE3Mn0.2CRXJvkmTUaFXkyGxaSUY0OS1ZCxr0EwLFxJljiFqjc
        ) > agent\.env
    )
)

if not exist "web\.env" (
    if exist ".env.netlify" (
        copy .env.netlify web\.env >nul
    ) else (
        (
            echo VITE_SUPABASE_URL=https://xfednxvbjzfssxyaurbc.supabase.co
            echo VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmZWRueHZianpmc3N4eWF1cmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MDQxNzIsImV4cCI6MjEwNDM4MDE3Mn0.2CRXJvkmTUaFXkyGxaSUY0OS1ZCxr0EwLFxJljiFqjc
        ) > web\.env
    )
)

:: 6. Check Android Debug Bridge (ADB)
echo.
where adb >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Android Debug Bridge ADB detected.
) else (
    echo [!] ADB not in system PATH.
)

echo.
echo =====================================================================
echo   [1/2] Launching Web Dashboard on http://localhost:5173...
echo   [2/2] Starting Universal PC and Android ADB Sync Agent...
echo =====================================================================
echo.

:: Launch Web Server in a separate background window
start "OmniNode AI - Web Dashboard Server" cmd /c "cd /d ""%~dp0web"" && npm run dev"

:: Wait 3 seconds for web server to initialize then open default browser
timeout /t 3 /nobreak >nul
start http://localhost:5173

:: Launch Agent in the main window
cd /d "%~dp0agent"
node agent.js

echo.
echo [!] OmniNode Agent stopped.
pause
