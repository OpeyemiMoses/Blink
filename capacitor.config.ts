import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.blink.solanamobile',
  appName: 'Blink',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#07080B",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
  },
};

export default config;

