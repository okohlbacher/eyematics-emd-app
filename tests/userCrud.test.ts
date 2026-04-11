/**
 * Tests for user CRUD API endpoints on authApiRouter.
 *
 * Behavior spec from 04-01-PLAN.md Task 2.
 * These tests are written BEFORE the implementation (TDD RED phase).
 */

import type { NextFunction,Request, Response } from 'express';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// We need to mock initAuth module before importing authApi
const TEST_SECRET = 'test-jwt-secret-for-user-crud-tests';

// In-memory users store for tests
let mockUsers: Array<{
  username: string;
  passwordHash?: string;
  role: string;
  centers: string[];
  firstName?: string;
  lastName?: string;
  createdAt: string;
  lastLogin?: string;
}> = [];

vi.mock('../server/initAuth.js', () => ({
  loadUsers: () => mockUsers,
  saveUsers: vi.fn(async (users: typeof mockUsers) => {
    mockUsers = [...users];
  }),
  modifyUsers: vi.fn(async (fn: (users: typeof mockUsers) => typeof mockUsers) => {
    mockUsers = fn(mockUsers);
    return mockUsers;
  }),
  getJwtSecret: () => TEST_SECRET,
  getAuthConfig: () => ({ twoFactorEnabled: false, maxLoginAttempts: 5, otpCode: '123456' }),
}));

// Import after mocks are set up
const { authApiRouter } = await import('../server/authApi.js');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeToken(username: string, role: string, centers: string[] = ['org-uka']): string {
  return jwt.sign(
    { sub: username, preferred_username: username, role, centers },
    TEST_SECRET,
    { algorithm: 'HS256', expiresIn: '10m' },
  );
}

function makeApp() {
  const app = express();
  app.use(express.json());
  // Attach auth from token header (simplified auth middleware for tests)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      try {
        const payload = jwt.verify(header.slice(7), TEST_SECRET) as {
          sub: string;
          preferred_username: string;
          role: string;
          centers: string[];
        };
        req.auth = {
          sub: payload.sub,
          preferred_username: payload.preferred_username,
          role: payload.role,
          centers: payload.centers,
          iat: 0,
          exp: 0,
        };
      } catch {
        // leave req.auth undefined
      }
    }
    next();
  });
  app.use('/api/auth', authApiRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('GET /api/auth/users/me', () => {
  let app: express.Express;

  beforeEach(() => {
    mockUsers = [
      { username: 'alice', role: 'admin', centers: ['org-uka'], createdAt: '2025-01-01T00:00:00Z' },
    ];
    app = makeApp();
  });

  it('returns 200 with user info when authenticated', async () => {
    const token = makeToken('alice', 'admin', ['org-uka']);
    const res = await request(app)
      .get('/api/auth/users/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ username: 'alice', role: 'admin', centers: ['org-uka'] });
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/auth/users/me');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/users', () => {
  let app: express.Express;

  beforeEach(() => {
    mockUsers = [
      { username: 'alice', passwordHash: 'hash', role: 'admin', centers: ['org-uka'], createdAt: '2025-01-01T00:00:00Z' },
      { username: 'bob', passwordHash: 'hash2', role: 'researcher', centers: ['org-ukb'], createdAt: '2025-01-02T00:00:00Z' },
    ];
    app = makeApp();
  });

  it('returns 403 for non-admin role', async () => {
    const token = makeToken('bob', 'researcher');
    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Admin access required');
  });

  it('returns 200 with user list for admin — no passwordHash fields', async () => {
    const token = makeToken('alice', 'admin');
    const res = await request(app)
      .get('/api/auth/users')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(2);
    // passwordHash must be stripped from response
    for (const u of res.body.users) {
      expect(u).not.toHaveProperty('passwordHash');
    }
  });
});

describe('POST /api/auth/users', () => {
  let app: express.Express;

  beforeEach(() => {
    mockUsers = [
      { username: 'alice', role: 'admin', centers: ['org-uka'], createdAt: '2025-01-01T00:00:00Z' },
    ];
    app = makeApp();
  });

  it('returns 403 for non-admin', async () => {
    const token = makeToken('bob', 'researcher');
    const res = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'charlie', role: 'researcher', centers: ['org-uka'] });
    expect(res.status).toBe(403);
  });

  it('returns 201 with generatedPassword for valid admin create', async () => {
    const token = makeToken('alice', 'admin');
    const res = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'charlie', role: 'researcher', centers: ['org-uka'] });
    expect(res.status).toBe(201);
    expect(res.body.generatedPassword).toBeTruthy();
    expect(typeof res.body.generatedPassword).toBe('string');
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('returns 409 for duplicate username (case-insensitive)', async () => {
    const token = makeToken('alice', 'admin');
    const res = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'ALICE', role: 'researcher', centers: ['org-uka'] });
    expect(res.status).toBe(409);
  });

  it('returns 400 for missing username', async () => {
    const token = makeToken('alice', 'admin');
    const res = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'researcher', centers: ['org-uka'] });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid center codes', async () => {
    const token = makeToken('alice', 'admin');
    const res = await request(app)
      .post('/api/auth/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'dave', role: 'researcher', centers: ['org-invalid'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid center codes/);
  });
});

describe('DELETE /api/auth/users/:username', () => {
  let app: express.Express;

  beforeEach(() => {
    mockUsers = [
      { username: 'alice', role: 'admin', centers: ['org-uka'], createdAt: '2025-01-01T00:00:00Z' },
      { username: 'bob', role: 'researcher', centers: ['org-ukb'], createdAt: '2025-01-02T00:00:00Z' },
    ];
    app = makeApp();
  });

  it('returns 200 when admin deletes another user', async () => {
    const token = makeToken('alice', 'admin');
    const res = await request(app)
      .delete('/api/auth/users/bob')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('returns 409 when admin tries to self-delete', async () => {
    const token = makeToken('alice', 'admin');
    const res = await request(app)
      .delete('/api/auth/users/alice')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Cannot delete your own account/);
  });

  it('returns 404 for nonexistent user', async () => {
    const token = makeToken('alice', 'admin');
    const res = await request(app)
      .delete('/api/auth/users/nonexistent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns 403 for non-admin', async () => {
    const token = makeToken('bob', 'researcher');
    const res = await request(app)
      .delete('/api/auth/users/alice')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/auth/users/:username/password', () => {
  let app: express.Express;

  beforeEach(() => {
    mockUsers = [
      { username: 'alice', role: 'admin', centers: ['org-uka'], createdAt: '2025-01-01T00:00:00Z' },
      { username: 'bob', passwordHash: 'oldhash', role: 'researcher', centers: ['org-ukb'], createdAt: '2025-01-02T00:00:00Z' },
    ];
    app = makeApp();
  });

  it('returns 200 with server-generated generatedPassword and Cache-Control: no-store', async () => {
    const token = makeToken('alice', 'admin');
    const res = await request(app)
      .put('/api/auth/users/bob/password')
      .set('Authorization', `Bearer ${token}`)
      .send({});  // no password in request body — server generates
    expect(res.status).toBe(200);
    expect(res.body.generatedPassword).toBeTruthy();
    expect(typeof res.body.generatedPassword).toBe('string');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('returns 404 for nonexistent user', async () => {
    const token = makeToken('alice', 'admin');
    const res = await request(app)
      .put('/api/auth/users/nonexistent/password')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('returns 403 for non-admin', async () => {
    const token = makeToken('bob', 'researcher');
    const res = await request(app)
      .put('/api/auth/users/bob/password')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('request body does NOT contain a password field — server-generated only', async () => {
    // This test verifies the design contract: no plaintext password in request body
    // The endpoint ignores req.body.password entirely
    const token = makeToken('alice', 'admin');
    const res = await request(app)
      .put('/api/auth/users/bob/password')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'this-should-be-ignored' });  // should be ignored
    expect(res.status).toBe(200);
    // Server generates its own password regardless of what's sent
    expect(res.body.generatedPassword).toBeTruthy();
    expect(res.body.generatedPassword).not.toBe('this-should-be-ignored');
  });
});
