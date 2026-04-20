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
      launchShowDuration: 0,
    },
    Keyboard: {
      resize: 'body' as any,
      style: 'dark' as any,
    },
    FirebaseMessaging: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  }
};

export default config;
