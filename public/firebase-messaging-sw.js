// firebase-messaging-sw.js — Service Worker for FCM Background Push
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyC5uK6CYIZ0icQfUUnAd57a5fHyudXxSc4",
    authDomain: "ride-gm.firebaseapp.com",
    projectId: "ride-gm",
    storageBucket: "ride-gm.firebasestorage.app",
    messagingSenderId: "791001809445",
    appId: "1:791001809445:web:6590e76daa77a607e4f5cc",
    measurementId: "G-T8J768GEFD"
});

const messaging = firebase.messaging();

// Handle background/app-closed messages
messaging.onBackgroundMessage((payload) => {
    console.log('[SW] FCM Background Message received:', payload);

    const title = payload.notification?.title || payload.data?.title || 'DROPOFF';
    const body = payload.notification?.body || payload.data?.body || 'You have a new notification';
    const icon = payload.notification?.image || '/favicon.ico';

    self.registration.showNotification(title, {
        body,
        icon,
        badge: '/favicon.ico',
        data: payload.data,
        tag: payload.data?.type || 'default',
        renotify: true,
        requireInteraction: payload.data?.type === 'ride_request' || payload.data?.type === 'order_request',
    });
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[SW] Notification clicked:', event.notification.tag);
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes('localhost') || client.url.includes('ridegambia.com')) {
                    return client.focus();
                }
            }
            return clients.openWindow('https://ridegambia.com/dashboard');
        })
    );
});
