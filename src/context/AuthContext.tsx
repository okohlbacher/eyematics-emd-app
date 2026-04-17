import { createContext, type ReactNode,useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

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
  | { ok: false; error: 'invalid_credentials' | 'otp_required' | 'account_locked' | 'invalid_otp' | 'network_error'; challengeToken?: string; retryAfterMs?: number }
  | { ok: false; error: 'must_change_password'; changeToken: string }
  | { ok: false; error: 'totp_enrollment_required'; enrollToken: string };

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
  /** SEC-03: true when user must change password before accessing the app */
  mustChangePassword: boolean;
  /** SEC-03: short-lived changeToken issued by /login for mustChangePassword users */
  pendingChangeToken: string | null;
  /** SEC-03: submit a new password using the pending changeToken */
  changePassword: (changeToken: string, newPassword: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** SEC-04: true when user must complete TOTP enrollment before accessing the app */
  requiresTotpEnrollment: boolean;
  /** SEC-04: short-lived enrollToken issued by /login for unenrolled users */
  pendingEnrollToken: string | null;
  /** SEC-04 Step 1: request QR code + manual key from server */
  startTotpEnroll: () => Promise<{ ok: true; qrDataUrl: string; manualKey: string; enrollToken: string } | { ok: false; error: string }>;
  /** SEC-04 Step 2: submit 6-digit confirmation code */
  confirmTotpEnroll: (otp: string) => Promise<{ ok: true; recoveryCodes: string[]; token: string } | { ok: false; error: string }>;
  /** SEC-04 Step 3: called after user confirms they saved recovery codes — activates session */
  completeTotpEnroll: (token: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
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

/** Extract User from JWT payload. */
function userFromToken(token: string): User | null {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;
  const username = (payload.preferred_username ?? payload.sub) as string;
  const role = (payload.role ?? 'researcher') as UserRole;
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
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [pendingChangeToken, setPendingChangeToken] = useState<string | null>(null);
  const [requiresTotpEnrollment, setRequiresTotpEnrollment] = useState(false);
  const [pendingEnrollToken, setPendingEnrollToken] = useState<string | null>(null);
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
    setUser(null);
    setToken(null);
    setInactivityWarning(false);
    setMustChangePassword(false);
    setPendingChangeToken(null);
    setRequiresTotpEnrollment(false);
    setPendingEnrollToken(null);
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
        const data = await resp.json() as { token?: string; challengeToken?: string; mustChangePassword?: boolean; changeToken?: string; requiresTotpEnrollment?: boolean; enrollToken?: string };

        if (data.mustChangePassword && data.changeToken) {
          // SEC-03: user must change default password before getting a session
          setMustChangePassword(true);
          setPendingChangeToken(data.changeToken);
          return { ok: false, error: 'must_change_password', changeToken: data.changeToken };
        }

        if (data.requiresTotpEnrollment && data.enrollToken) {
          // SEC-04: user must complete TOTP enrollment before getting a session
          setRequiresTotpEnrollment(true);
          setPendingEnrollToken(data.enrollToken);
          return { ok: false, error: 'totp_enrollment_required', enrollToken: data.enrollToken };
        }

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

  const changePassword = useCallback(async (changeToken: string, newPassword: string) => {
    try {
      const resp = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changeToken, newPassword }),
      });
      if (resp.ok) {
        const data = await resp.json() as { token: string };
        sessionStorage.setItem('emd-token', data.token);
        setToken(data.token);
        setUser(userFromToken(data.token));
        setMustChangePassword(false);
        setPendingChangeToken(null);
        return { ok: true as const };
      }
      const err = await resp.json() as { error?: string };
      return { ok: false as const, error: err.error ?? 'Unknown error' };
    } catch {
      return { ok: false as const, error: 'network_error' };
    }
  }, []);

  /** SEC-04 Step 1: request QR code + manual key from server. */
  const startTotpEnroll = useCallback(async (): Promise<
    { ok: true; qrDataUrl: string; manualKey: string; enrollToken: string } | { ok: false; error: string }
  > => {
    if (!pendingEnrollToken) return { ok: false, error: 'no_pending_token' };
    try {
      const resp = await fetch('/api/auth/totp/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollToken: pendingEnrollToken }),
      });
      const data = await resp.json() as { qrDataUrl?: string; manualKey?: string; enrollToken?: string; error?: string };
      if (!resp.ok) return { ok: false, error: data.error ?? 'enroll_failed' };
      setPendingEnrollToken(data.enrollToken ?? pendingEnrollToken); // refresh with fresh token
      return { ok: true, qrDataUrl: data.qrDataUrl!, manualKey: data.manualKey!, enrollToken: data.enrollToken! };
    } catch {
      return { ok: false, error: 'network_error' };
    }
  }, [pendingEnrollToken]);

  /** SEC-04 Step 2: submit 6-digit confirmation code. */
  const confirmTotpEnroll = useCallback(async (otp: string): Promise<
    { ok: true; recoveryCodes: string[]; token: string } | { ok: false; error: string }
  > => {
    if (!pendingEnrollToken) return { ok: false, error: 'no_pending_token' };
    try {
      const resp = await fetch('/api/auth/totp/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollToken: pendingEnrollToken, otp }),
      });
      const data = await resp.json() as { recoveryCodes?: string[]; token?: string; error?: string };
      if (!resp.ok) return { ok: false, error: data.error ?? 'confirm_failed' };
      // Do NOT clear requiresTotpEnrollment yet — wait for user to save recovery codes
      return { ok: true, recoveryCodes: data.recoveryCodes!, token: data.token! };
    } catch {
      return { ok: false, error: 'network_error' };
    }
  }, [pendingEnrollToken]);

  /** SEC-04 Step 3: called after user confirms they saved recovery codes — activates session. */
  const completeTotpEnroll = useCallback((sessionToken: string) => {
    setRequiresTotpEnrollment(false);
    setPendingEnrollToken(null);
    sessionStorage.setItem('emd-token', sessionToken);
    setToken(sessionToken);
    setUser(userFromToken(sessionToken));
  }, []);

  const hasRole = useCallback((roles: UserRole[]): boolean => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  const value = useMemo<AuthContextType>(() => ({
    user, displayName, login, logout, inactivityWarning, hasRole, token,
    mustChangePassword, pendingChangeToken, changePassword,
    requiresTotpEnrollment, pendingEnrollToken, startTotpEnroll, confirmTotpEnroll, completeTotpEnroll,
  }), [user, displayName, login, logout, inactivityWarning, hasRole, token, mustChangePassword, pendingChangeToken, changePassword, requiresTotpEnrollment, pendingEnrollToken, startTotpEnroll, confirmTotpEnroll, completeTotpEnroll]);

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
