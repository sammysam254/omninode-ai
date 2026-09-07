import { createClient } from '@supabase/supabase-js';
import { mockNodes, mockAttachedDevices, mockAssets } from './mockData.js';

class SupabaseService {
    constructor() {
        this.url = localStorage.getItem('omni_supabase_url') || '';
        this.key = localStorage.getItem('omni_supabase_key') || '';
        this.client = null;
        this.isConfigured = false;
        this.realtimeChannels = [];
        this.init();
    }

    init() {
        if (this.url && this.key && !this.url.includes('YOUR_SUPABASE')) {
            try {
                this.client = createClient(this.url, this.key);
                this.isConfigured = true;
                console.log('[SupabaseService] Initialized with Supabase URL:', this.url);
            } catch (err) {
                console.error('[SupabaseService] Init error:', err);
                this.isConfigured = false;
            }
        } else {
            this.isConfigured = false;
            console.log('[SupabaseService] Running in Standby / Mock Mesh Mode');
        }
    }

    setCredentials(url, key) {
        this.url = url.trim();
        this.key = key.trim();
        localStorage.setItem('omni_supabase_url', this.url);
        localStorage.setItem('omni_supabase_key', this.key);
        this.init();
    }

    async getNodes() {
        if (!this.isConfigured || !this.client) {
            return mockNodes;
        }
        try {
            const { data, error } = await this.client.from('nodes').select('*').order('last_heartbeat', { ascending: false });
            if (error || !data || data.length === 0) return mockNodes;
            return data;
        } catch (e) {
            console.warn('[SupabaseService] Falling back to mock nodes:', e.message);
            return mockNodes;
        }
    }

    async getAttachedDevices() {
        if (!this.isConfigured || !this.client) {
            return mockAttachedDevices;
        }
        try {
            const { data, error } = await this.client.from('attached_devices').select('*').order('last_sync', { ascending: false });
            if (error || !data || data.length === 0) return mockAttachedDevices;
            return data;
        } catch (e) {
            console.warn('[SupabaseService] Falling back to mock attached devices:', e.message);
            return mockAttachedDevices;
        }
    }

    async getAssets() {
        if (!this.isConfigured || !this.client) {
            return mockAssets;
        }
        try {
            const { data, error } = await this.client.from('assets').select('*').order('last_modified', { ascending: false });
            if (error || !data || data.length === 0) return mockAssets;
            return data;
        } catch (e) {
            console.warn('[SupabaseService] Falling back to mock assets:', e.message);
            return mockAssets;
        }
    }

    async saveDecision(decisionRecord) {
        if (!this.isConfigured || !this.client) {
            return { success: true, localOnly: true, data: decisionRecord };
        }
        try {
            const { data, error } = await this.client.from('ai_decisions').insert(decisionRecord).select();
            if (error) throw error;
            return { success: true, data };
        } catch (e) {
            console.error('[SupabaseService] Error saving decision:', e);
            return { success: false, error: e.message };
        }
    }

    subscribeToChanges(onChangeCallback) {
        if (!this.isConfigured || !this.client) return;

        const channel = this.client
            .channel('omni_mesh_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes' }, () => onChangeCallback('nodes'))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'attached_devices' }, () => onChangeCallback('devices'))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, () => onChangeCallback('assets'))
            .subscribe();

        this.realtimeChannels.push(channel);
    }
}

export const supabaseService = new SupabaseService();
