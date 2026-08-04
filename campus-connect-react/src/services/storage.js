import { Capacitor } from '@capacitor/core';
import * as SecureStorage from '@aparajita/capacitor-secure-storage';

const isNative = Capacitor.isNativePlatform();

export const storage = {
  async set(key, value) {
    if (isNative) {
      await SecureStorage.set({ key, value });
    } else {
      localStorage.setItem(key, value);
    }
  },

  async get(key) {
    if (isNative) {
      const { value } = await SecureStorage.get({ key });
      return value;
    } else {
      return localStorage.getItem(key);
    }
  },

  async remove(key) {
    if (isNative) {
      await SecureStorage.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
  },

  async clear() {
    if (isNative) {
      await SecureStorage.clear();
    } else {
      localStorage.clear();
    }
  }
};
