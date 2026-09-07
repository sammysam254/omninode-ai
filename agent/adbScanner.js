const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

class AdbScanner {
    constructor(logger = console) {
        this.logger = logger;
        this.adbPath = this.detectAdb();
        this.simulatedDevices = [];
    }

    detectAdb() {
        const standardPaths = [
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
            exec(`"${this.adbPath}" ${cmd}`, { timeout: 10000 }, (error, stdout, stderr) => {
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
                    let model = 'Android Device';
                    const modelMatch = line.match(/model:([^\s]+)/);
                    if (modelMatch) model = modelMatch[1].replace(/_/g, ' ');

                    let product = 'Generic';
                    const productMatch = line.match(/product:([^\s]+)/);
                    if (productMatch) product = productMatch[1];

                    physicalDevices.push({
                        device_id: serial,
                        device_name: `${model} (${product})`,
                        model: model,
                        connection_type: 'usb_adb',
                        usb_debugging_status: 'authorized',
                        is_simulated: false
                    });
                } else if (state === 'unauthorized') {
                    physicalDevices.push({
                        device_id: serial,
                        device_name: `Android Device (${serial})`,
                        model: 'Unknown',
                        connection_type: 'usb_adb',
                        usb_debugging_status: 'unauthorized',
                        is_simulated: false
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
        const androidVersion = resVersion.success ? `Android ${resVersion.stdout}` : 'Android 14';

        const resModel = await this.execCommand(`-s ${serial} shell getprop ro.product.model`);
        const modelName = resModel.success ? resModel.stdout : 'Galaxy / Pixel Phone';

        return {
            battery_level: batteryLevel,
            android_version: androidVersion,
            device_name: modelName
        };
    }

    async extractSmsMessages(serial) {
        // Query Android content provider for SMS
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
                            protocol: 'SMS'
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
                        extracted_text: `Mobile Asset on Android Device: ${filename} (Path: ${dir}/${filename})`,
                        metadata: {
                            storage_path: `${dir}/${filename}`,
                            source: 'USB_ADB_Storage'
                        }
                    });
                }
            }
        }

        return assets;
    }

    getSimulatedMockDevice() {
        const mockDeviceId = 'USB-ADB-PIXEL8-LIVE';
        return {
            device: {
                device_id: mockDeviceId,
                device_name: 'Google Pixel 8 Pro (USB Debugging)',
                model: 'Pixel 8 Pro',
                android_version: 'Android 15 (API 35)',
                connection_type: 'usb_adb',
                battery_level: 92,
                usb_debugging_status: 'authorized',
                is_simulated: true
            },
            assets: [
                {
                    name: 'SMS: Chase Bank Payment Notification',
                    file_path: '/sdcard/Messages/sms_chase_alert_9941.txt',
                    file_size_bytes: 312,
                    asset_category: 'message',
                    mime_type: 'text/plain',
                    extracted_text: '[SMS Received from: 24273 (Chase Bank)] [2026-09-06 16:42:10]\nChase Alert: Your card ending in 4108 was charged $1,450.00 at ACME Cloud Solutions. Ref ID #INV-1024. If unauthorized, reply NO.',
                    metadata: { sender: 'Chase Bank (24273)', amount: '$1,450.00', invoice_ref: 'INV-1024', status: 'Approved' }
                },
                {
                    name: 'WhatsApp: Supplier Delivery Confirmation',
                    file_path: '/sdcard/WhatsApp/Media/WhatsApp_Chat_Global_Logistics.txt',
                    file_size_bytes: 520,
                    asset_category: 'message',
                    mime_type: 'text/plain',
                    extracted_text: '[WhatsApp Chat with: Sarah Jenkins (Global Logistics)] [2026-09-07 09:15:00]\n"Hi Sammy, confirming that shipment #SHP-9022 with 500 units has cleared customs and will arrive at Warehouse B tomorrow morning at 10 AM. Tracking doc attached."',
                    metadata: { contact: 'Sarah Jenkins', shipment_id: 'SHP-9022', destination: 'Warehouse B' }
                },
                {
                    name: 'Screenshot_20260907_Invoice_Approval.png',
                    file_path: '/sdcard/DCIM/Screenshots/Screenshot_20260907_Invoice_Approval.png',
                    file_size_bytes: 1420000,
                    asset_category: 'image',
                    mime_type: 'image/png',
                    extracted_text: '[OCR Extracted from Mobile Screenshot]:\nVendor: Apex Hosting Corp\nInvoice: #APX-8821\nAmount Due: $320.00\nStatus: PAID VIA APPLE PAY on 2026-09-07 08:30 UTC\nAuth Code: #774910',
                    metadata: { vendor: 'Apex Hosting Corp', invoice: 'APX-8821', status: 'PAID' }
                },
                {
                    name: 'PXL_20260906_Warehouse_Inventory.jpg',
                    file_path: '/sdcard/DCIM/Camera/PXL_20260906_Warehouse_Inventory.jpg',
                    file_size_bytes: 3840000,
                    asset_category: 'image',
                    mime_type: 'image/jpeg',
                    extracted_text: '[Vision Analysis]: Photograph of physical hardware pallets in Warehouse A, showing 12 Server Racks labeled Rack-Alpha to Rack-Mu, tagged Inspection Passed Sept 2026.',
                    metadata: { location: 'Warehouse A', subject: 'Server Rack Inventory' }
                }
            ]
        };
    }
}

module.exports = AdbScanner;
