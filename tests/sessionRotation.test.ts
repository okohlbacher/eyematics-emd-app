/**
 * Plan 27-01 / Task 2 — SESS-03: refresh token rotation with jti (scaffolds).
 *
 * These tests are RED by design (Wave 0). Each `it` block calls `expect.fail`
 * with a SCAFFOLD marker. Plan 03 replaces each stub with a real implementation.
 *
 * Behaviors covered:
 *   1. Rolling rotation: old jti → revoked, new row inserted
 *   2. Reuse detection: replaying a revoked jti returns 401 token_reused
 *   3. Family revocation: replay of revoked jti revokes every sibling sid row
 *   4. Unknown jti (pre-upgrade cookie without jti): 401 token_reused (D-18)
 *   5. Absolute cap uses sessions.issued_at (not payload.iat)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import express from 'express';
import { vi } from 'vitest';

const TEST_SECRET = 'test-secret-for-rotation-tests-32b';
const TEST_PASSWORD = 'changeme2025!';
const PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 4); // low cost — test-only

let _users: Array<Record<string, unknown>>;

function resetUsers(): void {
  _users = [
    {
      username: 'alice',
      passwordHash: PASSWORD_HASH,
      role: 'researcher',
      centers: ['org-uka'],
      createdAt: '2025-01-01T00:00:00Z',
      tokenVersion: 0,
    },
  ];
}
resetUsers();

vi.mock('../server/initAuth.js', () => ({
  getJwtSecret: () => TEST_SECRET,
  getAuthConfig: () => ({ twoFactorEnabled: false, maxLoginAttempts: 5, otpCode: '123456' }),
  loadUsers: () => _users,
  modifyUsers: async (fn: (users: unknown[]) => unknown[]) => {
    _users = fn(_users) as Array<Record<string, unknown>>;
    return _users;
  },
}));

vi.mock('../server/keycloakAuth.js', () => ({
  getAuthProvider: () => 'local',
  getJwksClient: () => null,
}));

vi.mock('../server/settingsApi.js', () => ({
  getAuthSettings: () => ({
    refreshTokenTtlMs: 28_800_000,
    refreshAbsoluteCapMs: 43_200_000,
    refreshCookieSecure: false,
  }),
}));

import { authApiRouter } from '../server/authApi';
import { authMiddleware } from '../server/authMiddleware';

function createApp() {
  const app = express();
  app.use(cookieParser());
  app.use('/api/auth', express.json());
  app.use('/api', authMiddleware);
  app.use('/api/auth', authApiRouter);
  return app;
}

function parseCookieValue(setCookies: string[], name: string): string {
  const line = setCookies.find((c) => c.startsWith(`${name}=`));
  if (!line) return '';
  const eq = line.indexOf('=');
  const semi = line.indexOf(';');
  return decodeURIComponent(line.slice(eq + 1, semi === -1 ? line.length : semi));
}

beforeEach(() => {
  resetUsers();
});

describe('SESS-03: refresh token rotation with jti', () => {
  it('rolling rotation: first refresh marks old jti revoked and inserts a new row', async () => {
    // 1. Login as alice → capture refresh cookie (contains jti-A)
    // 2. Call /api/auth/refresh with that cookie
    // 3. Expect 200, new Set-Cookie with a different refresh JWT
    // 4. Decode new JWT → jti-B != jti-A
    // 5. Query sessionsDb (via direct module import) → row(jti-A).revoked === 1, row(jti-B).revoked === 0
    expect.fail('SCAFFOLD: implement once Plan 03 wires jti into /refresh');
  });

  it('reuse detection: replaying a revoked jti returns 401 token_reused', async () => {
    // 1. Login → cookie1 with jti-A
    // 2. /refresh with cookie1 → cookie2 with jti-B (jti-A now revoked=1)
    // 3. /refresh AGAIN with cookie1 (the now-revoked jti-A)
    // 4. Expect res.status === 401 and res.body.error === 'Refresh token reuse detected'
    expect.fail('SCAFFOLD: implement once Plan 03 wires jti lookup into /refresh');
  });

  it('family revocation: replay of revoked jti revokes every sibling row sharing the sid', async () => {
    // 1. Login → cookie1 (jti-A, sid-S)
    // 2. /refresh cookie1 → cookie2 (jti-B, sid-S) — jti-A revoked
    // 3. /refresh cookie2 → cookie3 (jti-C, sid-S) — jti-B revoked
    // 4. Replay cookie1 (jti-A) → 401
    // 5. Query sessionsDb: rows for jti-A, jti-B, jti-C ALL have revoked === 1
    expect.fail('SCAFFOLD: implement after Plan 03 + Plan 02');
  });

  it('unknown jti (e.g. pre-upgrade cookie without jti): 401 token_reused (D-18)', async () => {
    // 1. Manually sign a refresh JWT WITHOUT a jti claim (or with a random jti not in sessions.db)
    // 2. Send to /refresh
    // 3. Expect 401 token_reused
    expect.fail('SCAFFOLD: implement after Plan 03');
  });

  it('absolute cap uses sessions.issued_at (not payload.iat)', async () => {
    // 1. Insert a session row manually with issued_at = now - 13h (past 12h cap)
    // 2. Sign a matching JWT with iat = now (NOT expired by payload clock)
    // 3. /refresh → 401 (Session cap exceeded)
    expect.fail('SCAFFOLD: implement after Plan 03');
  });
});
