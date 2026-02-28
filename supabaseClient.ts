
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config';

// Initialize Supabase Client with optimized realtime settings for mobile
export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
    },
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
        // Send a heartbeat more frequently (15s) to prevent mobile browsers/proxies from dropping idle connections
        heartbeatIntervalMs: 15000,
    }
});
