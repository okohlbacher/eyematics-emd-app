/**
 * Plan 27-04 — SESS-04: signing-key rotation.
 *
 * Behaviors covered:
 *   1. POST /api/auth/rotate-key requires admin role (403 otherwise)
 *   2. Successful rotation returns { rotatedAt, prevKeyExpiresBy } for admin
 *   3. Refresh token signed by previous key still verifies during dual-key window
 *   4. Refresh token signed by previous key returns 401 once absolute cap elapses
 *   5. dual-key verify rejects tokens signed by neither current nor prev key
 *   6. rotate-key fails 400 when data/jwt-secret-next.txt is missing
 *   7. /api/auth/rotate-key is NOT in PUBLIC_PATHS (unauthenticated call returns 401)
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_SECRET = 'test-secret-for-rotate-key-tests-32b';
const NEXT_SECRET = 'next-secret-for-rotate-key-tests-32b';
const TEST_PASSWORD = 'changeme2025!';
const PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 4); // low cost — test-only

// Per-test mutable state closed over by the vi.mock factory
let _currentSecret = TEST_SECRET;
let _prevSecret: string | undefined;
let _simulateMissingNextKey = false;

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
  getJwtSecret: () => _currentSecret,
  getJwtSecrets: () => ({ current: _currentSecret, prev: _prevSecret }),
  computeKeyId: (s: string) => s.slice(0, 8),
  rotateSigningKey: () => {
    if (_simulateMissingNextKey) {
      const err = new Error('jwt-secret-next.txt not found');
      (err as Error & { code: string }).code = 'NEXT_KEY_MISSING';
      throw err;
    }
    _prevSecret = _currentSecret;
    _currentSecret = NEXT_SECRET;
    const rotatedAt = new Date().toISOString();
    const prevKeyExpiresBy = new Date(Date.now() + 43_200_000).toISOString();
    return { rotatedAt, prevKeyExpiresBy };
  },
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
import { signRefreshToken } from '../server/jwtUtil';
import { _closeForTests, initSessionsDb, insertSession } from '../server/sessionsDb';

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

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emd-rotate-key-test-'));
  initSessionsDb(tmpDir);
});

afterAll(() => {
  _closeForTests();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  resetUsers();
  _currentSecret = TEST_SECRET;
  _prevSecret = undefined;
  _simulateMissingNextKey = false;
});

async function loginAs(app: express.Express, username: string) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password: TEST_PASSWORD });
  expect(res.status).toBe(200);
  const token = res.body.token as string;
  const setCookies = (res.headers['set-cookie'] ?? []) as unknown as string[];
  const refresh = parseCookieValue(setCookies, 'emd-refresh');
  const csrf = parseCookieValue(setCookies, 'emd-csrf');
  return { token, refresh, csrf };
}

describe('SESS-04: signing-key rotation', () => {
  it('POST /api/auth/rotate-key requires admin role (403 otherwise)', async () => {
    const app = createApp();
    const { token } = await loginAs(app, 'researcher');
    const res = await request(app)
      .post('/api/auth/rotate-key')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin/i);
  });

  it('POST /api/auth/rotate-key returns { rotatedAt, prevKeyExpiresBy } for admin', async () => {
    const app = createApp();
    const { token } = await loginAs(app, 'admin');
    const res = await request(app)
      .post('/api/auth/rotate-key')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.rotatedAt).toBe('string');
    expect(typeof res.body.prevKeyExpiresBy).toBe('string');
    // prevKeyExpiresBy should be ~12h in the future
    const expiresBy = new Date(res.body.prevKeyExpiresBy as string).getTime();
    expect(expiresBy).toBeGreaterThan(Date.now() + 11 * 3600 * 1000);
  });

  it('a refresh token signed by the previous key still verifies during the dual-key window', async () => {
    const app = createApp();
    // Login while TEST_SECRET is current → gets cookie signed with TEST_SECRET
    const { refresh: cookie1, csrf: csrf1 } = await loginAs(app, 'admin');

    // Simulate key rotation: TEST_SECRET → prev, NEXT_SECRET → current
    _prevSecret = TEST_SECRET;
    _currentSecret = NEXT_SECRET;

    // /refresh should succeed: verifyRefreshToken falls back to prev key
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`emd-refresh=${cookie1}`, `emd-csrf=${csrf1}`].join('; '))
      .set('X-CSRF-Token', csrf1);
    expect(res.status).toBe(200);
  });

  it('a refresh token signed by the previous key returns 401 once absolute cap elapses', async () => {
    const app = createApp();
    // Insert session with issued_at = 13h ago (past 12h cap), signed with TEST_SECRET
    const oldJti = crypto.randomUUID();
    const testSid = crypto.randomUUID();
    insertSession({
      id: oldJti,
      sid: testSid,
      username: 'admin',
      ver: 0,
      issued_at: new Date(Date.now() - 13 * 3600 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 28_800_000).toISOString(),
      last_used_at: new Date().toISOString(),
      revoked: 0,
      key_id: 'testkey-1',
    });
    // _currentSecret is still TEST_SECRET here, so signRefreshToken uses it
    const refreshJwt = signRefreshToken({ sub: 'admin', ver: 0, sid: testSid, jti: oldJti }, 28_800_000);

    // Simulate rotation: TEST_SECRET is now prev key
    _prevSecret = TEST_SECRET;
    _currentSecret = NEXT_SECRET;

    const csrf = 'test-csrf-prev-cap';
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`emd-refresh=${refreshJwt}`, `emd-csrf=${csrf}`].join('; '))
      .set('X-CSRF-Token', csrf);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Session cap exceeded/);
  });

  it('dual-key verify rejects tokens signed by neither current nor prev key', async () => {
    const app = createApp();
    // Build a structurally valid JWT signed with a completely unrelated secret
    const unknownSecret = 'completely-unrelated-32-byte-sec!';
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({
      sub: 'admin', ver: 0, sid: crypto.randomUUID(), jti: crypto.randomUUID(),
      typ: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })).toString('base64url');
    const sig = crypto.createHmac('sha256', unknownSecret)
      .update(`${header}.${body}`)
      .digest('base64url');
    const badJwt = `${header}.${body}.${sig}`;

    const csrf = 'test-csrf-unknown-key';
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`emd-refresh=${badJwt}`, `emd-csrf=${csrf}`].join('; '))
      .set('X-CSRF-Token', csrf);
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/rotate-key fails 400 if data/jwt-secret-next.txt is missing', async () => {
    const app = createApp();
    const { token } = await loginAs(app, 'admin');
    _simulateMissingNextKey = true;
    const res = await request(app)
      .post('/api/auth/rotate-key')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/next key/i);
  });

  it('/api/auth/rotate-key is NOT in PUBLIC_PATHS (unauthenticated call returns 401)', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/rotate-key');
    expect(res.status).toBe(401);
  });
});
