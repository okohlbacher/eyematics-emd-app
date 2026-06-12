/**
 * T-02: Tests for auditMiddleware.ts — body redaction.
 * Security-critical: passwords/OTP must never appear in plaintext in the audit log.
 *
 * Since redactBody and tryParseJson are private, we test them indirectly
 * through the exported auditMiddleware by mocking logAuditEntry and inspecting
 * what gets logged.
 */

import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock auditDb to capture logged entries
const loggedEntries: Array<{ body: string | null; query: string | null; method: string; path: string; user: string }> = [];
vi.mock('../server/auditDb.js', () => ({
  logAuditEntry: vi.fn((entry: Record<string, unknown>) => {
    loggedEntries.push({
      body: entry.body as string | null,
      query: entry.query as string | null,
      method: entry.method as string,
      path: entry.path as string,
      user: entry.user as string,
    });
  }),
}));

// Provide a stable in-process JWT secret so verifyAccessTokenIgnoringExpiry works
// without a real data directory. Using vi.mock keeps initAuth from hitting disk.
const TEST_JWT_SECRET = 'audit-test-secret-a5-hotfix-32bytes!!';
vi.mock('../server/initAuth.js', () => ({
  getJwtSecret: () => TEST_JWT_SECRET,
  getJwtSecrets: () => ({ current: TEST_JWT_SECRET }),
}));

import { auditMiddleware } from '../server/auditMiddleware.js';

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    originalUrl: '/api/test',
    method: 'GET',
    query: {},
    body: undefined,
    _capturedBody: undefined,
    auth: { sub: 'admin', preferred_username: 'admin', role: 'admin', centers: [], iat: 0, exp: 0 },
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const handlers: Record<string, (() => void)[]> = {};
  return {
    statusCode: 200,
    on: (event: string, handler: () => void) => { (handlers[event] ??= []).push(handler); },
    _emit: (event: string) => { (handlers[event] ?? []).forEach((h) => h()); },
  } as unknown as Response & { _emit: (event: string) => void };
}

beforeEach(() => {
  loggedEntries.length = 0;
});

describe('auditMiddleware', () => {
  it('skips non-/api/ requests', () => {
    const req = mockReq({ originalUrl: '/index.html' });
    const res = mockRes();
    const next = vi.fn();
    auditMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries).toHaveLength(0);
  });

  it('logs /api/ requests', () => {
    const req = mockReq({ originalUrl: '/api/fhir/bundles' });
    const res = mockRes();
    const next: NextFunction = vi.fn();
    auditMiddleware(req, res, next);
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries).toHaveLength(1);
    expect(loggedEntries[0].path).toBe('/api/fhir/bundles');
  });

  it('redacts password on /api/auth/login', () => {
    const req = mockReq({
      originalUrl: '/api/auth/login',
      method: 'POST',
      body: { username: 'admin', password: 'secret123' },
    });
    const res = mockRes();
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries).toHaveLength(1);
    const body = JSON.parse(loggedEntries[0].body!);
    expect(body.password).toBe('[REDACTED]');
    expect(body.username).toBe('admin');
  });

  it('redacts otp on /api/auth/verify', () => {
    const req = mockReq({
      originalUrl: '/api/auth/verify',
      method: 'POST',
      body: { challengeToken: 'tok123', otp: '654321' },
    });
    const res = mockRes();
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    const body = JSON.parse(loggedEntries[0].body!);
    expect(body.otp).toBe('[REDACTED]');
    expect(body.challengeToken).toBe('[REDACTED]');
  });

  it('redacts generatedPassword on /api/auth/users', () => {
    const req = mockReq({
      originalUrl: '/api/auth/users',
      method: 'POST',
      body: { username: 'newuser', role: 'researcher', generatedPassword: 'abc123!' },
    });
    const res = mockRes();
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    const body = JSON.parse(loggedEntries[0].body!);
    expect(body.generatedPassword).toBe('[REDACTED]');
    expect(body.username).toBe('newuser');
  });

  it('redacts cohortHashSecret/otpCode from YAML body on PUT /api/settings (H4)', () => {
    const yamlBody = [
      'twoFactorEnabled: false',
      "otpCode: '123456'",
      'audit:',
      '  cohortHashSecret: deadbeefcafebabe1234567890abcdef',
      'dataSource:',
      '  type: blaze',
      '  blazeUrl: http://localhost:8080/fhir',
    ].join('\n');
    const req = mockReq({
      originalUrl: '/api/settings',
      method: 'PUT',
      body: yamlBody, // express.text() gives a string
    });
    const res = mockRes();
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    const stored = loggedEntries[0].body!;
    expect(stored).not.toContain('123456');
    expect(stored).not.toContain('deadbeefcafebabe');
    expect(stored).toMatch(/otpCode:\s*\[REDACTED\]/);
    expect(stored).toMatch(/cohortHashSecret:\s*\[REDACTED\]/);
    // Non-sensitive fields preserved
    expect(stored).toContain('blazeUrl: http://localhost:8080/fhir');
  });

  it('does NOT redact body on non-auth paths', () => {
    const req = mockReq({
      originalUrl: '/api/data/quality-flags',
      method: 'PUT',
      body: { password: 'should-not-redact' },
    });
    const res = mockRes();
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    const body = JSON.parse(loggedEntries[0].body!);
    expect(body.password).toBe('should-not-redact');
  });

  it('logs null body for GET requests', () => {
    const req = mockReq({ originalUrl: '/api/fhir/bundles', method: 'GET' });
    const res = mockRes();
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries[0].body).toBeNull();
  });

  it('logs query params for GET requests', () => {
    const req = mockReq({
      originalUrl: '/api/audit?limit=50',
      method: 'GET',
      query: { limit: '50' },
    });
    const res = mockRes();
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries[0].query).toBe('{"limit":"50"}');
  });

  it('records actor unauthenticated for a true no-auth request (401)', () => {
    const req = mockReq({ originalUrl: '/api/fhir/bundles', method: 'GET', auth: undefined });
    const res = mockRes();
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries[0]).toBeDefined();
    expect(loggedEntries[0].user).toBe('unauthenticated');
  });

  // AUDIT-02: login rows are attributed to the attempted username (from body),
  // since req.auth is empty during login. Aids brute-force / targeting visibility.
  it('records the attempted username as actor on /api/auth/login', () => {
    const req = mockReq({ originalUrl: '/api/auth/login', method: 'POST', auth: undefined, body: { username: 'bob', password: 'y' } });
    const res = mockRes();
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries[0].user).toBe('bob');
    // password still redacted in body
    expect(JSON.stringify(loggedEntries[0].body)).not.toContain('"y"');
  });

  // WR-06: control characters / newlines in the attempted username must be
  // stripped before it is stored as the audit actor (log-injection hardening).
  it('strips control chars and newlines from the attempted username actor (WR-06)', () => {
    const req = mockReq({
      originalUrl: '/api/auth/login',
      method: 'POST',
      auth: undefined,
      body: { username: 'ad\nmin\t', password: 'y' },
    });
    const res = mockRes();
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    // newline + tab removed → contiguous printable run, no injected line break
    expect(loggedEntries[0].user).toBe('admin');
    expect(loggedEntries[0].user).not.toContain('\n');
  });

  it('falls back to unauthenticated when attempted username is only control chars (WR-06)', () => {
    const req = mockReq({
      originalUrl: '/api/auth/login',
      method: 'POST',
      auth: undefined,
      body: { username: '\n\t ', password: 'y' },
    });
    const res = mockRes();
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries[0].user).toBe('unauthenticated');
  });

  it('falls back to unauthenticated on /api/auth/login with no username', () => {
    const req = mockReq({ originalUrl: '/api/auth/login', method: 'POST', auth: undefined, body: { password: 'y' } });
    const res = mockRes();
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries[0].user).toBe('unauthenticated');
  });

  it('authenticated identity wins over body username (no spoofing)', () => {
    const req = mockReq({ originalUrl: '/api/auth/login', method: 'POST', body: { username: 'attacker', password: 'y' } });
    // mockReq default auth = admin
    const res = mockRes();
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries[0].user).toBe('admin');
  });

  it('records the real username for authenticated requests', () => {
    const req = mockReq({
      originalUrl: '/api/data/cases',
      method: 'GET',
      auth: { sub: 'alice', preferred_username: 'alice', role: 'viewer', centers: [], iat: 0, exp: 0 },
    });
    const res = mockRes();
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries[0].user).toBe('alice');
  });

  it('strips query string from path', () => {
    const req = mockReq({ originalUrl: '/api/audit?user=admin&limit=10', method: 'GET', query: {} });
    const res = mockRes();
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries[0].path).toBe('/api/audit');
  });
});

describe('SKIP_AUDIT_PATHS — handler-written rows (Phase 11 / D-10 / T-11-01)', () => {
  it('skips POST /api/audit/events/view-open (no middleware-written row)', () => {
    const req = mockReq({
      originalUrl: '/api/audit/events/view-open',
      method: 'POST',
      body: { name: 'open_outcomes_view', cohortId: 'saved-search-xyz' },
    });
    const res = mockRes();
    const next: NextFunction = vi.fn();
    auditMiddleware(req, res, next);
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries).toHaveLength(0);
  });

  it('still logs other /api/ paths (regression — skip-list does not over-reach)', () => {
    const req = mockReq({ originalUrl: '/api/fhir/bundles' });
    const res = mockRes();
    const next: NextFunction = vi.fn();
    auditMiddleware(req, res, next);
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries).toHaveLength(1);
    expect(loggedEntries[0].path).toBe('/api/fhir/bundles');
  });

  it('skip fires even when request body would contain a raw cohort id', () => {
    // The skip-list MUST run before body-capture so the raw id cannot leak into debug sinks.
    // Observable proof: zero entries logged despite a body present.
    const req = mockReq({
      originalUrl: '/api/audit/events/view-open',
      method: 'POST',
      body: { cohortId: 'raw-cohort-id-that-must-not-be-captured' },
    });
    const res = mockRes();
    const next: NextFunction = vi.fn();
    auditMiddleware(req, res, next);
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Phase 20 / D-19: Status-conditional audit skip + REDACT_PATHS for refresh/logout
// ---------------------------------------------------------------------------
describe('Phase 20 status-conditional skip — /api/auth/refresh', () => {
  it('skips successful (200) /api/auth/refresh — high-volume background event', () => {
    const req = mockReq({
      originalUrl: '/api/auth/refresh',
      method: 'POST',
      body: {},
    });
    const res = mockRes();
    (res as unknown as { statusCode: number }).statusCode = 200;
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries).toHaveLength(0);
  });

  it('audits failed (401) /api/auth/refresh — security-relevant', () => {
    const req = mockReq({
      originalUrl: '/api/auth/refresh',
      method: 'POST',
      body: {},
    });
    const res = mockRes();
    (res as unknown as { statusCode: number }).statusCode = 401;
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries).toHaveLength(1);
    expect(loggedEntries[0].path).toBe('/api/auth/refresh');
    expect(loggedEntries[0].method).toBe('POST');
  });

  it('audits failed (403) /api/auth/refresh — CSRF mismatch path', () => {
    const req = mockReq({
      originalUrl: '/api/auth/refresh',
      method: 'POST',
      body: {},
    });
    const res = mockRes();
    (res as unknown as { statusCode: number }).statusCode = 403;
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries).toHaveLength(1);
    expect(loggedEntries[0].path).toBe('/api/auth/refresh');
  });

  it('always audits POST /api/auth/logout (200)', () => {
    const req = mockReq({
      originalUrl: '/api/auth/logout',
      method: 'POST',
      body: {},
    });
    const res = mockRes();
    (res as unknown as { statusCode: number }).statusCode = 200;
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries).toHaveLength(1);
    expect(loggedEntries[0].path).toBe('/api/auth/logout');
    expect(loggedEntries[0].method).toBe('POST');
  });

  it('redacts /api/auth/refresh body (CSRF-shaped fields not persisted raw)', () => {
    // refresh body in practice is empty / CSRF-only. Send a body containing a
    // password-shaped field — REDACT_PATHS membership must redact it.
    const req = mockReq({
      originalUrl: '/api/auth/refresh',
      method: 'POST',
      body: { password: 'should-be-redacted-on-refresh' },
    });
    const res = mockRes();
    (res as unknown as { statusCode: number }).statusCode = 401; // failure → audited
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries).toHaveLength(1);
    const stored = loggedEntries[0].body!;
    expect(stored).not.toContain('should-be-redacted-on-refresh');
    const parsed = JSON.parse(stored);
    expect(parsed.password).toBe('[REDACTED]');
  });

  it('redacts /api/auth/logout body (defense in depth)', () => {
    const req = mockReq({
      originalUrl: '/api/auth/logout',
      method: 'POST',
      body: { password: 'should-be-redacted-on-logout' },
    });
    const res = mockRes();
    (res as unknown as { statusCode: number }).statusCode = 200;
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries).toHaveLength(1);
    const stored = loggedEntries[0].body!;
    expect(stored).not.toContain('should-be-redacted-on-logout');
    const parsed = JSON.parse(stored);
    expect(parsed.password).toBe('[REDACTED]');
  });
});

// ---------------------------------------------------------------------------
// A5: Expired signed-claim attribution for 401 audit rows
// ---------------------------------------------------------------------------

/**
 * Sign a real access token using the test secret. iatOverride / expOverride allow
 * crafting tokens with specific iat/exp values for the 24 h cap tests.
 */
function signTestAccessToken(opts: {
  preferred_username?: string;
  typ?: string;
  expiredSecondsAgo?: number; // positive = expired N seconds ago
  expiredHoursAgo?: number;   // positive = expired N hours ago
}): string {
  const nowS = Math.floor(Date.now() / 1000);
  const expiredAgo = opts.expiredHoursAgo !== undefined
    ? opts.expiredHoursAgo * 3600
    : (opts.expiredSecondsAgo ?? 60);
  const exp = nowS - expiredAgo;
  const iat = exp - 900; // issued 15 min before expiry
  return jwt.sign(
    {
      sub: 'u1',
      preferred_username: opts.preferred_username ?? 'alice',
      role: 'viewer',
      centers: [],
      typ: opts.typ ?? 'access',
      iat,
      exp,
    },
    TEST_JWT_SECRET,
    { algorithm: 'HS256', noTimestamp: true },
  );
}

describe('A5 — expired signed-claim attribution for 401 audit rows', () => {
  // Helper: craft a 401 request with an Authorization header and no req.auth
  function make401Req(authHeader: string | undefined): Request {
    return {
      originalUrl: '/api/fhir/bundles',
      method: 'GET',
      query: {},
      body: undefined,
      _capturedBody: undefined,
      auth: undefined,
      headers: authHeader !== undefined ? { authorization: authHeader } : {},
    } as unknown as Request;
  }

  function make401Res(): Response & { _emit: (e: string) => void } {
    const handlers: Record<string, (() => void)[]> = {};
    return {
      statusCode: 401,
      on: (event: string, handler: () => void) => { (handlers[event] ??= []).push(handler); },
      _emit: (event: string) => { (handlers[event] ?? []).forEach((h) => h()); },
    } as unknown as Response & { _emit: (e: string) => void };
  }

  it('attributes 401 to username when token is expired but signature is valid and within 24 h', () => {
    const token = signTestAccessToken({ preferred_username: 'alice', expiredSecondsAgo: 30 });
    const req = make401Req(`Bearer ${token}`);
    const res = make401Res();
    auditMiddleware(req, res, vi.fn());
    res._emit('finish');
    expect(loggedEntries).toHaveLength(1);
    expect(loggedEntries[0].user).toBe('alice');
  });

  it('stays unauthenticated when token signature is invalid', () => {
    const token = signTestAccessToken({ preferred_username: 'eve', expiredSecondsAgo: 10 });
    // Corrupt the signature (last 4 chars → 'XXXX')
    const tampered = token.slice(0, -4) + 'XXXX';
    const req = make401Req(`Bearer ${tampered}`);
    const res = make401Res();
    auditMiddleware(req, res, vi.fn());
    res._emit('finish');
    expect(loggedEntries).toHaveLength(1);
    expect(loggedEntries[0].user).toBe('unauthenticated');
  });

  it('stays unauthenticated when token typ is refresh (not access)', () => {
    const token = signTestAccessToken({ preferred_username: 'bob', typ: 'refresh', expiredSecondsAgo: 5 });
    const req = make401Req(`Bearer ${token}`);
    const res = make401Res();
    auditMiddleware(req, res, vi.fn());
    res._emit('finish');
    expect(loggedEntries).toHaveLength(1);
    expect(loggedEntries[0].user).toBe('unauthenticated');
  });

  it('stays unauthenticated when token typ is challenge (not access)', () => {
    const token = signTestAccessToken({ preferred_username: 'carol', typ: 'challenge', expiredSecondsAgo: 5 });
    const req = make401Req(`Bearer ${token}`);
    const res = make401Res();
    auditMiddleware(req, res, vi.fn());
    res._emit('finish');
    expect(loggedEntries).toHaveLength(1);
    expect(loggedEntries[0].user).toBe('unauthenticated');
  });

  it('stays unauthenticated when token expired more than 24 h ago', () => {
    const token = signTestAccessToken({ preferred_username: 'dave', expiredHoursAgo: 25 });
    const req = make401Req(`Bearer ${token}`);
    const res = make401Res();
    auditMiddleware(req, res, vi.fn());
    res._emit('finish');
    expect(loggedEntries).toHaveLength(1);
    expect(loggedEntries[0].user).toBe('unauthenticated');
  });

  it('stays unauthenticated when no Authorization header is present on a 401', () => {
    const req = make401Req(undefined);
    const res = make401Res();
    auditMiddleware(req, res, vi.fn());
    res._emit('finish');
    expect(loggedEntries).toHaveLength(1);
    expect(loggedEntries[0].user).toBe('unauthenticated');
  });

  it('does NOT apply expired-claim attribution on non-401 responses', () => {
    const token = signTestAccessToken({ preferred_username: 'frank', expiredSecondsAgo: 10 });
    // req.auth absent but status 200 — should not attribute via expired claim
    const req = {
      originalUrl: '/api/fhir/bundles',
      method: 'GET',
      query: {},
      body: undefined,
      _capturedBody: undefined,
      auth: undefined,
      headers: { authorization: `Bearer ${token}` },
    } as unknown as Request;
    const handlers: Record<string, (() => void)[]> = {};
    const res = {
      statusCode: 200,
      on: (event: string, handler: () => void) => { (handlers[event] ??= []).push(handler); },
      _emit: (event: string) => { (handlers[event] ?? []).forEach((h) => h()); },
    } as unknown as Response & { _emit: (e: string) => void };
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries).toHaveLength(1);
    // No req.auth, no login path, not 401 → unauthenticated (not the token username)
    expect(loggedEntries[0].user).toBe('unauthenticated');
  });

  it('login-actor path takes precedence over expired-claim attribution on /api/auth/login 401', () => {
    // Login endpoint: body username wins (existing AUDIT-02 behaviour), not the Bearer token.
    const token = signTestAccessToken({ preferred_username: 'token-user', expiredSecondsAgo: 5 });
    const req = {
      originalUrl: '/api/auth/login',
      method: 'POST',
      query: {},
      body: { username: 'body-user', password: 'x' },
      _capturedBody: undefined,
      auth: undefined,
      headers: { authorization: `Bearer ${token}` },
    } as unknown as Request;
    const handlers: Record<string, (() => void)[]> = {};
    const res = {
      statusCode: 401,
      on: (event: string, handler: () => void) => { (handlers[event] ??= []).push(handler); },
      _emit: (event: string) => { (handlers[event] ?? []).forEach((h) => h()); },
    } as unknown as Response & { _emit: (e: string) => void };
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries).toHaveLength(1);
    expect(loggedEntries[0].user).toBe('body-user');
  });
});
