import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dropoffgambia.customer',
  appName: 'DROPOFF',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
    allowNavigation: ['*']
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#000000",
      androidScaleType: "FIT_CENTER",
      showSpinner: false,
    },
    Keyboard: {
      resize: 'body' as any,
      style: 'dark' as any,
    },
    FirebaseMessaging: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    Badge: {
      autoClear: true,
    },
  }
};

export default config;
