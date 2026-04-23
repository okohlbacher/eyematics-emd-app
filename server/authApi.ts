/**
 * Auth API router: POST /login, POST /verify, GET /config
 *
 * Implements two-step login with optional 2FA.
 * Rate limiting: per-username in-memory Map with exponential backoff.
 * OTP: fixed configurable code from settings.yaml — no otplib.
 */

import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import type { Request, Response } from 'express';
import { Router } from 'express';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';

import { requireCsrf } from './authMiddleware.js';
import { getValidCenterIds } from './constants.js';
import type { UserRecord } from './initAuth.js';
import { getAuthConfig, loadUsers, modifyUsers } from './initAuth.js';
import {
  signAccessToken,
  signChallengeToken as signChallengeTokenUtil,
  signRefreshToken,
  verifyChallengeToken,
  verifyRefreshToken,
} from './jwtUtil.js';
import { getAuthProvider } from './keycloakAuth.js';
import { createRateLimiter } from './rateLimiting.js';
import { getAuthSettings } from './settingsApi.js';

// ---------------------------------------------------------------------------
// Constants for user CRUD validation
// ---------------------------------------------------------------------------

const VALID_ROLES = new Set(['admin', 'researcher', 'epidemiologist', 'clinician', 'data_manager', 'clinic_lead']);

/**
 * Generate a secure random password: 16 chars base64url = ~96 bits entropy.
 * Used for both user creation (D-01) and password reset.
 */
function generateSecurePassword(length = 16): string {
  return crypto.randomBytes(Math.ceil(length * 0.75))
    .toString('base64url')
    .slice(0, length);
}

// ---------------------------------------------------------------------------
// Rate limiting state (in-memory, per username)
// ---------------------------------------------------------------------------

// Rate limiter -- lazy init because getAuthConfig() requires initAuth() to have run first.
// Single instance shared by /login and /verify handlers (addresses Codex review concern).
let _limiter: ReturnType<typeof createRateLimiter> | null = null;
function limiter() {
  if (!_limiter) {
    _limiter = createRateLimiter(getAuthConfig().maxLoginAttempts);
  }
  return _limiter;
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

/** Sign a full session JWT (10 min expiry per D-05). */
function signSessionToken(username: string, role: string, centers: string[]): string {
  // Plan 20-02 / D-04 — route through jwtUtil so the typ:'access' claim is
  // applied consistently and HS256 stays pinned in one place.
  return signAccessToken(
    { sub: username, preferred_username: username, role, centers },
    10 * 60 * 1000,
  );
}

/**
 * M8: Fire-and-forget last-login write. Factored out of /login and /verify
 * so a future policy change (e.g. debouncing writes, recording login source)
 * lives in one place. Intentionally best-effort: never block or fail the
 * login response if the users.json write fails.
 */
function touchLastLogin(username: string): void {
  try {
    modifyUsers((users) =>
      users.map((u) => u.username === username ? { ...u, lastLogin: new Date().toISOString() } : u),
    ).catch(() => {});
  } catch { /* best-effort */ }
}

/**
 * Phase 20 / D-06, D-13, D-14 — emit the refresh + CSRF cookie pair on
 * successful login/verify. Cookies use SameSite=Strict; the refresh cookie is
 * httpOnly and scoped to /api/auth/refresh, the CSRF cookie is JS-readable.
 *
 * `sid` is a fresh random UUID PER LOGIN (not per refresh) — preserved across
 * rolling rotations so the absolute-cap timer anchors to the original login.
 */
function emitRefreshCookies(res: Response, user: UserRecord): void {
  const settings = getAuthSettings();
  const sid = crypto.randomUUID();
  const refreshJwt = signRefreshToken(
    { sub: user.username, ver: user.tokenVersion ?? 0, sid },
    settings.refreshTokenTtlMs,
  );
  const csrf = crypto.randomBytes(32).toString('hex');

  res.cookie('emd-refresh', refreshJwt, {
    httpOnly: true,
    secure: settings.refreshCookieSecure,
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: settings.refreshTokenTtlMs,
  });
  res.cookie('emd-csrf', csrf, {
    httpOnly: false,
    secure: settings.refreshCookieSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: settings.refreshTokenTtlMs,
  });
}

/** Sign a challenge token for 2FA step 2 (2 min expiry, purpose='challenge'). */
function signChallengeToken(username: string): string {
  // Plan 20-02 / D-04 — route through jwtUtil. The typ:'challenge' claim added
  // by signChallengeTokenUtil makes verifyAccessToken / verifyRefreshToken
  // physically reject this token if a caller mis-routes it.
  return signChallengeTokenUtil({ sub: username, purpose: 'challenge' }, 2 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const authApiRouter = Router();

/**
 * POST /login
 *
 * Step 1 of login. Validates bcrypt credentials.
 * - If 2FA disabled: returns { token } (full session JWT)
 * - If 2FA enabled: returns { challengeToken } (short-lived, purpose='challenge')
 * - If account locked: returns 429 with retryAfterMs
 * - On bad credentials: returns 401 with generic error (no username enumeration, T-02-05)
 */
authApiRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
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
    // Record failure even for unknown users (prevent timing-based enumeration)
    limiter().recordFailure(key);
    res.status(401).json({ error: 'Invalid credentials' });
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
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  // Successful login — reset attempts
  limiter().resetAttempts(key);

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
authApiRouter.post('/verify', async (req: Request, res: Response): Promise<void> => {
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
authApiRouter.post('/refresh', requireCsrf, (req: Request, res: Response): void => {
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

  const settings = getAuthSettings();
  const ageMs = Date.now() - payload.iat * 1000;
  if (ageMs > settings.refreshAbsoluteCapMs) {
    res.status(401).json({ error: 'Session cap exceeded' });
    return;
  }

  const users = loadUsers();
  const user = users.find((u) => u.username.toLowerCase() === payload.sub.toLowerCase());
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }
  if ((user.tokenVersion ?? 0) !== payload.ver) {
    res.status(401).json({ error: 'Token version stale' });
    return;
  }

  // D-13 — rolling rotation. New exp, SAME sid so any future absolute-cap
  // calculation can anchor on the original login (currently we use payload.iat,
  // but preserving sid lets a stateful upgrade in SESSION-11 do per-session
  // revocation without breaking the cap math).
  const newRefresh = signRefreshToken(
    { sub: user.username, ver: user.tokenVersion ?? 0, sid: payload.sid },
    settings.refreshTokenTtlMs,
  );
  res.cookie('emd-refresh', newRefresh, {
    httpOnly: true,
    secure: settings.refreshCookieSecure,
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: settings.refreshTokenTtlMs,
  });

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
authApiRouter.post('/logout', requireCsrf, async (req: Request, res: Response): Promise<void> => {
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
authApiRouter.get('/config', (_req: Request, res: Response): void => {
  const { twoFactorEnabled } = getAuthConfig();
  const provider = getAuthProvider();
  res.json({ twoFactorEnabled, provider });
});

/**
 * GET /api/auth/users/me
 *
 * Returns the authenticated user's profile (USER-01).
 * Available to any authenticated user (not admin-only).
 */
authApiRouter.get('/users/me', (req: Request, res: Response): void => {
  if (!req.auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  // Case-insensitive lookup to get full user record (review suggestion: case-insensitive matching)
  const userRecord = loadUsers().find(
    (u) => u.username.toLowerCase() === req.auth!.preferred_username.toLowerCase()
  );
  res.json({
    user: {
      username: req.auth.preferred_username,
      role: req.auth.role,
      centers: req.auth.centers,
      firstName: userRecord?.firstName,
      lastName: userRecord?.lastName,
    },
  });
});

/**
 * GET /api/auth/users
 *
 * Returns user list (without password hashes). Admin only (T-04-05).
 */
authApiRouter.get('/users', (req: Request, res: Response): void => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  const users = loadUsers().map(({ username, firstName, lastName, role, centers, createdAt, lastLogin }) => ({
    username, firstName, lastName, role, centers, createdAt, lastLogin,
  }));
  res.json({ users });
});

/**
 * POST /api/auth/users
 *
 * Create a new user with auto-generated password (USER-03, D-01, D-03).
 * Admin only. Password is server-generated — never sent in request body.
 * Centers validated against VALID_CENTERS allowlist (review concern #3).
 */
authApiRouter.post('/users', async (req: Request, res: Response): Promise<void> => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const { username, role, centers, firstName, lastName } = req.body as Record<string, unknown>;

  // Validate required fields
  if (typeof username !== 'string' || !username.trim()) {
    res.status(400).json({ error: 'username is required' });
    return;
  }

  // Validate role against allowlist — reject explicitly invalid values (F-40)
  if (role !== undefined && (typeof role !== 'string' || !VALID_ROLES.has(role))) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${[...VALID_ROLES].join(', ')}` });
    return;
  }
  const userRole = typeof role === 'string' && VALID_ROLES.has(role) ? role : 'researcher';

  // Validate centers against allowlist (review concern #3)
  const rawCenters = Array.isArray(centers) ? centers.filter((c): c is string => typeof c === 'string') : [];
  const validCenterIds = getValidCenterIds();
  const invalidCenters = rawCenters.filter((c) => !validCenterIds.has(c));
  if (invalidCenters.length > 0) {
    res.status(400).json({ error: `Invalid center codes: ${invalidCenters.join(', ')}` });
    return;
  }

  // Generate secure random password (D-01): 16 chars base64url = ~96 bits entropy
  const generatedPassword = generateSecurePassword();
  const passwordHash = await bcrypt.hash(generatedPassword, 12);

  const newUser: UserRecord = {
    username: username.trim(),
    passwordHash,
    role: userRole,
    centers: rawCenters,
    firstName: typeof firstName === 'string' && firstName.trim() ? firstName.trim() : undefined,
    lastName: typeof lastName === 'string' && lastName.trim() ? lastName.trim() : undefined,
    createdAt: new Date().toISOString(),
  };

  // F-11: atomic read-modify-write under lock prevents TOCTOU race
  try {
    await modifyUsers((users) => {
      if (users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase())) {
        throw new Error('USERNAME_EXISTS');
      }
      return [...users, newUser];
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'USERNAME_EXISTS') {
      res.status(409).json({ error: 'Username already exists' });
      return;
    }
    throw err;
  }

  // Return user WITHOUT passwordHash, plus the one-time generatedPassword
  const { passwordHash: _omit, ...safeUser } = newUser;
  // Cache-Control: no-store to prevent caching one-time password (review suggestion)
  res.setHeader('Cache-Control', 'no-store');
  res.status(201).json({ user: safeUser, generatedPassword });
});

/**
 * DELETE /api/auth/users/:username
 *
 * Remove a user (USER-04, D-03). Admin only.
 * Self-delete guard prevents admin from locking themselves out (T-04-03).
 */
authApiRouter.delete('/users/:username', async (req: Request, res: Response): Promise<void> => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const target = String(req.params.username ?? '');

  // Self-delete guard (T-04-03)
  if (req.auth.preferred_username.toLowerCase() === target.toLowerCase()) {
    res.status(409).json({ error: 'Cannot delete your own account' });
    return;
  }

  // F-11: atomic read-modify-write under lock prevents TOCTOU race
  try {
    await modifyUsers((users) => {
      const idx = users.findIndex((u) => u.username.toLowerCase() === target.toLowerCase());
      if (idx === -1) throw new Error('USER_NOT_FOUND');
      return [...users.slice(0, idx), ...users.slice(idx + 1)];
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    throw err;
  }
  res.json({ message: 'User deleted' });
});

/**
 * PUT /api/auth/users/:username
 *
 * Update a user's profile (firstName, lastName, role, centers). Admin only.
 * Username and passwordHash are immutable via this endpoint.
 */
authApiRouter.put('/users/:username', async (req: Request, res: Response): Promise<void> => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const target = String(req.params.username ?? '');
  const { role, centers, firstName, lastName } = req.body as Record<string, unknown>;

  // Validate role against allowlist
  if (role !== undefined && (typeof role !== 'string' || !VALID_ROLES.has(role))) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${[...VALID_ROLES].join(', ')}` });
    return;
  }

  // Validate centers against allowlist
  const rawCenters = Array.isArray(centers) ? centers.filter((c): c is string => typeof c === 'string') : undefined;
  if (rawCenters !== undefined) {
    const validCenterIds = getValidCenterIds();
    const invalidCenters = rawCenters.filter((c) => !validCenterIds.has(c));
    if (invalidCenters.length > 0) {
      res.status(400).json({ error: `Invalid center codes: ${invalidCenters.join(', ')}` });
      return;
    }
  }

  let updated: UserRecord | undefined;
  try {
    await modifyUsers((users) => {
      const user = users.find((u) => u.username.toLowerCase() === target.toLowerCase());
      if (!user) throw new Error('USER_NOT_FOUND');
      if (role !== undefined && typeof role === 'string') user.role = role;
      if (rawCenters !== undefined) user.centers = rawCenters;
      if (typeof firstName === 'string') user.firstName = firstName.trim() || undefined;
      if (typeof lastName === 'string') user.lastName = lastName.trim() || undefined;
      updated = user;
      return users;
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    throw err;
  }

  const { passwordHash: _omit, ...safeUser } = updated!;
  res.json({ user: safeUser });
});

/**
 * PUT /api/auth/users/me/password
 *
 * Plan 20-02 / D-18 (SESSION-03) — self password change. Verifies the current
 * password (proof-of-possession) before accepting the new one, then bumps
 * tokenVersion + passwordChangedAt atomically with the new hash so any
 * outstanding refresh cookie is invalidated on next /refresh.
 *
 * MUST be registered BEFORE the `/users/:username/password` route so the
 * literal `/me/` path wins over the parameterized match (Express matches in
 * registration order).
 *
 * Body: { currentPassword: string, newPassword: string }
 * - 400 on missing fields or newPassword shorter than 8 chars
 * - 401 on bad currentPassword
 * - 200 on success
 */
authApiRouter.put('/users/me/password', async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) { res.status(401).json({ error: 'Authentication required' }); return; }
  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };

  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword) {
    res.status(400).json({ error: 'currentPassword and newPassword are required' });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: 'newPassword must be at least 8 characters' });
    return;
  }

  const username = req.auth.preferred_username;
  const user = loadUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!user || !user.passwordHash) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: 'Current password is incorrect' });
    return;
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  const nowIso = new Date().toISOString();
  try {
    await modifyUsers((users) => {
      const u = users.find((x) => x.username.toLowerCase() === username.toLowerCase());
      if (!u) throw new Error('USER_NOT_FOUND');
      u.passwordHash = newHash;
      u.tokenVersion = (u.tokenVersion ?? 0) + 1;
      u.passwordChangedAt = nowIso;
      return users;
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    throw err;
  }
  res.json({ ok: true });
});

/**
 * PUT /api/auth/users/:username/password
 *
 * Reset a user's password (USER-11, D-03). Admin only.
 * Password is SERVER-GENERATED — no plaintext in request body (review concern #1, T-04-07).
 */
authApiRouter.put('/users/:username/password', async (req: Request, res: Response): Promise<void> => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  const target = String(req.params.username ?? '');

  // Server generates the new password — no plaintext in request body
  // This eliminates the audit log leak (review concern #1, T-04-07)
  const generatedPassword = generateSecurePassword();
  const newHash = await bcrypt.hash(generatedPassword, 12);

  // F-11: atomic read-modify-write under lock prevents TOCTOU race
  // Plan 20-02 / D-18: bump tokenVersion + passwordChangedAt in the SAME write
  // so outstanding refresh tokens for this user are invalidated atomically.
  const nowIso = new Date().toISOString();
  try {
    await modifyUsers((users) => {
      const user = users.find((u) => u.username.toLowerCase() === target.toLowerCase());
      if (!user) throw new Error('USER_NOT_FOUND');
      user.passwordHash = newHash;
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      user.passwordChangedAt = nowIso;
      return users;
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    throw err;
  }

  // Cache-Control: no-store to prevent caching one-time password (review suggestion)
  res.setHeader('Cache-Control', 'no-store');
  res.json({ generatedPassword });
});

// ---------------------------------------------------------------------------
// Per-user TOTP (SEC-15, Phase 15): enroll / confirm / disable / admin-reset
// ---------------------------------------------------------------------------

const TOTP_ISSUER = 'EyeMatics EMD';
const RECOVERY_CODE_COUNT = 10;

function generateRecoveryCode(): string {
  // 10 chars base32-ish: user-typable, ~50 bits entropy
  return crypto.randomBytes(8).toString('base64url').slice(0, 10).toUpperCase();
}

/**
 * POST /api/auth/totp/enroll
 * Starts (or restarts) TOTP enrollment for the authenticated user. Generates
 * a new secret, otpauth URL, QR data URL, and 10 one-time recovery codes.
 * Secret is stored immediately but totpEnabled stays false until /confirm.
 */
authApiRouter.post('/totp/enroll', async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) { res.status(401).json({ error: 'Authentication required' }); return; }
  const username = req.auth.preferred_username;

  const secret = authenticator.generateSecret();
  const otpauth = authenticator.keyuri(username, TOTP_ISSUER, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauth);

  const plaintextCodes: string[] = [];
  const hashedCodes: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const code = generateRecoveryCode();
    plaintextCodes.push(code);
    hashedCodes.push(await bcrypt.hash(code, 10));
  }

  try {
    await modifyUsers((users) => users.map((u) => {
      if (u.username.toLowerCase() !== username.toLowerCase()) return u;
      return { ...u, totpSecret: secret, totpEnabled: false, recoveryCodeHashes: hashedCodes };
    }));
  } catch {
    res.status(500).json({ error: 'Failed to persist TOTP enrollment' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json({ otpauth, qrDataUrl, recoveryCodes: plaintextCodes });
});

/**
 * POST /api/auth/totp/confirm  { otp }
 * Verifies the first 6-digit code against the pending secret and flips
 * totpEnabled=true. Required before TOTP is enforced at login.
 */
authApiRouter.post('/totp/confirm', async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) { res.status(401).json({ error: 'Authentication required' }); return; }
  const { otp } = req.body as { otp?: string };
  if (typeof otp !== 'string' || !/^\d{6}$/.test(otp.trim())) {
    res.status(400).json({ error: 'otp must be a 6-digit code' });
    return;
  }
  const username = req.auth.preferred_username;
  const user = loadUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!user || !user.totpSecret) {
    res.status(409).json({ error: 'No pending TOTP enrollment. Call /totp/enroll first.' });
    return;
  }
  if (!authenticator.check(otp.trim(), user.totpSecret)) {
    res.status(401).json({ error: 'Invalid OTP' });
    return;
  }
  // Plan 20-02 / D-18: bump tokenVersion + totpChangedAt atomically with the
  // totpEnabled flip so outstanding refresh cookies are invalidated.
  const nowIso = new Date().toISOString();
  try {
    await modifyUsers((users) => users.map((u) =>
      u.username.toLowerCase() === username.toLowerCase()
        ? { ...u, totpEnabled: true, tokenVersion: (u.tokenVersion ?? 0) + 1, totpChangedAt: nowIso }
        : u,
    ));
  } catch {
    res.status(500).json({ error: 'Failed to enable TOTP' });
    return;
  }
  res.json({ totpEnabled: true });
});

/**
 * POST /api/auth/totp/disable  { otp }
 * Self-disable TOTP. Requires a current valid OTP (or recovery code) to prove possession.
 */
authApiRouter.post('/totp/disable', async (req: Request, res: Response): Promise<void> => {
  if (!req.auth) { res.status(401).json({ error: 'Authentication required' }); return; }
  const { otp } = req.body as { otp?: string };
  if (typeof otp !== 'string' || !otp.trim()) {
    res.status(400).json({ error: 'otp is required' });
    return;
  }
  const username = req.auth.preferred_username;
  const user = loadUsers().find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!user || !user.totpEnabled || !user.totpSecret) {
    res.status(409).json({ error: 'TOTP is not enabled for this user' });
    return;
  }
  const input = otp.trim();
  let ok = /^\d{6}$/.test(input) ? authenticator.check(input, user.totpSecret) : false;
  if (!ok && Array.isArray(user.recoveryCodeHashes)) {
    for (const h of user.recoveryCodeHashes) {
      if (await bcrypt.compare(input, h)) { ok = true; break; }
    }
  }
  if (!ok) { res.status(401).json({ error: 'Invalid OTP' }); return; }
  // Plan 20-02 / D-18: bump tokenVersion + totpChangedAt atomically with the
  // TOTP-state strip so outstanding refresh cookies are invalidated.
  const nowIso = new Date().toISOString();
  try {
    await modifyUsers((users) => users.map((u) => {
      if (u.username.toLowerCase() !== username.toLowerCase()) return u;
      const { totpSecret: _s, totpEnabled: _e, recoveryCodeHashes: _c, ...rest } = u;
      return {
        ...(rest as UserRecord),
        tokenVersion: (u.tokenVersion ?? 0) + 1,
        totpChangedAt: nowIso,
      };
    }));
  } catch {
    res.status(500).json({ error: 'Failed to disable TOTP' });
    return;
  }
  res.json({ totpEnabled: false });
});

/**
 * GET /api/auth/totp/status
 * Returns the authenticated user's TOTP state for the SettingsPage UI.
 */
authApiRouter.get('/totp/status', (req: Request, res: Response): void => {
  if (!req.auth) { res.status(401).json({ error: 'Authentication required' }); return; }
  const user = loadUsers().find(
    (u) => u.username.toLowerCase() === req.auth!.preferred_username.toLowerCase(),
  );
  res.json({
    totpEnabled: Boolean(user?.totpEnabled),
    recoveryCodesRemaining: user?.recoveryCodeHashes?.length ?? 0,
  });
});

/**
 * POST /api/auth/users/:username/totp/reset
 * Admin-only TOTP reset — clears per-user TOTP state so the user can re-enroll.
 */
authApiRouter.post('/users/:username/totp/reset', async (req: Request, res: Response): Promise<void> => {
  if (!req.auth || req.auth.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  const target = String(req.params.username ?? '');
  // Plan 20-02 / D-18: bump tokenVersion + totpChangedAt atomically with the
  // admin reset so outstanding refresh cookies for the target are invalidated.
  const nowIso = new Date().toISOString();
  try {
    await modifyUsers((users) => {
      const idx = users.findIndex((u) => u.username.toLowerCase() === target.toLowerCase());
      if (idx === -1) throw new Error('USER_NOT_FOUND');
      const u = users[idx];
      const { totpSecret: _s, totpEnabled: _e, recoveryCodeHashes: _c, ...rest } = u;
      users[idx] = {
        ...(rest as UserRecord),
        tokenVersion: (u.tokenVersion ?? 0) + 1,
        totpChangedAt: nowIso,
      };
      return users;
    });
  } catch (err) {
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    throw err;
  }
  res.json({ totpEnabled: false });
});
