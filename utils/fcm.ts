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

const showLocalNotification = async (title: string, body: string, data?: any) => {
    try {
        console.log("🔔 FCM: Displaying local notification:", title, body);
        await FirebaseMessaging.createChannel({
            id: 'default',
            name: 'General Notifications',
            importance: 3,
            visibility: 1,
        });
        // Use the Capacitor Local Notifications to display
        // Since the SDK might not directly support showing, we create it via notification API
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        await LocalNotifications.schedule({
            notifications: [{
                id: Math.floor(Math.random() * 100000),
                title: title || 'DROPOFF',
                body: body || '',
                extra: data,
                sound: 'default',
                smallIcon: 'ic_stat_onesignal_default',
                channelId: (data?.type && ['ride_request', 'order_request', 'new_delivery', 'batch_update'].includes(data.type))
                    ? 'ride_requests'
                    : 'default',
            }]
        });
    } catch (err) {
        console.error("❌ FCM: Local notification display error:", err);
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

        // CRITICAL FIX: When app is in foreground, FCM suppresses the system notification.
        // We must manually display it using Local Notifications.
        FirebaseMessaging.addListener('notificationReceived', async (event) => {
            const notif = event.notification;
            console.log('🔔 FCM: Foreground push received, displaying locally:', notif.title);
            await showLocalNotification(
                notif.title || 'DROPOFF',
                notif.body || '',
                notif.data
            );
        });

        FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
            console.log('🔔 FCM: Push tapped:', event.notification.title);
            // TODO: Route to relevant screen based on event.notification.data?.type
        });

        // 4. Register for remote notifications and get token
        console.log("📡 FCM: Getting token...");
        const result = await FirebaseMessaging.getToken();
        if (result.token) {
            console.log('✅ FCM: Token retrieved:', result.token.substring(0, 20) + '...');
            if (userId) {
                await syncFCMTokenToSupabase(userId, result.token);
            }
        } else {
            console.warn("⚠️ FCM: No token returned from getToken()");
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
            console.warn("⚠️ FCM: Web notifications are blocked by user.");
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
            vapidKey: APP_CONFIG.FCM_VAPID_KEY,
            serviceWorkerRegistration: await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js')
        });

        if (token) {
            console.log("✅ FCM: Web token generated:", token.substring(0, 20) + '...');
            if (userId) {
                await syncFCMTokenToSupabase(userId, token);
            }
        } else {
            console.warn("⚠️ FCM: No web registration token available");
        }

        // Listen for foreground messages and show them manually
        onMessage(messaging, (payload) => {
            console.log("🔔 FCM: Web foreground message received:", payload);
            const notificationTitle = payload.notification?.title || 'DROPOFF';
            const notificationOptions: NotificationOptions = {
                body: payload.notification?.body || '',
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                data: payload.data,
                tag: payload.data?.type || 'default',
            };

            if (Notification.permission === 'granted') {
                const n = new Notification(notificationTitle, notificationOptions);
                n.onclick = () => {
                    window.focus();
                    n.close();
                };
            }
        });

    } catch (err) {
        console.error("❌ FCM: Web init error:", err);
    }
};

export const syncFCMTokenToSupabase = async (userId: string, token: string) => {
    try {
        if (!userId || !token) return;

        const lastSyncToken = localStorage.getItem('last_fcm_sync_token');
        const lastSyncUser = localStorage.getItem('last_fcm_sync_user');

        if (lastSyncToken === token && lastSyncUser === userId) {
            console.log('📡 FCM: Token already synced for this user.');
            return;
        }

        console.log(`📡 FCM: Syncing token for user ${userId}...`);

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
