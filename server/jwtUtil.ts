/**
 * Centralized JWT sign/verify with HS256 hard-pin and `typ` claim enforcement.
 *
 * NOTE (Plan 20-01): This module SHOULD be the sole importer of `jsonwebtoken`
 * in the server tree. Plan 20-02 lands an ESLint `no-restricted-imports` rule
 * that enforces this; existing call sites in server/authApi.ts and
 * server/authMiddleware.ts will migrate at that time.
 *
 * Design notes:
 * - `ALGS` is a top-level constant so the algorithm pin is a single source of
 *   truth and easy to audit by grep.
 * - `signXxxToken(p, ttlMs)` accepts TTL as MILLISECONDS for caller convenience
 *   (consistent with settings.yaml `auth.refreshTokenTtlMs`). We convert to
 *   seconds via `Math.floor(ttlMs / 1000)` because `jsonwebtoken`'s
 *   `expiresIn: <number>` argument is interpreted as SECONDS — passing ms here
 *   would silently issue tokens with absurd lifetimes (Pitfall 7).
 * - Cross-rejection: `verifyAccessToken` throws if `typ === 'refresh'` and
 *   vice versa, preventing an attacker who steals a refresh cookie from
 *   replaying it as an access Bearer.
 */

import jwt from 'jsonwebtoken';

import { getJwtSecret } from './initAuth.js';

// Single source of truth for accepted algorithms — DO NOT inline `'HS256'` in
// jwt.verify call sites within this file; always reference ALGS so the pin is
// trivially auditable by `grep -nE "algorithms: ALGS"`.
const ALGS: jwt.Algorithm[] = ['HS256'];

export interface AccessPayload {
  sub: string;
  preferred_username: string;
  role: string;
  centers: string[];
  typ: 'access';
  iat: number;
  exp: number;
}

export interface RefreshPayload {
  sub: string;
  ver: number;
  sid: string;
  typ: 'refresh';
  iat: number;
  exp: number;
}

/**
 * Sign an access JWT.
 * @param p Access claims (excluding typ/iat/exp — populated automatically).
 * @param ttlMs Time-to-live in MILLISECONDS. Internally divided by 1000 because
 *   `jsonwebtoken` interprets numeric `expiresIn` as seconds (Pitfall 7).
 */
export function signAccessToken(
  p: Omit<AccessPayload, 'typ' | 'iat' | 'exp'>,
  ttlMs: number,
): string {
  return jwt.sign(
    { ...p, typ: 'access' as const },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: Math.floor(ttlMs / 1000) },
  );
}

/**
 * Sign a refresh JWT.
 * @param p Refresh claims (excluding typ/iat/exp — populated automatically).
 * @param ttlMs Time-to-live in MILLISECONDS (see signAccessToken note).
 */
export function signRefreshToken(
  p: Omit<RefreshPayload, 'typ' | 'iat' | 'exp'>,
  ttlMs: number,
): string {
  return jwt.sign(
    { ...p, typ: 'refresh' as const },
    getJwtSecret(),
    { algorithm: 'HS256', expiresIn: Math.floor(ttlMs / 1000) },
  );
}

/**
 * Verify an access JWT. Throws on bad signature, wrong algorithm, or wrong typ.
 * Use `try { verifyAccessToken(t) } catch { ... }` at call sites.
 */
export function verifyAccessToken(token: string): AccessPayload {
  const payload = jwt.verify(token, getJwtSecret(), { algorithms: ALGS }) as AccessPayload;
  if (payload.typ !== 'access') {
    throw new Error('wrong_token_type');
  }
  return payload;
}

/**
 * Verify a refresh JWT. Throws on bad signature, wrong algorithm, or wrong typ.
 */
export function verifyRefreshToken(token: string): RefreshPayload {
  const payload = jwt.verify(token, getJwtSecret(), { algorithms: ALGS }) as RefreshPayload;
  if (payload.typ !== 'refresh') {
    throw new Error('wrong_token_type');
  }
  return payload;
}
