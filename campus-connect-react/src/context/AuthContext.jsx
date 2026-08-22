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
import { storage } from '../services/storage';
import { studentsApi, professorsApi, authApi } from '../services/api';

const AuthContext = createContext(null);

// ── Storage keys (must stay in sync with services/api.js) ────────────────────
const KEYS = {
  ACCESS:  'access_token',
  REFRESH: 'refresh_token',
  USER:    'ss_user',
  // Legacy keys written by older code — we keep these in sync for compat
  TOKEN:   'token',
};

// ────────────────────────────────────────────────────────────────────────────────
// JWT helpers (no extra library — JWTs are just base64-encoded JSON)
// ────────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if the JWT is already expired or expires within `bufferSecs`
 * seconds (default 60). Returns true on any parse error (fail-safe).
 */
function isTokenExpiredSoon(token, bufferSecs = 60) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp) return false;
    return (payload.exp - bufferSecs) * 1000 < Date.now();
  } catch {
    return true; // unparseable → treat as expired
  }
}

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

  const sem = data.semester;
  const semToYear = {
    1: '1st Year', 2: '1st Year',
    3: '2nd Year', 4: '2nd Year',
    5: '3rd Year', 6: '3rd Year',
    7: '4th Year', 8: '4th Year',
  };
  const yearText = data.year || semToYear[sem] || (sem ? `Semester ${sem}` : null);

  return {
    id:          data.user_id,
    email:       data.email ?? (identifierHint.includes('@') ? identifierHint : null),
    roll_no:     data.roll_no ?? null,
    rollNo:      data.roll_no ?? null,
    branch:      data.branch ?? data.department ?? null,
    department:  data.department ?? data.branch ?? null,
    college_name: data.college_name ?? 'Campus Connect University',
    college:     data.college_name ?? 'Campus Connect University',
    semester:    sem ?? null,
    year:        yearText,
    batch_year:  data.batch_year ?? null,
    position:    data.position ?? data.delegated_role ?? null,
    role:        roleVal,          // UI role string (student / professor / tpo / admin)
    backendRole: data.role,        // raw backend value — keep for API calls that need it
    name:        displayName,
    full_name:   displayName,
    phone:       data.phone ?? null,
    profile_photo_url: data.profile_photo_url ?? null,
    initials:    displayName.slice(0, 2).toUpperCase(),
  };
}

/**
 * After login/session-restore, fetch the role-appropriate profile endpoint
 * and merge academic/contact fields (branch, college, year, position, etc.)
 * into the user object so the Virtual ID Card can display them.
 * Uses the project's api.js helpers so the correct base URL, auth headers,
 * and 401 silent-refresh are all handled automatically.
 * Returns an enriched copy of the user object (never mutates in place).
 */
async function fetchProfileEnrichment(userObj) {
  try {
    const role = userObj.role; // UI role: student | professor | tpo | admin

    // Skip mock / offline sessions
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    if (!token || token === 'mock-token') return userObj;

    let profile = null;

    if (role === 'student') {
      // studentsApi.getMe() returns the parsed JSON directly (not wrapped)
      profile = await studentsApi.getMe();
    } else if (role === 'professor') {
      profile = await professorsApi.getMe();
    } else {
      // tpo / admin — no academic profile endpoint needed
      return userObj;
    }

    // api.js returns { error: '...' } on failure — bail out silently
    if (!profile || profile.error) return userObj;

    if (role === 'student') {
      const sem = profile.semester;
      const semToYear = {
        1: '1st Year', 2: '1st Year',
        3: '2nd Year', 4: '2nd Year',
        5: '3rd Year', 6: '3rd Year',
        7: '4th Year', 8: '4th Year',
      };
      const yearText = semToYear[sem] ?? (sem ? `Sem ${sem}` : null);

      return {
        ...userObj,
        name:              profile.full_name          || userObj.name,
        roll_no:           profile.roll_no            || userObj.roll_no,
        branch:            profile.branch             || null,
        college_name:      profile.college_name       || null,
        college_code:      profile.college_code       || null,
        semester:          sem                        ?? null,
        year:              yearText,
        batch_year:        profile.batch_year         || null,
        delegated_role:    profile.delegated_role     || null,
        isCR: profile.delegated_role === 'CLASS_REPRESENTATIVE',
        isCS: profile.delegated_role === 'CORE_STUDENT',
        isPC: profile.delegated_role === 'PLACEMENT_COORDINATOR',
        phone:             profile.phone              || userObj.phone || null,
        profile_photo_url: profile.profile_photo_url || null,
        email:             profile.email              || userObj.email,
        initials: (profile.full_name || userObj.name || '').slice(0, 2).toUpperCase(),
      };
    }

    if (role === 'professor') {
      return {
        ...userObj,
        name:              profile.full_name    || userObj.name,
        department:        profile.department   || null,
        designation:       profile.designation  || null,
        college_name:      profile.college_name || null,
        phone:             profile.phone        || userObj.phone || null,
        office:            profile.office       || null,
        profile_photo_url: profile.profile_photo_url || null,
        email:             profile.email        || userObj.email,
        initials: (profile.full_name || userObj.name || '').slice(0, 2).toUpperCase(),
      };
    }

    return userObj;
  } catch (err) {
    // Network error — return unmodified so login still works
    console.warn('[AuthContext] fetchProfileEnrichment failed:', err);
    return userObj;
  }
}

async function persistSession(userObj, accessToken, refreshToken) {
  await storage.set(KEYS.USER,    JSON.stringify(userObj));
  await storage.set(KEYS.ACCESS,  accessToken);
  await storage.set(KEYS.TOKEN,   accessToken);   // legacy compat
  if (refreshToken) await storage.set(KEYS.REFRESH, refreshToken);
}

async function clearSession() {
  await storage.remove(KEYS.USER);
  await storage.remove(KEYS.ACCESS);
  await storage.remove(KEYS.REFRESH);
  await storage.remove(KEYS.TOKEN);
  localStorage.removeItem('ss_token');  // older legacy key
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [consentRequired, setConsentRequired] = useState(false);

  useEffect(() => {
    async function initAuth() {
      try {
        const raw = await storage.get(KEYS.USER);
        if (!raw) return; // no stored session → nothing to restore

        const parsed = JSON.parse(raw);
        // Purge stale mock-data objects that snuck in from old offline builds
        if (parsed && (parsed.classRank !== undefined || parsed.pendingTasks !== undefined)) {
          await clearSession();
          return;
        }

        // ── Proactive token refresh ─────────────────────────────────────────────
        const accessToken = await storage.get(KEYS.ACCESS);
        if (accessToken && accessToken !== 'mock-token' && isTokenExpiredSoon(accessToken)) {
          const refreshToken = await storage.get(KEYS.REFRESH);
          if (refreshToken) {
            try {
              const res = await fetch('/api/v1/auth/token/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken }),
              });
              if (res.ok) {
                const data = await res.json();
                await storage.set(KEYS.ACCESS,  data.access_token);
                await storage.set(KEYS.TOKEN,   data.access_token); // legacy compat
                if (data.refresh_token) await storage.set(KEYS.REFRESH, data.refresh_token);
                if (data.consent_required) setConsentRequired(true);
              } else {
                await clearSession();
                return;
              }
            } catch {
              // Network error on boot → keep session alive
            }
          } else {
            await clearSession();
            return;
          }
        }

        if (parsed) {
          // Re-fetch profile to pick up any changes since last session
          const enriched = await fetchProfileEnrichment(parsed);
          if (enriched !== parsed) {
            await storage.set(KEYS.USER, JSON.stringify(enriched));
          }
          setUser(enriched);

          // Check legal consent requirement
          try {
            const cRes = await authApi.getConsentStatus();
            if (cRes && cRes.consent_required) {
              setConsentRequired(true);
            } else {
              setConsentRequired(false);
            }
          } catch {
            // offline fallback
          }
        }
      } catch (err) {
        console.error('Failed to init auth', err);
      } finally {
        setAuthLoading(false);
      }
    }
    initAuth();
  }, []);

  // ── One-time boot migration: collapse legacy storage keys ─────────────────
  useEffect(() => {
    const legacyKeys = ['ss_token', 'token'];
    for (const k of legacyKeys) {
      const v = localStorage.getItem(k);
      if (v && v !== localStorage.getItem(KEYS.ACCESS)) {
        localStorage.setItem(KEYS.ACCESS, v);
      }
      if (k !== KEYS.TOKEN) {
        localStorage.removeItem(k);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Listen for session:expired events fired by services/api.js ────────────
  useEffect(() => {
    function onSessionExpired() {
      clearSession();
      setUser(null);
      setConsentRequired(false);
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
        const baseUser = buildUserFromResponse(data, idStr);
        await persistSession(baseUser, data.access_token, data.refresh_token);
        const userObj = await fetchProfileEnrichment(baseUser);
        await persistSession(userObj, data.access_token, data.refresh_token);
        setUser(userObj);
        setConsentRequired(Boolean(data.consent_required));
        return { success: true, user: userObj, consentRequired: Boolean(data.consent_required) };
      }

      return { success: false, error: data.error ?? data.message ?? 'Invalid credentials.' };

    } catch {
      if (import.meta.env.DEV) {
        const found = findOfflineUser(identifier, password);
        if (found) {
          await persistSession(found, 'mock-token', null);
          setUser(found);
          return { success: true, user: found, consentRequired: false };
        }
        return { success: false, error: 'Cannot reach server. Check backend is running.' };
      }
      return {
        success: false,
        error: "Can't reach the server — check your connection and try again.",
      };
    }
  }, []);

  // ── Register (offline dev registration only) ──────────────────────────────
  /**
   * NOTE: Real user creation goes through the backend invite / OTP flow.
   * This helper is only active in local dev (import.meta.env.DEV).
   * In production it always returns an error directing to the real flow.
   */
  const register = useCallback(async (name, email, password, role) => {
    if (!import.meta.env.DEV) {
      return { error: 'Please use the Sign Up / Claim flow to create an account.' };
    }
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
    await persistSession(newUser, 'mock-token', null);
    setUser(newUser);
    return { user: newUser };
  }, []);

  // ── Update local user metadata (name, avatar, etc.) ──────────────────────
  const updateUser = useCallback(async (updatedFields) => {
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
      storage.set(KEYS.USER, JSON.stringify(nextUser));

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
      const token = await storage.get(KEYS.ACCESS);
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

    await clearSession();
    setUser(null);
    setConsentRequired(false);
  }, []);

  // ── Record Legal & Device Permissions Consent ─────────────────────────────
  const recordConsent = useCallback(async (consentPayload) => {
    try {
      const res = await authApi.submitConsent(consentPayload);
      if (res && !res.error) {
        setConsentRequired(false);
        return { success: true, consent: res.consent };
      }
      return { success: false, error: res?.error || 'Failed to record consent.' };
    } catch (err) {
      return { success: false, error: err.message || 'Network error recording consent.' };
    }
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
        authLoading,
        consentRequired,
        setConsentRequired,
        recordConsent,
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
