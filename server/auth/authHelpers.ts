/**
 * Shared auth helpers extracted from authApi.ts (TECH-01 / F-09).
 *
 * Contains: VALID_ROLES, generateSecurePassword, currentKeyId, limiter singleton,
 * resetLimiter (exported for settingsApi), signSessionToken, touchLastLogin,
 * emitRefreshCookies, signChallengeToken.
 *
 * Import direction: authHelpers → settingsApi (getAuthSettings) is the existing,
 * allowed direction (AUTHCFG-04). Do NOT invert it.
 */

import crypto from 'node:crypto';

import type { Response } from 'express';

import type { UserRecord } from '../initAuth.js';
import { getAuthConfig, getJwtSecret, modifyUsers } from '../initAuth.js';
import {
  signAccessToken,
  signChallengeToken as signChallengeTokenUtil,
  signRefreshToken,
} from '../jwtUtil.js';
import { createRateLimiter } from '../rateLimiting.js';
import { insertSession, type SessionRow } from '../sessionsDb.js';
import { getAuthSettings } from '../settingsApi.js';

// ---------------------------------------------------------------------------
// Constants for user CRUD validation
// ---------------------------------------------------------------------------

export const VALID_ROLES = new Set(['admin', 'researcher', 'epidemiologist', 'clinician', 'data_manager', 'clinic_lead']);

/**
 * Generate a secure random password: 16 chars base64url = ~96 bits entropy.
 * Used for both user creation (D-01) and password reset.
 */
export function generateSecurePassword(length = 16): string {
  return crypto.randomBytes(Math.ceil(length * 0.75))
    .toString('base64url')
    .slice(0, length);
}

/** First 8 hex chars of SHA256(current signing key) — identifies which key was used to sign. */
export function currentKeyId(): string {
  return crypto.createHash('sha256').update(getJwtSecret()).digest('hex').slice(0, 8);
}

// ---------------------------------------------------------------------------
// Rate limiting state (in-memory, per username)
// ---------------------------------------------------------------------------

// Rate limiter -- lazy init because getAuthConfig() requires initAuth() to have run first.
// Single instance shared by /login and /verify handlers (addresses Codex review concern).
// resetLimiter() is exported so settingsApi can null the singleton after updateAuthConfig(),
// ensuring a live config change (e.g. lowered maxLoginAttempts) applies on the next request
// without a server restart (Blocker #1 / AUTHCFG-04).
let _limiter: ReturnType<typeof createRateLimiter> | null = null;
export function limiter() {
  if (!_limiter) {
    const cfg = getAuthConfig();
    _limiter = createRateLimiter(cfg.maxLoginAttempts, cfg.lockoutCapMs);
  }
  return _limiter;
}

/**
 * Null the lazy limiter singleton so the next request rebuilds it from the
 * current getAuthConfig() values. Call this immediately after updateAuthConfig()
 * in the settings PUT path so a live cap change takes effect on the next login.
 * Note: initAuth.ts MUST NOT import this — that would be a circular import.
 * The reset is driven from settingsApi, which already imports both modules.
 */
export function resetLimiter(): void {
  _limiter = null;
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

/** Sign a full session JWT (10 min expiry per D-05). */
export function signSessionToken(username: string, role: string, centers: string[]): string {
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
export function touchLastLogin(username: string): void {
  try {
    modifyUsers((users) =>
      users.map((u) => u.username === username ? { ...u, lastLogin: new Date().toISOString() } : u),
    ).catch(() => {});
  } catch { /* best-effort */ }
}

/**
 * Phase 20 / D-06, D-13, D-14 — emit the refresh + CSRF cookie pair on
 * successful login/verify/refresh. Cookies use SameSite=Strict; the refresh
 * cookie is httpOnly and scoped to /api/auth/refresh.
 *
 * Phase 27 / D-07: generates a per-token jti, inserts a sessions row BEFORE
 * signing the JWT (Pitfall 5 — row must exist before the cookie leaves the
 * server). Pass `existingSid` on rolling rotation to preserve the session
 * family for absolute-cap and revocation purposes.
 */
export function emitRefreshCookies(res: Response, user: UserRecord, existingSid?: string): void {
  const settings = getAuthSettings();
  const effectiveSid = existingSid ?? crypto.randomUUID();
  const jti = crypto.randomUUID();
  const nowIso = new Date().toISOString();
  const expiresAtIso = new Date(Date.now() + settings.refreshTokenTtlMs).toISOString();

  const row: SessionRow = {
    id: jti,
    sid: effectiveSid,
    username: user.username,
    ver: user.tokenVersion ?? 0,
    issued_at: nowIso,
    expires_at: expiresAtIso,
    last_used_at: nowIso,
    revoked: 0,
    key_id: currentKeyId(),
  };
  insertSession(row);

  const refreshJwt = signRefreshToken(
    { sub: user.username, ver: user.tokenVersion ?? 0, sid: effectiveSid, jti },
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
export function signChallengeToken(username: string): string {
  // Plan 20-02 / D-04 — route through jwtUtil. The typ:'challenge' claim added
  // by signChallengeTokenUtil makes verifyAccessToken / verifyRefreshToken
  // physically reject this token if a caller mis-routes it.
  return signChallengeTokenUtil({ sub: username, purpose: 'challenge' }, 2 * 60 * 1000);
}
