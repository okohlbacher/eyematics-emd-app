import { createContext, type ReactNode,useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { broadcastLogout, serverLogout } from '../services/authHeaders';
import { invalidateBundleCache } from '../services/fhirLoader';
import * as recentActivityStore from '../services/recentActivityStore';
import * as settingsService from '../services/settingsService';

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

/** Roles that can view documentation quality benchmarking */
export const QUALITY_ROLES: UserRole[] = ['admin', 'clinic_lead', 'data_manager'];

export interface User {
  username: string;
  role: UserRole;
  centers: string[];
}

type LoginResult =
  | { ok: true }
  | { ok: false; error: 'invalid_credentials' | 'otp_required' | 'account_locked' | 'invalid_otp' | 'network_error'; challengeToken?: string; retryAfterMs?: number; attemptsRemaining?: number };

interface AuthContextType {
  user: User | null;
  /** Display name: "FirstName LastName (username)" or fallback to username */
  displayName: string;
  login: (username: string, password: string, otp?: string, challengeToken?: string) => Promise<LoginResult>;
  logout: () => void;
  inactivityWarning: boolean;
  /** Live countdown in seconds; only meaningful when inactivityWarning is true (AUTHCFG-02). */
  inactivitySecondsRemaining: number;
  /** Check if current user has a given role or is in a role list */
  hasRole: (roles: UserRole[]) => boolean;
  /** JWT token for API calls */
  token: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Exported defaults — used as safe fallbacks when loadSettings() rejects (T-32-09).
// The active timer values are sourced from settings at mount time; these are the fallbacks only.
export const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes (safe default)
export const WARNING_BEFORE = 3 * 60 * 1000;       // 3 minutes (AUTHCFG-02)

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
  /** Live seconds remaining in the inactivity warning window (AUTHCFG-02). */
  const [inactivitySecondsRemaining, setInactivitySecondsRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warningEndsAtRef = useRef<number>(0);
  /** Effective timer values sourced from settings (with safe-default fallback). */
  const inactivityTimeoutMsRef = useRef<number>(INACTIVITY_TIMEOUT);
  const warningBeforeMsRef = useRef<number>(WARNING_BEFORE);

  useEffect(() => {
    if (!user || !token) {
      setDisplayName('');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/auth/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = r.ok
          ? ((await r.json()) as { user?: { firstName?: string; lastName?: string; username: string } })
          : null;
        if (cancelled) return;
        const u = data?.user;
        if (u?.firstName || u?.lastName) {
          setDisplayName([u.firstName, u.lastName].filter(Boolean).join(' '));
        } else {
          setDisplayName(user.username);
        }
      } catch {
        if (!cancelled) setDisplayName(user.username);
      }
    })();
    return () => { cancelled = true; };
  }, [user, token]);

  const performLogout = useCallback((auto = false) => {
    void auto; // auto-logout logged server-side via audit middleware
    // T-29-09 / D-02 / CR-01: purge ALL emd-recent:* keys on every interactive logout.
    // localStorage is origin-scoped and shared across every user of this browser profile,
    // and entry labels store patient pseudonyms — clearing only the logging-out user's key
    // (clear(username)) leaves any other user's residue physically readable on the same
    // machine, defeating the D-01 per-username isolation guarantee. clearAll() sweeps every
    // namespace so a normal single-tab logout leaves no pseudonym behind.
    recentActivityStore.clearAll();
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
    sessionStorage.removeItem('emd-cohort-filters'); // D-05: clear persisted cohort context on logout (T-33-03)
    invalidateBundleCache(); // L-12: clear stale data from previous user's center scope
  }, []);

  const resetInactivityTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setInactivityWarning(false);
    setInactivitySecondsRemaining(0);

    if (!user) return;

    const timeoutMs = inactivityTimeoutMsRef.current;
    const warningMs = warningBeforeMsRef.current;

    warningRef.current = setTimeout(() => {
      setInactivityWarning(true);
      // Start the live countdown when the warning fires (AUTHCFG-02)
      warningEndsAtRef.current = Date.now() + warningMs;
      setInactivitySecondsRemaining(Math.ceil(warningMs / 1000));
      countdownRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((warningEndsAtRef.current - Date.now()) / 1000));
        setInactivitySecondsRemaining(remaining);
        if (remaining <= 0 && countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      }, 1000);
    }, timeoutMs - warningMs);

    timerRef.current = setTimeout(() => {
      performLogout(true);
    }, timeoutMs);
  }, [user, performLogout]);

  // AUTHCFG-03: load inactivity timer values from settings before starting the timer.
  // Falls back to safe defaults (INACTIVITY_TIMEOUT / WARNING_BEFORE) if loadSettings()
  // rejects — the timer never disables itself on failure (T-32-09).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const s = await settingsService.loadSettings();
        if (cancelled) return;
        inactivityTimeoutMsRef.current = s.auth?.inactivityTimeoutMs ?? INACTIVITY_TIMEOUT;
        warningBeforeMsRef.current = s.auth?.warningBeforeMs ?? WARNING_BEFORE;
      } catch {
        // Safe-default fallback — use the exported constants (T-32-09)
        inactivityTimeoutMsRef.current = INACTIVITY_TIMEOUT;
        warningBeforeMsRef.current = WARNING_BEFORE;
      }
      if (!cancelled) {
        resetInactivityTimer();
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Set up activity listeners (EMDREQ-USM-008)
  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    const handler = () => resetInactivityTimer();

    events.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    // Note: initial timer start is handled by the settings-load effect above

    return () => {
      events.forEach((e) => window.removeEventListener(e, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
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
          // CR-01: purge any prior user's recent-activity residue before seeding the new
          // session so a fresh login never inherits stale pseudonyms from shared-origin
          // localStorage on this machine.
          recentActivityStore.clearAll();
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
          // CR-01: purge any prior user's recent-activity residue before seeding the new
          // session so a fresh login never inherits stale pseudonyms from shared-origin
          // localStorage on this machine.
          recentActivityStore.clearAll();
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

      // Parse 401 body to surface attemptsRemaining for the login page (AUTHCFG-01).
      // The server returns attemptsRemaining on both known-user and unknown-user 401 paths.
      try {
        const data = await resp.json() as { attemptsRemaining?: number };
        return { ok: false, error: 'invalid_credentials', attemptsRemaining: data.attemptsRemaining };
      } catch {
        return { ok: false, error: 'invalid_credentials' };
      }
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
    user, displayName, login, logout, inactivityWarning, inactivitySecondsRemaining, hasRole, token,
  }), [user, displayName, login, logout, inactivityWarning, inactivitySecondsRemaining, hasRole, token]);

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
