import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';

export const useDeepLinks = () => {
  const navigate = useNavigate();
  const showToast = useToast();

  useEffect(() => {
    App.addListener('appUrlOpen', data => {
      // Example: campusconnect://settings -> navigates to /settings
      const slug = data.url.split('://').pop();
      if (slug) {
        showToast('Opening ' + slug, 'info');
        navigate('/' + slug);
      }
    });

    return () => {
      App.removeAllListeners();
    };
  }, [navigate, showToast]);
};
