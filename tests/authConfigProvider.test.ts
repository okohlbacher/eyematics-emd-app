/**
 * Tests for provider-aware /config and /login endpoints in authApi.ts.
 *
 * Covers KC-03, KC-04, KC-05 requirements per 06-02-PLAN.md Task 1.
 *
 * Behavior specs:
 * - GET /api/auth/config returns { twoFactorEnabled, provider: 'local' } when provider=local
 * - GET /api/auth/config returns { twoFactorEnabled, provider: 'keycloak' } when provider=keycloak
 * - POST /api/auth/login returns 405 with error message when provider=keycloak (D-04)
 * - POST /api/auth/login works normally when provider=local (regression)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------------
// Control provider state via module-level variable
// ---------------------------------------------------------------------------

let mockProvider: 'local' | 'keycloak' = 'local';

// ---------------------------------------------------------------------------
// Top-level mocks (hoisted by vitest)
// ---------------------------------------------------------------------------

vi.mock('../server/initAuth.js', () => ({
  loadUsers: vi.fn(() => [
    {
      username: 'testuser',
      passwordHash: bcrypt.hashSync('correctpassword', 4),
      role: 'researcher',
      centers: ['org-uka'],
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ]),
  saveUsers: vi.fn(async () => {}),
  getJwtSecret: () => 'test-jwt-secret-for-auth-config-provider-tests',
  getAuthConfig: () => ({
    twoFactorEnabled: false,
    maxLoginAttempts: 5,
    otpCode: '123456',
  }),
}));

vi.mock('../server/keycloakAuth.js', () => ({
  getAuthProvider: vi.fn(() => mockProvider),
  getJwksClient: vi.fn(() => null),
}));

vi.mock('../server/rateLimiting.js', () => ({
  createRateLimiter: vi.fn(() => ({
    getLockState: vi.fn(() => ({ attempts: 0, lockedUntil: 0 })),
    isLocked: vi.fn(() => false),
    recordFailure: vi.fn(() => ({ attempts: 1, lockedUntil: 0 })),
    resetAttempts: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Build test app (import after mocks are hoisted)
// ---------------------------------------------------------------------------

import { authApiRouter } from '../server/authApi.js';
import { getAuthProvider } from '../server/keycloakAuth.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authApiRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/auth/config — provider field', () => {
  const app = buildApp();

  beforeEach(() => {
    mockProvider = 'local';
    vi.mocked(getAuthProvider).mockImplementation(() => mockProvider);
  });

  it('returns provider: local when provider=local', async () => {
    mockProvider = 'local';
    vi.mocked(getAuthProvider).mockReturnValue('local');
    const res = await request(app).get('/api/auth/config');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('provider', 'local');
    expect(res.body).toHaveProperty('twoFactorEnabled');
  });

  it('returns provider: keycloak when provider=keycloak', async () => {
    vi.mocked(getAuthProvider).mockReturnValue('keycloak');
    const res = await request(app).get('/api/auth/config');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('provider', 'keycloak');
    expect(res.body).toHaveProperty('twoFactorEnabled');
  });
});

describe('POST /api/auth/login — provider guard (D-04)', () => {
  const app = buildApp();

  beforeEach(() => {
    vi.mocked(getAuthProvider).mockImplementation(() => mockProvider);
  });

  it('returns 405 with error message when provider=keycloak', async () => {
    vi.mocked(getAuthProvider).mockReturnValue('keycloak');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'correctpassword' });
    expect(res.status).toBe(405);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toContain('Local login is disabled');
  });

  it('returns 405 regardless of credentials when provider=keycloak', async () => {
    vi.mocked(getAuthProvider).mockReturnValue('keycloak');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'wrongpassword' });
    expect(res.status).toBe(405);
    expect(res.body.error).toContain('Local login is disabled');
  });

  it('processes login normally when provider=local (regression)', async () => {
    vi.mocked(getAuthProvider).mockReturnValue('local');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'correctpassword' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('returns 401 on invalid credentials when provider=local (regression)', async () => {
    vi.mocked(getAuthProvider).mockReturnValue('local');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error', 'Invalid credentials');
  });
});
