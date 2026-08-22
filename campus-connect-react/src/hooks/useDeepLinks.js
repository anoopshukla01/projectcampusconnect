import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

export const useDeepLinks = () => {
  const navigate = useNavigate();
  const showToast = useToast();

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('App')) return;

    let listenerHandle = null;

    const setupDeepLinks = async () => {
      try {
        listenerHandle = await App.addListener('appUrlOpen', data => {
          try {
            const slug = data?.url?.split('://').pop();
            if (slug) {
              showToast('Opening ' + slug, 'info');
              navigate('/' + slug);
            }
          } catch (e) {
            console.warn('Deep link navigation error:', e);
          }
        });
      } catch (err) {
        console.warn('Deep link listener error:', err);
      }
    };

    setupDeepLinks();

    return () => {
      if (listenerHandle) {
        try {
          listenerHandle.remove();
        } catch (e) {}
      }
    };
  }, [navigate, showToast]);
};
