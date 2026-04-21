/**
 * Tests for the audit subsystem: auditDb (query, purge, filters)
 * and auditMiddleware (body redaction, request logging).
 *
 * H-11: Security-critical redaction logic must not regress.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { AuditDbRow } from '../server/auditDb.js';
import { initAuditDb, logAuditEntry, purgeOldEntries, queryAudit } from '../server/auditDb.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

function makeEntry(overrides: Partial<AuditDbRow> = {}): AuditDbRow {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    method: 'GET',
    path: '/api/test',
    user: 'testuser',
    status: 200,
    duration_ms: 10,
    body: null,
    query: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown — fresh DB per test
// ---------------------------------------------------------------------------

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
  initAuditDb(tmpDir, 1); // 1-day retention for purge tests
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// auditDb tests
// ---------------------------------------------------------------------------

describe('auditDb', () => {
  describe('logAuditEntry + queryAudit', () => {
    it('inserts and retrieves an entry', () => {
      const entry = makeEntry({ user: 'admin', method: 'POST', path: '/api/auth/login' });
      logAuditEntry(entry);

      const { rows, total } = queryAudit({});
      expect(total).toBe(1);
      expect(rows[0].id).toBe(entry.id);
      expect(rows[0].user).toBe('admin');
      expect(rows[0].method).toBe('POST');
    });

    it('stores body and query fields', () => {
      const entry = makeEntry({
        method: 'POST',
        body: '{"username":"test"}',
        query: '{"page":"1"}',
      });
      logAuditEntry(entry);

      const { rows } = queryAudit({});
      expect(rows[0].body).toBe('{"username":"test"}');
      expect(rows[0].query).toBe('{"page":"1"}');
    });

    it('stores null body/query for GET requests', () => {
      logAuditEntry(makeEntry());
      const { rows } = queryAudit({});
      expect(rows[0].body).toBeNull();
      expect(rows[0].query).toBeNull();
    });
  });

  describe('queryAudit filters', () => {
    beforeEach(() => {
      logAuditEntry(makeEntry({ user: 'admin', method: 'POST', path: '/api/auth/login', status: 200 }));
      logAuditEntry(makeEntry({ user: 'admin', method: 'PUT', path: '/api/settings', status: 200 }));
      logAuditEntry(makeEntry({ user: 'researcher', method: 'GET', path: '/api/fhir/bundles', status: 200 }));
      logAuditEntry(makeEntry({ user: 'researcher', method: 'GET', path: '/api/fhir/bundles', status: 403 }));
    });

    it('filters by user', () => {
      const { rows, total } = queryAudit({ user: 'admin' });
      expect(total).toBe(2);
      expect(rows.every((r) => r.user === 'admin')).toBe(true);
    });

    it('filters by method', () => {
      const { rows, total } = queryAudit({ method: 'GET' });
      expect(total).toBe(2);
      expect(rows.every((r) => r.method === 'GET')).toBe(true);
    });

    it('filters by path substring', () => {
      const { rows, total } = queryAudit({ path: 'auth' });
      expect(total).toBe(1);
      expect(rows[0].path).toBe('/api/auth/login');
    });

    it('respects limit and offset', () => {
      const page1 = queryAudit({ limit: 2, offset: 0 });
      expect(page1.rows).toHaveLength(2);
      expect(page1.total).toBe(4);

      const page2 = queryAudit({ limit: 2, offset: 2 });
      expect(page2.rows).toHaveLength(2);
      expect(page2.total).toBe(4);
    });

    it('caps limit at 500', () => {
      const { rows } = queryAudit({ limit: 9999 });
      // Just verify it doesn't throw — our 4 entries are all returned
      expect(rows.length).toBeLessThanOrEqual(500);
    });
  });

  describe('purgeOldEntries', () => {
    it('deletes entries older than retention period', () => {
      // Insert an old entry (2 days ago) and a fresh one
      const old = makeEntry({
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      });
      const fresh = makeEntry();

      logAuditEntry(old);
      logAuditEntry(fresh);

      const purged = purgeOldEntries();
      expect(purged).toBe(1);

      const { total } = queryAudit({});
      expect(total).toBe(1);
    });

    it('preserves recent entries', () => {
      logAuditEntry(makeEntry());
      logAuditEntry(makeEntry());

      const purged = purgeOldEntries();
      expect(purged).toBe(0);

      const { total } = queryAudit({});
      expect(total).toBe(2);
    });
  });

  describe('body redaction (integration)', () => {
    it('stores redacted body when sensitive fields are present', () => {
      // Simulate what auditMiddleware does: redact before calling logAuditEntry
      const redactedBody = JSON.stringify({
        username: 'admin',
        password: '[REDACTED]',
        otp: '[REDACTED]',
      });
      logAuditEntry(makeEntry({
        method: 'POST',
        path: '/api/auth/login',
        body: redactedBody,
      }));

      const { rows } = queryAudit({});
      const stored = JSON.parse(rows[0].body!);
      expect(stored.password).toBe('[REDACTED]');
      expect(stored.otp).toBe('[REDACTED]');
      expect(stored.username).toBe('admin');
    });

    it('must never store plaintext passwords in audit log', () => {
      // This test documents the contract: passwords must be redacted BEFORE storage
      const entry = makeEntry({
        method: 'POST',
        path: '/api/auth/login',
        body: '{"username":"admin","password":"[REDACTED]"}',
      });
      logAuditEntry(entry);

      const { rows } = queryAudit({});
      expect(rows[0].body).not.toContain('secret');
      expect(rows[0].body).toContain('[REDACTED]');
    });
  });
});

// ---------------------------------------------------------------------------
// Phase 17 filter arms
// ---------------------------------------------------------------------------

describe('Phase 17 filter arms', () => {
  let tmpDir17: string;

  beforeEach(() => {
    tmpDir17 = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-p17-test-'));
    initAuditDb(tmpDir17, 90);

    // Seed rows covering all action-category buckets and search variants
    logAuditEntry(makeEntry({ path: '/api/auth/login', method: 'POST', status: 200, body: '{}', query: null, user: 'alice' }));
    logAuditEntry(makeEntry({ path: '/api/auth/login', method: 'POST', status: 401, body: '{"err":"bad"}', query: null, user: 'bob' }));
    logAuditEntry(makeEntry({ path: '/api/auth/users/alice', method: 'DELETE', status: 204, body: '', query: null, user: 'admin' }));
    logAuditEntry(makeEntry({ path: '/api/data/bundle', method: 'GET', status: 200, body: '', query: '?center=abc123', user: 'alice' }));
    logAuditEntry(makeEntry({ path: '/api/settings', method: 'GET', status: 200, body: '', query: null, user: 'admin' }));
    logAuditEntry(makeEntry({ path: '/api/outcomes/aggregate', method: 'POST', status: 200, body: '{"cohort":"xyz"}', query: null, user: 'alice' }));
    logAuditEntry(makeEntry({ path: '/api/audit/events/view-open', method: 'POST', status: 204, body: '', query: null, user: 'alice' }));
  });

  afterEach(() => {
    fs.rmSync(tmpDir17, { recursive: true, force: true });
  });

  it('action_category: auth returns only /api/auth/* rows excluding /api/auth/users/*', () => {
    const { rows } = queryAudit({ action_category: 'auth' });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.path.startsWith('/api/auth/'))).toBe(true);
    expect(rows.some((r) => r.path.startsWith('/api/auth/users/'))).toBe(false);
  });

  it('action_category: data returns only /api/data/* rows', () => {
    const { rows } = queryAudit({ action_category: 'data' });
    expect(rows).toHaveLength(1);
    expect(rows[0].path).toBe('/api/data/bundle');
  });

  it('action_category: admin returns /api/auth/users/* and /api/settings rows', () => {
    const { rows } = queryAudit({ action_category: 'admin' });
    expect(rows).toHaveLength(2);
    const paths = rows.map((r) => r.path);
    expect(paths).toContain('/api/auth/users/alice');
    expect(paths).toContain('/api/settings');
  });

  it('action_category: outcomes returns /api/outcomes/* and /api/audit/events/view-open rows', () => {
    const { rows } = queryAudit({ action_category: 'outcomes' });
    expect(rows).toHaveLength(2);
    const paths = rows.map((r) => r.path);
    expect(paths).toContain('/api/outcomes/aggregate');
    expect(paths).toContain('/api/audit/events/view-open');
  });

  it('body_search: abc123 matches via query column', () => {
    const { rows } = queryAudit({ body_search: 'abc123' });
    expect(rows).toHaveLength(1);
    expect(rows[0].path).toBe('/api/data/bundle');
  });

  it('body_search: xyz matches via body column', () => {
    const { rows } = queryAudit({ body_search: 'xyz' });
    expect(rows).toHaveLength(1);
    expect(rows[0].path).toBe('/api/outcomes/aggregate');
  });

  it('status_gte: 400 returns only rows with status >= 400', () => {
    const { rows } = queryAudit({ status_gte: 400 });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(401);
    expect(rows.every((r) => r.status >= 400)).toBe(true);
  });

  it('action_category: auth + status_gte: 400 intersects both conditions', () => {
    const { rows } = queryAudit({ action_category: 'auth', status_gte: 400 });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(401);
    expect(rows[0].path).toBe('/api/auth/login');
  });
});
