import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://xfednxvbjzfssxyaurbc.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmZWRueHZianpmc3N4eWF1cmJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MDQxNzIsImV4cCI6MjEwNDM4MDE3Mn0.2CRXJvkmTUaFXkyGxaSUY0OS1ZCxr0EwLFxJljiFqjc';

class SupabaseService {
    constructor() {
        const storedUrl = localStorage.getItem('omni_supabase_url');
        const storedKey = localStorage.getItem('omni_supabase_key');

        this.url = (storedUrl && storedUrl.length > 5) ? storedUrl : DEFAULT_SUPABASE_URL;
        this.key = (storedKey && storedKey.length > 10) ? storedKey : DEFAULT_SUPABASE_KEY;
        this.client = null;
        this.isConfigured = false;
        this.cachedNodes = JSON.parse(localStorage.getItem('omni_cached_nodes') || '[]');
        this.cachedDevices = JSON.parse(localStorage.getItem('omni_cached_devices') || '[]');
        this.cachedAssets = JSON.parse(localStorage.getItem('omni_cached_assets') || '[]');
        this.realtimeChannels = [];
        this.inFlightFetch = null;
        this.init();
    }

    init() {
        try {
            this.client = createClient(this.url, this.key, {
                auth: { 
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                },
                realtime: { params: { eventsPerSecond: 10 } }
            });
            this.isConfigured = true;
            console.log('[SupabaseService] Initialized with Supabase URL:', this.url);
        } catch (err) {
            console.error('[SupabaseService] Init error:', err);
            this.isConfigured = false;
        }
    }

    setCredentials(url, key) {
        this.url = (url && url.trim().length > 5) ? url.trim() : DEFAULT_SUPABASE_URL;
        this.key = (key && key.trim().length > 10) ? key.trim() : DEFAULT_SUPABASE_KEY;
        localStorage.setItem('omni_supabase_url', this.url);
        localStorage.setItem('omni_supabase_key', this.key);
        this.init();
    }

    async getNodes(timeoutMs = 2500) {
        if (!this.client) return this.cachedNodes;
        try {
            const queryPromise = this.client
                .from('nodes')
                .select('*')
                .order('last_heartbeat', { ascending: false })
                .limit(20);

            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Nodes timeout')), timeoutMs));
            const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

            if (error) {
                console.warn('[SupabaseService] Nodes query error:', error.message);
                return this.cachedNodes;
            }
            if (data && data.length > 0) {
                this.cachedNodes = data;
                try { localStorage.setItem('omni_cached_nodes', JSON.stringify(data)); } catch (e) {}
            }
            return this.cachedNodes;
        } catch (e) {
            return this.cachedNodes;
        }
    }

    async getAttachedDevices(timeoutMs = 2500) {
        if (!this.client) return this.cachedDevices;
        try {
            const queryPromise = this.client
                .from('attached_devices')
                .select('*')
                .order('last_sync', { ascending: false })
                .limit(20);

            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Devices timeout')), timeoutMs));
            const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

            if (error) {
                console.warn('[SupabaseService] Devices query error:', error.message);
                return this.cachedDevices;
            }
            if (data && data.length > 0) {
                this.cachedDevices = data;
                try { localStorage.setItem('omni_cached_devices', JSON.stringify(data)); } catch (e) {}
            }
            return this.cachedDevices;
        } catch (e) {
            return this.cachedDevices;
        }
    }

    async getAssets(timeoutMs = 2500) {
        if (!this.client) return this.cachedAssets;
        try {
            const queryPromise = this.client
                .from('assets')
                .select('*')
                .order('last_modified', { ascending: false })
                .limit(300);

            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Assets timeout')), timeoutMs));
            const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

            if (error) {
                console.warn('[SupabaseService] Assets query error:', error.message);
                return this.cachedAssets;
            }
            if (data && data.length > 0) {
                this.cachedAssets = data;
                try { localStorage.setItem('omni_cached_assets', JSON.stringify(data)); } catch (e) {}
            }
            return this.cachedAssets;
        } catch (e) {
            return this.cachedAssets;
        }
    }

    async fetchAllMeshState(timeoutMs = 3000) {
        if (this.inFlightFetch) return this.inFlightFetch;

        this.inFlightFetch = (async () => {
            try {
                const [nodes, devices, assets] = await Promise.all([
                    this.getNodes(timeoutMs),
                    this.getAttachedDevices(timeoutMs),
                    this.getAssets(timeoutMs)
                ]);
                return { nodes, devices, assets };
            } finally {
                this.inFlightFetch = null;
            }
        })();

        return this.inFlightFetch;
    }

    async saveDecision(decisionRecord) {
        if (!this.client) return { success: true, localOnly: true, data: decisionRecord };
        try {
            const insertPromise = this.client.from('ai_decisions').insert(decisionRecord).select();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Save timeout')), 3000));
            const { data, error } = await Promise.race([insertPromise, timeoutPromise]);
            if (error) throw error;
            return { success: true, data };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    subscribeToChanges(onChangeCallback) {
        if (!this.client) return;

        try {
            const channel = this.client
                .channel('omni_mesh_realtime_broadcast')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'nodes' }, () => onChangeCallback('nodes'))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'attached_devices' }, () => onChangeCallback('devices'))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, () => onChangeCallback('assets'))
                .subscribe((status) => {
                    console.log('[Supabase Realtime Status]:', status);
                });

            this.realtimeChannels.push(channel);
        } catch (e) {
            console.warn('[SupabaseService] Realtime subscription notice:', e.message);
        }
    }
}

export const supabaseService = new SupabaseService();
