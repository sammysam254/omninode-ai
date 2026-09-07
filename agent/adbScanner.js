const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class AdbScanner {
    constructor(logger = console) {
        this.logger = logger;
        this.adbPath = this.detectAdb();
    }

    detectAdb() {
        const standardPaths = [
            path.join(__dirname, 'bin', 'adb.exe'),
            'C:\\agentai\\agent\\bin\\adb.exe',
            path.join(process.env.USERPROFILE || '', 'Downloads', 'adb.exe'),
            path.join(process.env.USERPROFILE || '', 'Downloads', 'bin', 'adb.exe'),
            'adb',
            path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk', 'platform-tools', 'adb.exe'),
            path.join(process.env.PROGRAMFILES || '', 'Android', 'platform-tools', 'adb.exe'),
            'C:\\platform-tools\\adb.exe'
        ];

        for (const p of standardPaths) {
            if (p === 'adb' || fs.existsSync(p)) {
                return p;
            }
        }
        return 'adb';
    }

    execCommand(cmd, timeoutMs = 20000) {
        return new Promise((resolve) => {
            exec(`"${this.adbPath}" ${cmd}`, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
                if (error) {
                    resolve({ success: false, error: stderr || error.message, stdout: '' });
                } else {
                    resolve({ success: true, stdout: stdout.trim(), stderr });
                }
            });
        });
    }

    async getConnectedDevices() {
        const result = await this.execCommand('devices -l');
        const physicalDevices = [];

        if (result.success && result.stdout) {
            const lines = result.stdout.split('\n');
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line || line.startsWith('*')) continue;

                const parts = line.split(/\s+/);
                const serial = parts[0];
                const state = parts[1];

                if (state === 'device') {
                    let model = 'Samsung Galaxy Phone';
                    const modelMatch = line.match(/model:([^\s]+)/);
                    if (modelMatch) model = modelMatch[1].replace(/_/g, ' ');

                    let product = 'Generic';
                    const productMatch = line.match(/product:([^\s]+)/);
                    if (productMatch) product = productMatch[1];

                    const details = await this.getDeviceDetails(serial);

                    physicalDevices.push({
                        device_id: serial,
                        device_name: details.device_name || `${model} (${product})`,
                        model: model,
                        android_version: details.android_version || 'Android',
                        battery_level: details.battery_level || 100,
                        connection_type: 'usb_adb',
                        usb_debugging_status: 'authorized'
                    });
                } else if (state === 'unauthorized') {
                    physicalDevices.push({
                        device_id: serial,
                        device_name: `Android Device (${serial}) - Unauthorized`,
                        model: 'Unknown',
                        android_version: 'Unknown',
                        battery_level: 0,
                        connection_type: 'usb_adb',
                        usb_debugging_status: 'unauthorized'
                    });
                }
            }
        }

        return physicalDevices;
    }

    async getDeviceDetails(serial) {
        const resBattery = await this.execCommand(`-s ${serial} shell dumpsys battery`);
        let batteryLevel = 100;
        if (resBattery.success) {
            const match = resBattery.stdout.match(/level:\s*(\d+)/i);
            if (match) batteryLevel = parseInt(match[1], 10);
        }

        const resVersion = await this.execCommand(`-s ${serial} shell getprop ro.build.version.release`);
        const androidVersion = resVersion.success ? `Android ${resVersion.stdout}` : 'Android';

        const resModel = await this.execCommand(`-s ${serial} shell getprop ro.product.model`);
        const modelName = resModel.success ? resModel.stdout : 'Samsung Galaxy';

        return {
            battery_level: batteryLevel,
            android_version: androidVersion,
            device_name: modelName
        };
    }

    // Comprehensive Mobile SMS Extractor (Sorted by newest first)
    async extractSmsMessages(serial) {
        const cmd = `-s ${serial} shell content query --uri content://sms --projection address,body,date,type --sort date\\ DESC`;
        const res = await this.execCommand(cmd);
        const messages = [];

        if (res.success && res.stdout) {
            const rows = res.stdout.split('Row:');
            for (const row of rows) {
                if (!row.trim()) continue;
                const addressMatch = row.match(/address=([^,]+)/);
                const bodyMatch = row.match(/body=(.*?), date=/s) || row.match(/body=(.*?)(,|$)/s);
                const dateMatch = row.match(/date=(\d+)/);
                const typeMatch = row.match(/type=(\d+)/);

                if (bodyMatch) {
                    const sender = addressMatch ? addressMatch[1].trim() : 'Unknown';
                    const body = bodyMatch[1].trim();
                    const rawDate = dateMatch ? parseInt(dateMatch[1], 10) : Date.now();
                    const timestamp = new Date(rawDate).toISOString();
                    const isIncoming = typeMatch ? typeMatch[1] === '1' : true;

                    messages.push({
                        name: `SMS from ${sender}`,
                        file_path: `/sdcard/Messages/sms_${rawDate}_${messages.length}.txt`,
                        asset_category: 'message',
                        mime_type: 'text/plain',
                        extracted_text: `[SMS ${isIncoming ? 'Received from' : 'Sent to'}: ${sender}] [Time: ${timestamp}]\n${body}`,
                        metadata: {
                            sender,
                            timestamp,
                            raw_timestamp: rawDate,
                            direction: isIncoming ? 'inbound' : 'outbound',
                            protocol: 'SMS',
                            source: 'USB_Physical_Android'
                        },
                        last_modified: timestamp
                    });
                }
            }
        }

        return messages;
    }

    // Comprehensive Android Deep Storage Crawler (All paths, photos, docs, WhatsApp, downloads, media)
    async scanStorageDirectories(serial) {
        const assets = [];
        const seenPaths = new Set();

        // 1. First run fast recursive find across entire /sdcard/ for all media and documents
        const findCmd = `-s ${serial} shell find /sdcard/ -maxdepth 5 -type f \\( -name "*.pdf" -o -name "*.doc" -o -name "*.docx" -o -name "*.xls" -o -name "*.xlsx" -o -name "*.csv" -o -name "*.txt" -o -name "*.json" -o -name "*.log" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.webp" -o -name "*.heic" -o -name "*.mp4" -o -name "*.mkv" -o -name "*.3gp" -o -name "*.mp3" -o -name "*.m4a" -o -name "*.wav" -o -name "*.aac" -o -name "*.opus" -o -name "*.zip" -o -name "*.apk" \\) 2>/dev/null`;
        const findRes = await this.execCommand(findCmd, 25000);

        if (findRes.success && findRes.stdout) {
            const files = findRes.stdout.split('\n');
            for (const rawFile of files) {
                const fullPath = rawFile.trim();
                if (!fullPath || fullPath.includes('.nomedia') || fullPath.includes('.thumbnails')) continue;
                if (seenPaths.has(fullPath)) continue;
                seenPaths.add(fullPath);

                const filename = path.basename(fullPath);
                const ext = path.extname(filename).toLowerCase();
                let category = 'document';
                let mime = 'application/octet-stream';

                if (['.jpg', '.jpeg', '.png', '.webp', '.heic', '.gif', '.bmp'].includes(ext)) {
                    category = 'image';
                    mime = `image/${ext.replace('.', '')}`;
                } else if (['.txt', '.pdf', '.docx', '.doc', '.csv', '.json', '.xlsx', '.pptx', '.html', '.md', '.log'].includes(ext)) {
                    category = 'document';
                    mime = ext === '.pdf' ? 'application/pdf' : 'text/plain';
                } else if (['.mp4', '.mkv', '.avi', '.mov', '.3gp'].includes(ext)) {
                    category = 'video';
                    mime = 'video/mp4';
                } else if (['.mp3', '.m4a', '.wav', '.aac', '.opus'].includes(ext)) {
                    category = 'audio';
                    mime = 'audio/mpeg';
                }

                assets.push({
                    name: filename,
                    file_path: fullPath,
                    file_size_bytes: 0,
                    asset_category: category,
                    mime_type: mime,
                    extracted_text: `Android File: ${filename} (Location: ${fullPath})`,
                    metadata: {
                        storage_path: fullPath,
                        source: 'USB_ADB_Device_Storage'
                    }
                });
            }
        }

        // 2. Comprehensive Directory Inspection for known high-value folders
        const targetDirs = [
            '/sdcard/DCIM',
            '/sdcard/DCIM/Camera',
            '/sdcard/DCIM/Screenshots',
            '/sdcard/Pictures',
            '/sdcard/Pictures/Screenshots',
            '/sdcard/Pictures/Telegram',
            '/sdcard/Pictures/WhatsApp',
            '/sdcard/Download',
            '/sdcard/Downloads',
            '/sdcard/Documents',
            '/sdcard/Document',
            '/sdcard/WhatsApp/Media/WhatsApp Images',
            '/sdcard/WhatsApp/Media/WhatsApp Documents',
            '/sdcard/WhatsApp/Media/WhatsApp Audio',
            '/sdcard/Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images',
            '/sdcard/Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Documents',
            '/sdcard/Telegram/Telegram Documents',
            '/sdcard/Telegram/Telegram Images',
            '/sdcard/Music',
            '/sdcard/Movies',
            '/sdcard/Recordings',
            '/sdcard/Voice Recorder',
            '/sdcard/Bluetooth'
        ];

        for (const dir of targetDirs) {
            const res = await this.execCommand(`-s ${serial} shell ls -la "${dir}" 2>/dev/null`);
            if (!res.success || !res.stdout) continue;

            const lines = res.stdout.split('\n');
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 7) {
                    const filename = parts.slice(7).join(' ');
                    const size = parseInt(parts[4], 10) || 0;
                    if (!filename || filename === '.' || filename === '..') continue;

                    const fullPath = `${dir}/${filename}`;
                    if (seenPaths.has(fullPath)) continue;
                    seenPaths.add(fullPath);

                    const ext = path.extname(filename).toLowerCase();
                    let category = 'document';
                    let mime = 'application/octet-stream';

                    if (['.jpg', '.jpeg', '.png', '.webp', '.heic', '.gif', '.bmp'].includes(ext)) {
                        category = 'image';
                        mime = `image/${ext.replace('.', '')}`;
                    } else if (['.txt', '.pdf', '.docx', '.doc', '.csv', '.json', '.xlsx', '.pptx', '.html', '.md', '.log'].includes(ext)) {
                        category = 'document';
                        mime = 'text/plain';
                    } else if (['.mp4', '.mkv', '.avi', '.mov', '.3gp'].includes(ext)) {
                        category = 'video';
                        mime = 'video/mp4';
                    } else if (['.mp3', '.m4a', '.wav', '.aac', '.opus'].includes(ext)) {
                        category = 'audio';
                        mime = 'audio/mpeg';
                    }

                    assets.push({
                        name: filename,
                        file_path: fullPath,
                        file_size_bytes: size,
                        asset_category: category,
                        mime_type: mime,
                        extracted_text: `Android Storage Asset: ${filename} (Path: ${fullPath}, Size: ${(size / 1024).toFixed(1)} KB)`,
                        metadata: {
                            storage_path: fullPath,
                            source: 'USB_ADB_Device_Storage'
                        }
                    });
                }
            }
        }

        return assets;
    }
}

module.exports = AdbScanner;
