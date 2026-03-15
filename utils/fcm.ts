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

/**
 * Shows a local notification when the app is in the FOREGROUND.
 * FCM suppresses system notifications when the app is open — this bypasses that.
 */
const showLocalNotification = async (title: string, body: string, data?: any) => {
    try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        
        // Check and request permissions first (required on Android 13+)
        let permStatus = await LocalNotifications.checkPermissions();
        if (permStatus.display === 'prompt') {
            permStatus = await LocalNotifications.requestPermissions();
        }
        if (permStatus.display !== 'granted') {
            console.warn("⚠️ FCM: Local notification permission not granted:", permStatus.display);
            return;
        }

        const isUrgent = data?.type && ['ride_request', 'order_request', 'new_delivery', 'batch_update'].includes(data.type);

        await LocalNotifications.schedule({
            notifications: [{
                id: Math.floor(Math.random() * 2147483647), // Max int value for Android
                title: title || 'DROPOFF',
                body: body || '',
                extra: data,
                sound: 'default',
                // 'ic_launcher' is guaranteed to exist in every Capacitor build
                // Do NOT use 'ic_stat_onesignal_default' — that icon doesn't exist
                smallIcon: 'ic_launcher',
                iconColor: isUrgent ? '#00E39A' : '#00D68F',
                channelId: isUrgent ? 'ride_requests' : 'default',
                autoCancel: true,
            }]
        });
        console.log("✅ FCM: Foreground local notification displayed:", title);
    } catch (err) {
        console.error("❌ FCM: Local notification display error:", err);
    }
};

const initNativePush = async (userId?: string) => {
    try {
        console.log("🔔 FCM: Initializing Native Push (Capacitor)...");

        // 1. Create channels for Android 8.0+
        if (Capacitor.getPlatform() === 'android') {
            await FirebaseMessaging.createChannel({
                id: 'ride_requests',
                name: 'Ride & Order Requests',
                description: 'Critical alerts for new rides and order updates',
                importance: 5,
                visibility: 1,
                vibration: true,
                lights: true,
                lightColor: '#00E39A'
            });
            await FirebaseMessaging.createChannel({
                id: 'default',
                name: 'General Notifications',
                description: 'Updates and general information',
                importance: 4,
                visibility: 1,
                vibration: true,
            });
            console.log("✅ FCM: Android Channels created");
        }

        // 2. Check / request FCM permissions
        let permStatus = await FirebaseMessaging.checkPermissions();
        if (permStatus.receive === 'prompt') {
            permStatus = await FirebaseMessaging.requestPermissions();
        }
        if (permStatus.receive !== 'granted') {
            console.warn("⚠️ FCM: Push permission not granted:", permStatus.receive);
            return;
        }

        // 3. Register listeners (remove old ones first to avoid duplicates)
        await FirebaseMessaging.removeAllListeners();

        // CRITICAL: When app is FOREGROUND, FCM does NOT show a system notification.
        // We must manually display it using LocalNotifications.
        FirebaseMessaging.addListener('notificationReceived', async (event) => {
            const notif = event.notification;
            console.log('🔔 FCM: Foreground message received → showing local notification:', notif.title);
            await showLocalNotification(
                notif.title || 'DROPOFF',
                notif.body || '',
                notif.data
            );
        });

        FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
            console.log('🔔 FCM: Push notification tapped:', event.notification.title);
            // Future: navigate to relevant screen based on event.notification.data?.type
        });

        // 4. Get and sync the FCM token
        console.log("📡 FCM: Getting device token...");
        const result = await FirebaseMessaging.getToken();
        if (result.token) {
            console.log('✅ FCM: Token retrieved:', result.token.substring(0, 20) + '...');
            if (userId) {
                await syncFCMTokenToSupabase(userId, result.token);
            }
        } else {
            console.warn("⚠️ FCM: getToken() returned no token");
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
        if (Notification.permission === 'denied') {
            console.warn("⚠️ FCM: Web notifications are blocked by the browser.");
            return;
        }

        if (!app) {
            app = initializeApp(firebaseConfig);
            messaging = getMessaging(app);
        }

        console.log("🔔 FCM: Initializing Web Push...");
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            console.warn("⚠️ FCM: Web permission not granted");
            return;
        }

        const swReg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        const token = await getToken(messaging, {
            vapidKey: APP_CONFIG.FCM_VAPID_KEY,
            serviceWorkerRegistration: swReg
        });

        if (token) {
            console.log("✅ FCM: Web token generated:", token.substring(0, 20) + '...');
            if (userId) await syncFCMTokenToSupabase(userId, token);
        } else {
            console.warn("⚠️ FCM: No web token available — check VAPID key and service worker registration");
        }

        // Foreground web messages: show a native browser notification
        onMessage(messaging, (payload) => {
            console.log("🔔 FCM: Web foreground message:", payload);
            const title = payload.notification?.title || 'DROPOFF';
            const options: NotificationOptions = {
                body: payload.notification?.body || '',
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
        const lastToken = localStorage.getItem('last_fcm_sync_token');
        const lastUser = localStorage.getItem('last_fcm_sync_user');
        if (lastToken === token && lastUser === userId) {
            console.log('📡 FCM: Token already synced for this user, skipping.');
            return;
        }

        const { error } = await supabase
            .from('profiles')
            .update({ fcm_token: token, updated_at: new Date().toISOString() })
            .eq('id', userId);

        if (error) {
            console.error('❌ FCM: Failed to sync token:', error);
        } else {
            console.log('✅ FCM: Token synced to Supabase');
            localStorage.setItem('last_fcm_sync_token', token);
            localStorage.setItem('last_fcm_sync_user', userId);
        }
    } catch (err) {
        console.error('❌ FCM: Sync exception:', err);
    }
};
