export const mockNodes = [
    {
        id: 'node-win-sammy-01',
        node_id: 'node-win-sammy-01',
        hostname: 'Sammy-Primary-Workstation',
        os_info: 'Windows 11 Pro 64-bit',
        ip_address: '192.168.1.104',
        status: 'online',
        last_heartbeat: new Date().toISOString(),
        storage_stats: {
            total_memory_gb: '32.0',
            free_memory_gb: '18.4',
            cpu_cores: 16,
            platform: 'win32'
        },
        monitored_paths: [
            'C:\\Users\\Sammy\\Documents',
            'C:\\Users\\Sammy\\Downloads',
            'C:\\Users\\Sammy\\Desktop\\Finance'
        ]
    },
    {
        id: 'node-mac-ops-02',
        node_id: 'node-mac-ops-02',
        hostname: 'Operations-MacBook-M3',
        os_info: 'macOS Sonoma 14.5 (arm64)',
        ip_address: '192.168.1.142',
        status: 'online',
        last_heartbeat: new Date(Date.now() - 45000).toISOString(),
        storage_stats: {
            total_memory_gb: '16.0',
            free_memory_gb: '9.2',
            cpu_cores: 8,
            platform: 'darwin'
        },
        monitored_paths: [
            '/Users/ops/Documents/Contracts',
            '/Users/ops/Downloads/Invoices'
        ]
    }
];

export const mockAttachedDevices = [
    {
        id: 'dev-s24-001',
        device_id: 'USB-ADB-SAMSUNG-S24U',
        node_id: 'node-win-sammy-01',
        device_name: 'Samsung Galaxy S24 Ultra',
        model: 'SM-S928B',
        android_version: 'Android 14 (OneUI 6.1)',
        connection_type: 'usb_adb',
        battery_level: 88,
        usb_debugging_status: 'authorized',
        last_sync: new Date().toISOString()
    },
    {
        id: 'dev-pixel-002',
        device_id: 'USB-ADB-PIXEL8-OPS',
        node_id: 'node-mac-ops-02',
        device_name: 'Google Pixel 8 Pro',
        model: 'Pixel 8 Pro',
        android_version: 'Android 15 Developer Preview',
        connection_type: 'usb_adb',
        battery_level: 94,
        usb_debugging_status: 'authorized',
        last_sync: new Date(Date.now() - 30000).toISOString()
    }
];

export const mockAssets = [
    {
        id: 'ast-01',
        asset_uid: 'node-win-sammy-01::host::invoice_1024_acme.txt',
        node_id: 'node-win-sammy-01',
        device_id: null,
        device_type: 'computer',
        asset_category: 'document',
        name: 'invoice_1024_acme_cloud.txt',
        file_path: 'C:\\Users\\Sammy\\Desktop\\Finance\\invoice_1024_acme_cloud.txt',
        file_size_bytes: 420,
        mime_type: 'text/plain',
        extracted_text: 'ACME Cloud Solutions - Statement of Account\nInvoice Number: #INV-1024\nDate: 2026-09-06\nDue Amount: $1,450.00\nClient: Sammy Enterprises\nStatus: Pending Audit Verification\nItem: Dedicated Multi-Node GPU Cluster & Storage Server\nPayment Terms: Due upon receipt via Corporate Wire or Card.',
        metadata: { vendor: 'ACME Cloud Solutions', invoice: '#INV-1024', amount: '$1,450.00' },
        last_modified: '2026-09-06T14:20:00Z'
    },
    {
        id: 'ast-02',
        asset_uid: 'node-win-sammy-01::USB-ADB-SAMSUNG-S24U::sms_chase_9941.txt',
        node_id: 'node-win-sammy-01',
        device_id: 'USB-ADB-SAMSUNG-S24U',
        device_type: 'android',
        asset_category: 'message',
        name: 'SMS: Chase Bank Card Alert',
        file_path: '/sdcard/Messages/sms_chase_9941.txt',
        file_size_bytes: 290,
        mime_type: 'text/plain',
        extracted_text: '[SMS Received from: 24273 (Chase Bank Alerts)] [2026-09-06 16:42:10 UTC]\n"Chase Alert: Your corporate debit card ending in 4108 was charged $1,450.00 at ACME Cloud Solutions. Reference: #INV-1024. Auth Code: #883902. Balance remaining: $48,250.00."',
        metadata: { sender: 'Chase Bank (24273)', amount: '$1,450.00', invoice_ref: 'INV-1024', card_last4: '4108', auth_code: '883902' },
        last_modified: '2026-09-06T16:42:10Z'
    },
    {
        id: 'ast-03',
        asset_uid: 'node-mac-ops-02::USB-ADB-PIXEL8-OPS::wa_shipping_9022.txt',
        node_id: 'node-mac-ops-02',
        device_id: 'USB-ADB-PIXEL8-OPS',
        device_type: 'android',
        asset_category: 'message',
        name: 'WhatsApp: Global Logistics Delivery Notice',
        file_path: '/sdcard/WhatsApp/Media/WhatsApp_Logistics_9022.txt',
        file_size_bytes: 380,
        mime_type: 'text/plain',
        extracted_text: '[WhatsApp Chat: Sarah Jenkins (Global Freight Logistics)] [2026-09-07 09:15:00 UTC]\n"Hi Ops Team, shipment #SHP-9022 (500 unit batch) has cleared customs inspection. Truck #44 is scheduled to arrive at Main Distribution Warehouse B on Sept 8 at 10:00 AM."',
        metadata: { contact: 'Sarah Jenkins', shipment_id: 'SHP-9022', destination: 'Warehouse B', eta: '2026-09-08 10:00 AM' },
        last_modified: '2026-09-07T09:15:00Z'
    },
    {
        id: 'ast-04',
        asset_uid: 'node-win-sammy-01::USB-ADB-SAMSUNG-S24U::Screenshot_20260907_Payment.png',
        node_id: 'node-win-sammy-01',
        device_id: 'USB-ADB-SAMSUNG-S24U',
        device_type: 'android',
        asset_category: 'image',
        name: 'Screenshot_20260907_Payment_Success.png',
        file_path: '/sdcard/DCIM/Screenshots/Screenshot_20260907_Payment_Success.png',
        file_size_bytes: 1820000,
        mime_type: 'image/png',
        extracted_text: '[OCR Screen Analysis]: Apple Pay Transaction Receipt - Apex Hosting Corp. Amount: $320.00. Payment Method: Virtual Visa 9011. Timestamp: 2026-09-07 08:30:15 UTC. Status: COMPLETED.',
        metadata: { vendor: 'Apex Hosting Corp', amount: '$320.00', status: 'COMPLETED' },
        last_modified: '2026-09-07T08:30:15Z'
    },
    {
        id: 'ast-05',
        asset_uid: 'node-mac-ops-02::host::supplier_contract_2026.pdf',
        node_id: 'node-mac-ops-02',
        device_id: null,
        device_type: 'computer',
        asset_category: 'document',
        name: 'master_supply_agreement_2026.pdf',
        file_path: '/Users/ops/Documents/Contracts/master_supply_agreement_2026.pdf',
        file_size_bytes: 2450000,
        mime_type: 'application/pdf',
        extracted_text: '[PDF Content]: Master Services Agreement between Sammy Enterprises & Apex Hosting. Section 4.2: Renewal pricing locked at $320.00/mo. Section 8: SLA guaranteed 99.99% uptime with 24/7 priority support.',
        metadata: { vendor: 'Apex Hosting', contract_id: 'MSA-2026-04', terms: '$320.00/mo' },
        last_modified: '2026-09-05T11:00:00Z'
    }
];
