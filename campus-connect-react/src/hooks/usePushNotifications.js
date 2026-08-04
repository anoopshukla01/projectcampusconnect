import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { useToast } from '../context/ToastContext';

export const usePushNotifications = () => {
  const showToast = useToast();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const registerPush = async () => {
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.warn('Push notification permission denied');
        return;
      }

      await PushNotifications.register();
    };

    const addListeners = async () => {
      await PushNotifications.addListener('registration', token => {
        console.info('Push registration success, token: ' + token.value);
        // In a real app, send this token to your backend
      });

      await PushNotifications.addListener('registrationError', err => {
        console.error('Push registration error: ', err.error);
      });

      await PushNotifications.addListener('pushNotificationReceived', notification => {
        showToast(notification.title + ': ' + notification.body, 'info', 5000);
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', notification => {
        console.log('Push notification action performed', notification.actionId, notification.notification);
      });
    };

    registerPush();
    addListeners();

    return () => {
      PushNotifications.removeAllListeners();
    };
  }, []);
};
