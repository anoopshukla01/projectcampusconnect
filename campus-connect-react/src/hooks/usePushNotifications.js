import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useToast } from '../context/ToastContext';

export const usePushNotifications = () => {
  const showToast = useToast();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    // Push notifications are gracefully handled via in-app toast & offline banners
    // to prevent native FCM crashes when google-services is absent.
  }, [showToast]);
};
