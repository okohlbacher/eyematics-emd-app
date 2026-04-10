import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { setJwt, clearJwt } from '../services/authHeaders';
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
  centers: string[];
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

interface AuthContextType {
  user: User | null;
  /** Display name: "FirstName LastName (username)" or fallback to username */
  displayName: string;
  /**
   * Step 1 of login: POST /api/auth/login with { username, password }.
   * Returns { ok: true } on success (no 2FA), or { ok: false, needsOtp: true, challengeToken }
   * when 2FA is required, or { ok: false, error } on failure.
   */
  login: (username: string, password: string) => Promise<{
    ok: boolean;
    needsOtp?: boolean;
    challengeToken?: string;
    error?: string;
  }>;
  /**
   * Step 2 of login: POST /api/auth/verify with { challengeToken, otp }.
   * Returns { ok: true } on success, or { ok: false, error } on failure.
   */
  verifyOtp: (challengeToken: string, otp: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  managedUsers: ManagedUser[];
  addManagedUser: (u: ManagedUser) => void;
  removeManagedUser: (username: string) => void;
  inactivityWarning: boolean;
  /** Check if current user has a given role or is in a role list */
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const WARNING_BEFORE = 60 * 1000; // warn 1 minute before

/**
 * Decode the payload segment of a JWT (base64url middle segment).
 * Returns null if decoding fails.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // Base64url → base64 → decode
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem('emd-user');
    return stored ? safeJsonParse<User | null>(stored, null) : null;
  });

  // managedUsers is kept as local state for Phase 2.
  // Phase 3 will move CRUD to server API. No localStorage persistence (server is source of truth).
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);

  const [inactivityWarning, setInactivityWarning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performLogout = useCallback((auto = false) => {
    setUser(null);
    setInactivityWarning(false);
    clearJwt();
    sessionStorage.removeItem('emd-user');
    // H-04: clear client-side sensitive data on logout
    // (emd-audit-log and emd-managed-users removed — now server-side)
    localStorage.removeItem('emd-saved-searches');
    localStorage.removeItem('emd-quality-flags');
    localStorage.removeItem('emd-excluded-cases');
    localStorage.removeItem('emd-reviewed-cases');
    if (auto) {
      console.info('[auth] Session expired due to inactivity');
    }
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

  /**
   * Apply a received session JWT: decode payload, set user state, store JWT + user in sessionStorage.
   */
  const applySessionToken = useCallback((token: string): boolean => {
    const payload = decodeJwtPayload(token);
    if (!payload) return false;

    const username = typeof payload.preferred_username === 'string' ? payload.preferred_username : (typeof payload.sub === 'string' ? payload.sub : null);
    const role = typeof payload.role === 'string' ? payload.role as UserRole : 'researcher';
    const centers = Array.isArray(payload.centers) ? payload.centers as string[] : [];

    if (!username) return false;

    const u: User = { username, role, centers };
    setJwt(token);
    sessionStorage.setItem('emd-user', JSON.stringify(u));
    setUser(u);
    return true;
  }, []);

  /**
   * Step 1 of server login: POST /api/auth/login with { username, password }.
   *
   * - If 2FA disabled: server returns { token } → apply JWT, return { ok: true }
   * - If 2FA enabled: server returns { challengeToken } → return { ok: false, needsOtp: true, challengeToken }
   * - On 401: return { ok: false, error: 'Invalid credentials' }
   * - On 429: return { ok: false, error: 'account_locked' }
   * - On network error: return { ok: false, error: 'network_error' }
   */
  const login = useCallback(async (username: string, password: string): Promise<{
    ok: boolean;
    needsOtp?: boolean;
    challengeToken?: string;
    error?: string;
  }> => {
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await resp.json() as Record<string, unknown>;

      if (resp.status === 429) {
        return { ok: false, error: 'account_locked' };
      }

      if (resp.status === 401 || resp.status === 400) {
        return { ok: false, error: typeof data.error === 'string' ? data.error : 'Invalid credentials' };
      }

      if (!resp.ok) {
        return { ok: false, error: 'network_error' };
      }

      // 2FA enabled: server returned challenge token
      if (typeof data.challengeToken === 'string') {
        return { ok: false, needsOtp: true, challengeToken: data.challengeToken };
      }

      // No 2FA: server returned full session JWT
      if (typeof data.token === 'string') {
        const applied = applySessionToken(data.token);
        if (!applied) {
          return { ok: false, error: 'Failed to decode session token' };
        }
        return { ok: true };
      }

      return { ok: false, error: 'Unexpected server response' };
    } catch {
      return { ok: false, error: 'network_error' };
    }
  }, [applySessionToken]);

  /**
   * Step 2 of server login (2FA): POST /api/auth/verify with { challengeToken, otp }.
   *
   * - On success: server returns { token } → apply JWT, return { ok: true }
   * - On 401: return { ok: false, error: 'Invalid OTP' }
   * - On 429: return { ok: false, error: 'account_locked' }
   * - On network error: return { ok: false, error: 'network_error' }
   */
  const verifyOtp = useCallback(async (challengeToken: string, otp: string): Promise<{ ok: boolean; error?: string }> => {
    try {
      const resp = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken, otp }),
      });

      const data = await resp.json() as Record<string, unknown>;

      if (resp.status === 429) {
        return { ok: false, error: 'account_locked' };
      }

      if (resp.status === 401 || resp.status === 400) {
        return { ok: false, error: typeof data.error === 'string' ? data.error : 'Invalid OTP' };
      }

      if (!resp.ok) {
        return { ok: false, error: 'network_error' };
      }

      if (typeof data.token === 'string') {
        const applied = applySessionToken(data.token);
        if (!applied) {
          return { ok: false, error: 'Failed to decode session token' };
        }
        return { ok: true };
      }

      return { ok: false, error: 'Unexpected server response' };
    } catch {
      return { ok: false, error: 'network_error' };
    }
  }, [applySessionToken]);

  const logout = useCallback(() => performLogout(false), [performLogout]);

  // Build display name from managed users: "FirstName LastName (username)"
  const displayName = (() => {
    if (!user) return '';
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
    user, displayName, login, verifyOtp, logout, managedUsers, addManagedUser, removeManagedUser, inactivityWarning, hasRole,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [user, displayName, login, verifyOtp, logout, managedUsers, inactivityWarning]);

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
