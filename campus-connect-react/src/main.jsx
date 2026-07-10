// Vercel trigger redeploy
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { PermissionProvider } from './context/PermissionContext'
import './styles/global.css'
import App from './App'

// Redirect API requests to the deployed Railway backend when on Vercel.
// VITE_API_BASE is set in Vercel env vars.
// In local dev, Vite's proxy handles /api → localhost:5001 so API_BASE stays empty.
const API_BASE = import.meta.env.VITE_API_BASE || '';

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
