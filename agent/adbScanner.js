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

    execCommand(cmd) {
        return new Promise((resolve) => {
            exec(`"${this.adbPath}" ${cmd}`, { timeout: 15000 }, (error, stdout, stderr) => {
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
                    let model = 'Samsung Device';
                    const modelMatch = line.match(/model:([^\s]+)/);
                    if (modelMatch) model = modelMatch[1].replace(/_/g, ' ');

                    let product = 'Generic';
                    const productMatch = line.match(/product:([^\s]+)/);
                    if (productMatch) product = productMatch[1];

                    // Query live battery and version from physical phone
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

    async extractSmsMessages(serial) {
        const cmd = `-s ${serial} shell content query --uri content://sms --projection address,body,date,type`;
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
                    const timestamp = dateMatch ? new Date(parseInt(dateMatch[1], 10)).toISOString() : new Date().toISOString();
                    const isIncoming = typeMatch ? typeMatch[1] === '1' : true;

                    messages.push({
                        name: `SMS from ${sender}`,
                        file_path: `/sdcard/Messages/sms_${Date.now()}_${messages.length}.txt`,
                        asset_category: 'message',
                        mime_type: 'text/plain',
                        extracted_text: `[SMS ${isIncoming ? 'Received from' : 'Sent to'}: ${sender}] [Time: ${timestamp}]\n${body}`,
                        metadata: {
                            sender,
                            timestamp,
                            direction: isIncoming ? 'inbound' : 'outbound',
                            protocol: 'SMS',
                            source: 'USB_Physical_Android'
                        }
                    });
                }
            }
        }

        return messages;
    }

    async scanStorageDirectories(serial) {
        const targetDirs = [
            '/sdcard/DCIM/Camera',
            '/sdcard/DCIM/Screenshots',
            '/sdcard/Pictures/Screenshots',
            '/sdcard/Download',
            '/sdcard/Documents'
        ];

        const assets = [];

        for (const dir of targetDirs) {
            const res = await this.execCommand(`-s ${serial} shell ls -l "${dir}"`);
            if (!res.success || !res.stdout) continue;

            const lines = res.stdout.split('\n');
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 7) {
                    const filename = parts.slice(7).join(' ');
                    const size = parseInt(parts[4], 10) || 0;
                    if (!filename || filename === '.' || filename === '..') continue;

                    const ext = path.extname(filename).toLowerCase();
                    let category = 'document';
                    let mime = 'application/octet-stream';

                    if (['.jpg', '.jpeg', '.png', '.webp', '.heic', '.gif'].includes(ext)) {
                        category = 'image';
                        mime = `image/${ext.replace('.', '')}`;
                    } else if (['.txt', '.pdf', '.docx', '.csv', '.json'].includes(ext)) {
                        category = 'document';
                        mime = 'text/plain';
                    }

                    assets.push({
                        name: filename,
                        file_path: `${dir}/${filename}`,
                        file_size_bytes: size,
                        asset_category: category,
                        mime_type: mime,
                        extracted_text: `Physical Mobile Asset on Android Device: ${filename} (Path: ${dir}/${filename})`,
                        metadata: {
                            storage_path: `${dir}/${filename}`,
                            source: 'USB_ADB_Physical_Device'
                        }
                    });
                }
            }
        }

        return assets;
    }
}

module.exports = AdbScanner;
