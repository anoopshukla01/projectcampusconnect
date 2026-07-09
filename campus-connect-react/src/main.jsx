import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { PermissionProvider } from './context/PermissionContext'
import './styles/global.css'
import App from './App'

// Redirect API requests to the backend when deployed on Vercel.
// VITE_API_BASE is set in Vercel env vars to the Railway/Render backend URL.
// Falls back to localhost:5001 for local development.
const API_BASE = import.meta.env.VITE_API_BASE || '';

if (API_BASE) {
  const originalFetch = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      input = API_BASE + input;
    }
    return originalFetch(input, init);
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
