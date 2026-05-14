/**
 * Wave 0 RED scaffold — Plan 28-01, Task 1
 *
 * Tests for three session management endpoints that DO NOT EXIST YET:
 *   GET  /api/auth/sessions?username=<u>
 *   DELETE /api/auth/sessions/:id
 *   DELETE /api/auth/sessions?username=<u>
 *
 * These tests are fully written and will FAIL until Plan 28-02 implements
 * the endpoints. Failure mode: 404 from Express (route not registered).
 *
 * Requirements: SESS-01, SESSUI-01, SESSUI-02
 * Threat: T-28-01 — admin-only guard tested for all three endpoints.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before authApi import
// ---------------------------------------------------------------------------

vi.mock('../server/initAuth.js', () => ({
  loadUsers: () => [],
  modifyUsers: vi.fn(async (fn: (u: unknown[]) => unknown[]) => fn([])),
  getJwtSecret: () => 'test-secret-session-revoke-tests-32b',
  getJwtSecrets: () => ({ current: 'test-secret-session-revoke-tests-32b', prev: undefined }),
  computeKeyId: (s: string) => s.slice(0, 8),
  getAuthConfig: () => ({ twoFactorEnabled: false, maxLoginAttempts: 5, otpCode: '123456' }),
  rotateSigningKey: vi.fn(),
}));

vi.mock('../server/keycloakAuth.js', () => ({
  getAuthProvider: () => ({ type: 'local' }),
}));

vi.mock('../server/fhirApi.js', () => ({ invalidateFhirCache: vi.fn() }));

vi.mock('../server/settingsApi.js', () => ({
  getAuthSettings: () => ({
    refreshTokenTtlMs: 28_800_000,
    refreshAbsoluteCapMs: 43_200_000,
    refreshCookieSecure: false,
  }),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const { authApiRouter } = await import('../server/authApi.js');
import {
  _closeForTests,
  getSession,
  initSessionsDb,
  insertSession,
  type SessionRow,
} from '../server/sessionsDb.js';

// ---------------------------------------------------------------------------
// Test infra — tmpdir sessions DB (mirrors sessionsDb.test.ts pattern)
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-revoke-test-'));
  initSessionsDb(tmpDir);
});

afterEach(() => {
  _closeForTests();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// makeRow — factory matching sessionsDb.test.ts pattern
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<SessionRow> = {}): SessionRow {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? 'jti-1',
    sid: overrides.sid ?? 'sid-1',
    username: overrides.username ?? 'alice',
    ver: overrides.ver ?? 0,
    issued_at: overrides.issued_at ?? now,
    expires_at: overrides.expires_at ?? new Date(Date.now() + 60_000).toISOString(),
    last_used_at: overrides.last_used_at ?? null,
    revoked: overrides.revoked ?? 0,
    key_id: overrides.key_id ?? 'abcd1234',
  };
}

// ---------------------------------------------------------------------------
// Express app factory — injects req.auth directly (no JWT in tests)
// ---------------------------------------------------------------------------

function createApp(role: string, username = 'testadmin') {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.auth = {
      sub: username,
      preferred_username: username,
      role,
      centers: [],
      iat: 0,
      exp: 0,
    };
    next();
  });
  app.use('/api/auth', authApiRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/auth/sessions', () => {
  it('returns only active sessions for the given username', async () => {
    // Insert 3 rows for alice: one revoked, one expired, one active
    insertSession(makeRow({ id: 'alice-revoked', username: 'alice', revoked: 1 }));
    insertSession(makeRow({
      id: 'alice-expired',
      username: 'alice',
      expires_at: new Date(Date.now() - 1_000).toISOString(),
    }));
    insertSession(makeRow({ id: 'alice-active', username: 'alice', sid: 'sid-alice-active' }));
    // Insert 1 active row for bob (must not appear in alice results)
    insertSession(makeRow({ id: 'bob-active', username: 'bob', sid: 'sid-bob' }));

    const app = createApp('admin');
    const res = await request(app).get('/api/auth/sessions?username=alice');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.sessions).toHaveLength(1);
    expect(res.body.sessions[0].id).toBe('alice-active');
  });

  it('does not expose sid/ver/revoked/username in the response (DTO projection)', async () => {
    insertSession(makeRow({ id: 'alice-dto', username: 'alice' }));
    const app = createApp('admin');
    const res = await request(app).get('/api/auth/sessions?username=alice');
    expect(res.status).toBe(200);
    const session = res.body.sessions[0];
    // DTO fields present
    expect(session).toHaveProperty('id');
    expect(session).toHaveProperty('issued_at');
    expect(session).toHaveProperty('key_id');
    // Internal fields must NOT be present
    expect(session).not.toHaveProperty('sid');
    expect(session).not.toHaveProperty('ver');
    expect(session).not.toHaveProperty('revoked');
  });

  it('returns 403 for non-admin role', async () => {
    const app = createApp('researcher');
    const res = await request(app).get('/api/auth/sessions?username=alice');
    expect(res.status).toBe(403);
  });

  it('returns 400 when username query param is missing', async () => {
    const app = createApp('admin');
    const res = await request(app).get('/api/auth/sessions');
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/auth/sessions/:id', () => {
  it('revokes an individual session and returns { revoked: true }', async () => {
    insertSession(makeRow({ id: 'jti-1', username: 'alice' }));

    const app = createApp('admin');
    const res = await request(app).delete('/api/auth/sessions/jti-1');

    expect(res.status).toBe(200);
    expect(res.body.revoked).toBe(true);
    expect(getSession('jti-1')!.revoked).toBe(1);
  });

  it('returns 404 when the session id does not exist', async () => {
    const app = createApp('admin');
    const res = await request(app).delete('/api/auth/sessions/nonexistent');
    expect(res.status).toBe(404);
  });

  it('returns 403 for non-admin role', async () => {
    const app = createApp('researcher');
    const res = await request(app).delete('/api/auth/sessions/jti-1');
    expect(res.status).toBe(403);
  });

  it('route ordering: DELETE /sessions/:id hits the :id handler, not the query-param handler', async () => {
    // 'some-uuid' is not a real row — expect 404 from :id handler, NOT 400 'username required'
    const app = createApp('admin');
    const res = await request(app).delete('/api/auth/sessions/some-uuid');
    // Must be 404 (id not found), not 400 (missing username param)
    expect(res.status).toBe(404);
  });

  it('returns 404 when revoking an already-revoked session (idempotent guard)', async () => {
    insertSession(makeRow({ id: 'jti-already', username: 'alice' }));
    const app = createApp('admin');
    // First revoke — succeeds
    await request(app).delete('/api/auth/sessions/jti-already');
    // Second revoke — must 404, not return { revoked: true }
    const res = await request(app).delete('/api/auth/sessions/jti-already');
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/auth/sessions (by username)', () => {
  it('revokes all active sessions for a username and returns the count', async () => {
    insertSession(makeRow({ id: 'alice-1', username: 'alice', sid: 'sid-a1' }));
    insertSession(makeRow({ id: 'alice-2', username: 'alice', sid: 'sid-a2' }));

    const app = createApp('admin');
    const res = await request(app).delete('/api/auth/sessions?username=alice');

    expect(res.status).toBe(200);
    expect(res.body.revoked).toBe(2);
  });

  it('returns 403 for non-admin role', async () => {
    const app = createApp('researcher');
    const res = await request(app).delete('/api/auth/sessions?username=alice');
    expect(res.status).toBe(403);
  });

  it('returns 400 when username query param is missing', async () => {
    const app = createApp('admin');
    const res = await request(app).delete('/api/auth/sessions');
    expect(res.status).toBe(400);
  });

  it('returns { revoked: 0 } for a user with no active sessions', async () => {
    const app = createApp('admin');
    const res = await request(app).delete('/api/auth/sessions?username=nobody');
    expect(res.status).toBe(200);
    expect(res.body.revoked).toBe(0);
  });
});
