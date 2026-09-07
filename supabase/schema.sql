-- =========================================================
-- OmniNode AI - Multi-Device Asset & Decision Database Schema
-- Run this in your Supabase SQL Editor
-- =========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. NODES TABLE (Host Computers running setup.bat)
CREATE TABLE IF NOT EXISTS public.nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id TEXT UNIQUE NOT NULL,             -- Unique machine hardware / user ID
    hostname TEXT NOT NULL,                  -- e.g., 'Sammy-Workstation'
    os_info TEXT,                            -- e.g., 'Windows 11 (x64)'
    ip_address TEXT,
    status TEXT DEFAULT 'online',            -- 'online', 'syncing', 'idle', 'offline'
    last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
    storage_stats JSONB DEFAULT '{}'::jsonb, -- Disk free/total space
    monitored_paths JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ATTACHED_DEVICES TABLE (Android Phones connected via USB ADB to any Node)
CREATE TABLE IF NOT EXISTS public.attached_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id TEXT UNIQUE NOT NULL,          -- ADB Serial Number (e.g. 'R58M34ABCD')
    node_id TEXT NOT NULL REFERENCES public.nodes(node_id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,               -- e.g., 'Samsung Galaxy S24 Ultra'
    model TEXT,                              -- e.g., 'SM-S928B'
    android_version TEXT,                    -- e.g., 'Android 14 (API 34)'
    connection_type TEXT DEFAULT 'usb_adb',  -- 'usb_adb', 'wifi_adb', 'simulated'
    battery_level INTEGER DEFAULT 100,
    usb_debugging_status TEXT DEFAULT 'authorized', -- 'authorized', 'unauthorized', 'offline'
    last_sync TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ASSETS TABLE (Aggregated Assets: Images, SMS/Messages, Docs, Media across all devices)
CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asset_uid TEXT UNIQUE NOT NULL,          -- Composite ID: node_id + device_id + file_path
    node_id TEXT NOT NULL REFERENCES public.nodes(node_id) ON DELETE CASCADE,
    device_id TEXT,                          -- References attached_devices(device_id) if from mobile
    device_type TEXT NOT NULL,               -- 'computer', 'android', 'cloud'
    asset_category TEXT NOT NULL,            -- 'message', 'image', 'document', 'audio', 'archive', 'data'
    name TEXT NOT NULL,                      -- File name or message subject/sender
    file_path TEXT NOT NULL,                 -- Path on target PC or Android path (/sdcard/DCIM/...)
    file_size_bytes BIGINT DEFAULT 0,
    mime_type TEXT,                          -- e.g., 'image/jpeg', 'text/plain', 'application/json'
    extracted_text TEXT,                     -- OCR text, message body, document content
    thumbnail_url TEXT,                      -- Base64 or Supabase storage URL
    metadata JSONB DEFAULT '{}'::jsonb,      -- Timestamps, sender, EXIF, tags, etc.
    last_modified TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast search
CREATE INDEX IF NOT EXISTS idx_assets_category ON public.assets(asset_category);
CREATE INDEX IF NOT EXISTS idx_assets_device_type ON public.assets(device_type);
CREATE INDEX IF NOT EXISTS idx_assets_node_id ON public.assets(node_id);

-- 4. AI_DECISIONS TABLE (Stored queries, synthesized decisions, and citations)
CREATE TABLE IF NOT EXISTS public.ai_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt TEXT NOT NULL,
    query_type TEXT DEFAULT 'decision',       -- 'decision', 'search', 'investigation', 'summary'
    decision TEXT NOT NULL,                   -- Final AI synthesized decision / answer
    confidence_score NUMERIC(4,2) DEFAULT 0.95,
    reasoning_steps JSONB DEFAULT '[]'::jsonb, -- Array of step-by-step logic
    cited_asset_ids JSONB DEFAULT '[]'::jsonb, -- References to assets used as proof
    participating_nodes JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. REALTIME PUBLICATION SETUP
ALTER PUBLICATION supabase_realtime ADD TABLE public.nodes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attached_devices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_decisions;

-- 6. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attached_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read/write nodes" ON public.nodes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write attached_devices" ON public.attached_devices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write assets" ON public.assets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write ai_decisions" ON public.ai_decisions FOR ALL USING (true) WITH CHECK (true);
