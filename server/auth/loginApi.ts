/**
 * Login router: POST /login, POST /verify, POST /refresh, POST /logout, GET /config
 *
 * Implements two-step login with optional 2FA.
 * Rate limiting: per-username in-memory Map with exponential backoff.
 * OTP: fixed configurable code from settings.yaml — no otplib.
 */

import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { authenticator } from 'otplib';

import { requireCsrf } from '../authMiddleware.js';
import { getAuthConfig, loadUsers, modifyUsers } from '../initAuth.js';
import {
  signAccessToken,
  verifyChallengeToken,
  verifyRefreshToken,
} from '../jwtUtil.js';
import { getAuthProvider } from '../keycloakAuth.js';
import { getSession, revokeFamily, revokeSession } from '../sessionsDb.js';
import { getAuthSettings } from '../settingsApi.js';
import {
  emitRefreshCookies,
  limiter,
  signChallengeToken,
  signSessionToken,
  touchLastLogin,
} from './authHelpers.js';

export const loginRouter = Router();

/**
 * POST /login
 *
 * Step 1 of login. Validates bcrypt credentials.
 * - If 2FA disabled: returns { token } (full session JWT)
 * - If 2FA enabled: returns { challengeToken } (short-lived, purpose='challenge')
 * - If account locked: returns 429 with retryAfterMs
 * - On bad credentials: returns 401 with generic error (no username enumeration, T-02-05)
 */
loginRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  // D-04: Local login disabled in Keycloak mode
  if (getAuthProvider() === 'keycloak') {
    res.status(405).json({
      error: 'Local login is disabled. This instance uses Keycloak SSO. Contact your administrator.',
    });
    return;
  }

  const { username, password } = req.body as { username?: string; password?: string };

  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    res.status(400).json({ error: 'username and password are required' });
    return;
  }

  const key = username.toLowerCase();
  const state = limiter().getLockState(key);

  // Check lock before any credential lookup
  if (limiter().isLocked(state)) {
    const retryAfterMs = state.lockedUntil - Date.now();
    res.status(429).json({ error: 'Account locked', retryAfterMs });
    return;
  }

  // Find user (case-insensitive)
  const users = loadUsers();
  const user = users.find((u) => u.username.toLowerCase() === key);

  if (!user || !user.passwordHash) {
    // Record failure even for unknown users (prevent timing-based enumeration — T-02-05).
    // Symmetric with the known-user bad-password branch (Blocker #2 / T-32-06):
    // unknown-user crossing the threshold gets the same 429 shape as a known-user lockout
    // so response shape cannot reveal account existence.
    const newStateUnknown = limiter().recordFailure(key);
    if (limiter().isLocked(newStateUnknown)) {
      const retryAfterMs = newStateUnknown.lockedUntil - Date.now();
      res.status(429).json({ error: 'Account locked', retryAfterMs });
      return;
    }
    const attemptsRemainingUnknown = Math.max(0, getAuthConfig().maxLoginAttempts - newStateUnknown.count);
    res.status(401).json({ error: 'Invalid credentials', attemptsRemaining: attemptsRemainingUnknown });
    return;
  }

  // Verify password
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const newState = limiter().recordFailure(key);
    if (limiter().isLocked(newState)) {
      const retryAfterMs = newState.lockedUntil - Date.now();
      res.status(429).json({ error: 'Account locked', retryAfterMs });
      return;
    }
    const attemptsRemaining = Math.max(0, getAuthConfig().maxLoginAttempts - newState.count);
    res.status(401).json({ error: 'Invalid credentials', attemptsRemaining });
    return;
  }

  // Successful login — reset attempts
  limiter().resetAttempts(key);

  // UMGMT-03 / T-32-01 — inactive user gate. absent `active` means active —
  // migration target; only an explicit `false` blocks login.
  // Return the SAME generic 401 as bad credentials to prevent account enumeration (T-02-05).
  if (user.active === false) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const { twoFactorEnabled } = getAuthConfig();

  // Per-user TOTP overrides the global twoFactorEnabled toggle — if this user has
  // confirmed TOTP enrollment, always require the OTP step (SEC-15 / Phase 15).
  if (twoFactorEnabled || user.totpEnabled) {
    // Return short-lived challenge token for OTP step
    const challengeToken = signChallengeToken(user.username);
    res.json({ challengeToken });
  } else {
    // Return full session JWT directly — update lastLogin (H-12)
    const token = signSessionToken(user.username, user.role, user.centers);
    touchLastLogin(user.username);
    // Phase 20 / D-06 — emit refresh + CSRF cookies on every successful login
    emitRefreshCookies(res, user);
    res.json({ token });
  }
});

/**
 * POST /verify
 *
 * Step 2 of login (2FA). Validates challenge token + OTP.
 * OTP compared against fixed code from settings.yaml (no otplib).
 * OTP attempts share the same lockout counter as password attempts (T-02-06).
 */
loginRouter.post('/verify', async (req: Request, res: Response): Promise<void> => {
  const { challengeToken, otp } = req.body as { challengeToken?: string; otp?: string };

  if (typeof challengeToken !== 'string' || typeof otp !== 'string' || !challengeToken || !otp) {
    res.status(400).json({ error: 'challengeToken and otp are required' });
    return;
  }

  // Verify challenge token (Plan 20-02 / D-04 — via jwtUtil; typ:'challenge'
  // is enforced inside verifyChallengeToken, so a stolen access/refresh token
  // smuggled into the challengeToken slot is rejected before purpose check).
  let sub: string;
  try {
    const payload = verifyChallengeToken(challengeToken);
    if (payload.purpose !== 'challenge') {
      res.status(401).json({ error: 'Invalid challenge token' });
      return;
    }
    sub = payload.sub;
  } catch {
    res.status(401).json({ error: 'Invalid or expired challenge token' });
    return;
  }

  const key = sub.toLowerCase();
  const state = limiter().getLockState(key);

  // Check lock (OTP brute-force shares counter with password attempts)
  if (limiter().isLocked(state)) {
    const retryAfterMs = state.lockedUntil - Date.now();
    res.status(429).json({ error: 'Account locked', retryAfterMs });
    return;
  }

  // Load user up-front so we can route between per-user TOTP and shared otpCode
  const users = loadUsers();
  const user = users.find((u) => u.username.toLowerCase() === key);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  // UMGMT-03 / T-32-02 — inactive gate at verify step too. A challenge token
  // issued before deactivation must not complete login (T-32-02).
  // absent `active` means active — only explicit false blocks.
  if (user.active === false) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const otpInput = otp.trim();
  let otpValid = false;
  let recoveryCodeConsumed = false;

  if (user.totpEnabled && user.totpSecret) {
    // Per-user TOTP path (SEC-15). Accept 6-digit TOTP or a recovery code.
    const digits = otpInput.replace(/\s+/g, '');
    if (/^\d{6}$/.test(digits)) {
      try {
        otpValid = authenticator.check(digits, user.totpSecret);
      } catch {
        otpValid = false;
      }
    } else if (digits.length >= 10 && Array.isArray(user.recoveryCodeHashes)) {
      // Recovery-code path: bcrypt-compare against stored hashes; burn on match.
      for (const h of user.recoveryCodeHashes) {
        if (await bcrypt.compare(digits, h)) {
          otpValid = true;
          recoveryCodeConsumed = true;
          break;
        }
      }
    }
  } else {
    // Legacy shared-otpCode path (pre-enrollment users)
    const { otpCode } = getAuthConfig();
    otpValid = otpInput === otpCode;
  }

  if (!otpValid) {
    const newState = limiter().recordFailure(key);
    if (limiter().isLocked(newState)) {
      const retryAfterMs = newState.lockedUntil - Date.now();
      res.status(429).json({ error: 'Account locked', retryAfterMs });
      return;
    }
    res.status(401).json({ error: 'Invalid OTP' });
    return;
  }

  // OTP valid — reset attempts and (if needed) burn the recovery code atomically
  limiter().resetAttempts(key);

  if (recoveryCodeConsumed) {
    try {
      await modifyUsers((all) => all.map((r) => {
        if (r.username !== user.username) return r;
        const remaining: string[] = [];
        let burned = false;
        for (const h of r.recoveryCodeHashes ?? []) {
          if (!burned && bcrypt.compareSync(otpInput, h)) {
            burned = true;
            continue;
          }
          remaining.push(h);
        }
        return { ...r, recoveryCodeHashes: remaining };
      }));
    } catch { /* best-effort */ }
  }

  const token = signSessionToken(user.username, user.role, user.centers);
  touchLastLogin(user.username);
  // Phase 20 / D-06 — emit refresh + CSRF cookies after the OTP step too
  emitRefreshCookies(res, user);
  res.json({ token });
});

// ---------------------------------------------------------------------------
// Phase 20 / D-13, D-15 — POST /refresh and POST /logout
// ---------------------------------------------------------------------------

/**
 * POST /api/auth/refresh
 *
 * Public route (no Bearer required). Credentials are the emd-refresh cookie
 * + matching X-CSRF-Token header. Validates: cookie present → JWT valid (typ
 * + alg pinned by jwtUtil) → not over absolute cap → user exists → tokenVersion
 * matches. On success: rotates refresh cookie (new exp, SAME sid — preserves
 * absolute-cap anchor) and returns a fresh access token.
 */
loginRouter.post('/refresh', requireCsrf, (req: Request, res: Response): void => {
  const settings = getAuthSettings();
  const cookie = req.cookies?.['emd-refresh'];
  if (typeof cookie !== 'string' || !cookie) {
    res.status(401).json({ error: 'Missing refresh token' });
    return;
  }

  let payload;
  try {
    payload = verifyRefreshToken(cookie);
  } catch {
    res.status(401).json({ error: 'Invalid refresh token' });
    return;
  }

  // D-06 + D-08: jti lookup FIRST — before tokenVersion check or absolute cap.
  // Empty jti means pre-Phase-27 token (D-18 sentinel); getSession('') returns
  // null → same family-revocation path.
  const existing = getSession(payload.jti);
  if (!existing || existing.revoked === 1) {
    revokeFamily(payload.sid);
    res.clearCookie('emd-refresh', { path: '/api/auth/refresh' });
    res.status(401).json({ error: 'Refresh token reuse detected' });
    return;
  }

  // Absolute cap: server-authoritative issued_at from sessions row (tamper-proof).
  const ageMs = Date.now() - new Date(existing.issued_at).getTime();
  if (ageMs > settings.refreshAbsoluteCapMs) {
    revokeSession(payload.jti);
    res.clearCookie('emd-refresh', { path: '/api/auth/refresh' });
    res.status(401).json({ error: 'Session cap exceeded' });
    return;
  }

  const users = loadUsers();
  const user = users.find((u) => u.username.toLowerCase() === payload.sub.toLowerCase());
  if (!user) {
    revokeSession(payload.jti);
    res.status(401).json({ error: 'User not found' });
    return;
  }

  // D-19: tokenVersion check remains as second-layer invalidation (explicit logout / password change).
  if ((user.tokenVersion ?? 0) !== payload.ver) {
    revokeSession(payload.jti);
    res.clearCookie('emd-refresh', { path: '/api/auth/refresh' });
    res.status(401).json({ error: 'Token version stale' });
    return;
  }

  // Valid — revoke the consumed token and rotate into a new one (same sid, new jti).
  revokeSession(payload.jti);
  emitRefreshCookies(res, user, payload.sid);

  const accessTtlMs = 10 * 60 * 1000;
  const access = signAccessToken({
    sub: user.username,
    preferred_username: user.username,
    role: user.role,
    centers: user.centers,
  }, accessTtlMs);
  res.json({ token: access, expiresAt: Date.now() + accessTtlMs });
});

/**
 * POST /api/auth/logout
 *
 * Bumps user.tokenVersion (invalidates ALL outstanding refresh tokens for this
 * user) and clears both cookies. Requires a valid Bearer access token (so the
 * authenticated user is known) AND a matching CSRF cookie/header pair.
 *
 * Audit: emitted by auditMiddleware as a normal POST event; Plan 03 will add
 * the i18n label `audit_action_logout`.
 */
loginRouter.post('/logout', requireCsrf, async (req: Request, res: Response): Promise<void> => {
  const username = req.auth?.preferred_username ?? req.auth?.sub;
  if (username) {
    try {
      await modifyUsers((users) => users.map((u) =>
        u.username.toLowerCase() === username.toLowerCase()
          ? { ...u, tokenVersion: (u.tokenVersion ?? 0) + 1 }
          : u,
      ));
    } catch {
      /* best-effort — clearing cookies still helps the user even if write fails */
    }
  }
  const settings = getAuthSettings();
  res.cookie('emd-refresh', '', {
    httpOnly: true,
    secure: settings.refreshCookieSecure,
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: 0,
  });
  res.cookie('emd-csrf', '', {
    httpOnly: false,
    secure: settings.refreshCookieSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  });
  res.status(200).json({ ok: true });
});

/**
 * GET /config
 *
 * Public endpoint. Returns twoFactorEnabled so the LoginPage can decide
 * whether to show the OTP field (D-02).
 */
loginRouter.get('/config', (_req: Request, res: Response): void => {
  const { twoFactorEnabled } = getAuthConfig();
  const provider = getAuthProvider();
  res.json({ twoFactorEnabled, provider });
});
