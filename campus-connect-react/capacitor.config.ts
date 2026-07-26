import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.college.campusconnect',
  appName: 'Campus Connect',
  webDir: 'dist',
  // No `server.url` here — Capacitor serves the bundled dist/ folder.
  // For local dev/testing only, you can temporarily restore:
  //   server: { url: 'http://YOUR_LOCAL_IP:5173', cleartext: true }
  // Remove it before building a release APK.
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,   // set true only for debug builds
  },
};

export default config;
