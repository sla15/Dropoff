
// Import and configure the Firebase SDK
// These scripts are made available when the app is served locally or deployed.
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
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

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);

    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        // icon: '/assets/app_logo.png' // Removed broken path to prevent display errors
        data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
