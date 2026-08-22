import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { PermissionProvider } from './context/PermissionContext'
import ErrorBoundary from './components/ErrorBoundary'
import './styles/global.css'
import App from './App'

// Redirect API requests to Render backend on native Android APK:
let API_BASE = import.meta.env.VITE_API_BASE || '';
const _host = typeof window !== 'undefined' ? window.location.hostname : '';
const isVercel = _host.includes('vercel.app');
const isNativePlatform = Capacitor.isNativePlatform();

if (isNativePlatform || (!isVercel && _host !== 'localhost' && _host !== '127.0.0.1')) {
  API_BASE = 'https://projectcampusconnect.onrender.com';
} else {
  API_BASE = '';
}

if (API_BASE) {
  const _orig = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      input = API_BASE.replace(/\/$/, '') + input;
      init = { ...init, headers: { ...(init?.headers || {}), 'bypass-tunnel-reminder': 'true' } };
    }
    return _orig(input, init);
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <PermissionProvider>
              <App />
            </PermissionProvider>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>
)
