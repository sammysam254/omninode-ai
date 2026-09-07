@echo off
setlocal enabledelayedexpansion

:: 1. Anchor working directory to script location
cd /d "%~dp0"

title OmniNode AI - Universal Setup and Launcher

echo =====================================================================
echo          OmniNode AI - Universal All-in-One Setup and Launcher        
echo =====================================================================
echo.

set "REPO_URL=https://github.com/sammysam254/omninode-ai.git"

:: 2. Safely free port 5173 if occupied by previous session
powershell -NoProfile -Command "try { Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } } catch {}" >nul 2>&1

:: 3. Check Git and update repository
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
    echo [!] Git not in PATH. Proceeding with local files.
)

:: 4. Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [!] Node.js not found on this system.
    echo [*] Attempting automated installation via winget...
    winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Automated Node.js installation failed.
        echo Please download and install Node.js from https://nodejs.org
        echo.
        pause
        exit /b 1
    )
    echo [OK] Node.js installed.
)

echo [OK] Node.js detected:
node --version

:: 5. Install Dependencies if needed
if not exist "agent\node_modules" (
    echo [*] Installing Agent dependencies...
    pushd agent
    call npm install --no-audit --no-fund
    popd
)

if not exist "web\node_modules" (
    echo [*] Installing Web dependencies...
    pushd web
    call npm install --no-audit --no-fund
    popd
)

:: 6. Ensure Environment Files with Supabase Keys
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

:: 7. Check ADB
where adb >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Android Debug Bridge ADB detected.
) else (
    echo [!] Using bundled ADB in agent/bin.
)

echo.
echo =====================================================================
echo   [1/2] Launching Web Dashboard on http://localhost:5173...
echo   [2/2] Starting Universal PC and Android ADB Sync Agent...
echo =====================================================================
echo.

:: Launch Web Server in background window (uses cmd /k so it stays open)
start "OmniNode_Web_Server" cmd /k "cd /d ""%~dp0web"" && npm run dev"

:: Open Browser after 3 seconds
timeout /t 3 /nobreak >nul
start http://localhost:5173

:: Enter agent directory and run agent with restart guard
cd /d "%~dp0agent"

:run_agent
echo [*] Starting OmniNode Realtime Sync Agent...
node agent.js
echo.
echo [!] OmniNode Agent process ended.
echo =====================================================================
echo Press any key to restart the OmniNode Agent, or close this window.
echo =====================================================================
pause
goto run_agent
