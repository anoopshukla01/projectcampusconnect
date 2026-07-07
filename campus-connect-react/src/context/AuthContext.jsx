import { createContext, useContext, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { USERS } from '../data/users';

const AuthContext = createContext(null);

function getCustomUsers() {
  try {
    const raw = localStorage.getItem('ss_custom_users');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function findUser(identifier, password, role) {
  const id = identifier.toLowerCase().trim();
  const pw = password.trim();
  const custom = getCustomUsers();
  
  // Search static USERS list first
  const foundStatic = USERS.find(u =>
    (u.email.toLowerCase() === id || u.id.toLowerCase() === id) &&
    u.password === pw &&
    u.role === role
  );
  if (foundStatic) return foundStatic;

  // Search dynamic custom users
  return custom.find(u =>
    (u.email.toLowerCase() === id || u.id?.toLowerCase() === id) &&
    u.password === pw &&
    u.role === role
  ) || null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('ss_user');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });

  const login = useCallback(async (identifier, password, _selectedRole) => {
    const idStr = identifier.trim();
    const isEmail = idStr.includes('@');
    const payload = isEmail
      ? { email: idStr, password: password.trim() }
      : { roll_no: idStr, password: password.trim() };

    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('access_token', data.access_token);
        if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);

        // Map backend role string to UI role string
        const roleMap = {
          student: 'student',
          professor: 'professor',
          placement_cell: 'tpo',
          admin: 'admin',
        };
        const roleVal = roleMap[data.role] ?? data.role;

        // Build display name: prefer data.name, fall back to email prefix
        const rawName = data.name || idStr.split('@')[0].replace(/[._-]/g, ' ');
        const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

        const userObj = {
          id: data.user_id,
          email: isEmail ? idStr : (data.email || idStr + '@college.edu.in'),
          role: roleVal,
          name: displayName,
          initials: displayName.slice(0, 2).toUpperCase(),
          backendRole: data.role,  // keep the raw backend value too
        };

        localStorage.setItem('ss_user', JSON.stringify(userObj));
        setUser(userObj);
        return { success: true, user: userObj };
      }

      return { success: false, error: data.error || 'Invalid credentials.' };
    } catch {
      // Dev fallback — backend offline
      const found = findUser(identifier, password, _selectedRole || 'student');
      if (found) {
        localStorage.setItem('ss_user', JSON.stringify(found));
        localStorage.setItem('token', 'mock-token');
        localStorage.setItem('access_token', 'mock-token');
        setUser(found);
        return { success: true, user: found };
      }
      return { success: false, error: 'Cannot reach server. Check backend is running.' };
    }
  }, []);

  const register = useCallback((name, email, password, role) => {
    const custom = getCustomUsers();
    const id = email.toLowerCase().trim();

    // Check if user already exists
    const existsStatic = USERS.some(u => u.email.toLowerCase() === id);
    const existsCustom = custom.some(u => u.email.toLowerCase() === id);
    if (existsStatic || existsCustom) {
      return { error: 'A user with this email address already exists.' };
    }

    const newUser = {
      id: `USR${Math.floor(1000 + Math.random() * 9000)}`,
      name,
      email,
      password,
      role,
      initials: name.slice(0, 2).toUpperCase(),
      stats: role === 'tpo' ? { totalStudents: 320, placed: 187, avgPackage: '12.4 LPA', drivesThisYear: 34 } : {}
    };

    custom.push(newUser);
    localStorage.setItem('ss_custom_users', JSON.stringify(custom));
    
    // Automatically log in newly registered user
    localStorage.setItem('ss_user', JSON.stringify(newUser));
    localStorage.setItem('token', 'mock-token');
    localStorage.setItem('access_token', 'mock-token');
    setUser(newUser);
    return { user: newUser };
  }, []);

  const updateUser = useCallback((updatedFields) => {
    setUser(prev => {
      if (!prev) return null;
      const nextUser = { ...prev, ...updatedFields, initials: (updatedFields.name || prev.name).slice(0,2).toUpperCase() };
      
      // Update current logged-in user
      localStorage.setItem('ss_user', JSON.stringify(nextUser));

      // Also update in ss_custom_users if they registered dynamically
      const custom = getCustomUsers();
      const updatedCustom = custom.map(u => u.email.toLowerCase() === prev.email.toLowerCase() ? { ...u, ...updatedFields } : u);
      localStorage.setItem('ss_custom_users', JSON.stringify(updatedCustom));

      return nextUser;
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('ss_user');
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Wraps protected routes – redirects to /login if not authenticated */
export function RequireAuth({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    // Use effect-style redirect
    if (typeof window !== 'undefined') {
      // Redirect immediately
      window.location.replace('/login');
      return null;
    }
    return null;
  }
  return children;
}
