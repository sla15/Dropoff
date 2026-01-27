
export const CONFIG = {
  // ==========================================
  // 1. GOOGLE MAPS PLATFORM
  // Enable: Maps JS API, Places API, Directions API, Distance Matrix API
  // Console: https://console.cloud.google.com/google/maps-apis
  // ==========================================
  GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,

  // ==========================================
  // 2. SUPABASE (Database & Auth)
  // Project Settings -> API
  // Console: https://supabase.com/dashboard/project/_/settings/api
  // ==========================================
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,

  // ==========================================
  // 3. TWILIO (SMS & OTP)
  // HANDLED BY SUPABASE BACKEND
  // ==========================================

  // ==========================================
  // 4. ONESIGNAL (Push Notifications)
  // Console: https://dashboard.onesignal.com/apps
  // ==========================================
  ONESIGNAL_APP_ID: import.meta.env.VITE_ONESIGNAL_APP_ID,
};
