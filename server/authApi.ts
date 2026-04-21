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
import jwt from 'jsonwebtoken';

import type { AuthPayload } from './authMiddleware.js';
import { getValidCenterIds } from './constants.js';
import type { UserRecord } from './initAuth.js';
import { getAuthConfig, getJwtSecret, loadUsers, modifyUsers } from './initAuth.js';
import { getAuthProvider } from './keycloakAuth.js';
import { createRateLimiter } from './rateLimiting.js';

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
  const payload: Omit<AuthPayload, 'iat' | 'exp'> = {
    sub: username,
    preferred_username: username,
    role,
    centers,
  };
  return jwt.sign(payload, getJwtSecret(), { algorithm: 'HS256', expiresIn: '10m' });
}

/** Sign a challenge token for 2FA step 2 (2 min expiry, purpose='challenge'). */
function signChallengeToken(username: string): string {
  return jwt.sign(
    { sub: username, purpose: 'challenge' },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: '2m' },
  );
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

  if (twoFactorEnabled) {
    // Return short-lived challenge token for OTP step
    const challengeToken = signChallengeToken(user.username);
    res.json({ challengeToken });
  } else {
    // Return full session JWT directly — update lastLogin (H-12)
    const token = signSessionToken(user.username, user.role, user.centers);
    try {
      modifyUsers((users) =>
        users.map((u) => u.username === user.username ? { ...u, lastLogin: new Date().toISOString() } : u),
      ).catch(() => {});
    } catch { /* best-effort — don't fail login if write fails */ }
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
authApiRouter.post('/verify', (req: Request, res: Response): void => {
  const { challengeToken, otp } = req.body as { challengeToken?: string; otp?: string };

  if (typeof challengeToken !== 'string' || typeof otp !== 'string' || !challengeToken || !otp) {
    res.status(400).json({ error: 'challengeToken and otp are required' });
    return;
  }

  // Verify challenge token
  let sub: string;
  try {
    const payload = jwt.verify(challengeToken, getJwtSecret()) as { sub: string; purpose?: string };
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

  const { otpCode } = getAuthConfig();

  if (otp !== otpCode) {
    const newState = limiter().recordFailure(key);
    if (limiter().isLocked(newState)) {
      const retryAfterMs = newState.lockedUntil - Date.now();
      res.status(429).json({ error: 'Account locked', retryAfterMs });
      return;
    }
    res.status(401).json({ error: 'Invalid OTP' });
    return;
  }

  // OTP valid — load user and issue full session JWT
  limiter().resetAttempts(key);

  const users = loadUsers();
  const user = users.find((u) => u.username.toLowerCase() === key);

  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  const token = signSessionToken(user.username, user.role, user.centers);
  // Update lastLogin (H-12)
  try {
    modifyUsers((u) =>
      u.map((r) => r.username === user.username ? { ...r, lastLogin: new Date().toISOString() } : r),
    ).catch(() => {});
  } catch { /* best-effort */ }
  res.json({ token });
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
  try {
    await modifyUsers((users) => {
      const user = users.find((u) => u.username.toLowerCase() === target.toLowerCase());
      if (!user) throw new Error('USER_NOT_FOUND');
      user.passwordHash = newHash;
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
