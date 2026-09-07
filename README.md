# OmniNode AI - Distributed Multi-Device AI Decision System

OmniNode AI connects across **Host PCs (via `setup.bat`)** and **USB-Connected Android Devices (via ADB)** to create a unified real-time asset intelligence mesh stored in **Supabase** and controlled via a **Netlify-ready AI Decision Studio**.

---

## 🏗️ Architecture

1. **Central Supabase Database**:
   - Stores connected Host PC nodes, attached USB Android phones, and aggregated assets (SMS, WhatsApp, DCIM photos, documents, invoices).
   - Real-time PostgreSQL publication pushes live updates to the web dashboard.
## 🤖 Multi-Tier Resilient AI Decision Engine (Always-Online)

The system uses an intelligent **5-tier cascading fallback router** to ensure instantaneous responses and 100% uptime:

1. **Tier 1 (Primary)**: **OpenRouter Free Models Cascade**
   - Automatically queries high-performance free models on OpenRouter:
     - `meta-llama/llama-3.3-70b-instruct:free`
     - `google/gemini-2.0-flash-exp:free`
     - `deepseek/deepseek-r1:free`
     - `qwen/qwen-2.5-coder-32b-instruct:free`
     - `meta-llama/llama-3.2-3b-instruct:free`
     - `mistralai/mistral-7b-instruct:free`
2. **Tier 2 (Second Fallback)**: **Grok AI (xAI API)**
   - High-speed reasoning with `grok-2-latest` / `grok-beta`.
3. **Tier 3 (Third Fallback)**: **Zero-API Public Free Inference Models**
   - Direct web gateways requiring zero authentication or API keys.
4. **Tier 4 (Fourth Fallback)**: **Google Gemini API**
   - `gemini-1.5-flash` / `gemini-2.0-flash`.
5. **Tier 5 (Zero-Downtime Guarantee)**: **Embedded Offline Multimodal Reasoner**
   - Local deterministic reasoning engine that operates even without internet access.

---

## 🚀 Quick Start Guide

### Step 1: Initialize Supabase Schema
1. Create a free project at [supabase.com](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Open and copy the SQL from `supabase/schema.sql` into the editor and click **Run**.

### Step 2: Launch the Web Dashboard
```bash
# In the project root directory
run_dev.bat
# or
cd web
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

### Step 3: Run the Agent on Any Host Computer
```cmd
cd agent
setup.bat
```
- The agent will check for Node.js, install dependencies, and begin indexing local files.
- If an Android phone is connected via USB with USB Debugging enabled, it will automatically register the phone and stream its SMS and media assets to the central database.

### Step 4: Deploying to Netlify
1. Connect your repository to [Netlify](https://netlify.com).
2. Build settings are preconfigured via `web/netlify.toml`:
   - **Base directory**: `web`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
3. Set your environment variables in Netlify or enter them via the Settings modal in the web UI.

---

## 📱 Android USB Debugging Setup
1. On your Android phone, go to **Settings > About Phone > Software Information**.
2. Tap **Build Number** 7 times until Developer Mode is unlocked.
3. Go back to **Settings > Developer Options** and enable **USB Debugging**.
4. Plug your phone into the computer running `setup.bat`.
5. Tap **"Always allow from this computer"** when the USB debugging prompt appears on your phone.
