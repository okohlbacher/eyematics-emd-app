import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { logAudit } from '../services/auditService';
import { getSettings } from '../services/settingsService';
import { getAuthHeaders } from '../services/authHeaders';
import { safeJsonParse } from '../utils/safeJson';

/**
 * Roles from the Lastenheft stakeholder analysis (K10 N10.01):
 * 1 = Forscher*in (researcher), 2 = IT-Administrator*in (admin),
 * 3 = Epidemiolog*in (epidemiologist), 4 = Kliniker*in (clinician),
 * 5 = DIZ Data Manager (data_manager), 6 = Klinikleitung (clinic_lead)
 */
export type UserRole =
  | 'researcher'
  | 'admin'
  | 'epidemiologist'
  | 'clinician'
  | 'data_manager'
  | 'clinic_lead';

/** Roles that have admin-level access (user management, audit) */
export const ADMIN_ROLES: UserRole[] = ['admin'];

/** Roles that can view clinical data */
export const CLINICAL_ROLES: UserRole[] = ['researcher', 'epidemiologist', 'clinician', 'data_manager', 'clinic_lead'];

/** Roles that can view documentation quality benchmarking */
export const QUALITY_ROLES: UserRole[] = ['admin', 'clinic_lead', 'data_manager'];

export interface User {
  username: string;
  role: UserRole;
  centers?: string[];
  firstName?: string;
  lastName?: string;
}

export interface ManagedUser {
  username: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  centers?: string[];  // N10.02: multi-center assignment
  center?: string;     // legacy single-center (kept for backward compat)
  createdAt: string;
  lastLogin?: string;
}

/** Default credentials for the demonstrator */
const DEFAULT_CREDENTIALS: Record<string, { password: string; role: UserRole }> = {
  admin:        { password: 'admin2025!',      role: 'admin' },
  forscher1:    { password: 'forscher2025!',   role: 'researcher' },
  forscher2:    { password: 'forscher2025!',   role: 'researcher' },
  epidemiologe: { password: 'epid2025!',       role: 'epidemiologist' },
  kliniker:     { password: 'klinik2025!',     role: 'clinician' },
  diz_manager:  { password: 'diz2025!',        role: 'data_manager' },
  klinikleitung:{ password: 'leitung2025!',    role: 'clinic_lead' },
};

/** Accepted OTP code for the demonstrator */
const VALID_OTP = '123456';

interface AuthContextType {
  user: User | null;
  /** Display name: "FirstName LastName (username)" or fallback to username */
  displayName: string;
  login: (username: string, password: string, otp: string) => { ok: boolean; error?: 'user_not_found' | 'wrong_password' | 'invalid_otp' };
  logout: () => void;
  managedUsers: ManagedUser[];
  addManagedUser: (u: ManagedUser) => void;
  removeManagedUser: (username: string) => void;
  inactivityWarning: boolean;
  /** Check if current user has a given role or is in a role list */
  hasRole: (roles: UserRole[]) => boolean;
  fetchCurrentUser: () => Promise<void>;
  fetchUsers: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const WARNING_BEFORE = 60 * 1000; // warn 1 minute before

const DEFAULT_MANAGED_USERS: ManagedUser[] = [
  { username: 'admin', firstName: 'System', lastName: 'Administrator', role: 'admin', centers: ['UKA', 'UKB', 'LMU', 'UKT', 'UKM'], createdAt: '2025-01-01T00:00:00Z' },
  { username: 'forscher1', firstName: 'Anna', lastName: 'Müller', role: 'researcher', centers: ['UKA'], createdAt: '2025-01-15T00:00:00Z' },
  { username: 'forscher2', firstName: 'Thomas', lastName: 'Weber', role: 'researcher', centers: ['UKB'], createdAt: '2025-02-01T00:00:00Z' },
  { username: 'epidemiologe', firstName: 'Julia', lastName: 'Schmidt', role: 'epidemiologist', centers: ['UKA', 'UKB', 'LMU'], createdAt: '2025-03-01T00:00:00Z' },
  { username: 'kliniker', firstName: 'Markus', lastName: 'Fischer', role: 'clinician', centers: ['UKT'], createdAt: '2025-03-15T00:00:00Z' },
  { username: 'diz_manager', firstName: 'Sabine', lastName: 'Braun', role: 'data_manager', centers: ['UKM'], createdAt: '2025-04-01T00:00:00Z' },
  { username: 'klinikleitung', firstName: 'Prof. Klaus', lastName: 'Hoffmann', role: 'clinic_lead', centers: ['UKA', 'UKB', 'LMU', 'UKT', 'UKM'], createdAt: '2025-04-15T00:00:00Z' },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem('emd-user');
    return stored ? safeJsonParse<User | null>(stored, null) : null;
  });
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>(() => {
    const stored = localStorage.getItem('emd-managed-users');
    return stored ? safeJsonParse<ManagedUser[]>(stored, DEFAULT_MANAGED_USERS) : DEFAULT_MANAGED_USERS;
  });
  const [inactivityWarning, setInactivityWarning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const resp = await fetch('/api/auth/users/me', { headers: getAuthHeaders() });
      if (resp.ok) {
        const data = await resp.json() as { user: { username: string; role: string; centers: string[]; firstName?: string; lastName?: string } };
        setUser((prev) => prev ? { ...prev, ...data.user, role: data.user.role as UserRole } : prev);
      }
    } catch {
      // Silently fail — user is already authenticated from JWT
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const resp = await fetch('/api/auth/users', { headers: getAuthHeaders() });
      if (resp.ok) {
        const data = await resp.json() as { users: ManagedUser[] };
        setManagedUsers(data.users);
      }
    } catch {
      // Silently fail — keep existing managed users list
    }
  }, []);

  const performLogout = useCallback((auto = false) => {
    if (user) {
      logAudit(user.username, auto ? 'auto_logout' : 'logout', auto ? 'audit_detail_auto_logout' : 'audit_detail_logout');
    }
    setUser(null);
    setInactivityWarning(false);
    sessionStorage.removeItem('emd-user');
    // Data now server-side — no localStorage cleanup needed for data
    localStorage.removeItem('emd-managed-users');
    localStorage.removeItem('emd-audit-log');
  }, [user]);

  const resetInactivityTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    setInactivityWarning(false);

    if (!user) return;

    warningRef.current = setTimeout(() => {
      setInactivityWarning(true);
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE);

    timerRef.current = setTimeout(() => {
      performLogout(true);
    }, INACTIVITY_TIMEOUT);
  }, [user, performLogout]);

  // Set up activity listeners (EMDREQ-USM-008)
  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    const handler = () => resetInactivityTimer();

    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    resetInactivityTimer();

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [user, resetInactivityTimer]);

  // Hydrate profile on mount/login: /users/me for all, /users for admin only
  useEffect(() => {
    if (!user) return;
    fetchCurrentUser();
    if (user.role === 'admin') {
      fetchUsers();
    }
  }, [user?.username]); // eslint-disable-line react-hooks/exhaustive-deps

  const login = (username: string, password: string, otp: string): { ok: boolean; error?: 'user_not_found' | 'wrong_password' | 'invalid_otp' } => {
    if (!username) return { ok: false, error: 'user_not_found' };

    // Check if user exists – first in default credentials, then in managed users
    const defaultCred = DEFAULT_CREDENTIALS[username.toLowerCase()];
    const managed = managedUsers.find((u) => u.username.toLowerCase() === username.toLowerCase());

    if (!defaultCred && !managed) {
      return { ok: false, error: 'user_not_found' };
    }

    // Validate password (managed users created at runtime use default password 'changeme!')
    const expectedPassword = defaultCred?.password ?? 'changeme!';
    if (password !== expectedPassword) {
      return { ok: false, error: 'wrong_password' };
    }

    // Validate OTP (skip if 2FA is disabled in settings)
    const settings = getSettings();
    if (settings.twoFactorEnabled && otp !== VALID_OTP) {
      return { ok: false, error: 'invalid_otp' };
    }

    const role = defaultCred?.role ?? managed?.role ?? 'researcher';
    const u: User = { username, role };
    setUser(u);
    sessionStorage.setItem('emd-user', JSON.stringify(u));
    logAudit(username, 'login', 'audit_detail_login', [role]);

    // Update last login date on managed user
    setManagedUsers((prev) => {
      const next = prev.map((mu) =>
        mu.username.toLowerCase() === username.toLowerCase()
          ? { ...mu, lastLogin: new Date().toISOString() }
          : mu
      );
      localStorage.setItem('emd-managed-users', JSON.stringify(next));
      return next;
    });

    return { ok: true };
  };

  const logout = () => performLogout(false);

  // Build display name from managed users: "FirstName LastName (username)"
  const displayName = (() => {
    if (!user) return '';
    // Prefer user object fields first (from /users/me), then fall back to managedUsers
    if (user.firstName || user.lastName) {
      const full = [user.firstName, user.lastName].filter(Boolean).join(' ');
      return `${full} (${user.username})`;
    }
    const mu = managedUsers.find((m) => m.username.toLowerCase() === user.username.toLowerCase());
    if (mu?.firstName || mu?.lastName) {
      const full = [mu.firstName, mu.lastName].filter(Boolean).join(' ');
      return `${full} (${user.username})`;
    }
    return user.username;
  })();

  const hasRole = (roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const addManagedUser = (u: ManagedUser) => {
    setManagedUsers((prev) => {
      const next = [...prev.filter((x) => x.username !== u.username), u];
      localStorage.setItem('emd-managed-users', JSON.stringify(next));
      return next;
    });
    if (user) logAudit(user.username, 'create_user', 'audit_detail_create_user', [u.username]);
  };

  const removeManagedUser = (username: string) => {
    setManagedUsers((prev) => {
      const next = prev.filter((u) => u.username !== username);
      localStorage.setItem('emd-managed-users', JSON.stringify(next));
      return next;
    });
    if (user) logAudit(user.username, 'delete_user', 'audit_detail_delete_user', [username]);
  };

  const value = useMemo<AuthContextType>(() => ({
    user, displayName, login, logout, managedUsers, addManagedUser, removeManagedUser, inactivityWarning, hasRole, fetchCurrentUser, fetchUsers,
  }), [user, displayName, login, logout, managedUsers, addManagedUser, removeManagedUser, inactivityWarning, hasRole, fetchCurrentUser, fetchUsers]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
