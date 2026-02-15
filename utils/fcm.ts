import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { supabase } from "../supabaseClient";
import { CONFIG as APP_CONFIG } from "../config";

/* 
// 📲 TWILIO SMS CONFIGURATION (FOR PRODUCTION)
// This is as test numbers for now. Twilio API key will be added here later.
const TWILIO_CONFIG = {
  accountSid: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', // Placeholder
  authToken: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',   // Placeholder
  fromNumber: '+1234567890'                        // Placeholder
};
*/

// Firebase configuration from config.ts
const firebaseConfig = APP_CONFIG.FIREBASE_CONFIG;

// Initialize Firebase
// Initialize Firebase variables
let app: any = null;
let messaging: any = null;

export const initFCM = async (userId?: string) => {
    try {
        if (!APP_CONFIG.FIREBASE_CONFIG.apiKey) {
            console.warn("⚠️ FCM: Firebase config missing. Skipping init.");
            return;
        }

        if (!app) {
            app = initializeApp(firebaseConfig);
            messaging = getMessaging(app);
        }

        console.log("🔔 FCM: Starting initialization...");

        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            console.warn("⚠️ FCM: Notification permission not granted");
            return;
        }

        // Get FCM Token
        const token = await getToken(messaging, {
            vapidKey: APP_CONFIG.FCM_VAPID_KEY
        });

        if (token) {
            console.log("✅ FCM: Token generated:", token);
            if (userId) {
                await syncFCMTokenToSupabase(userId, token);
            }
        } else {
            console.warn("⚠️ FCM: No registration token available");
        }

        // Listen for foreground messages
        onMessage(messaging, (payload) => {
            console.log("🔔 FCM: Message received in foreground:", payload);

            // Display the notification even when app is in foreground
            const notificationTitle = payload.notification?.title || 'New Notification';
            const notificationOptions = {
                body: payload.notification?.body || '',
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                data: payload.data,
                requireInteraction: false,
                tag: payload.data?.type || 'default' // Prevents duplicate notifications
            };

            // Show the notification
            if (Notification.permission === 'granted') {
                new Notification(notificationTitle, notificationOptions);
            }
        });

    } catch (err) {
        console.error("❌ FCM: Initialization error:", err);
    }
};

export const syncFCMTokenToSupabase = async (userId: string, token: string) => {
    try {
        const { error } = await supabase
            .from('profiles')
            .update({ fcm_token: token })
            .eq('id', userId);

        if (error) {
            console.error('❌ FCM: Failed to sync token to Supabase:', error);
        } else {
            console.log('✅ FCM: Token synced to Supabase');
        }
    } catch (err) {
        console.error('❌ FCM: Sync exception:', err);
    }
};
