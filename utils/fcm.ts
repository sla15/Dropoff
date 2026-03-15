import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
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
            console.log("🔔 FCM: Initializing Native Push for User:", userId || 'Guest');
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

        // 1. Create Channels for Android 8.0+
        if (Capacitor.getPlatform() === 'android') {
            await FirebaseMessaging.createChannel({
                id: 'ride_requests',
                name: 'Ride & Order Requests',
                description: 'Critical alerts for new rides and order updates',
                importance: 5, // Importance.HIGH
                visibility: 1, // Visibility.PUBLIC
                vibration: true,
                lights: true,
                lightColor: '#00E39A'
            });

            await FirebaseMessaging.createChannel({
                id: 'default',
                name: 'General Notifications',
                description: 'Updates and general information',
                importance: 3, // Importance.DEFAULT
                visibility: 1,
            });
            console.log("✅ FCM: Android Channels created");
        }

        // 2. Check/Request Permissions
        let permStatus = await FirebaseMessaging.checkPermissions();
        if (permStatus.receive === 'prompt') {
            permStatus = await FirebaseMessaging.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
            console.warn("⚠️ FCM: Push permission not granted:", permStatus.receive);
            return;
        }

        // 3. Register Listeners
        await FirebaseMessaging.removeAllListeners();

        FirebaseMessaging.addListener('notificationReceived', (event) => {
            console.log('🔔 FCM: Foreground push received:', event.notification);
        });

        FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
            console.log('🔔 FCM: Push action performed:', event.notification);
        });

        // 4. Register for remote notifications and get token
        console.log("📡 FCM: Getting token...");
        const result = await FirebaseMessaging.getToken();
        if (result.token) {
            console.log('✅ FCM: Token retrieved:', result.token);
            if (userId) {
                await syncFCMTokenToSupabase(userId, result.token);
            }
        }
        
        console.log("📡 FCM: Native initialization complete");

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
                icon: 'public\assets\logo.png',
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

        // Prevent redundant syncs only if it's the SAME user and SAME token
        const lastSyncToken = localStorage.getItem('last_fcm_sync_token');
        const lastSyncUser = localStorage.getItem('last_fcm_sync_user');
        
        if (lastSyncToken === token && lastSyncUser === userId) {
            console.log('📡 FCM: Token already synced for this user.');
            return;
        }

        console.log(`📡 FCM: Syncing token [${token.substring(0, 10)}...] for user ${userId}...`);

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
            console.log('✅ FCM: Token synced successfully to Supabase');
            localStorage.setItem('last_fcm_sync_token', token);
            localStorage.setItem('last_fcm_sync_user', userId);
        }
    } catch (err) {
        console.error('❌ FCM: Sync exception:', err);
    }
};
