/**
 * T-06: Tests for auditApi.ts — admin-only export, non-admin auto-scoping.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { auditApiRouter } from '../server/auditApi';
import { initAuditDb, logAuditEntry } from '../server/auditDb';

let tmpDir: string;

function createApp(role: string, username = 'testuser') {
  const app = express();
  app.use((req, _res, next) => {
    req.auth = { sub: username, preferred_username: username, role, centers: [], iat: 0, exp: 0 };
    next();
  });
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

  describe('GET /api/audit/events/view-open — view-open beacon', () => {
    it('responds 204 with empty body when authenticated (user role)', async () => {
      const app = createApp('user');
      const res = await request(app).get('/api/audit/events/view-open?name=open_outcomes_view&cohort=abc');
      expect(res.status).toBe(204);
      expect(res.text).toBe('');
    });

    it('responds 204 for admin role too (no role gating)', async () => {
      const app = createApp('admin');
      const res = await request(app).get('/api/audit/events/view-open?name=open_outcomes_view&cohort=abc');
      expect(res.status).toBe(204);
      expect(res.text).toBe('');
    });

    it('accepts oversized filter query string without rejection', async () => {
      const app = createApp('user');
      const longFilter = encodeURIComponent(JSON.stringify({ centers: Array(20).fill('org-x') }));
      const res = await request(app).get(`/api/audit/events/view-open?name=open_outcomes_view&filter=${longFilter}`);
      expect(res.status).toBe(204);
    });

    it('POST to same URL returns 404 (no write route exists)', async () => {
      const app = createApp('user');
      const res = await request(app).post('/api/audit/events/view-open').send({});
      expect(res.status).toBe(404);
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
