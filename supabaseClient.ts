import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config';
import { capacitorStorage } from './utils/capacitorStorage';

const fetchWithTimeout = (url: RequestInfo | URL, options: RequestInit | undefined) => {
    return new Promise<Response>((resolve, reject) => {
        // 12-second timeout for Supabase HTTP requests to prevent mobile UI hanging
        const timeoutId = setTimeout(() => {
            reject(new Error("Network timeout: The request took too long. Please check your connection."));
        }, 12000);

        fetch(url, options)
            .then((response) => {
                clearTimeout(timeoutId);
                resolve(response);
            })
            .catch((error) => {
                clearTimeout(timeoutId);
                reject(error);
            });
    });
};

// Initialize Supabase Client with optimized realtime settings for mobile
export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        storage: capacitorStorage,
        autoRefreshToken: true,
        detectSessionInUrl: false, // Disable for native performance
    },
    global: {
        fetch: fetchWithTimeout
    },
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
        // Send a heartbeat more frequently (15s) to prevent mobile browsers/proxies from dropping idle connections
        heartbeatIntervalMs: 15000,
    }
});
