#!/usr/bin/env bash
# OmniNode AI - Universal PC & Android ADB Sync Agent (Linux / macOS)

echo "====================================================================="
echo "         OmniNode AI - Universal PC & Android ADB Sync Agent        "
echo "====================================================================="

# 1. Auto-Pull Latest Updates from GitHub
if command -v git &> /dev/null && [ -d "../.git" ]; then
    echo "[*] Checking for latest OmniNode AI updates from GitHub..."
    git -C .. pull origin main --quiet 2>/dev/null
    echo "[OK] Codebase is up to date."
fi

# 2. Check Node.js installation
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed. Please install Node.js v18+."
    exit 1
fi

echo "[OK] Node.js detected: $(node -v)"

# 3. Check and Install Dependencies
if [ ! -d "node_modules" ]; then
    echo "[*] Installing dependencies..."
    npm install --no-audit --no-fund
fi

# 4. Check for .env or configuration
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    cp .env.example .env
    echo "[*] Created .env configuration from template."
fi

echo "====================================================================="
echo "   Starting OmniNode Agent... (Connecting PC assets + Android ADB)   "
echo "====================================================================="

node agent.js
