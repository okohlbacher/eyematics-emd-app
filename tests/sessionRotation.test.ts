/**
 * SESS-03: refresh token rotation with jti — Phase 27 Plan 03.
 *
 * Behaviors tested:
 *   1. Rolling rotation: old jti → revoked, new row inserted
 *   2. Reuse detection: replaying a revoked jti returns 401 "Refresh token reuse detected"
 *   3. Family revocation: replay of revoked jti revokes every sibling sid row
 *   4. Unknown jti (pre-upgrade cookie without jti): 401 "Refresh token reuse detected" (D-18)
 *   5. Absolute cap uses sessions.issued_at (not payload.iat)
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
import { signRefreshToken } from '../server/jwtUtil';
import { _closeForTests, getSession, initSessionsDb, insertSession } from '../server/sessionsDb';

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

function decodeJwt(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
}

let tmpDir: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emd-rotation-test-'));
  initSessionsDb(tmpDir);
});

afterAll(() => {
  _closeForTests();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

beforeEach(() => {
  resetUsers();
});

async function loginAlice(app: express.Express) {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'alice', password: TEST_PASSWORD });
  expect(res.status).toBe(200);
  const setCookies = (res.headers['set-cookie'] ?? []) as unknown as string[];
  const refresh = parseCookieValue(setCookies, 'emd-refresh');
  const csrf = parseCookieValue(setCookies, 'emd-csrf');
  expect(refresh).toBeTruthy();
  expect(csrf).toBeTruthy();
  return { refresh, csrf };
}

async function doRefresh(app: express.Express, refresh: string, csrf: string) {
  return request(app)
    .post('/api/auth/refresh')
    .set('Cookie', [`emd-refresh=${refresh}`, `emd-csrf=${csrf}`].join('; '))
    .set('X-CSRF-Token', csrf);
}

describe('SESS-03: refresh token rotation with jti', () => {
  it('rolling rotation: first refresh marks old jti revoked and inserts a new row', async () => {
    const app = createApp();
    const { refresh: cookie1, csrf: csrf1 } = await loginAlice(app);
    const jtiA = (decodeJwt(cookie1) as { jti: string }).jti;
    expect(jtiA).toBeTruthy();

    const rotateRes = await doRefresh(app, cookie1, csrf1);
    expect(rotateRes.status).toBe(200);
    const setCookies = (rotateRes.headers['set-cookie'] ?? []) as unknown as string[];
    const cookie2 = parseCookieValue(setCookies, 'emd-refresh');
    const csrf2 = parseCookieValue(setCookies, 'emd-csrf');
    const jtiB = (decodeJwt(cookie2) as { jti: string }).jti;

    expect(jtiB).toBeTruthy();
    expect(jtiB).not.toBe(jtiA);

    // Old row is revoked; new row is active
    expect(getSession(jtiA)!.revoked).toBe(1);
    expect(getSession(jtiB)!.revoked).toBe(0);

    // Session family is preserved
    expect(getSession(jtiB)!.sid).toBe(getSession(jtiA)!.sid);

    // Second rotation still works
    const rotateRes2 = await doRefresh(app, cookie2, csrf2);
    expect(rotateRes2.status).toBe(200);
  });

  it('reuse detection: replaying a revoked jti returns 401 token_reused', async () => {
    const app = createApp();
    const { refresh: cookie1, csrf: csrf1 } = await loginAlice(app);

    // First /refresh consumes cookie1 (jti-A)
    const rotateRes = await doRefresh(app, cookie1, csrf1);
    expect(rotateRes.status).toBe(200);
    const setCookies = (rotateRes.headers['set-cookie'] ?? []) as unknown as string[];
    const csrf2 = parseCookieValue(setCookies, 'emd-csrf');

    // Replay cookie1 (now revoked) — must fail
    const replayRes = await doRefresh(app, cookie1, csrf2);
    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error).toBe('Refresh token reuse detected');
  });

  it('family revocation: replay of revoked jti revokes every sibling row sharing the sid', async () => {
    const app = createApp();
    const { refresh: cookie1, csrf: csrf1 } = await loginAlice(app);
    const jtiA = (decodeJwt(cookie1) as { jti: string }).jti;

    const res2 = await doRefresh(app, cookie1, csrf1);
    expect(res2.status).toBe(200);
    const sc2 = (res2.headers['set-cookie'] ?? []) as unknown as string[];
    const cookie2 = parseCookieValue(sc2, 'emd-refresh');
    const csrf2 = parseCookieValue(sc2, 'emd-csrf');
    const jtiB = (decodeJwt(cookie2) as { jti: string }).jti;

    const res3 = await doRefresh(app, cookie2, csrf2);
    expect(res3.status).toBe(200);
    const sc3 = (res3.headers['set-cookie'] ?? []) as unknown as string[];
    const cookie3 = parseCookieValue(sc3, 'emd-refresh');
    const csrf3 = parseCookieValue(sc3, 'emd-csrf');
    const jtiC = (decodeJwt(cookie3) as { jti: string }).jti;

    // Replay the original cookie1 (jti-A, already revoked) → triggers family revocation
    const replayRes = await doRefresh(app, cookie1, csrf3);
    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error).toBe('Refresh token reuse detected');

    // All three rows must now be revoked
    expect(getSession(jtiA)!.revoked).toBe(1);
    expect(getSession(jtiB)!.revoked).toBe(1);
    expect(getSession(jtiC)!.revoked).toBe(1);
  });

  it('unknown jti (e.g. pre-upgrade cookie without jti): 401 token_reused (D-18)', async () => {
    const app = createApp();
    // Hand-craft a refresh JWT without jti (simulates pre-Phase-27 token).
    // verifyRefreshToken returns jti:'' sentinel → getSession('') → null → 401.
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({
      sub: 'alice', ver: 0, sid: crypto.randomUUID(), typ: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      // intentionally no jti field
    })).toString('base64url');
    const sig = crypto.createHmac('sha256', TEST_SECRET).update(`${header}.${body}`).digest('base64url');
    const preUpgradeCookie = `${header}.${body}.${sig}`;
    const csrf = 'test-csrf-no-jti';
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`emd-refresh=${preUpgradeCookie}`, `emd-csrf=${csrf}`].join('; '))
      .set('X-CSRF-Token', csrf);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Refresh token reuse detected');
  });

  it('absolute cap uses sessions.issued_at (not payload.iat)', async () => {
    const app = createApp();
    // Insert a session row with issued_at = 13h ago (past 12h cap),
    // then sign a JWT with iat = now. The JWT is NOT expired, but the DB
    // row's issued_at triggers the absolute cap — proving it's server-authoritative.
    const oldJti = crypto.randomUUID();
    const testSid = crypto.randomUUID();
    insertSession({
      id: oldJti,
      sid: testSid,
      username: 'alice',
      ver: 0,
      issued_at: new Date(Date.now() - 13 * 3600 * 1000).toISOString(),
      expires_at: new Date(Date.now() + 28_800_000).toISOString(),
      last_used_at: new Date().toISOString(),
      revoked: 0,
      key_id: 'test-key',
    });
    const refreshJwt = signRefreshToken({ sub: 'alice', ver: 0, sid: testSid, jti: oldJti }, 28_800_000);
    const csrf = 'test-csrf-cap';
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`emd-refresh=${refreshJwt}`, `emd-csrf=${csrf}`].join('; '))
      .set('X-CSRF-Token', csrf);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Session cap exceeded/);
  });
});
