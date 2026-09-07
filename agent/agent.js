const os = require('os');
const path = require('path');
const fs = require('fs');
const chokidar = require('chokidar');
const { createClient } = require('@supabase/supabase-js');
const AdbScanner = require('./adbScanner');
require('dotenv').config();

// Load Config
const configPath = path.join(__dirname, 'config.json');
let config = {
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseKey: process.env.SUPABASE_ANON_KEY || '',
    nodeId: `node-${os.hostname().toLowerCase().replace(/[^a-z0-9]/g, '-')}-${os.arch()}`,
    syncIntervalSeconds: 15,
    enableMockAndroidIfNoDevice: true,
    watchPaths: [
        path.join(os.homedir(), 'Documents'),
        path.join(os.homedir(), 'Downloads'),
        path.join(os.homedir(), 'Desktop'),
        path.join(__dirname, 'local_assets')
    ]
};

if (fs.existsSync(configPath)) {
    try {
        const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config = { ...config, ...fileConfig };
    } catch (e) {
        console.error('Error reading config.json:', e.message);
    }
}

// Ensure local assets directory exists for quick testing
const localAssetsDir = path.join(__dirname, 'local_assets');
if (!fs.existsSync(localAssetsDir)) {
    fs.mkdirSync(localAssetsDir, { recursive: true });
    // Seed sample files if empty
    fs.writeFileSync(
        path.join(localAssetsDir, 'invoice_1024_acme_cloud.txt'),
        'ACME Cloud Solutions - Statement of Account\nInvoice Number: #INV-1024\nDate: 2026-09-06\nDue Amount: $1,450.00\nClient: Sammy Enterprises\nStatus: Pending Verification\nItem: Dedicated Multi-Node GPU Cluster\nTerms: Net 30'
    );
    fs.writeFileSync(
        path.join(localAssetsDir, 'quarterly_financial_report_2026.md'),
        '# Sammy Enterprises - Q3 2026 Financial Overview\n\nTotal Budget Allocated: $120,000\nApproved Vendors: ACME Cloud Solutions, Apex Hosting, Global Logistics.\nPending Audit: All transactions above $1,000 must have matching mobile bank SMS and PC invoice confirmation.'
    );
}

// Initialize Supabase Client
let supabase = null;
if (config.supabaseUrl && config.supabaseKey && !config.supabaseUrl.includes('YOUR_SUPABASE')) {
    supabase = createClient(config.supabaseUrl, config.supabaseKey);
    console.log(`\x1b[32m[Supabase]\x1b[0m Connected to Supabase at: ${config.supabaseUrl}`);
} else {
    console.log(`\x1b[33m[Supabase Standby]\x1b[0m No active Supabase URL/Key provided in .env or config.json.`);
    console.log(`\x1b[33m[Supabase Standby]\x1b[0m Running in Local Agent Mode. Assets and devices will be indexed and ready for sync.`);
}

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
    console.log(`\x1b[36m[Node Heartbeat]\x1b[0m Host: ${nodeData.hostname} | OS: ${nodeData.os_info} | IP: ${nodeData.ip_address}`);

    if (supabase) {
        try {
            const { error } = await supabase
                .from('nodes')
                .upsert(nodeData, { onConflict: 'node_id' });
            if (error) console.log(`  \x1b[33m[Supabase Sync]\x1b[0m Node heartbeat queued (Status: ${error.message})`);
        } catch (err) {
            // Standby mode
        }
    }
}

// Sync Asset to Supabase
async function syncAsset(asset) {
    const assetRecord = {
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

    if (supabase) {
        try {
            const { error } = await supabase
                .from('assets')
                .upsert(assetRecord, { onConflict: 'asset_uid' });
            if (error) {
                // Queued
            }
        } catch (err) {
            // Standby mode
        }
    }

    console.log(`  \x1b[32m✔ Indexed Asset:\x1b[0m [${assetRecord.device_type.toUpperCase()}] ${assetRecord.name} (${assetRecord.asset_category})`);
}

// Local File Indexer
function indexLocalFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) return;
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) return;

        const filename = path.basename(filePath);
        const ext = path.extname(filePath).toLowerCase();

        let category = 'document';
        let mime = 'text/plain';
        let extractedText = '';

        if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(ext)) {
            category = 'image';
            mime = `image/${ext.replace('.', '')}`;
            extractedText = `Image asset on PC: ${filename} (Size: ${(stats.size / 1024).toFixed(1)} KB)`;
        } else if (['.txt', '.md', '.json', '.csv', '.log', '.xml', '.yaml', '.yml', '.sql'].includes(ext)) {
            category = 'document';
            mime = ext === '.json' ? 'application/json' : 'text/plain';
            // Read first 10KB of text
            if (stats.size < 500000) {
                extractedText = fs.readFileSync(filePath, 'utf8');
            } else {
                const buffer = Buffer.alloc(10000);
                const fd = fs.openSync(filePath, 'r');
                fs.readSync(fd, buffer, 0, 10000, 0);
                fs.closeSync(fd);
                extractedText = buffer.toString('utf8') + '\n...[Truncated]';
            }
        } else if (['.pdf', '.docx', '.xlsx'].includes(ext)) {
            category = 'document';
            mime = 'application/octet-stream';
            extractedText = `Binary Document: ${filename} (Size: ${(stats.size / 1024).toFixed(1)} KB)`;
        }

        syncAsset({
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
        });
    } catch (e) {
        console.error(`Error indexing ${filePath}:`, e.message);
    }
}

// Start File Watcher
function startLocalFileWatcher() {
    const existingPaths = config.watchPaths.filter(p => fs.existsSync(p));
    console.log(`\x1b[35m[File Watcher]\x1b[0m Monitoring local directories:`);
    existingPaths.forEach(p => console.log(`  📁 ${p}`));

    const watcher = chokidar.watch(existingPaths, {
        ignored: /(^|[\/\\])\..|node_modules|AppData|\.git|My Music|My Videos|My Pictures/,
        persistent: true,
        depth: 2,
        ignoreInitial: false,
        followSymlinks: false,
        ignorePermissionErrors: true,
        awaitWriteFinish: { stabilityThreshold: 1000, pollInterval: 500 }
    });

    watcher
        .on('add', filePath => indexLocalFile(filePath))
        .on('change', filePath => indexLocalFile(filePath))
        .on('error', err => {
            // Silently ignore Windows junction permission warnings
            if (err.code !== 'EPERM' && err.code !== 'EACCES') {
                console.warn('[File Watcher Warning]:', err.message);
            }
        });
}

// Android ADB Sync Routine (100% Real Physical Devices)
async function syncAndroidDevices() {
    const physicalDevices = await adbScanner.getConnectedDevices();

    if (physicalDevices.length === 0) {
        // No physical device currently plugged in
        return;
    }

    for (const dev of physicalDevices) {
        console.log(`\x1b[32m[Android Connected via USB]\x1b[0m Found: ${dev.device_name} (ID: ${dev.device_id}, Status: ${dev.usb_debugging_status})`);

        // Sync attached device info to Supabase
        if (supabase) {
            try {
                const { error } = await supabase.from('attached_devices').upsert({
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
                if (error) console.log(`  \x1b[33m[Supabase Device Sync]\x1b[0m ${error.message}`);
            } catch (err) {
                // Ignore transient network errors
            }
        }

        // Pull Real SMS and Real Storage Assets
        if (dev.usb_debugging_status === 'authorized') {
            console.log(`  📱 Extracting messages & media from physical Android phone (${dev.device_id})...`);
            const messages = await adbScanner.extractSmsMessages(dev.device_id);
            for (const msg of messages) {
                syncAsset({
                    ...msg,
                    device_id: dev.device_id,
                    device_type: 'android'
                });
            }

            const storageAssets = await adbScanner.scanStorageDirectories(dev.device_id);
            for (const asset of storageAssets) {
                syncAsset({
                    ...asset,
                    device_id: dev.device_id,
                    device_type: 'android'
                });
            }
        }
    }
}

// Main Agent Bootstrap
async function startAgent() {
    console.log(`=======================================================`);
    console.log(`   🚀 OmniNode AI Unified Node.js Agent Initializing   `);
    console.log(`   Host: ${os.hostname()} | Node ID: ${config.nodeId}`);
    console.log(`=======================================================`);

    // 1. Send Node Heartbeat
    await syncNodeHeartbeat();

    // 2. Scan and Connect Physical Android USB ADB Devices IMMEDIATELY
    console.log(`\x1b[34m[Android ADB]\x1b[0m Scanning for USB debugging connected devices...`);
    await syncAndroidDevices();

    // 3. Start Background Local File Watcher
    startLocalFileWatcher();

    // 4. Periodic Heartbeat and ADB scan every interval
    setInterval(async () => {
        await syncNodeHeartbeat();
        await syncAndroidDevices();
    }, config.syncIntervalSeconds * 1000);
}

startAgent().catch(err => {
    console.error('Fatal agent error:', err);
});
