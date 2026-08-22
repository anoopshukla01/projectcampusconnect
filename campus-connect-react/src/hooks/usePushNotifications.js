import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { useToast } from '../context/ToastContext';

export const usePushNotifications = () => {
  const showToast = useToast();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('PushNotifications')) return;

    const requestNativeNotificationPermission = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus?.receive === 'prompt') {
          // Triggers Android 13+ native OS permission dialog cleanly
          await PushNotifications.requestPermissions();
        }
      } catch (err) {
        console.warn('Notification permission request:', err);
      }
    };

    requestNativeNotificationPermission();
  }, [showToast]);
};
