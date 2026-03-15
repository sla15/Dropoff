import { supabase } from '../supabaseClient';
import { Capacitor } from '@capacitor/core';

export const logError = async (error: Error | string, context?: Record<string, any>) => {
    try {
        const message = typeof error === 'string' ? error : error.message;
        const stack = typeof error === 'string' ? '' : error.stack;
        const metadata = {
            ...context,
            stack,
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        const platform = Capacitor.getPlatform(); // 'web', 'ios', or 'android'

        // Don't await to avoid blocking the thread during a crash
        supabase.from('app_logs').insert({
            level: 'error',
            message: message,
            metadata: metadata,
            platform: platform,
            app_version: '1.0.0', // Optionally, dynamic via Capacitor App API
            // Note: user_id will be automatically recorded if RLS is set or manually set 
            // but we can let the session do its magic if the user is authenticated
        }).then(({ error: dbError }) => {
            if (dbError) console.error("Logger Failed to Save:", dbError);
        });
        
    } catch (e) {
        console.error("Critical Logger Failure:", e);
    }
};

export const setupGlobalErrorHandlers = () => {
    // Catch unhandled Promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        console.error("Unhandled Rejection:", event.reason);
        logError(event.reason || "Unknown Unhandled Rejection", { type: 'unhandledrejection' });
    });

    // Catch general runtime errors
    window.addEventListener('error', (event) => {
        console.error("Global Error:", event.error || event.message);
        logError(event.error || event.message, { type: 'error', filename: event.filename, lineno: event.lineno, colno: event.colno });
    });
};
