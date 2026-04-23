import { createContext, type ReactNode,useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { broadcastLogout, serverLogout } from '../services/authHeaders';
import { invalidateBundleCache } from '../services/fhirLoader';

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
  centers?: string[];
  createdAt: string;
  lastLogin?: string;
}

type LoginResult =
  | { ok: true }
  | { ok: false; error: 'invalid_credentials' | 'otp_required' | 'account_locked' | 'invalid_otp' | 'network_error'; challengeToken?: string; retryAfterMs?: number };

interface AuthContextType {
  user: User | null;
  /** Display name: "FirstName LastName (username)" or fallback to username */
  displayName: string;
  login: (username: string, password: string, otp?: string, challengeToken?: string) => Promise<LoginResult>;
  logout: () => void;
  inactivityWarning: boolean;
  /** Check if current user has a given role or is in a role list */
  hasRole: (roles: UserRole[]) => boolean;
  /** JWT token for API calls */
  token: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Exported for v1.9 Phase 21 UAT-AUTO-04 test-hook (constant import, not magic number).
export const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const WARNING_BEFORE = 60 * 1000; // warn 1 minute before

/**
 * Decode a JWT payload without cryptographic verification.
 * This is cosmetic only — used to display the current user's name and role
 * in the UI. All authorization decisions are enforced server-side via the
 * authMiddleware, which validates the JWT signature on every /api/* request.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload;
  } catch {
    return null;
  }
}

/** All valid roles — kept in sync with UserRole union above. */
const VALID_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  'researcher', 'admin', 'epidemiologist', 'clinician', 'data_manager', 'clinic_lead',
]);

/** Extract User from JWT payload. */
function userFromToken(token: string): User | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const username = (payload.preferred_username ?? payload.sub) as string;
  // L2: validate role against the known enum instead of trusting the cast.
  // A malformed token shouldn't silently show the UI as "researcher" — the
  // server still enforces authz, but a mismatch here means the session is
  // broken, so refuse to hydrate a user from it.
  const rawRole = payload.role;
  if (typeof rawRole !== 'string' || !VALID_ROLES.has(rawRole as UserRole)) return null;
  const role = rawRole as UserRole;
  const centers = (Array.isArray(payload.centers) ? payload.centers : []) as string[];
  if (!username) return null;
  return { username, role, centers };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    return sessionStorage.getItem('emd-token');
  });
  const [user, setUser] = useState<User | null>(() => {
    const stored = sessionStorage.getItem('emd-token');
    return stored ? userFromToken(stored) : null;
  });
  const [displayName, setDisplayName] = useState('');
  const [inactivityWarning, setInactivityWarning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch display name from /api/auth/users/me when user changes
  useEffect(() => {
    if (!user || !token) {
      setDisplayName('');
      return;
    }
    fetch('/api/auth/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() as Promise<{ user?: { firstName?: string; lastName?: string; username: string } }> : null)
      .then((data) => {
        const u = data?.user;
        if (u?.firstName || u?.lastName) {
          setDisplayName([u.firstName, u.lastName].filter(Boolean).join(' '));
        } else {
          setDisplayName(user.username);
        }
      })
      .catch(() => setDisplayName(user.username));
  }, [user, token]);

  const performLogout = useCallback((auto = false) => {
    void auto; // auto-logout logged server-side via audit middleware
    // Phase 20 / D-15: notify server to clear refresh + CSRF cookies and bump tokenVersion.
    // serverLogout() swallows network errors so a failure never traps the user in a
    // half-logged-in state. Fire-and-forget — local state is cleared synchronously below.
    void serverLogout();
    // SESSION-05: notify sibling tabs to clear their session and redirect to /login.
    broadcastLogout();
    setUser(null);
    setToken(null);
    setInactivityWarning(false);
    sessionStorage.removeItem('emd-token');
    invalidateBundleCache(); // L-12: clear stale data from previous user's center scope
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

  const login = useCallback(async (
    username: string,
    password: string,
    otp?: string,
    challengeToken?: string,
  ): Promise<LoginResult> => {
    try {
      // Step 2: OTP verification
      if (otp && challengeToken) {
        const resp = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ challengeToken, otp }),
        });

        if (resp.ok) {
          const data = await resp.json() as { token: string };
          sessionStorage.setItem('emd-token', data.token);
          setToken(data.token);
          setUser(userFromToken(data.token));
          return { ok: true };
        }

        if (resp.status === 429) {
          const data = await resp.json() as { retryAfterMs?: number };
          return { ok: false, error: 'account_locked', retryAfterMs: data.retryAfterMs };
        }

        return { ok: false, error: 'invalid_otp' };
      }

      // Step 1: Credential validation
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (resp.ok) {
        const data = await resp.json() as { token?: string; challengeToken?: string };

        if (data.token) {
          // 2FA disabled — direct session token
          sessionStorage.setItem('emd-token', data.token);
          setToken(data.token);
          setUser(userFromToken(data.token));
          return { ok: true };
        }

        if (data.challengeToken) {
          // 2FA enabled — need OTP
          return { ok: false, error: 'otp_required', challengeToken: data.challengeToken };
        }
      }

      if (resp.status === 429) {
        const data = await resp.json() as { retryAfterMs?: number };
        return { ok: false, error: 'account_locked', retryAfterMs: data.retryAfterMs };
      }

      return { ok: false, error: 'invalid_credentials' };
    } catch {
      return { ok: false, error: 'network_error' };
    }
  }, []);

  const logout = useCallback(() => performLogout(false), [performLogout]);

  const hasRole = useCallback((roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  const value = useMemo<AuthContextType>(() => ({
    user, displayName, login, logout, inactivityWarning, hasRole, token,
  }), [user, displayName, login, logout, inactivityWarning, hasRole, token]);

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
