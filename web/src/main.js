import { supabaseService } from './supabaseClient.js';
import { aiDecisionEngine } from './aiDecisionEngine.js';

// State
let allNodes = [];
let allDevices = [];
let allAssets = [];

// DOM Elements
const statNodesCount = document.getElementById('statNodesCount');
const statAndroidCount = document.getElementById('statAndroidCount');
const statAssetsCount = document.getElementById('statAssetsCount');
const deviceMeshContainer = document.getElementById('deviceMeshContainer');
const assetsTableBody = document.getElementById('assetsTableBody');
const assetSearchInput = document.getElementById('assetSearchInput');
const assetCategoryFilter = document.getElementById('assetCategoryFilter');

// Chat Elements
const chatStream = document.getElementById('chatStream');
const chatInput = document.getElementById('chatInput');
const btnSendMessage = document.getElementById('btnSendMessage');
const btnClearChat = document.getElementById('btnClearChat');
const liveModelIndicator = document.getElementById('liveModelIndicator');

// Modals
const configModal = document.getElementById('configModal');
const downloadModal = document.getElementById('downloadModal');
const assetViewerModal = document.getElementById('assetViewerModal');
const btnOpenConfig = document.getElementById('btnOpenConfig');
const btnCloseConfigModal = document.getElementById('btnCloseConfigModal');
const btnCancelConfig = document.getElementById('btnCancelConfig');
const btnSaveConfig = document.getElementById('btnSaveConfig');
const inputOpenRouterKey = document.getElementById('inputOpenRouterKey');
const inputGrokKey = document.getElementById('inputGrokKey');
const inputGeminiApiKey = document.getElementById('inputGeminiApiKey');
const inputSupabaseUrl = document.getElementById('inputSupabaseUrl');
const inputSupabaseKey = document.getElementById('inputSupabaseKey');

const btnDownloadAgent = document.getElementById('btnDownloadAgent');
const btnCloseDownloadModal = document.getElementById('btnCloseDownloadModal');
const btnDownloadBatFile = document.getElementById('btnDownloadBatFile');

const btnCloseAssetViewer = document.getElementById('btnCloseAssetViewer');
const viewerTitle = document.getElementById('viewerTitle');
const viewerOriginBadge = document.getElementById('viewerOriginBadge');
const viewerContent = document.getElementById('viewerContent');
const viewerMetadata = document.getElementById('viewerMetadata');

// Load Real Data from Supabase
async function loadData() {
    allNodes = await supabaseService.getNodes();
    allDevices = await supabaseService.getAttachedDevices();
    allAssets = await supabaseService.getAssets();

    renderStats();
    renderDeviceMesh();
    renderAssetsTable();
}

function renderStats() {
    statNodesCount.textContent = allNodes.length;
    statAndroidCount.textContent = allDevices.length;
    statAssetsCount.textContent = allAssets.length;
}

function renderDeviceMesh() {
    deviceMeshContainer.innerHTML = '';

    if (allNodes.length === 0) {
        deviceMeshContainer.innerHTML = `
            <div class="empty-state-box" style="grid-column: 1 / -1;">
                <div class="empty-state-icon">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect width="20" height="14" x="2" y="3" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                </div>
                <div style="font-weight: 700; font-size: 1.05rem;">No Host PCs Connected Yet</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); max-width: 500px;">
                    Download and run <b>setup.bat</b> on any Windows PC or laptop. It will register here in real time and begin syncing your local folders and USB Android devices.
                </div>
                <button class="btn btn-primary" style="margin-top: 0.5rem;" onclick="document.getElementById('downloadModal').classList.add('open')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Download setup.bat
                </button>
            </div>
        `;
        return;
    }

    allNodes.forEach(node => {
        const attachedMobile = allDevices.filter(d => d.node_id === node.node_id);
        const nodeAssets = allAssets.filter(a => a.node_id === node.node_id);

        const card = document.createElement('div');
        card.className = 'node-card';

        let mobileDevicesHtml = '';
        if (attachedMobile.length > 0) {
            mobileDevicesHtml = `
                <div class="attached-android-section">
                    <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--text-secondary); font-weight: 600;">
                        Attached Mobile Devices (USB Debugging):
                    </div>
                    ${attachedMobile.map(dev => `
                        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); padding: 6px 10px; border-radius: 6px;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span class="android-badge">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"></rect><path d="M12 18h.01"></path></svg>
                                    ${dev.device_name}
                                </span>
                            </div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">
                                🔋 ${dev.battery_level}% | ${dev.android_version}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            mobileDevicesHtml = `
                <div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px;">
                    🔌 No Android phone plugged in via USB debugging on this PC yet.
                </div>
            `;
        }

        card.innerHTML = `
            <div class="node-header">
                <div class="node-title-group">
                    <div class="node-type-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="3" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                    </div>
                    <div>
                        <div style="font-weight: 700; font-size: 1.05rem;">${node.hostname}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);">${node.ip_address || '127.0.0.1'} · ${node.os_info || 'Unknown OS'}</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 4px; font-size: 0.75rem; color: var(--accent-emerald);">
                    <span class="pulse-indicator"></span>
                    <span>ONLINE</span>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 8px; font-size: 0.8rem;">
                <div><span style="color: var(--text-muted);">RAM:</span> ${node.storage_stats?.free_memory_gb || '8'}GB Free / ${node.storage_stats?.total_memory_gb || '16'}GB</div>
                <div><span style="color: var(--text-muted);">Synced Assets:</span> <b style="color: var(--accent-cyan);">${nodeAssets.length}</b></div>
            </div>

            ${mobileDevicesHtml}
        `;

        deviceMeshContainer.appendChild(card);
    });
}

function renderAssetsTable() {
    const query = (assetSearchInput.value || '').toLowerCase();
    const category = assetCategoryFilter.value;

    const filtered = allAssets.filter(asset => {
        const matchesQuery = query === '' || 
            asset.name.toLowerCase().includes(query) ||
            (asset.extracted_text || '').toLowerCase().includes(query) ||
            asset.file_path.toLowerCase().includes(query);
        const matchesCategory = category === 'all' || asset.asset_category === category;
        return matchesQuery && matchesCategory;
    });

    assetsTableBody.innerHTML = '';

    if (filtered.length === 0) {
        assetsTableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 6px;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color: var(--text-muted);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        <span>No assets indexed in Supabase yet. Run <code>setup.bat</code> on your PC to begin syncing.</span>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    filtered.forEach(asset => {
        const tr = document.createElement('tr');
        tr.className = 'asset-row';

        const sizeKb = asset.file_size_bytes ? (asset.file_size_bytes / 1024).toFixed(1) + ' KB' : 'Text';
        const isMobile = asset.device_type === 'android';

        tr.innerHTML = `
            <td>
                <div style="font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: 6px;">
                    ${isMobile ? '📱' : '📄'} ${asset.name}
                </div>
            </td>
            <td>
                <span class="chip" style="font-size: 0.7rem; ${isMobile ? 'border-color: rgba(16,185,129,0.4); color: #34D399;' : ''}">
                    ${isMobile ? 'Android (USB ADB)' : 'Host PC Storage'}
                </span>
            </td>
            <td><span style="text-transform: capitalize; font-size: 0.8rem; color: var(--text-secondary);">${asset.asset_category}</span></td>
            <td style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted);">${sizeKb}</td>
            <td style="font-family: var(--font-mono); font-size: 0.75rem; color: var(--text-muted); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${asset.file_path}">
                ${asset.file_path}
            </td>
            <td>
                <button class="btn btn-secondary" style="padding: 3px 8px; font-size: 0.75rem;" data-asset-id="${asset.id || asset.asset_uid}">Inspect</button>
            </td>
        `;

        tr.querySelector('button').addEventListener('click', () => openAssetViewer(asset));
        assetsTableBody.appendChild(tr);
    });
}

function openAssetViewer(asset) {
    viewerTitle.textContent = asset.name;
    const isMobile = asset.device_type === 'android';
    viewerOriginBadge.innerHTML = `
        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
            <span class="chip" style="font-size: 0.75rem;">Node: ${asset.node_id}</span>
            <span class="chip" style="${isMobile ? 'color: #34D399; border-color: rgba(16,185,129,0.4);' : ''}">${isMobile ? '📱 Android USB Attached' : '🖥️ Host Computer'}</span>
        </div>
    `;
    viewerContent.textContent = asset.extracted_text || 'No text content available.';
    viewerMetadata.textContent = JSON.stringify(asset.metadata || {}, null, 2);
    assetViewerModal.classList.add('open');
}

// Conversational Chat Studio Handler
async function handleSendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = '';

    // Append User Message
    const userMsg = document.createElement('div');
    userMsg.className = 'chat-msg user';
    userMsg.innerHTML = `
        <div class="chat-avatar">👤</div>
        <div class="chat-bubble">
            <p>${escapeHtml(text)}</p>
        </div>
    `;
    chatStream.appendChild(userMsg);
    chatStream.scrollTop = chatStream.scrollHeight;

    // Append Typing Indicator
    const typingMsg = document.createElement('div');
    typingMsg.className = 'chat-msg assistant';
    typingMsg.id = 'typingIndicator';
    typingMsg.innerHTML = `
        <div class="chat-avatar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v3m0 14v3M2 12h3m14 0h3"></path></svg>
        </div>
        <div class="chat-bubble" style="display: flex; align-items: center; gap: 8px; color: var(--text-muted);">
            <span class="pulse-indicator"></span>
            <span>Reasoning across connected devices...</span>
        </div>
    `;
    chatStream.appendChild(typingMsg);
    chatStream.scrollTop = chatStream.scrollHeight;

    btnSendMessage.disabled = true;

    try {
        const response = await aiDecisionEngine.sendMessage(text, allAssets, allNodes, allDevices);

        // Remove typing indicator
        const typingEl = document.getElementById('typingIndicator');
        if (typingEl) typingEl.remove();

        // Format citations
        let citationsHtml = '';
        if (response.cited_assets && response.cited_assets.length > 0) {
            citationsHtml = `
                <div class="chat-citations-box">
                    <div style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700;">Grounded in Live Device Evidence:</div>
                    <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                        ${response.cited_assets.slice(0, 4).map(a => `
                            <span class="citation-chip" title="${a.file_path}">
                                ${a.device_type === 'android' ? '📱' : '🖥️'} ${a.name}
                            </span>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Append Assistant Message
        const assistantMsg = document.createElement('div');
        assistantMsg.className = 'chat-msg assistant';
        assistantMsg.innerHTML = `
            <div class="chat-avatar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v3m0 14v3M2 12h3m14 0h3"></path></svg>
            </div>
            <div class="chat-bubble">
                <div>${formatMarkdown(response.reply)}</div>
                ${citationsHtml}
                <div class="chat-model-badge">
                    ⚡ ${response.source_engine || 'AI Engine'}
                </div>
            </div>
        `;
        chatStream.appendChild(assistantMsg);
        chatStream.scrollTop = chatStream.scrollHeight;

        if (liveModelIndicator) {
            liveModelIndicator.textContent = response.source_engine || 'Active';
        }

    } catch (err) {
        const typingEl = document.getElementById('typingIndicator');
        if (typingEl) typingEl.remove();

        const errorMsg = document.createElement('div');
        errorMsg.className = 'chat-msg assistant';
        errorMsg.innerHTML = `
            <div class="chat-avatar" style="color: #EF4444;">⚠️</div>
            <div class="chat-bubble" style="border-color: rgba(239, 68, 68, 0.4);">
                <p style="color: #F87171;"><b>AI Communication Error:</b> ${err.message}</p>
            </div>
        `;
        chatStream.appendChild(errorMsg);
    } finally {
        btnSendMessage.disabled = false;
        chatInput.focus();
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatMarkdown(text) {
    if (!text) return '';
    // Format bold, backticks, bullet points, headers
    let html = escapeHtml(text);
    html = html.replace(/### (.*?)\n/g, '<h4 style="color: #38BDF8; margin: 0.5rem 0;">$1</h4>');
    html = html.replace(/## (.*?)\n/g, '<h3 style="color: #FFF; margin: 0.6rem 0;">$1</h3>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    html = html.replace(/`(.*?)`/g, '<code>$1</code>');
    html = html.replace(/\n- (.*?)/g, '<br/>• $1');
    html = html.replace(/\n/g, '<br/>');
    return html;
}

// Setup Event Listeners
function setupEvents() {
    btnSendMessage.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    btnClearChat.addEventListener('click', () => {
        aiDecisionEngine.clearHistory();
        chatStream.innerHTML = `
            <div class="chat-msg assistant">
                <div class="chat-avatar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M12 2v3m0 14v3M2 12h3m14 0h3"></path></svg>
                </div>
                <div class="chat-bubble">
                    <p>✨ Conversation cleared. Ask any cross-device decision question to begin.</p>
                </div>
            </div>
        `;
    });

    document.querySelectorAll('.chip[data-quick]').forEach(chip => {
        chip.addEventListener('click', () => {
            chatInput.value = chip.getAttribute('data-quick');
            handleSendMessage();
        });
    });

    assetSearchInput.addEventListener('input', renderAssetsTable);
    assetCategoryFilter.addEventListener('change', renderAssetsTable);

    // Settings Modal (Auto-loads from Netlify Environment Variables & LocalStorage)
    btnOpenConfig.addEventListener('click', () => {
        inputOpenRouterKey.value = localStorage.getItem('omni_openrouter_key') || import.meta.env.VITE_OPENROUTER_API_KEY || '';
        inputGrokKey.value = localStorage.getItem('omni_grok_key') || import.meta.env.VITE_GROK_API_KEY || '';
        inputGeminiApiKey.value = localStorage.getItem('omni_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '';
        inputSupabaseUrl.value = localStorage.getItem('omni_supabase_url') || import.meta.env.VITE_SUPABASE_URL || 'https://xfednxvbjzfssxyaurbc.supabase.co';
        inputSupabaseKey.value = localStorage.getItem('omni_supabase_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
        configModal.classList.add('open');
    });

    btnCloseConfigModal.addEventListener('click', () => configModal.classList.remove('open'));
    btnCancelConfig.addEventListener('click', () => configModal.classList.remove('open'));

    btnSaveConfig.addEventListener('click', () => {
        aiDecisionEngine.setKeys({
            openRouterKey: inputOpenRouterKey.value,
            grokKey: inputGrokKey.value,
            geminiKey: inputGeminiApiKey.value
        });
        supabaseService.setCredentials(inputSupabaseUrl.value, inputSupabaseKey.value);
        configModal.classList.remove('open');
        loadData();
    });

    // Download Modal
    btnDownloadAgent.addEventListener('click', () => downloadModal.classList.add('open'));
    btnCloseDownloadModal.addEventListener('click', () => downloadModal.classList.remove('open'));

    btnDownloadBatFile.addEventListener('click', () => {
        const batContent = `@echo off
setlocal enabledelayedexpansion
title OmniNode AI - Universal Launcher
echo =====================================================================
echo          OmniNode AI - Universal Setup & Launcher
echo =====================================================================
set "REPO_URL=https://github.com/sammysam254/omninode-ai.git"

where git >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    if not exist "web" (
        echo [*] Fresh install: Cloning OmniNode AI from GitHub...
        git clone %REPO_URL% temp_clone
        if exist "temp_clone" (
            xcopy /E /Y /Q temp_clone\\* . >nul
            rmdir /S /Q temp_clone
        )
    ) else if exist ".git" (
        echo [*] Pulling latest updates from GitHub...
        git pull origin main --quiet 2>nul
    )
)

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [*] Installing Node.js LTS via winget...
    winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements >nul 2>&1
)

if not exist "agent\\node_modules" (
    pushd agent & call npm install --no-audit --no-fund & popd
)
if not exist "web\\node_modules" (
    pushd web & call npm install --no-audit --no-fund & popd
)

start "OmniNode AI Dashboard" cmd /c "cd web && npm run dev"
timeout /t 3 /nobreak >nul
start http://localhost:5173

cd agent
node agent.js
pause`;
        const blob = new Blob([batContent], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'setup.bat';
        a.click();
    });

    btnCloseAssetViewer.addEventListener('click', () => assetViewerModal.classList.remove('open'));

    // Real-time listener
    supabaseService.subscribeToChanges(() => {
        loadData();
    });
}

// Initial Boot
setupEvents();
loadData();
