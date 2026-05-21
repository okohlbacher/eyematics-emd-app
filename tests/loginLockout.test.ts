/**
 * AUTHCFG-01 / AUTHCFG-04 — symmetric login lockout branches + resetLimiter rebuild.
 *
 * Uses REAL rate limiting (not mocked) to verify threshold-crossing 429 behaviour
 * on both the known-user and unknown-user branches (Blocker #1, #2).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import bcrypt from 'bcryptjs';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock only the modules that need filesystem / keycloak access.
// rateLimiting is NOT mocked — we need real lockout behavior.
// ---------------------------------------------------------------------------

vi.mock('../server/initAuth.js', () => ({
  loadUsers: vi.fn(() => [
    {
      username: 'testuser',
      passwordHash: bcrypt.hashSync('correctpassword', 4),
      role: 'researcher',
      centers: ['org-uka'],
      createdAt: '2026-01-01T00:00:00.000Z',
      active: true,
    },
  ]),
  saveUsers: vi.fn(async () => {}),
  getJwtSecret: () => 'test-jwt-secret-for-lockout-tests-1234',
  getAuthConfig: vi.fn(() => ({
    twoFactorEnabled: false,
    maxLoginAttempts: 3,
    otpCode: '123456',
    lockoutCapMs: 900_000,
  })),
  modifyUsers: vi.fn(async (fn: (u: unknown[]) => unknown[]) => fn([])),
}));

vi.mock('../server/keycloakAuth.js', () => ({
  getAuthProvider: vi.fn(() => 'local'),
  getJwksClient: vi.fn(() => null),
}));

vi.mock('../server/sessionsDb.js', () => ({
  getSession: vi.fn(async () => null),
  insertSession: vi.fn(async () => {}),
  listActiveSessionsByUser: vi.fn(async () => []),
  revokeByUsername: vi.fn(async () => {}),
  revokeFamily: vi.fn(async () => {}),
  revokeSession: vi.fn(async () => {}),
}));

vi.mock('../server/settingsApi.js', () => ({
  getAuthSettings: vi.fn(() => ({
    refreshTokenTtlMs: 28_800_000,
    refreshAbsoluteCapMs: 43_200_000,
    refreshCookieSecure: false,
  })),
}));

vi.mock('../server/jwtUtil.js', () => ({
  signAccessToken: vi.fn(() => 'mock-access-token'),
  signRefreshToken: vi.fn(() => 'mock-refresh-token'),
  signChallengeToken: vi.fn(() => 'mock-challenge-token'),
  verifyChallengeToken: vi.fn(() => null),
  verifyRefreshToken: vi.fn(() => null),
}));

vi.mock('../server/constants.js', () => ({
  getValidCenterIds: vi.fn(() => new Set(['org-uka'])),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { authApiRouter } from '../server/authApi.js';
import { resetLimiter } from '../server/authApi.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authApiRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Shared app + reset between tests
// ---------------------------------------------------------------------------

const app = buildApp();

beforeEach(() => {
  // Always reset the limiter so lockout state doesn't bleed between tests
  resetLimiter();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/auth/login — attemptsRemaining on 401 (AUTHCFG-01)', () => {
  it('known user bad password returns 401 with attemptsRemaining', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('attemptsRemaining');
    expect(typeof res.body.attemptsRemaining).toBe('number');
    expect(res.body.attemptsRemaining).toBeGreaterThanOrEqual(0);
  });

  it('unknown user returns 401 with attemptsRemaining (symmetric shape)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ghost_user', password: 'anything' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('attemptsRemaining');
    expect(typeof res.body.attemptsRemaining).toBe('number');
  });

  it('attemptsRemaining decreases with each bad-password attempt', async () => {
    const res1 = await request(app)
      .post('/api/auth/login').send({ username: 'testuser', password: 'wrong' });
    const res2 = await request(app)
      .post('/api/auth/login').send({ username: 'testuser', password: 'wrong' });
    expect(res1.status).toBe(401);
    expect(res2.status).toBe(401);
    expect(res2.body.attemptsRemaining).toBeLessThan(res1.body.attemptsRemaining);
  });
});

describe('POST /api/auth/login — 429 on threshold crossing (AUTHCFG-01, Blocker #2)', () => {
  it('known user crossing maxLoginAttempts returns 429 with retryAfterMs, no attemptsRemaining', async () => {
    // maxLoginAttempts = 3 (mocked). Make 3 failures to cross.
    await request(app).post('/api/auth/login').send({ username: 'testuser', password: 'wrong' });
    await request(app).post('/api/auth/login').send({ username: 'testuser', password: 'wrong' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'wrong' });
    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty('retryAfterMs');
    expect(res.body).not.toHaveProperty('attemptsRemaining');
  });

  it('unknown user crossing maxLoginAttempts returns 429 (non-enumeration parity)', async () => {
    // Exhaust the limiter for an unknown user
    await request(app).post('/api/auth/login').send({ username: 'unknownABC', password: 'wrong' });
    await request(app).post('/api/auth/login').send({ username: 'unknownABC', password: 'wrong' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'unknownABC', password: 'wrong' });
    expect(res.status).toBe(429);
    expect(res.body).toHaveProperty('retryAfterMs');
    expect(res.body).not.toHaveProperty('attemptsRemaining');
  });
});

describe('resetLimiter — rebuild after config change (AUTHCFG-04, Blocker #1)', () => {
  it('resetLimiter nulls the singleton so the next request rebuilds with new config', async () => {
    // First, establish a failed attempt so the limiter is initialized
    const res1 = await request(app)
      .post('/api/auth/login')
      .send({ username: 'rebuilduser', password: 'wrong' });
    expect(res1.status).toBe(401);

    // Calling resetLimiter() nulls _limiter; the next request re-creates it fresh
    resetLimiter();

    // After reset, the user's lockout state is gone (new limiter = empty map)
    const res2 = await request(app)
      .post('/api/auth/login')
      .send({ username: 'rebuilduser', password: 'wrong' });
    expect(res2.status).toBe(401);
    // attemptsRemaining should be back at (maxLoginAttempts - 1) = 2, not lower
    expect(res2.body.attemptsRemaining).toBe(2); // 3 - 1 = 2
  });
});

describe('GET /api/auth/config — no maxLoginAttempts (Blocker #4)', () => {
  it('does NOT expose maxLoginAttempts', async () => {
    const res = await request(app).get('/api/auth/config');
    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('maxLoginAttempts');
    expect(res.body).toHaveProperty('twoFactorEnabled');
    expect(res.body).toHaveProperty('provider');
  });
});
