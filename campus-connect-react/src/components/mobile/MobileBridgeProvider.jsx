import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Network } from '@capacitor/network';
import { WifiOff, RefreshCw } from 'lucide-react';

export function MobileBridgeProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    // 1. Configure native status bar
    const initStatusBar = async () => {
      if (Capacitor.isNativePlatform() || Capacitor.isPluginAvailable('StatusBar')) {
        try {
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#4338ca' });
        } catch (err) {
          console.warn('StatusBar initialization:', err);
        }
      }
    };
    initStatusBar();

    // 2. Hardware back button handler for Android
    let backListenerHandle = null;
    if (Capacitor.isNativePlatform() || Capacitor.isPluginAvailable('App')) {
      CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        const path = location.pathname;
        if (path === '/dashboard' || path === '/auth/login' || path === '/' || path === '/login') {
          CapacitorApp.exitApp();
        } else if (canGoBack) {
          window.history.back();
        } else {
          navigate('/dashboard');
        }
      }).then(handle => {
        backListenerHandle = handle;
      });
    }

    // 3. Network listener for offline status
    const setupNetwork = async () => {
      try {
        const status = await Network.getStatus();
        setIsOnline(status.connected);

        Network.addListener('networkStatusChange', (status) => {
          setIsOnline(status.connected);
        });
      } catch (err) {
        console.warn('Network listener setup:', err);
      }
    };
    setupNetwork();

    return () => {
      if (backListenerHandle) {
        backListenerHandle.remove();
      }
      try {
        Network.removeAllListeners();
      } catch (e) {}
    };
  }, [location.pathname, navigate]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const status = await Network.getStatus();
      setIsOnline(status.connected);
      if (status.connected) {
        window.location.reload();
      }
    } catch (e) {
      console.warn('Retry error:', e);
    } finally {
      setTimeout(() => setIsRetrying(false), 800);
    }
  };

  if (!isOnline) {
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0f172a',
        padding: '1.5rem',
        color: '#ffffff',
        textAlign: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          marginBottom: '1rem',
          borderRadius: '50%',
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#f87171'
        }}>
          <WifiOff size={32} />
        </div>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.5rem', color: '#fff' }}>
          No Internet Connection
        </h2>
        <p style={{
          color: '#94a3b8',
          fontSize: '0.88rem',
          marginBottom: '1.5rem',
          maxWidth: '300px',
          lineHeight: 1.5
        }}>
          Campus Connect requires an active internet connection to verify presence, sync schedules, and display dashboard data.
        </p>
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1.4rem',
            backgroundColor: '#4f46e5',
            color: '#ffffff',
            borderRadius: '0.75rem',
            fontSize: '0.88rem',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(79, 70, 229, 0.4)',
            transition: 'transform 0.15s ease'
          }}
        >
          <RefreshCw size={16} className={isRetrying ? 'animate-spin' : ''} />
          {isRetrying ? 'Checking Connection...' : 'Retry Connection'}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
