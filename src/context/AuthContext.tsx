import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
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

interface LoginResult {
  ok: boolean;
  error?: 'invalid_credentials' | 'account_locked' | 'invalid_otp' | 'otp_required' | 'network_error';
  retryAfterMs?: number;
  challengeToken?: string;
}

interface AuthContextType {
  user: User | null;
  /** Display name: "FirstName LastName (username)" or fallback to username */
  displayName: string;
  login: (username: string, password: string, otp?: string, challengeToken?: string) => Promise<LoginResult>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem('emd-user');
    return stored ? safeJsonParse<User | null>(stored, null) : null;
  });
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [inactivityWarning, setInactivityWarning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Cache the 2FA config so it is not re-fetched on every login attempt
  const twoFactorEnabledRef = useRef<boolean | null>(null);

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
    setUser(null);
    setInactivityWarning(false);
    sessionStorage.removeItem('emd-user');
    sessionStorage.removeItem('emd-token');
    // Clean up legacy localStorage entries
    localStorage.removeItem('emd-managed-users');
    localStorage.removeItem('emd-audit-log');
    void auto; // suppress unused param lint
  }, []);

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

  /**
   * Decode a JWT payload (middle segment) without verification.
   * Used only for extracting user info for UI display — NOT for authorization decisions.
   * Server verifies the signature on every request via authMiddleware.
   */
  function decodeJwtPayload(token: string): { sub: string; preferred_username?: string; role: string; centers: string[] } | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      return JSON.parse(atob(parts[1])) as { sub: string; preferred_username?: string; role: string; centers: string[] };
    } catch {
      return null;
    }
  }

  const login = useCallback(async (username: string, password: string, otp?: string, challengeToken?: string): Promise<LoginResult> => {
    try {
      // Fetch and cache 2FA config if not yet loaded
      if (twoFactorEnabledRef.current === null) {
        try {
          const cfgResp = await fetch('/api/auth/config');
          if (cfgResp.ok) {
            const cfg = await cfgResp.json() as { twoFactorEnabled: boolean };
            twoFactorEnabledRef.current = cfg.twoFactorEnabled;
          } else {
            twoFactorEnabledRef.current = false;
          }
        } catch {
          twoFactorEnabledRef.current = false;
        }
      }

      // If OTP is provided (step 2 of 2FA), call /verify with the challengeToken
      if (otp && challengeToken) {
        const verifyResp = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeToken, otp }),
        });

        if (verifyResp.status === 429) {
          const data = await verifyResp.json() as { retryAfterMs?: number };
          return { ok: false, error: 'account_locked', retryAfterMs: data.retryAfterMs };
        }

        if (!verifyResp.ok) {
          return { ok: false, error: 'invalid_otp' };
        }

        const verifyData = await verifyResp.json() as { token: string };
        const payload = decodeJwtPayload(verifyData.token);
        if (!payload) return { ok: false, error: 'network_error' };

        const newUser: User = {
          username: payload.preferred_username || payload.sub,
          role: payload.role as UserRole,
          centers: payload.centers,
        };
        setUser(newUser);
        sessionStorage.setItem('emd-token', verifyData.token);
        sessionStorage.setItem('emd-user', JSON.stringify(newUser));
        return { ok: true };
      }

      // Step 1: POST /api/auth/login with credentials
      const loginResp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (loginResp.status === 429) {
        const data = await loginResp.json() as { retryAfterMs?: number };
        return { ok: false, error: 'account_locked', retryAfterMs: data.retryAfterMs };
      }

      if (!loginResp.ok) {
        return { ok: false, error: 'invalid_credentials' };
      }

      const loginData = await loginResp.json() as { token?: string; challengeToken?: string };

      // 2FA enabled — server returned a challenge token for OTP step
      if (loginData.challengeToken) {
        return { ok: false, error: 'otp_required', challengeToken: loginData.challengeToken };
      }

      // 2FA disabled — server returned a full session JWT
      if (loginData.token) {
        const payload = decodeJwtPayload(loginData.token);
        if (!payload) return { ok: false, error: 'network_error' };

        const newUser: User = {
          username: payload.preferred_username || payload.sub,
          role: payload.role as UserRole,
          centers: payload.centers,
        };
        setUser(newUser);
        sessionStorage.setItem('emd-token', loginData.token);
        sessionStorage.setItem('emd-user', JSON.stringify(newUser));
        return { ok: true };
      }

      return { ok: false, error: 'network_error' };
    } catch {
      return { ok: false, error: 'network_error' };
    }
  }, []);

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
    setManagedUsers((prev) => [...prev.filter((x) => x.username !== u.username), u]);
  };

  const removeManagedUser = (username: string) => {
    setManagedUsers((prev) => prev.filter((u) => u.username !== username));
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
