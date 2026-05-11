/**
 * Plan 27-01 / Task 3 — SESS-04: signing-key rotation scaffolds.
 *
 * These tests are RED by design (Wave 0). Each `it` block calls `expect.fail`
 * with a SCAFFOLD marker. Plan 04 replaces each stub with a real implementation.
 *
 * Behaviors covered:
 *   1. POST /api/auth/rotate-key requires admin role (403 otherwise)
 *   2. Successful rotation returns { rotatedAt, prevKeyExpiresBy } for admin
 *   3. Refresh token signed by previous key still verifies during dual-key window
 *   4. Refresh token signed by previous key returns 401 once absolute cap elapses
 *   5. dual-key verify rejects tokens signed by neither current nor prev key
 *   6. rotate-key fails 4xx when data/jwt-secret-next.txt is missing
 *   7. /api/auth/rotate-key is NOT in PUBLIC_PATHS (unauthenticated call returns 401)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import express from 'express';
import { vi } from 'vitest';

const TEST_SECRET = 'test-secret-for-rotate-key-tests-32b';
const TEST_PASSWORD = 'changeme2025!';
const PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 4); // low cost — test-only

let _users: Array<Record<string, unknown>>;

function resetUsers(): void {
  _users = [
    {
      username: 'admin',
      passwordHash: PASSWORD_HASH,
      role: 'admin',
      centers: ['org-uka'],
      createdAt: '2025-01-01T00:00:00Z',
      tokenVersion: 0,
    },
    {
      username: 'researcher',
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

beforeEach(() => {
  resetUsers();
});

describe('SESS-04: signing-key rotation', () => {
  it('POST /api/auth/rotate-key requires admin role (403 otherwise)', async () => {
    // 1. Login as non-admin user (researcher) → access token
    // 2. POST /api/auth/rotate-key with that Bearer
    // 3. Expect 403 with body.error matching /admin/i
    expect.fail('SCAFFOLD: implement after Plan 04');
  });

  it('POST /api/auth/rotate-key returns { rotatedAt, prevKeyExpiresBy } for admin', async () => {
    // 1. Login as admin
    // 2. Precondition: data/jwt-secret-next.txt MUST exist (admin pre-stages the next key)
    // 3. POST /api/auth/rotate-key
    // 4. Expect 200, body.rotatedAt is ISO8601, body.prevKeyExpiresBy is ISO8601 ~12h in future
    expect.fail('SCAFFOLD: implement after Plan 04');
  });

  it('a refresh token signed by the previous key still verifies during the dual-key window', async () => {
    // 1. Login → cookie1 (signed by key K1)
    // 2. Rotate key: K1 → prev, K2 → current
    // 3. /refresh with cookie1 → 200 (verifyRefreshToken falls back to prev key)
    // 4. New cookie2 issued, signed by K2 (key_id in sessions row = id(K2))
    expect.fail('SCAFFOLD: implement after Plan 04');
  });

  it('a refresh token signed by the previous key returns 401 once absolute cap elapses', async () => {
    // 1. Insert a session row issued_at = now - 13h, key_id = id(K1)
    // 2. Sign matching JWT with K1
    // 3. /refresh → 401 (Session cap exceeded), NOT 500
    expect.fail('SCAFFOLD: implement after Plan 04');
  });

  it('dual-key verify rejects tokens signed by neither current nor prev key', async () => {
    // 1. Sign refresh JWT with an unrelated random secret
    // 2. /refresh → 401 (not 500)
    expect.fail('SCAFFOLD: implement after Plan 04');
  });

  it('POST /api/auth/rotate-key fails 400/409 if data/jwt-secret-next.txt is missing', async () => {
    // 1. Login as admin, ensure no jwt-secret-next.txt exists
    // 2. POST /api/auth/rotate-key
    // 3. Expect 4xx (not 500), error mentions next key file
    expect.fail('SCAFFOLD: implement after Plan 04');
  });

  it('/api/auth/rotate-key is NOT in PUBLIC_PATHS (unauthenticated call returns 401)', async () => {
    // POST /api/auth/rotate-key with no Authorization header → 401
    expect.fail('SCAFFOLD: implement after Plan 04');
  });
});
