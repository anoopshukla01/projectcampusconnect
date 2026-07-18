import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.college.campusconnect',
  appName: 'Campus Connect',
  webDir: 'dist',
  server: {
    url: 'https://projectcampusconnect.vercel.app',
    cleartext: true
  }
};

export default config;
