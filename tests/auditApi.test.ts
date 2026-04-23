/**
 * T-06: Tests for auditApi.ts — admin-only export, non-admin auto-scoping.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { auditApiRouter } from '../server/auditApi';
import { initAuditDb, logAuditEntry, queryAudit } from '../server/auditDb';
import { _resetForTesting as _resetHashCohortId,initHashCohortId } from '../server/hashCohortId';

let tmpDir: string;

function createApp(role: string, username = 'testuser') {
  const app = express();
  app.use((req, _res, next) => {
    req.auth = { sub: username, preferred_username: username, role, centers: [], iat: 0, exp: 0 };
    next();
  });
  // Phase 11: scoped JSON parser for the beacon route (mirrors server/index.ts)
  app.use('/api/audit/events/view-open', express.json({ limit: '16kb' }));
  app.use('/api/audit', auditApiRouter);
  return app;
}

function seedEntries() {
  logAuditEntry({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    method: 'POST',
    path: '/api/auth/login',
    user: 'admin',
    status: 200,
    duration_ms: 50,
    body: null,
    query: null,
  });
  logAuditEntry({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    method: 'GET',
    path: '/api/fhir/bundles',
    user: 'researcher',
    status: 200,
    duration_ms: 100,
    body: null,
    query: null,
  });
  logAuditEntry({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    method: 'PUT',
    path: '/api/settings',
    user: 'admin',
    status: 200,
    duration_ms: 30,
    body: null,
    query: null,
  });
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auditapi-test-'));
  initAuditDb(tmpDir);
  _resetHashCohortId();
  initHashCohortId({ audit: { cohortHashSecret: 'x'.repeat(64) } });
  seedEntries();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('auditApi', () => {
  describe('GET /api/audit', () => {
    it('admin sees all entries', async () => {
      const app = createApp('admin');
      const res = await request(app).get('/api/audit');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
      expect(res.body.entries).toHaveLength(3);
    });

    it('non-admin sees only own entries (auto-scoping)', async () => {
      const app = createApp('researcher', 'researcher');
      const res = await request(app).get('/api/audit');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.entries[0].user).toBe('researcher');
    });

    it('supports limit and offset', async () => {
      const app = createApp('admin');
      const res = await request(app).get('/api/audit?limit=1&offset=0');
      expect(res.status).toBe(200);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.total).toBe(3);
      expect(res.body.limit).toBe(1);
      expect(res.body.offset).toBe(0);
    });

    it('supports method filter', async () => {
      const app = createApp('admin');
      const res = await request(app).get('/api/audit?method=POST');
      expect(res.status).toBe(200);
      expect(res.body.entries.every((e: { method: string }) => e.method === 'POST')).toBe(true);
    });

    it('admin can filter by user', async () => {
      const app = createApp('admin');
      const res = await request(app).get('/api/audit?user=researcher');
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
    });
  });

  describe('POST /api/audit/events/view-open — hashed beacon (Phase 11 / CRREV-01)', () => {
    it('responds 204 with empty body for an authenticated user', async () => {
      const app = createApp('researcher', 'researcher');
      const res = await request(app)
        .post('/api/audit/events/view-open')
        .send({ name: 'open_outcomes_view' });
      expect(res.status).toBe(204);
      expect(res.text).toBe('');
    });

    it('writes audit row with cohortHash (16 hex) and NO raw cohortId anywhere (D-11 / T-11-01)', async () => {
      const app = createApp('researcher', 'researcher');
      const res = await request(app)
        .post('/api/audit/events/view-open')
        .send({ name: 'open_outcomes_view', cohortId: 'saved-search-xyz', filter: { diagnosis: ['AMD'] } });
      expect(res.status).toBe(204);

      const { rows } = queryAudit({ path: '/api/audit/events/view-open' });
      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row.method).toBe('POST');
      expect(row.path).toBe('/api/audit/events/view-open');
      expect(row.user).toBe('researcher');
      expect(row.query).toBeNull();

      // Raw id absence — the core security assertion
      expect(row.body).not.toContain('saved-search-xyz');

      // Parsed body shape
      expect(row.body).not.toBeNull();
      const parsed = JSON.parse(row.body!);
      expect(parsed.name).toBe('open_outcomes_view');
      expect(parsed.cohortHash).toMatch(/^[0-9a-f]{16}$/);
      expect(parsed.filter).toEqual({ diagnosis: ['AMD'] });
      expect(parsed).not.toHaveProperty('cohortId');
    });

    it('records cohortHash: null when no cohortId is sent', async () => {
      const app = createApp('researcher', 'researcher');
      const res = await request(app)
        .post('/api/audit/events/view-open')
        .send({ name: 'open_outcomes_view' });
      expect(res.status).toBe(204);

      const { rows } = queryAudit({ path: '/api/audit/events/view-open' });
      expect(rows).toHaveLength(1);
      const parsed = JSON.parse(rows[0].body!);
      expect(parsed.cohortHash).toBeNull();
    });

    it('preserves filter payload verbatim without hashing (D-08)', async () => {
      const app = createApp('researcher', 'researcher');
      await request(app)
        .post('/api/audit/events/view-open')
        .send({ name: 'open_outcomes_view', filter: { centers: ['org-uka', 'org-ukc'] } });
      const { rows } = queryAudit({ path: '/api/audit/events/view-open' });
      const parsed = JSON.parse(rows[0].body!);
      expect(parsed.filter).toEqual({ centers: ['org-uka', 'org-ukc'] });
    });

    it('GET /api/audit/events/view-open returns 404 (legacy route removed)', async () => {
      const app = createApp('researcher', 'researcher');
      const res = await request(app).get('/api/audit/events/view-open?cohort=abc');
      expect(res.status).toBe(404);
    });

    it('rejects body larger than 16 KiB with 413', async () => {
      const app = createApp('researcher', 'researcher');
      const big = 'x'.repeat(32 * 1024);
      const res = await request(app)
        .post('/api/audit/events/view-open')
        .send({ name: 'open_outcomes_view', filter: { blob: big } });
      expect(res.status).toBe(413);
    });
  });

  describe('GET /api/audit/export', () => {
    it('returns 403 for non-admin', async () => {
      const app = createApp('researcher', 'researcher');
      const res = await request(app).get('/api/audit/export');
      expect(res.status).toBe(403);
    });

    it('returns all entries for admin', async () => {
      const app = createApp('admin');
      const res = await request(app).get('/api/audit/export');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('entries');
      expect(res.body.entries).toHaveLength(3);
      expect(res.headers['content-disposition']).toContain('attachment');
    });
  });
});

describe('Phase 17 audit API params', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auditapi-p17-test-'));
    initAuditDb(tmpDir);
    _resetHashCohortId();
    initHashCohortId({ audit: { cohortHashSecret: 'x'.repeat(64) } });
    // Seed entries covering auth, data, admin, outcomes categories + needle body
    const entries = [
      { path: '/api/auth/login', method: 'POST', status: 200, body: null, query: null, user: 'admin' },
      { path: '/api/auth/login', method: 'POST', status: 401, body: '{"err":"bad"}', query: null, user: 'bob' },
      { path: '/api/auth/users/alice', method: 'DELETE', status: 204, body: null, query: null, user: 'admin' },
      { path: '/api/data/bundle', method: 'GET', status: 200, body: null, query: '?center=abc123', user: 'researcher' },
      { path: '/api/settings', method: 'GET', status: 200, body: null, query: null, user: 'admin' },
      { path: '/api/outcomes/aggregate', method: 'POST', status: 200, body: '{"needle":"found"}', query: null, user: 'researcher' },
      { path: '/api/audit/events/view-open', method: 'POST', status: 204, body: null, query: null, user: 'researcher' },
    ];
    for (const e of entries) {
      logAuditEntry({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), duration_ms: 10, ...e });
    }
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('action_category=auth returns only auth rows', async () => {
    const app = createApp('admin');
    const res = await request(app).get('/api/audit?action_category=auth');
    expect(res.status).toBe(200);
    for (const entry of res.body.entries) {
      expect(entry.path.startsWith('/api/auth/')).toBe(true);
    }
  });

  it('action_category=invalid does not cause 500', async () => {
    const app = createApp('admin');
    const res = await request(app).get('/api/audit?action_category=invalid');
    expect(res.status).not.toBe(500);
  });

  it('status_gte=400 returns only rows with status>=400', async () => {
    const app = createApp('admin');
    const res = await request(app).get('/api/audit?status_gte=400');
    expect(res.status).toBe(200);
    for (const entry of res.body.entries) {
      expect(entry.status).toBeGreaterThanOrEqual(400);
    }
  });

  it('status_gte=notanumber does not cause 500', async () => {
    const app = createApp('admin');
    const res = await request(app).get('/api/audit?status_gte=notanumber');
    expect(res.status).not.toBe(500);
  });

  it('body_search=needle returns rows containing needle', async () => {
    const app = createApp('admin');
    const res = await request(app).get('/api/audit?body_search=needle');
    expect(res.status).toBe(200);
    const paths = res.body.entries.map((e: { path: string }) => e.path);
    expect(paths).toContain('/api/outcomes/aggregate');
  });

  it('non-admin auto-scope preserved with new filter params', async () => {
    const app = createApp('researcher', 'researcher');
    const res = await request(app).get('/api/audit?action_category=auth');
    expect(res.status).toBe(200);
    for (const entry of res.body.entries) {
      expect(entry.user).toBe('researcher');
    }
  });
});

describe('Phase 17 audit API — H6 input validation', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'auditapi-h6-test-'));
    initAuditDb(tmpDir);
    _resetHashCohortId();
    initHashCohortId({ audit: { cohortHashSecret: 'x'.repeat(64) } });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rejects fromTime that is not ISO 8601 with 400', async () => {
    const app = createApp('admin');
    const res = await request(app).get('/api/audit?fromTime=not-a-date');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/fromTime/);
  });

  it('rejects toTime that is not ISO 8601 with 400', async () => {
    const app = createApp('admin');
    const res = await request(app).get('/api/audit?toTime=garbage');
    expect(res.status).toBe(400);
  });

  it('accepts date-only ISO 8601 for fromTime/toTime', async () => {
    const app = createApp('admin');
    const res = await request(app).get('/api/audit?fromTime=2026-01-01&toTime=2026-12-31');
    expect(res.status).toBe(200);
  });

  it('accepts full ISO 8601 with timezone for fromTime', async () => {
    const app = createApp('admin');
    const res = await request(app).get('/api/audit?fromTime=2026-04-21T10:15:30Z');
    expect(res.status).toBe(200);
  });

  it('rejects body_search for non-admin with 403', async () => {
    const app = createApp('researcher', 'researcher');
    const res = await request(app).get('/api/audit?body_search=secret');
    expect(res.status).toBe(403);
  });

  it('rejects body_search longer than 128 chars with 400', async () => {
    const app = createApp('admin');
    const long = 'a'.repeat(129);
    const res = await request(app).get(`/api/audit?body_search=${long}`);
    expect(res.status).toBe(400);
  });

  it('rejects body_search containing % wildcard with 400', async () => {
    const app = createApp('admin');
    const res = await request(app).get('/api/audit?body_search=%25secret%25');
    expect(res.status).toBe(400);
  });

  it('rejects body_search containing _ wildcard with 400', async () => {
    const app = createApp('admin');
    const res = await request(app).get('/api/audit?body_search=foo_bar');
    expect(res.status).toBe(400);
  });

  it('accepts well-formed body_search from admin', async () => {
    const app = createApp('admin');
    const res = await request(app).get('/api/audit?body_search=needle');
    expect(res.status).toBe(200);
  });

  it('ignores status_gte outside [100, 599]', async () => {
    const app = createApp('admin');
    // status_gte=0 would match everything — ignored, so total matches unfiltered total
    const unbounded = await request(app).get('/api/audit');
    const outOfRange = await request(app).get('/api/audit?status_gte=0');
    expect(outOfRange.status).toBe(200);
    expect(outOfRange.body.total).toBe(unbounded.body.total);
  });

  it('accepts status_gte within [100, 599]', async () => {
    const app = createApp('admin');
    const res = await request(app).get('/api/audit?status_gte=400');
    expect(res.status).toBe(200);
  });
});
