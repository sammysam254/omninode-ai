@echo off
title OmniNode AI - Dashboard Launcher
echo Starting OmniNode AI Web Dashboard...
cd /d "%~dp0web"
npm run dev
