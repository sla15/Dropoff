
export const CONFIG = {
  // ==========================================
  // 1. GOOGLE MAPS PLATFORM
  // Enable: Maps JS API, Places API, Directions API, Distance Matrix API
  // Console: https://console.cloud.google.com/google/maps-apis
  // ==========================================
  GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',

  // ==========================================
  // 2. SUPABASE (Database & Auth)
  // Project Settings -> API
  // Console: https://supabase.com/dashboard/project/_/settings/api
  // ==========================================
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY || '',

  // ==========================================
  // 3. TWILIO (SMS & OTP)
  // HANDLED BY SUPABASE BACKEND
  // ==========================================

  // ==========================================
  // 4. FIREBASE & FCM (Push Notifications)
  // ==========================================
  FIREBASE_CONFIG: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyC5qcs0wMfkq4n-Mwf2er1-llBHshTh-ik',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'ride-gm.firebaseapp.com',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'ride-gm',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'ride-gm.firebasestorage.app',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '791001809445',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:791001809445:android:347eb9446745fffce4f5cc',
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ''
  },
  FCM_VAPID_KEY: import.meta.env.VITE_FCM_VAPID_KEY || '',

  GOOGLE_AI_API_KEY: import.meta.env.VITE_GOOGLE_AI_API_KEY || '', // Add your Gemini key to .env
};
