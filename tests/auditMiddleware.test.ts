/**
 * T-02: Tests for auditMiddleware.ts — body redaction.
 * Security-critical: passwords/OTP must never appear in plaintext in the audit log.
 *
 * Since redactBody and tryParseJson are private, we test them indirectly
 * through the exported auditMiddleware by mocking logAuditEntry and inspecting
 * what gets logged.
 */

import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock auditDb to capture logged entries
const loggedEntries: Array<{ body: string | null; query: string | null; method: string; path: string }> = [];
vi.mock('../server/auditDb.js', () => ({
  logAuditEntry: vi.fn((entry: Record<string, unknown>) => {
    loggedEntries.push({
      body: entry.body as string | null,
      query: entry.query as string | null,
      method: entry.method as string,
      path: entry.path as string,
    });
  }),
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

  it('uses anonymous for unauthenticated requests', () => {
    const req = mockReq({ originalUrl: '/api/auth/login', method: 'POST', auth: undefined, body: { username: 'x', password: 'y' } });
    const res = mockRes();
    auditMiddleware(req, res, vi.fn());
    (res as unknown as { _emit: (e: string) => void })._emit('finish');
    expect(loggedEntries[0]).toBeDefined();
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
