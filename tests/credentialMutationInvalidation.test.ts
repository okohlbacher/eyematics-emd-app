/**
 * Plan 20-02 / Task 2 — credential-mutation refresh-token invalidation (D-18).
 *
 * Each of the four credential-mutation endpoints (admin password reset,
 * admin TOTP reset, self password change, self TOTP confirm/disable) MUST
 * bump `user.tokenVersion` and the matching `*ChangedAt` timestamp atomically
 * with the credential write. After the bump, an outstanding refresh cookie
 * issued before the mutation must fail /api/auth/refresh with 401
 * 'Token version stale'.
 *
 * Test 6 is a regression guard: read-only endpoints must NOT bump tokenVersion.
 */

import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import express from 'express';
import { authenticator } from 'otplib';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_SECRET = 'test-secret-for-cred-mutation-invalidation-32b';
const TEST_PASSWORD = 'changeme2025!';
const PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 4);
const ADMIN_PASSWORD = 'adminpw2025!';
const ADMIN_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 4);

interface FixtureUser {
  username: string;
  passwordHash?: string;
  role: string;
  centers: string[];
  createdAt: string;
  tokenVersion?: number;
  passwordChangedAt?: string;
  totpChangedAt?: string;
  totpSecret?: string;
  totpEnabled?: boolean;
  recoveryCodeHashes?: string[];
}

let _users: FixtureUser[];

function resetUsers(): void {
  _users = [
    {
      username: 'admin',
      passwordHash: ADMIN_HASH,
      role: 'admin',
      centers: ['org-uka'],
      createdAt: '2025-01-01T00:00:00Z',
      tokenVersion: 0,
      passwordChangedAt: '2025-01-01T00:00:00Z',
      totpChangedAt: '2025-01-01T00:00:00Z',
    },
    {
      username: 'targetuser',
      passwordHash: PASSWORD_HASH,
      role: 'researcher',
      centers: ['org-uka'],
      createdAt: '2025-01-01T00:00:00Z',
      tokenVersion: 0,
      passwordChangedAt: '2025-01-01T00:00:00Z',
      totpChangedAt: '2025-01-01T00:00:00Z',
    },
  ];
}
resetUsers();

vi.mock('../server/initAuth.js', () => ({
  getJwtSecret: () => TEST_SECRET,
  getAuthConfig: () => ({ twoFactorEnabled: false, maxLoginAttempts: 5, otpCode: '123456' }),
  loadUsers: () => _users,
  modifyUsers: async (fn: (users: FixtureUser[]) => FixtureUser[]) => {
    _users = fn(_users);
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

const { authApiRouter } = await import('../server/authApi.js');
const { authMiddleware } = await import('../server/authMiddleware.js');

function createApp(): express.Express {
  const app = express();
  app.use(cookieParser());
  app.use('/api/auth', express.json());
  app.use('/api', authMiddleware);
  app.use('/api/auth', authApiRouter);
  return app;
}

interface Captured {
  token: string;
  refresh: string;
  csrf: string;
}

function parseCookie(setCookies: string[], name: string): string {
  const line = setCookies.find((c) => c.startsWith(`${name}=`));
  if (!line) return '';
  const eq = line.indexOf('=');
  const semi = line.indexOf(';');
  return decodeURIComponent(line.slice(eq + 1, semi === -1 ? line.length : semi));
}

async function loginAndCapture(app: express.Express, username: string, password: string): Promise<Captured> {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  expect(res.status).toBe(200);
  const setCookies = (res.headers['set-cookie'] ?? []) as unknown as string[];
  return {
    token: res.body.token as string,
    refresh: parseCookie(setCookies, 'emd-refresh'),
    csrf: parseCookie(setCookies, 'emd-csrf'),
  };
}

async function attemptRefresh(app: express.Express, c: Captured): Promise<request.Response> {
  return request(app)
    .post('/api/auth/refresh')
    .set('Cookie', [`emd-refresh=${c.refresh}`, `emd-csrf=${c.csrf}`].join('; '))
    .set('X-CSRF-Token', c.csrf);
}

beforeEach(() => {
  resetUsers();
});

describe('Plan 20-02 D-18 — credential-mutation invalidation', () => {
  it('admin password reset bumps tokenVersion + passwordChangedAt; old refresh → 401', async () => {
    const app = createApp();
    const target = await loginAndCapture(app, 'targetuser', TEST_PASSWORD);
    const admin = await loginAndCapture(app, 'admin', ADMIN_PASSWORD);
    const beforeChangedAt = _users[1].passwordChangedAt;

    const res = await request(app)
      .put('/api/auth/users/targetuser/password')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);

    const tu = _users.find((u) => u.username === 'targetuser')!;
    expect(tu.tokenVersion).toBe(1);
    expect(typeof tu.passwordChangedAt).toBe('string');
    expect(tu.passwordChangedAt).not.toBe(beforeChangedAt);

    const refreshRes = await attemptRefresh(app, target);
    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.error).toMatch(/Token version stale/);
  });

  it('admin TOTP reset bumps tokenVersion + totpChangedAt; old refresh → 401', async () => {
    const app = createApp();
    // Pre-enroll target so reset has something to clear
    _users[1].totpSecret = 'JBSWY3DPEHPK3PXP';
    _users[1].totpEnabled = true;
    _users[1].recoveryCodeHashes = [];

    // Note: with totpEnabled the /login path returns a challenge token rather
    // than a refresh cookie. To capture a refresh cookie for the invalidation
    // assertion we briefly toggle totpEnabled off, log in, then restore.
    _users[1].totpEnabled = false;
    const target2 = await loginAndCapture(app, 'targetuser', TEST_PASSWORD);
    _users[1].totpEnabled = true;
    const beforeChangedAt = _users[1].totpChangedAt;

    const admin = await loginAndCapture(app, 'admin', ADMIN_PASSWORD);
    const res = await request(app)
      .post('/api/auth/users/targetuser/totp/reset')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(res.status).toBe(200);

    const tu = _users.find((u) => u.username === 'targetuser')!;
    expect(tu.tokenVersion).toBe(1);
    expect(typeof tu.totpChangedAt).toBe('string');
    expect(tu.totpChangedAt).not.toBe(beforeChangedAt);

    const refreshRes = await attemptRefresh(app, target2);
    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.error).toMatch(/Token version stale/);
  });

  it('self password change bumps tokenVersion + passwordChangedAt; old refresh → 401', async () => {
    const app = createApp();
    const target = await loginAndCapture(app, 'targetuser', TEST_PASSWORD);
    const beforeChangedAt = _users[1].passwordChangedAt;

    const res = await request(app)
      .put('/api/auth/users/me/password')
      .set('Authorization', `Bearer ${target.token}`)
      .send({ currentPassword: TEST_PASSWORD, newPassword: 'newpass2025!' });
    expect(res.status).toBe(200);

    const tu = _users.find((u) => u.username === 'targetuser')!;
    expect(tu.tokenVersion).toBe(1);
    expect(typeof tu.passwordChangedAt).toBe('string');
    expect(tu.passwordChangedAt).not.toBe(beforeChangedAt);

    const refreshRes = await attemptRefresh(app, target);
    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.error).toMatch(/Token version stale/);
  });

  it('self TOTP confirm bumps tokenVersion + totpChangedAt; old refresh → 401', async () => {
    const app = createApp();
    const target = await loginAndCapture(app, 'targetuser', TEST_PASSWORD);
    const beforeChangedAt = _users[1].totpChangedAt;

    // Seed a pending enrollment (mimic /totp/enroll outcome) so /confirm has a secret
    const secret = authenticator.generateSecret();
    _users[1].totpSecret = secret;
    _users[1].totpEnabled = false;
    const validOtp = authenticator.generate(secret);

    const res = await request(app)
      .post('/api/auth/totp/confirm')
      .set('Authorization', `Bearer ${target.token}`)
      .send({ otp: validOtp });
    expect(res.status).toBe(200);

    const tu = _users.find((u) => u.username === 'targetuser')!;
    expect(tu.tokenVersion).toBe(1);
    expect(typeof tu.totpChangedAt).toBe('string');
    expect(tu.totpChangedAt).not.toBe(beforeChangedAt);

    const refreshRes = await attemptRefresh(app, target);
    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.error).toMatch(/Token version stale/);
  });

  it('self TOTP disable bumps tokenVersion + totpChangedAt; old refresh → 401', async () => {
    const app = createApp();
    const secret = authenticator.generateSecret();
    _users[1].totpSecret = secret;
    _users[1].totpEnabled = true;
    _users[1].recoveryCodeHashes = [];

    // Login bypasses 2FA path (twoFactorEnabled:false in mock + we toggle off briefly)
    _users[1].totpEnabled = false;
    const target = await loginAndCapture(app, 'targetuser', TEST_PASSWORD);
    _users[1].totpEnabled = true;
    const beforeChangedAt = _users[1].totpChangedAt;

    const validOtp = authenticator.generate(secret);
    const res = await request(app)
      .post('/api/auth/totp/disable')
      .set('Authorization', `Bearer ${target.token}`)
      .send({ otp: validOtp });
    expect(res.status).toBe(200);

    const tu = _users.find((u) => u.username === 'targetuser')!;
    expect(tu.tokenVersion).toBe(1);
    expect(typeof tu.totpChangedAt).toBe('string');
    expect(tu.totpChangedAt).not.toBe(beforeChangedAt);

    const refreshRes = await attemptRefresh(app, target);
    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.error).toMatch(/Token version stale/);
  });

  it('regression: GET /api/auth/users/me does NOT bump tokenVersion', async () => {
    const app = createApp();
    const target = await loginAndCapture(app, 'targetuser', TEST_PASSWORD);
    const before = _users[1].tokenVersion;

    const res = await request(app)
      .get('/api/auth/users/me')
      .set('Authorization', `Bearer ${target.token}`);
    expect(res.status).toBe(200);

    expect(_users[1].tokenVersion).toBe(before);

    const refreshRes = await attemptRefresh(app, target);
    expect(refreshRes.status).toBe(200);
  });
});
