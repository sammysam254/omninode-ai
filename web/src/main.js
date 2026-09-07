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
const decisionPromptInput = document.getElementById('decisionPromptInput');
const btnExecuteDecision = document.getElementById('btnExecuteDecision');
const btnDecisionText = document.getElementById('btnDecisionText');
const decisionResultContainer = document.getElementById('decisionResultContainer');
const resDecisionText = document.getElementById('resDecisionText');
const resConfidence = document.getElementById('resConfidence');
const resSummaryText = document.getElementById('resSummaryText');
const resReasoningList = document.getElementById('resReasoningList');
const resActionText = document.getElementById('resActionText');
const resEvidenceGrid = document.getElementById('resEvidenceGrid');

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
const resEngineTierBadge = document.getElementById('resEngineTierBadge');

const btnDownloadAgent = document.getElementById('btnDownloadAgent');
const btnCloseDownloadModal = document.getElementById('btnCloseDownloadModal');
const btnDownloadBatFile = document.getElementById('btnDownloadBatFile');

const btnCloseAssetViewer = document.getElementById('btnCloseAssetViewer');
const viewerTitle = document.getElementById('viewerTitle');
const viewerOriginBadge = document.getElementById('viewerOriginBadge');
const viewerContent = document.getElementById('viewerContent');
const viewerMetadata = document.getElementById('viewerMetadata');

// Load Data & Initialize
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
                <div style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">
                    No Android devices attached via USB ADB on this node.
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
                <div><span style="color: var(--text-muted);">Indexed Assets:</span> <b style="color: var(--accent-cyan);">${nodeAssets.length}</b></div>
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
        assetsTableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No matching assets found across connected devices.</td></tr>`;
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

// AI Decision Execution
async function handleExecuteDecision() {
    const prompt = decisionPromptInput.value.trim();
    if (!prompt) {
        alert('Please enter a question or decision scenario.');
        return;
    }

    btnExecuteDecision.disabled = true;
    btnDecisionText.textContent = 'Querying Multi-Tier AI Cascade...';
    decisionResultContainer.classList.remove('active');

    try {
        const result = await aiDecisionEngine.makeDecision(prompt, allAssets, allNodes, allDevices);

        resDecisionText.textContent = result.decision;
        resConfidence.textContent = `${Math.round(result.confidence_score * 100)}% Confidence`;
        resSummaryText.textContent = result.summary;
        if (resEngineTierBadge) {
            resEngineTierBadge.textContent = result.source_engine || 'AI Engine';
        }

        resReasoningList.innerHTML = '';
        (result.reasoning_steps || []).forEach(step => {
            const li = document.createElement('li');
            li.className = 'reasoning-item';
            li.innerHTML = `<span>⚡</span><span>${step}</span>`;
            resReasoningList.appendChild(li);
        });

        resActionText.textContent = result.action_recommendation;

        resEvidenceGrid.innerHTML = '';
        (result.cited_assets || []).forEach(asset => {
            const isMobile = asset.device_type === 'android';
            const card = document.createElement('div');
            card.className = 'evidence-card';
            card.innerHTML = `
                <div class="evidence-origin">
                    <span style="font-weight: 600; color: ${isMobile ? '#34D399' : 'var(--accent-cyan)'};">${isMobile ? '📱 Android USB' : '🖥️ PC Local'}</span>
                    <span style="color: var(--text-muted);">${asset.asset_category.toUpperCase()}</span>
                </div>
                <div style="font-weight: 600; font-size: 0.85rem;">${asset.name}</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); max-height: 80px; overflow: hidden; text-overflow: ellipsis; background: rgba(0,0,0,0.3); padding: 6px; border-radius: 4px;">
                    ${asset.extracted_text || 'Asset content verified.'}
                </div>
            `;
            resEvidenceGrid.appendChild(card);
        });

        decisionResultContainer.classList.add('active');
        decisionResultContainer.scrollIntoView({ behavior: 'smooth' });

        // Save decision to Supabase if connected
        await supabaseService.saveDecision({
            prompt: result.prompt,
            decision: result.decision,
            confidence_score: result.confidence_score,
            reasoning_steps: result.reasoning_steps,
            cited_asset_ids: (result.cited_assets || []).map(a => a.id || a.asset_uid)
        });

    } catch (err) {
        alert('Error analyzing assets: ' + err.message);
    } finally {
        btnExecuteDecision.disabled = false;
        btnDecisionText.textContent = 'Run AI Decision';
    }
}

// Setup Event Listeners
function setupEvents() {
    btnExecuteDecision.addEventListener('click', handleExecuteDecision);

    document.querySelectorAll('.chip[data-preset]').forEach(chip => {
        chip.addEventListener('click', () => {
            decisionPromptInput.value = chip.getAttribute('data-preset');
            handleExecuteDecision();
        });
    });

    assetSearchInput.addEventListener('input', renderAssetsTable);
    assetCategoryFilter.addEventListener('change', renderAssetsTable);

    // Settings Modal
    btnOpenConfig.addEventListener('click', () => {
        inputOpenRouterKey.value = localStorage.getItem('omni_openrouter_key') || '';
        inputGrokKey.value = localStorage.getItem('omni_grok_key') || '';
        inputGeminiApiKey.value = localStorage.getItem('omni_gemini_api_key') || '';
        inputSupabaseUrl.value = localStorage.getItem('omni_supabase_url') || '';
        inputSupabaseKey.value = localStorage.getItem('omni_supabase_key') || '';
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

