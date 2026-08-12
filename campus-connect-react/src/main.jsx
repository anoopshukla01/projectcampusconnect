// Vercel trigger redeploy
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { PermissionProvider } from './context/PermissionContext'
import './styles/global.css'
import App from './App'

// Redirect API requests to the correct backend based on environment:
//   • localhost / 127.0.0.1  → empty string (Vite proxy handles /api → local backend)
//   • vercel.app             → empty string (Vercel rewrites handle routing)
//   • anything else (native Android APK) → production Render backend
let API_BASE = import.meta.env.VITE_API_BASE || '';
const _host = typeof window !== 'undefined' ? window.location.hostname : '';
const isVercel    = _host.includes('vercel.app');
const isLocalhost = _host === 'localhost' || _host === '127.0.0.1' || _host === '';
const isNative    = !isVercel && !isLocalhost;

if (isNative) {
  API_BASE = 'https://projectcampusconnect.onrender.com';
} else {
  API_BASE = '';
}

if (API_BASE) {
  const _orig = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      input = API_BASE.replace(/\/$/, '') + input;
      // bypass localtunnel browser warning page
      init = { ...init, headers: { ...(init?.headers || {}), 'bypass-tunnel-reminder': 'true' } };
    }
    return _orig(input, init);
  };
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <PermissionProvider>
            <App />
          </PermissionProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
