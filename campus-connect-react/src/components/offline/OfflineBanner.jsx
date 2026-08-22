import { useState, useEffect } from 'react';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';
import './OfflineBanner.css';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSyncTime, setLastSyncTime] = useState('');

  useEffect(() => {
    // Initial sync time formatted
    const now = new Date();
    setLastSyncTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      const offlineNow = new Date();
      setLastSyncTime(offlineNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    let networkListenerHandle = null;
    if (Capacitor.isNativePlatform() || Capacitor.isPluginAvailable('Network')) {
      Network.getStatus().then(status => setIsOnline(status.connected)).catch(() => {});
      Network.addListener('networkStatusChange', status => {
        setIsOnline(status.connected);
      }).then(handle => {
        networkListenerHandle = handle;
      }).catch(() => {});
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (networkListenerHandle) {
        try {
          networkListenerHandle.remove();
        } catch (e) {}
      }
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="offline-snapshot-banner" role="status" aria-live="polite">
      <div className="offline-banner-content">
        <span className="offline-pulse-dot"></span>
        <span className="offline-banner-text">
          <strong>Viewing Offline Snapshot</strong> — Last synced at {lastSyncTime}
        </span>
      </div>
      <span className="offline-banner-tag">Read-Only Mode</span>
    </div>
  );
}
