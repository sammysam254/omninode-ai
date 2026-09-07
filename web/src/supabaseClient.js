import { createClient } from '@supabase/supabase-js';

class SupabaseService {
    constructor() {
        this.url = localStorage.getItem('omni_supabase_url') || import.meta.env.VITE_SUPABASE_URL || 'https://xfednxvbjzfssxyaurbc.supabase.co';
        this.key = localStorage.getItem('omni_supabase_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
        this.client = null;
        this.isConfigured = false;
        this.realtimeChannels = [];
        this.init();
    }

    init() {
        if (this.url && this.key && !this.url.includes('YOUR_SUPABASE') && !this.url.includes('your-project')) {
            try {
                this.client = createClient(this.url, this.key);
                this.isConfigured = true;
                console.log('[SupabaseService] Connected to Supabase:', this.url);
            } catch (err) {
                console.error('[SupabaseService] Init error:', err);
                this.isConfigured = false;
            }
        } else {
            this.isConfigured = false;
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
        if (!this.client) return [];
        try {
            const { data, error } = await this.client.from('nodes').select('*').order('last_heartbeat', { ascending: false });
            if (error || !data) return [];
            return data;
        } catch (e) {
            console.warn('[SupabaseService] Error loading nodes:', e.message);
            return [];
        }
    }

    async getAttachedDevices() {
        if (!this.client) return [];
        try {
            const { data, error } = await this.client.from('attached_devices').select('*').order('last_sync', { ascending: false });
            if (error || !data) return [];
            return data;
        } catch (e) {
            console.warn('[SupabaseService] Error loading attached devices:', e.message);
            return [];
        }
    }

    async getAssets() {
        if (!this.client) return [];
        try {
            const { data, error } = await this.client.from('assets').select('*').order('last_modified', { ascending: false });
            if (error || !data) return [];
            return data;
        } catch (e) {
            console.warn('[SupabaseService] Error loading assets:', e.message);
            return [];
        }
    }

    async saveDecision(decisionRecord) {
        if (!this.client) return { success: true, localOnly: true, data: decisionRecord };
        try {
            const { data, error } = await this.client.from('ai_decisions').insert(decisionRecord).select();
            if (error) throw error;
            return { success: true, data };
        } catch (e) {
            console.warn('[SupabaseService] Error saving decision:', e.message);
            return { success: false, error: e.message };
        }
    }

    subscribeToChanges(onChangeCallback) {
        if (!this.client) return;

        try {
            const channel = this.client
                .channel('omni_mesh_realtime_stream')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes' }, () => onChangeCallback('nodes'))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'attached_devices' }, () => onChangeCallback('devices'))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, () => onChangeCallback('assets'))
                .subscribe();

            this.realtimeChannels.push(channel);
        } catch (e) {
            console.warn('[SupabaseService] Realtime subscription notice:', e.message);
        }
    }
}

export const supabaseService = new SupabaseService();
