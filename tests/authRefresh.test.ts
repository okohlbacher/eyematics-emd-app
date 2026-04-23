/**
 * Plan 20-01 / Task 3 — POST /api/auth/refresh + POST /api/auth/logout coverage.
 *
 * Verifies the full cookie-and-CSRF dance:
 *   1. /login emits emd-refresh + emd-csrf cookies
 *   2. /refresh with both cookies + matching X-CSRF-Token returns 200 + new cookie
 *   3. CSRF missing/mismatched → 403
 *   4. tokenVersion mismatch → 401 'Token version stale'
 *   5. iat older than absolute cap → 401 'Session cap exceeded'
 *   6. Access-typed token in refresh cookie → 401 (typ cross-rejection from jwtUtil)
 *   7. /logout bumps tokenVersion + clears both cookies
 */

import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_SECRET = 'test-secret-for-refresh-tests-32b';
const TEST_PASSWORD = 'changeme2025!';
const PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 4); // low cost — test-only

// In-memory user fixture, mutable across tests via modifyUsers mock.
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
    refreshCookieSecure: false, // off so supertest doesn't drop cookies over plain http
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

interface CapturedCookies {
  refresh: string;
  csrf: string;
  rawSetCookie: string[];
}

/**
 * POST /login then parse Set-Cookie into emd-refresh + emd-csrf values.
 */
async function loginAndCapture(app: express.Express): Promise<{ token: string; cookies: CapturedCookies }> {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: TEST_PASSWORD });
  expect(res.status).toBe(200);
  const setCookies = (res.headers['set-cookie'] ?? []) as unknown as string[];
  const refresh = parseCookieValue(setCookies, 'emd-refresh');
  const csrf = parseCookieValue(setCookies, 'emd-csrf');
  expect(refresh).toBeTruthy();
  expect(csrf).toBeTruthy();
  return { token: res.body.token as string, cookies: { refresh, csrf, rawSetCookie: setCookies } };
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

describe('POST /api/auth/login — Phase 20 cookie emission', () => {
  it('sets emd-refresh (HttpOnly, SameSite=Strict, Path=/api/auth/refresh) AND emd-csrf', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    const setCookies = (res.headers['set-cookie'] ?? []) as unknown as string[];
    const refreshLine = setCookies.find((c) => c.startsWith('emd-refresh='))!;
    const csrfLine = setCookies.find((c) => c.startsWith('emd-csrf='))!;
    expect(refreshLine).toMatch(/HttpOnly/i);
    expect(refreshLine).toMatch(/SameSite=Strict/i);
    expect(refreshLine).toMatch(/Path=\/api\/auth\/refresh/);
    expect(csrfLine).not.toMatch(/HttpOnly/i);
    expect(csrfLine).toMatch(/SameSite=Strict/i);
  });
});

describe('POST /api/auth/refresh — happy path + CSRF + version + cap', () => {
  it('returns 200 + new access token + rotated refresh cookie when CSRF matches', async () => {
    const app = createApp();
    const { cookies } = await loginAndCapture(app);
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`emd-refresh=${cookies.refresh}`, `emd-csrf=${cookies.csrf}`].join('; '))
      .set('X-CSRF-Token', cookies.csrf);
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(typeof res.body.expiresAt).toBe('number');
    const setCookies = (res.headers['set-cookie'] ?? []) as unknown as string[];
    const newRefresh = parseCookieValue(setCookies, 'emd-refresh');
    expect(newRefresh).toBeTruthy();
    // Rotation: a fresh emd-refresh Set-Cookie was emitted on the response
    // (within-second iat collisions can produce identical JWT bytes — what we
    // care about is that the server SET a new cookie at all).
    const refreshLine = setCookies.find((c) => c.startsWith('emd-refresh='))!;
    expect(refreshLine).toMatch(/HttpOnly/i);
  });

  it('returns 403 when X-CSRF-Token header is missing', async () => {
    const app = createApp();
    const { cookies } = await loginAndCapture(app);
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`emd-refresh=${cookies.refresh}`, `emd-csrf=${cookies.csrf}`].join('; '));
    expect(res.status).toBe(403);
  });

  it('returns 403 when X-CSRF-Token does not match cookie value', async () => {
    const app = createApp();
    const { cookies } = await loginAndCapture(app);
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`emd-refresh=${cookies.refresh}`, `emd-csrf=${cookies.csrf}`].join('; '))
      .set('X-CSRF-Token', 'wrong-value');
    expect(res.status).toBe(403);
  });

  it('returns 401 "Token version stale" when user.tokenVersion is bumped after issue', async () => {
    const app = createApp();
    const { cookies } = await loginAndCapture(app);
    // Bump tokenVersion in fixture so payload.ver (0) no longer matches
    _users[0].tokenVersion = 99;
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`emd-refresh=${cookies.refresh}`, `emd-csrf=${cookies.csrf}`].join('; '))
      .set('X-CSRF-Token', cookies.csrf);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Token version stale/);
  });

  it('returns 401 "Session cap exceeded" when refresh iat is older than absolute cap', async () => {
    const app = createApp();
    // Hand-construct a JWT with iat ~13h ago (cap is 12h) but exp far in the
    // future, so jwt.verify accepts it and our absolute-cap check is what
    // rejects it. jsonwebtoken sign() rewrites/strips iat too aggressively for
    // back-dating, so build the segments by hand and HMAC-SHA256 sign them.
    const oldIat = Math.floor(Date.now() / 1000) - 13 * 3600;
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({
      sub: 'admin', ver: 0, sid: 'fixed-sid', typ: 'refresh', iat: oldIat, exp: futureExp,
    })).toString('base64url');
    const sig = crypto
      .createHmac('sha256', TEST_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    const oldRefresh = `${header}.${body}.${sig}`;
    // Sanity: decoded payload must still carry our backdated iat
    const decoded = jwt.decode(oldRefresh) as { iat?: number };
    expect(decoded.iat).toBe(oldIat);
    const csrf = 'test-csrf-value';
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`emd-refresh=${oldRefresh}`, `emd-csrf=${csrf}`].join('; '))
      .set('X-CSRF-Token', csrf);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Session cap exceeded/);
  });

  it('returns 401 when refresh cookie holds a typ:"access" token (typ cross-rejection)', async () => {
    const app = createApp();
    // A valid-looking access token in the refresh cookie slot
    const accessShaped = jwt.sign(
      { sub: 'admin', preferred_username: 'admin', role: 'admin', centers: [], typ: 'access' },
      TEST_SECRET,
      { algorithm: 'HS256', expiresIn: 600 },
    );
    const csrf = 'test-csrf-value';
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`emd-refresh=${accessShaped}`, `emd-csrf=${csrf}`].join('; '))
      .set('X-CSRF-Token', csrf);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid refresh token/);
  });
});

describe('POST /api/auth/logout — clears cookies + bumps tokenVersion', () => {
  it('returns 200, clears both cookies, increments user.tokenVersion', async () => {
    const app = createApp();
    const { token, cookies } = await loginAndCapture(app);
    expect(_users[0].tokenVersion).toBe(0);

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', [`emd-refresh=${cookies.refresh}`, `emd-csrf=${cookies.csrf}`].join('; '))
      .set('X-CSRF-Token', cookies.csrf);
    expect(res.status).toBe(200);
    expect(_users[0].tokenVersion).toBe(1);

    const setCookies = (res.headers['set-cookie'] ?? []) as unknown as string[];
    const refreshClear = setCookies.find((c) => c.startsWith('emd-refresh='))!;
    const csrfClear = setCookies.find((c) => c.startsWith('emd-csrf='))!;
    // express cookie() with maxAge:0 emits Max-Age=0 OR Expires in past
    expect(refreshClear).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
    expect(csrfClear).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });
});
