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
        this.realtimeChannels = [];
        this.init();
    }

    init() {
        try {
            this.client = createClient(this.url, this.key, {
                auth: { persistSession: false },
                realtime: { params: { eventsPerSecond: 20 } }
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

    async getNodes() {
        if (!this.client) return [];
        try {
            const { data, error } = await this.client
                .from('nodes')
                .select('*')
                .order('last_heartbeat', { ascending: false });
            if (error) {
                console.warn('[SupabaseService] Nodes query error:', error.message);
                return [];
            }
            return data || [];
        } catch (e) {
            console.warn('[SupabaseService] Error loading nodes:', e.message);
            return [];
        }
    }

    async getAttachedDevices() {
        if (!this.client) return [];
        try {
            const { data, error } = await this.client
                .from('attached_devices')
                .select('*')
                .order('last_sync', { ascending: false });
            if (error) {
                console.warn('[SupabaseService] Devices query error:', error.message);
                return [];
            }
            return data || [];
        } catch (e) {
            console.warn('[SupabaseService] Error loading attached devices:', e.message);
            return [];
        }
    }

    async getAssets() {
        if (!this.client) return [];
        try {
            const { data, error } = await this.client
                .from('assets')
                .select('*')
                .order('last_modified', { ascending: false })
                .limit(5000);
            if (error) {
                console.warn('[SupabaseService] Assets query error:', error.message);
                return [];
            }
            return data || [];
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
