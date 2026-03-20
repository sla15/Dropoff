import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { FirebaseMessaging } from '@capacitor-firebase/messaging';
import { Capacitor } from '@capacitor/core';
import { supabase } from "../supabaseClient";
import { CONFIG as APP_CONFIG } from "../config";

const firebaseConfig = APP_CONFIG.FIREBASE_CONFIG;
let app: any = null;
let messaging: any = null;
const isNative = Capacitor.isNativePlatform();

export const initFCM = async (userId?: string) => {
    try {
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

        // 1. Create channels for Android 8.0+
        if (Capacitor.getPlatform() === 'android') {
            try {
                await FirebaseMessaging.createChannel({
                    id: 'ride_requests',
                    name: 'Ride & Order Requests',
                    description: 'Critical alerts for new rides and order updates',
                    importance: 5, // MAX importance = heads-up notification
                    visibility: 1, // PUBLIC
                    vibration: true,
                    lights: true,
                    lightColor: '#00E39A',
                    sound: 'default',
                });
                await FirebaseMessaging.createChannel({
                    id: 'default',
                    name: 'General Notifications',
                    description: 'Updates and general information',
                    importance: 4, // HIGH
                    visibility: 1, // PUBLIC
                    vibration: true,
                    sound: 'default',
                });
                console.log("✅ FCM: Android Channels created (ride_requests + default)");
            } catch (channelErr) {
                console.warn("⚠️ FCM: Channel creation warning:", channelErr);
            }
        }

        // 2. Check / request FCM permissions
        let permStatus = await FirebaseMessaging.checkPermissions();
        console.log("🔔 FCM: Current permission status:", permStatus.receive);
        if (permStatus.receive === 'prompt') {
            permStatus = await FirebaseMessaging.requestPermissions();
            console.log("🔔 FCM: Permission after request:", permStatus.receive);
        }
        if (permStatus.receive !== 'granted') {
            console.warn("⚠️ FCM: Push permission not granted:", permStatus.receive);
            return;
        }

        // 3. Register listeners
        await FirebaseMessaging.removeAllListeners();

        // Foreground notifications: With notification_foreground: "true" in the
        // data payload (set in the edge function), @capacitor-firebase/messaging
        // will automatically show the notification in the system tray.
        // This listener is for when we want to do something EXTRA with the data.
        FirebaseMessaging.addListener('notificationReceived', (event) => {
            console.log('🔔 FCM: Foreground notification received:', JSON.stringify(event.notification));
            // The notification is already shown by the plugin thanks to 
            // notification_foreground: "true" in the data payload.
            // No need for LocalNotifications.
        });

        // When user taps on a notification
        FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
            console.log('🔔 FCM: Notification tapped:', event.notification?.title);
            // Future: navigate to relevant screen based on event.notification.data?.type
        });

        // 4. Get and sync the FCM token
        console.log("📡 FCM: Getting device token...");
        const result = await FirebaseMessaging.getToken();
        if (result.token) {
            console.log('✅ FCM: Token retrieved:', result.token.substring(0, 30) + '...');
            if (userId) {
                await syncFCMTokenToSupabase(userId, result.token);
            }
        } else {
            console.warn("⚠️ FCM: getToken() returned no token");
        }

        console.log("✅ FCM: Native initialization complete");

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
        if (typeof Notification === 'undefined') {
            console.warn("⚠️ FCM: Notification API not available in this browser.");
            return;
        }
        if (Notification.permission === 'denied') {
            console.warn("⚠️ FCM: Web notifications are blocked by the browser.");
            return;
        }

        if (!APP_CONFIG.FCM_VAPID_KEY) {
            console.warn("⚠️ FCM: VITE_FCM_VAPID_KEY is not set. Web push token cannot be obtained. Add it to your .env file.");
            return;
        }

        if (!app) {
            app = initializeApp(firebaseConfig);
            messaging = getMessaging(app);
        }

        console.log("🔔 FCM: Requesting Web Push permission...");
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            console.warn("⚠️ FCM: Web permission not granted:", permission);
            return;
        }

        // Explicitly register the service worker to ensure it's ready before getToken
        let swReg: ServiceWorkerRegistration | undefined;
        try {
            swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
            await navigator.serviceWorker.ready; // Wait for SW to be active
            console.log("✅ FCM: Service Worker registered:", swReg.scope);
        } catch (swErr) {
            console.warn("⚠️ FCM: Service Worker registration failed:", swErr);
        }

        const token = await getToken(messaging, {
            vapidKey: APP_CONFIG.FCM_VAPID_KEY,
            serviceWorkerRegistration: swReg
        });

        if (token) {
            console.log("✅ FCM: Web token:", token.substring(0, 30) + '...');
            if (userId) await syncFCMTokenToSupabase(userId, token);
        } else {
            console.warn("⚠️ FCM: No web token returned — check VAPID key and service worker");
        }

        // Web foreground: show browser notification
        onMessage(messaging, (payload) => {
            console.log("🔔 FCM: Web foreground message:", payload);
            const title = payload.notification?.title || payload.data?.notification_title || 'DROPOFF';
            const options: NotificationOptions = {
                body: payload.notification?.body || payload.data?.notification_body || '',
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: payload.data?.type || 'default',
                data: payload.data,
            };
            if (Notification.permission === 'granted') {
                const n = new Notification(title, options);
                n.onclick = () => { window.focus(); n.close(); };
            }
        });

    } catch (err) {
        console.error("❌ FCM: Web init error:", err);
    }
};

export const syncFCMTokenToSupabase = async (userId: string, token: string) => {
    try {
        if (!userId || !token) return;
        const lastToken = localStorage.getItem('customer_last_fcm_sync_token_v2');
        const lastUser = localStorage.getItem('customer_last_fcm_sync_user_v2');
        if (lastToken === token && lastUser === userId) {
            console.log('📡 FCM: Token already synced, skipping.');
            return;
        }

        const { error } = await supabase.rpc('add_fcm_token', {
            p_user_id: userId,
            p_token: token
        });

        if (error) {
            console.error('❌ FCM: Sync failed:', error);
        } else {
            console.log('✅ FCM: Token synced to Supabase');
            localStorage.setItem('customer_last_fcm_sync_token_v2', token);
            localStorage.setItem('customer_last_fcm_sync_user_v2', userId);
        }
    } catch (err) {
        console.error('❌ FCM: Sync exception:', err);
    }
};
