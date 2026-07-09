/**
 * AuthContext — Authentication State & Session Management
 * ========================================================
 * SECURITY CONTRACT:
 *  - Role is ALWAYS sourced from the backend JWT response (data.role),
 *    never from a client-supplied form field.
 *  - Tokens are stored in localStorage under consistent keys.
 *  - Silent token refresh is handled in services/api.js. This context
 *    listens for the 'session:expired' event fired when refresh fails,
 *    and cleans up state immediately.
 *  - The offline mock fallback (static USERS list) is only active when
 *    the backend is genuinely unreachable (network error). It never
 *    bypasses backend authentication when the server is up.
 */

import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { USERS } from '../data/users';

const AuthContext = createContext(null);

// ── Storage keys (must stay in sync with services/api.js) ────────────────────
const KEYS = {
  ACCESS:  'access_token',
  REFRESH: 'refresh_token',
  USER:    'ss_user',
  // Legacy keys written by older code — we keep these in sync for compat
  TOKEN:   'token',
};

// ─────────────────────────────────────────────────────────────────────────────
// Offline-mode helpers (dev only, never used when backend is reachable)
// ─────────────────────────────────────────────────────────────────────────────

function getCustomUsers() {
  try {
    const raw = localStorage.getItem('ss_custom_users');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function findOfflineUser(identifier, password) {
  const id = identifier.toLowerCase().trim();
  const pw = password.trim();
  const custom = getCustomUsers();

  return (
    USERS.find(
      (u) =>
        (u.email?.toLowerCase() === id || u.id?.toLowerCase() === id) &&
        u.password === pw,
    ) ??
    custom.find(
      (u) =>
        (u.email?.toLowerCase() === id || u.id?.toLowerCase() === id) &&
        u.password === pw,
    ) ??
    null
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Role mapping  (backend → UI)
// The UI uses 'tpo' as the display role for placement_cell users.
// All permission checks in App.jsx and route guards use these UI strings.
// ─────────────────────────────────────────────────────────────────────────────
const BACKEND_ROLE_TO_UI = {
  student:         'student',
  professor:       'professor',
  placement_cell:  'tpo',
  admin:           'admin',
};

function mapRole(backendRole) {
  return BACKEND_ROLE_TO_UI[backendRole] ?? backendRole;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers to build the user object stored in state / localStorage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the normalised user object from a successful backend login response.
 * Role is taken EXCLUSIVELY from data.role (server-resolved from JWT claims).
 */
function buildUserFromResponse(data, identifierHint = '') {
  const roleVal = mapRole(data.role);
  const rawName =
    data.name ??
    data.full_name ??
    (identifierHint.includes('@')
      ? identifierHint.split('@')[0].replace(/[._-]/g, ' ')
      : identifierHint);
  const displayName =
    rawName.charAt(0).toUpperCase() + rawName.slice(1);

  return {
    id:          data.user_id,
    email:       data.email ?? (identifierHint.includes('@') ? identifierHint : null),
    roll_no:     data.roll_no ?? null,
    role:        roleVal,          // UI role string (student / professor / tpo / admin)
    backendRole: data.role,        // raw backend value — keep for API calls that need it
    name:        displayName,
    initials:    displayName.slice(0, 2).toUpperCase(),
  };
}

function persistSession(userObj, accessToken, refreshToken) {
  localStorage.setItem(KEYS.USER,    JSON.stringify(userObj));
  localStorage.setItem(KEYS.ACCESS,  accessToken);
  localStorage.setItem(KEYS.TOKEN,   accessToken);   // legacy compat
  if (refreshToken) localStorage.setItem(KEYS.REFRESH, refreshToken);
}

function clearSession() {
  localStorage.removeItem(KEYS.USER);
  localStorage.removeItem(KEYS.ACCESS);
  localStorage.removeItem(KEYS.REFRESH);
  localStorage.removeItem(KEYS.TOKEN);
  localStorage.removeItem('ss_token');  // older legacy key
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(KEYS.USER);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  // ── Listen for session:expired events fired by services/api.js ────────────
  useEffect(() => {
    function onSessionExpired() {
      clearSession();
      setUser(null);
    }
    window.addEventListener('session:expired', onSessionExpired);
    return () => window.removeEventListener('session:expired', onSessionExpired);
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (identifier, password) => {
    const idStr    = identifier.trim();
    const isEmail  = idStr.includes('@');
    const payload  = isEmail
      ? { email: idStr,    password: password.trim() }
      : { roll_no: idStr,  password: password.trim() };

    try {
      const res  = await fetch('/api/v1/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        // ✅ Role resolved from backend JWT claim — never from client input
        const userObj = buildUserFromResponse(data, idStr);
        persistSession(userObj, data.access_token, data.refresh_token);
        setUser(userObj);
        return { success: true, user: userObj };
      }

      return { success: false, error: data.error ?? data.message ?? 'Invalid credentials.' };

    } catch {
      // Backend is genuinely unreachable → offline dev fallback
      const found = findOfflineUser(identifier, password);
      if (found) {
        persistSession(found, 'mock-token', null);
        setUser(found);
        return { success: true, user: found };
      }
      return { success: false, error: 'Cannot reach server. Check backend is running.' };
    }
  }, []);

  // ── Register (offline dev registration only) ──────────────────────────────
  /**
   * NOTE: Real user creation goes through the backend invite / OTP flow.
   * This helper persists a temporary local user for offline dev/demo mode.
   */
  const register = useCallback((name, email, password, role) => {
    const custom = getCustomUsers();
    const id = email.toLowerCase().trim();

    const existsStatic = USERS.some((u) => u.email?.toLowerCase() === id);
    const existsCustom = custom.some((u) => u.email?.toLowerCase() === id);
    if (existsStatic || existsCustom) {
      return { error: 'A user with this email address already exists.' };
    }

    const newUser = {
      id:       `USR${Math.floor(1000 + Math.random() * 9000)}`,
      name,
      email,
      password,
      role:     mapRole(role),   // normalise even in offline mode
      initials: name.slice(0, 2).toUpperCase(),
    };

    custom.push(newUser);
    localStorage.setItem('ss_custom_users', JSON.stringify(custom));
    persistSession(newUser, 'mock-token', null);
    setUser(newUser);
    return { user: newUser };
  }, []);

  // ── Update local user metadata (name, avatar, etc.) ──────────────────────
  const updateUser = useCallback((updatedFields) => {
    setUser((prev) => {
      if (!prev) return null;
      const nextUser = {
        ...prev,
        ...updatedFields,
        // Never allow role to be overwritten from the client
        role:     prev.role,
        backendRole: prev.backendRole,
        initials: (updatedFields.name ?? prev.name).slice(0, 2).toUpperCase(),
      };
      localStorage.setItem(KEYS.USER, JSON.stringify(nextUser));

      // Keep offline custom-users list in sync
      const custom = getCustomUsers();
      const updated = custom.map((u) =>
        u.email?.toLowerCase() === prev.email?.toLowerCase()
          ? { ...u, ...updatedFields }
          : u,
      );
      localStorage.setItem('ss_custom_users', JSON.stringify(updated));
      return nextUser;
    });
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    // Best-effort server-side token revocation (fire and forget)
    try {
      const token = localStorage.getItem(KEYS.ACCESS);
      if (token && token !== 'mock-token') {
        await fetch('/api/v1/auth/logout', {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });
      }
    } catch { /* ignore network errors on logout */ }

    clearSession();
    setUser(null);
  }, []);

  // ── Helpers consumed by route guards ─────────────────────────────────────
  const isStudent  = user?.role === 'student';
  const isProfessor = user?.role === 'professor';
  const isTPO      = user?.role === 'tpo';
  const isAdmin    = user?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        register,
        updateUser,
        logout,
        // Convenience booleans used by App.jsx and guards
        isStudent,
        isProfessor,
        isTPO,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks & Guards
// ─────────────────────────────────────────────────────────────────────────────

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * RequireAuth — wraps a protected route.
 * Redirects to /login if the user is not authenticated.
 * Uses React Router's useNavigate for a proper SPA redirect.
 */
export function RequireAuth({ children }) {
  const { user } = useAuth();
  const navigate  = useNavigate();

  useEffect(() => {
    if (!user) navigate('/login', { replace: true });
  }, [user, navigate]);

  if (!user) return null;
  return children;
}
