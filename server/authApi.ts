/**
 * Auth API router: POST /login, POST /verify, GET /config
 *
 * Implements two-step login with optional 2FA.
 * Rate limiting: per-username in-memory Map with exponential backoff.
 * OTP: fixed configurable code from settings.yaml — no otplib.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getJwtSecret, getAuthConfig, loadUsers } from './initAuth.js';
import type { AuthPayload } from './authMiddleware.js';
import { createRateLimiter } from './rateLimiting.js';

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
authApiRouter.post('/login', (req: Request, res: Response): void => {
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
  const valid = bcrypt.compareSync(password, user.passwordHash);
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
    // Return full session JWT directly
    const token = signSessionToken(user.username, user.role, user.centers);
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
  res.json({ twoFactorEnabled });
});

/**
 * GET /api/auth/users
 *
 * Returns user list (without password hashes). Requires authentication.
 */
authApiRouter.get('/users', (req: Request, res: Response): void => {
  if (!req.auth) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const users = loadUsers().map(({ username, firstName, lastName, role, centers, createdAt, lastLogin }) => ({
    username, firstName, lastName, role, centers, createdAt, lastLogin,
  }));
  res.json({ users });
});
