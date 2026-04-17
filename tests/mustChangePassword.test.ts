/**
 * SEC-03: Tests for forced password change enforcement.
 *
 * Covers:
 * 1. _migrateUsersJson sets mustChangePassword: true for users with the default hash
 * 2. _migrateUsersJson does NOT set the flag if mustChangePassword already set to false
 * 3. POST /login with default-password user returns 200 { mustChangePassword: true, changeToken }
 * 4. POST /login with non-default-password user returns 200 { token }
 * 5. POST /change-password with valid changeToken + valid newPassword → 200 { token }
 * 6. POST /change-password with newPassword 'changeme2025!' → 400
 * 7. POST /change-password with newPassword shorter than 8 chars → 400
 * 8. POST /change-password with invalid changeToken → 401
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module-level mocks — must be declared before the imports they mock
// ---------------------------------------------------------------------------

const TEST_SECRET = 'test-secret-for-must-change-password-tests';

vi.mock('../server/keycloakAuth.js', () => ({
  getAuthProvider: () => 'local',
  getJwksClient: () => null,
}));

// We need real initAuth functions but with a controlled data dir.
// We mock getJwtSecret so the authApi uses our TEST_SECRET.
// loadUsers / modifyUsers are re-exported from initAuth.js so we must
// reset the module state by reinitializing initAuth for each test.
import { _migrateUsersJson, initAuth, loadUsers, type UserRecord } from '../server/initAuth';
import { authApiRouter } from '../server/authApi';
import { authMiddleware } from '../server/authMiddleware';

let tmpDir: string;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authApiRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Helper: build a users.json file with known users
// ---------------------------------------------------------------------------

function writeUsers(dir: string, users: UserRecord[]): void {
  fs.writeFileSync(path.join(dir, 'users.json'), JSON.stringify(users, null, 2), 'utf-8');
}

function writeJwtSecret(dir: string, secret: string): void {
  fs.writeFileSync(path.join(dir, 'jwt-secret.txt'), secret, { encoding: 'utf-8', mode: 0o600 });
}

function makeSettings(): Record<string, unknown> {
  return { twoFactorEnabled: false, maxLoginAttempts: 5, otpCode: '123456' };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-'));
  writeJwtSecret(tmpDir, TEST_SECRET);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Group 1: _migrateUsersJson — SEC-03 scan
// ---------------------------------------------------------------------------

describe('_migrateUsersJson — mustChangePassword scan (SEC-03)', () => {
  it('sets mustChangePassword=true for a user whose passwordHash matches changeme2025!', () => {
    const defaultHash = bcrypt.hashSync('changeme2025!', 4); // low rounds for speed in test
    const users: UserRecord[] = [
      {
        username: 'testuser',
        passwordHash: defaultHash,
        role: 'researcher',
        centers: ['org-uka'],
        createdAt: '2025-01-01T00:00:00Z',
      },
    ];
    const filePath = path.join(tmpDir, 'users.json');
    fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf-8');

    _migrateUsersJson(filePath);

    const result = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as UserRecord[];
    expect(result[0].mustChangePassword).toBe(true);
  });

  it('does NOT set mustChangePassword flag if it is already false (no-op on previously processed users)', () => {
    const defaultHash = bcrypt.hashSync('changeme2025!', 4);
    const users: UserRecord[] = [
      {
        username: 'testuser',
        passwordHash: defaultHash,
        mustChangePassword: false,
        role: 'researcher',
        centers: ['org-uka'],
        createdAt: '2025-01-01T00:00:00Z',
      },
    ];
    const filePath = path.join(tmpDir, 'users.json');
    fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf-8');

    _migrateUsersJson(filePath);

    const result = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as UserRecord[];
    // mustChangePassword: false means admin or change-password flow already ran — must stay false
    expect(result[0].mustChangePassword).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Group 2: POST /login — mustChangePassword gate
// ---------------------------------------------------------------------------

describe('POST /login — mustChangePassword gate', () => {
  it('returns { mustChangePassword: true, changeToken } for a user flagged with mustChangePassword', async () => {
    const defaultHash = bcrypt.hashSync('changeme2025!', 4);
    const users: UserRecord[] = [
      {
        username: 'flaggeduser',
        passwordHash: defaultHash,
        mustChangePassword: true,
        role: 'researcher',
        centers: ['org-uka'],
        createdAt: '2025-01-01T00:00:00Z',
      },
    ];
    writeUsers(tmpDir, users);
    initAuth(tmpDir, makeSettings());

    const app = createApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'flaggeduser', password: 'changeme2025!' });

    expect(res.status).toBe(200);
    expect(res.body.mustChangePassword).toBe(true);
    expect(typeof res.body.changeToken).toBe('string');
    // Verify changeToken has correct purpose
    const payload = jwt.verify(res.body.changeToken, TEST_SECRET) as { purpose: string; sub: string };
    expect(payload.purpose).toBe('change-password');
    expect(payload.sub).toBe('flaggeduser');
    // Must NOT contain a session token
    expect(res.body.token).toBeUndefined();
  });

  it('returns { token } for a normal user without mustChangePassword flag', async () => {
    const hash = bcrypt.hashSync('securepwd123!', 4);
    const users: UserRecord[] = [
      {
        username: 'normaluser',
        passwordHash: hash,
        role: 'researcher',
        centers: ['org-uka'],
        createdAt: '2025-01-01T00:00:00Z',
      },
    ];
    writeUsers(tmpDir, users);
    initAuth(tmpDir, makeSettings());

    const app = createApp();
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'normaluser', password: 'securepwd123!' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.mustChangePassword).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Group 3: POST /change-password
// ---------------------------------------------------------------------------

describe('POST /change-password', () => {
  function makeChangeToken(username: string, expiresIn = '5m'): string {
    return jwt.sign({ sub: username, purpose: 'change-password' }, TEST_SECRET, {
      algorithm: 'HS256',
      expiresIn,
    });
  }

  beforeEach(() => {
    const hash = bcrypt.hashSync('changeme2025!', 4);
    const users: UserRecord[] = [
      {
        username: 'changeuser',
        passwordHash: hash,
        mustChangePassword: true,
        role: 'researcher',
        centers: ['org-uka'],
        createdAt: '2025-01-01T00:00:00Z',
      },
    ];
    writeUsers(tmpDir, users);
    initAuth(tmpDir, makeSettings());
  });

  it('returns { token } with valid changeToken + valid newPassword', async () => {
    const changeToken = makeChangeToken('changeuser');
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ changeToken, newPassword: 'newSecurePass99!' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    // Verify new token is a valid session token
    const payload = jwt.verify(res.body.token, TEST_SECRET) as { sub: string };
    expect(payload.sub).toBe('changeuser');
    // Verify mustChangePassword cleared
    const users = loadUsers();
    const user = users.find((u) => u.username === 'changeuser');
    expect(user?.mustChangePassword).toBe(false);
  });

  it('returns 400 when newPassword is the default password changeme2025!', async () => {
    const changeToken = makeChangeToken('changeuser');
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ changeToken, newPassword: 'changeme2025!' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/default password/i);
  });

  it('returns 400 when newPassword is shorter than 8 characters', async () => {
    const changeToken = makeChangeToken('changeuser');
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ changeToken, newPassword: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 characters/i);
  });

  it('returns 401 with an invalid changeToken', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/auth/change-password')
      .send({ changeToken: 'not.a.valid.token', newPassword: 'newSecurePass99!' });

    expect(res.status).toBe(401);
  });
});
