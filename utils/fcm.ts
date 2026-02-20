import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from "../supabaseClient";
import { CONFIG as APP_CONFIG } from "../config";

// Firebase configuration from config.ts
const firebaseConfig = APP_CONFIG.FIREBASE_CONFIG;

// Initialize Firebase variables
let app: any = null;
let messaging: any = null;

const isNative = Capacitor.isNativePlatform();

export const initFCM = async (userId?: string) => {
    try {
        // Dynamic check for user interaction on web
        if (!isNative && Notification.permission === 'default') {
            console.log("🔔 FCM: Web permission is default. Waiting for interaction or retrying...");
        }

        if (isNative) {
            await initNativePush(userId);
        } else {
            await initWebPush(userId);
        }
    } catch (err) {
        console.error("❌ FCM: System initialization error:", err);
    }
};

const initNativePush = async (userId?: string) => {
    try {
        console.log("🔔 FCM: Initializing Native Push (Capacitor)...");

        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
            permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
            console.warn("⚠️ FCM: Native notification permission not granted");
            return;
        }

        // ADD LISTENERS BEFORE REGISTERING
        PushNotifications.addListener('registration', async (token) => {
            console.log('✅ FCM: Native registration successful, token:', token.value);
            if (userId) {
                await syncFCMTokenToSupabase(userId, token.value);
            }
        });

        PushNotifications.addListener('registrationError', (err) => {
            console.error('❌ FCM: Native registration error:', err.error);
        });

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
            console.log('🔔 FCM: Push received:', notification);
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
            console.log('🔔 FCM: Push action performed:', notification);
        });

        await PushNotifications.register();

    } catch (err) {
        console.error("❌ FCM: Native init error:", err);
    }
};

const initWebPush = async (userId?: string) => {
    try {
        if (!APP_CONFIG.FIREBASE_CONFIG.apiKey) {
            console.warn("⚠️ FCM: Firebase config missing. Skipping web init.");
            return;
        }

        if (!app) {
            app = initializeApp(firebaseConfig);
            messaging = getMessaging(app);
        }

        console.log("🔔 FCM: Initializing Web Push...");

        // Request permission
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            console.warn("⚠️ FCM: Web notification permission not granted");
            return;
        }

        // Get FCM Token
        const token = await getToken(messaging, {
            vapidKey: APP_CONFIG.FCM_VAPID_KEY
        });

        if (token) {
            console.log("✅ FCM: Web token generated:", token);
            if (userId) {
                await syncFCMTokenToSupabase(userId, token);
            }
        } else {
            console.warn("⚠️ FCM: No web registration token available");
        }

        // Listen for foreground messages
        onMessage(messaging, (payload) => {
            console.log("🔔 FCM: Web message received in foreground:", payload);
            const notificationTitle = payload.notification?.title || 'New Notification';
            const notificationOptions = {
                body: payload.notification?.body || '',
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                data: payload.data
            };

            if (Notification.permission === 'granted') {
                new Notification(notificationTitle, notificationOptions);
            }
        });

    } catch (err) {
        console.error("❌ FCM: Web init error:", err);
    }
};

export const syncFCMTokenToSupabase = async (userId: string, token: string) => {
    try {
        if (!userId || !token) return;

        console.log(`📡 FCM: Syncing token to user ${userId}...`);

        const { error } = await supabase
            .from('profiles')
            .update({
                fcm_token: token,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) {
            console.error('❌ FCM: Failed to sync token to Supabase:', error);
        } else {
            console.log('✅ FCM: Token synced to Supabase successfully');
        }
    } catch (err) {
        console.error('❌ FCM: Sync exception:', err);
    }
};
