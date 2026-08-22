import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { useToast } from '../context/ToastContext';

export const usePushNotifications = () => {
  const showToast = useToast();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('PushNotifications')) return;

    let isSubscribed = true;

    const setupPush = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus?.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus?.receive !== 'granted') {
          console.warn('Push notification permission denied or not granted');
          return;
        }

        await PushNotifications.register().catch(err => {
          console.warn('Push registration skipped:', err);
        });

        if (isSubscribed) {
          await PushNotifications.addListener('registration', token => {
            console.info('Push registration token:', token?.value);
          }).catch(() => {});

          await PushNotifications.addListener('registrationError', err => {
            console.warn('Push registration error:', err);
          }).catch(() => {});

          await PushNotifications.addListener('pushNotificationReceived', notification => {
            if (notification?.title) {
              showToast(`${notification.title}: ${notification.body || ''}`, 'info', 5000);
            }
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('Push notification setup skipped:', err);
      }
    };

    setupPush();

    return () => {
      isSubscribed = false;
      try {
        PushNotifications.removeAllListeners().catch(() => {});
      } catch (e) {}
    };
  }, [showToast]);
};
