#!/usr/bin/env bash
# OmniNode AI - Universal All-in-One Setup & Launcher (Linux / macOS)

echo "====================================================================="
echo "         OmniNode AI - Universal All-in-One Setup & Launcher        "
echo "====================================================================="
echo ""

REPO_URL="https://github.com/sammysam254/omninode-ai.git"

# 1. Check Git & Bootstrap Repository if needed
if command -v git &> /dev/null; then
    if [ ! -d "web" ]; then
        echo "[*] Fresh standalone installation detected."
        echo "[*] Cloning OmniNode AI codebase from GitHub..."
        git clone "$REPO_URL" temp_clone
        if [ -d "temp_clone" ]; then
            cp -rn temp_clone/* .
            rm -rf temp_clone
            echo "[OK] Codebase cloned successfully."
        fi
    elif [ -d ".git" ]; then
        echo "[*] Checking for latest updates from GitHub..."
        git pull origin main --quiet 2>/dev/null
        echo "[OK] Codebase is up to date."
    fi
fi

# 2. Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed. Please install Node.js v18+ from https://nodejs.org."
    exit 1
fi

echo "[OK] Node.js detected: $(node -v)"

# 3. Setup Agent Dependencies
if [ ! -d "agent/node_modules" ]; then
    echo "[*] Installing Agent dependencies..."
    (cd agent && npm install --no-audit --no-fund)
fi

# 4. Setup Web Dependencies
if [ ! -d "web/node_modules" ]; then
    echo "[*] Installing Web dependencies..."
    (cd web && npm install --no-audit --no-fund)
fi

# 5. Environment Config
if [ ! -f "agent/.env" ] && [ -f ".env" ]; then
    cp .env agent/.env
fi

if [ ! -f "web/.env" ] && [ -f ".env.netlify" ]; then
    cp .env.netlify web/.env
fi

echo ""
echo "====================================================================="
echo "   [1/2] Launching Web Dashboard (http://localhost:5173)...          "
echo "   [2/2] Starting Universal PC & Android ADB Sync Agent...           "
echo "====================================================================="
echo ""

# Launch Web Server in background
(cd web && npm run dev) &
WEB_PID=$!

sleep 3

# Open default browser
if command -v xdg-open &> /dev/null; then
    xdg-open http://localhost:5173 &
elif command -v open &> /dev/null; then
    open http://localhost:5173 &
fi

# Run Agent in foreground
(cd agent && node agent.js)

# Cleanup on exit
kill $WEB_PID 2>/dev/null
