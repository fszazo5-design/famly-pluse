// capacitor.config.ts — Capacitor configuration for Guardian Safety
// This file configures how Capacitor packages the React web app into a
// native Android binary. Run `npx cap add android` then `npx cap sync`
// to generate the native project from this config.

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.guardian.safety',
  appName: 'نبض العائلة',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: '#0f172a',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_shield',
      iconColor: '#dc2626',
    },
    CapacitorUpdater: {
      // GitHub Releases are checked explicitly by the web layer.
      // Native/plugin changes still require a new APK/AAB release.
      autoUpdate: 'off',
      appReadyTimeout: 10000,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      keepUrlPathAfterReload: true,
    },
    FirebaseAuthentication: {
      providers: ['google.com'],
      skipNativeAuth: false,
    },
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
