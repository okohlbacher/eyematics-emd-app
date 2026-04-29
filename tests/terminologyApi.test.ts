/**
 * Tests for server/terminologyApi.ts — terminology proxy endpoint.
 *
 * Phase 25 / Plan 02 (TERM-03, TERM-05). Mirrors the auditApi test pattern:
 * mount the router on an Express stub that pre-populates req.auth, so router
 * logic is tested independently of the JWT middleware. A separate suite
 * mounts the real authMiddleware to assert 401 on unauthenticated requests
 * (D-14 — JWT-protected like every other /api/* route).
 *
 * Settings are stubbed by mocking node:fs and js-yaml — same approach used
 * by tests/fhirApi.test.ts. The mocked YAML payload is set per-test via the
 * exported `__setSettings` helper.
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Settings stub — driven by a mutable record the tests update before each call
// ---------------------------------------------------------------------------

let mockSettings: Record<string, unknown> = {};

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn(() => '__settings_yaml__'),
    },
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn(() => '__settings_yaml__'),
  };
});

vi.mock('js-yaml', () => ({
  default: { load: vi.fn(() => mockSettings) },
  load: vi.fn(() => mockSettings),
}));

// ---------------------------------------------------------------------------
// Imports — AFTER mocks
// ---------------------------------------------------------------------------

import { _resetCacheForTests, terminologyRouter } from '../server/terminologyApi';

function createApp() {
  const app = express();
  app.use(express.json());
  // Stub auth so router logic runs (auth itself is exercised in the second suite below).
  app.use((req, _res, next) => {
    req.auth = { sub: 'u', preferred_username: 'u', role: 'researcher', centers: [], iat: 0, exp: 0 };
    next();
  });
  app.use('/api/terminology', terminologyRouter);
  return app;
}

const SNOMED = 'http://snomed.info/sct';
const CODE = '267718000';

beforeEach(() => {
  mockSettings = {};
  _resetCacheForTests();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Suite 1: router behavior
// ---------------------------------------------------------------------------

describe('terminologyApi router', () => {
  describe('disabled / 503', () => {
    it('returns 503 when terminology.enabled is false (default)', async () => {
      mockSettings = { terminology: { enabled: false, serverUrl: 'https://example.test/fhir' } };
      const res = await request(createApp())
        .post('/api/terminology/lookup')
        .send({ system: SNOMED, code: CODE });
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ error: 'terminology lookup disabled' });
    });

    it('returns 503 when enabled but serverUrl is unset', async () => {
      mockSettings = { terminology: { enabled: true } };
      const res = await request(createApp())
        .post('/api/terminology/lookup')
        .send({ system: SNOMED, code: CODE });
      expect(res.status).toBe(503);
      expect(res.body).toEqual({ error: 'terminology lookup disabled' });
    });

    it('returns 503 when terminology section is entirely missing', async () => {
      mockSettings = {};
      const res = await request(createApp())
        .post('/api/terminology/lookup')
        .send({ system: SNOMED, code: CODE });
      expect(res.status).toBe(503);
    });
  });

  describe('400 invalid body', () => {
    it('returns 400 when code is missing', async () => {
      mockSettings = { terminology: { enabled: true, serverUrl: 'https://example.test/fhir' } };
      const res = await request(createApp())
        .post('/api/terminology/lookup')
        .send({ system: SNOMED });
      expect(res.status).toBe(400);
    });

    it('returns 400 when system is missing', async () => {
      mockSettings = { terminology: { enabled: true, serverUrl: 'https://example.test/fhir' } };
      const res = await request(createApp())
        .post('/api/terminology/lookup')
        .send({ code: CODE });
      expect(res.status).toBe(400);
    });

    it('returns 400 when code is not a string', async () => {
      mockSettings = { terminology: { enabled: true, serverUrl: 'https://example.test/fhir' } };
      const res = await request(createApp())
        .post('/api/terminology/lookup')
        .send({ system: SNOMED, code: 12345 });
      expect(res.status).toBe(400);
    });
  });

  describe('200 remote lookup', () => {
    it('forwards to FHIR $lookup and returns {display, source: remote}', async () => {
      mockSettings = {
        terminology: { enabled: true, serverUrl: 'https://example.test/fhir', cacheTtlMs: 60000 },
      };
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          parameter: [
            { name: 'display', valueString: 'AMD' },
            { name: 'name', valueString: 'SNOMED CT' },
          ],
        }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const res = await request(createApp())
        .post('/api/terminology/lookup')
        .send({ system: SNOMED, code: CODE });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ display: 'AMD', system: SNOMED, code: CODE, source: 'remote' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const calledUrl = fetchMock.mock.calls[0][0] as string;
      expect(calledUrl).toContain('https://example.test/fhir/CodeSystem/$lookup');
      expect(calledUrl).toContain(`system=${encodeURIComponent(SNOMED)}`);
      expect(calledUrl).toContain(`code=${encodeURIComponent(CODE)}`);
    });
  });

  describe('cache', () => {
    it('returns source:cache on second request and does not re-fetch', async () => {
      mockSettings = {
        terminology: { enabled: true, serverUrl: 'https://example.test/fhir', cacheTtlMs: 60000 },
      };
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ parameter: [{ name: 'display', valueString: 'AMD' }] }),
      });
      vi.stubGlobal('fetch', fetchMock);

      const app = createApp();
      const r1 = await request(app)
        .post('/api/terminology/lookup')
        .send({ system: SNOMED, code: CODE });
      const r2 = await request(app)
        .post('/api/terminology/lookup')
        .send({ system: SNOMED, code: CODE });

      expect(r1.body.source).toBe('remote');
      expect(r2.status).toBe(200);
      expect(r2.body.source).toBe('cache');
      expect(r2.body.display).toBe('AMD');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('SSRF guard', () => {
    it('returns 502 ssrf blocked for private IP serverUrl (192.168/16)', async () => {
      mockSettings = {
        terminology: { enabled: true, serverUrl: 'http://192.168.1.5/fhir', cacheTtlMs: 60000 },
      };
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const res = await request(createApp())
        .post('/api/terminology/lookup')
        .send({ system: SNOMED, code: CODE });

      expect(res.status).toBe(502);
      expect(res.body).toEqual({ error: 'ssrf blocked' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 502 ssrf blocked for localhost serverUrl', async () => {
      mockSettings = {
        terminology: { enabled: true, serverUrl: 'http://localhost:8080/fhir', cacheTtlMs: 60000 },
      };
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const res = await request(createApp())
        .post('/api/terminology/lookup')
        .send({ system: SNOMED, code: CODE });

      expect(res.status).toBe(502);
      expect(res.body).toEqual({ error: 'ssrf blocked' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 502 ssrf blocked for 127.0.0.1', async () => {
      mockSettings = {
        terminology: { enabled: true, serverUrl: 'http://127.0.0.1/fhir', cacheTtlMs: 60000 },
      };
      vi.stubGlobal('fetch', vi.fn());
      const res = await request(createApp())
        .post('/api/terminology/lookup')
        .send({ system: SNOMED, code: CODE });
      expect(res.status).toBe(502);
      expect(res.body.error).toBe('ssrf blocked');
    });

    it('returns 502 ssrf blocked for 10.x private range', async () => {
      mockSettings = {
        terminology: { enabled: true, serverUrl: 'http://10.0.0.5/fhir', cacheTtlMs: 60000 },
      };
      vi.stubGlobal('fetch', vi.fn());
      const res = await request(createApp())
        .post('/api/terminology/lookup')
        .send({ system: SNOMED, code: CODE });
      expect(res.status).toBe(502);
    });
  });

  describe('remote failure', () => {
    it('returns 502 remote lookup failed when fetch rejects', async () => {
      mockSettings = {
        terminology: { enabled: true, serverUrl: 'https://example.test/fhir', cacheTtlMs: 60000 },
      };
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
      const res = await request(createApp())
        .post('/api/terminology/lookup')
        .send({ system: SNOMED, code: CODE });
      expect(res.status).toBe(502);
      expect(res.body).toEqual({ error: 'remote lookup failed' });
    });

    it('returns 502 when response has no display parameter', async () => {
      mockSettings = {
        terminology: { enabled: true, serverUrl: 'https://example.test/fhir', cacheTtlMs: 60000 },
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ parameter: [{ name: 'name', valueString: 'SNOMED CT' }] }),
      }));
      const res = await request(createApp())
        .post('/api/terminology/lookup')
        .send({ system: SNOMED, code: CODE });
      expect(res.status).toBe(502);
    });
  });
});

// ---------------------------------------------------------------------------
// Suite 2: JWT auth via global authMiddleware (Test D — D-14)
// ---------------------------------------------------------------------------

vi.mock('../server/initAuth.js', () => ({
  getJwtSecret: () => 'test-secret-for-terminology',
}));
vi.mock('../server/keycloakAuth.js', () => ({
  getAuthProvider: () => 'local',
  getJwksClient: () => null,
}));

describe('terminologyApi auth gating (D-14)', () => {
  it('returns 401 when no Bearer token is supplied', async () => {
    const { authMiddleware } = await import('../server/authMiddleware');
    const app = express();
    app.use(express.json());
    app.use('/api', authMiddleware);
    app.use('/api/terminology', terminologyRouter);

    const res = await request(app)
      .post('/api/terminology/lookup')
      .send({ system: SNOMED, code: CODE });

    expect(res.status).toBe(401);
  });

  it('passes the route when a valid Bearer token is supplied', async () => {
    mockSettings = { terminology: { enabled: false } };
    const { authMiddleware } = await import('../server/authMiddleware');
    const app = express();
    app.use(express.json());
    app.use('/api', authMiddleware);
    app.use('/api/terminology', terminologyRouter);

    const token = jwt.sign(
      { typ: 'access', sub: 'u', preferred_username: 'u', role: 'researcher', centers: [] },
      'test-secret-for-terminology',
      { algorithm: 'HS256', expiresIn: '10m' },
    );

    const res = await request(app)
      .post('/api/terminology/lookup')
      .set('Authorization', `Bearer ${token}`)
      .send({ system: SNOMED, code: CODE });

    // Auth passed → router runs → 503 because terminology disabled.
    expect(res.status).toBe(503);
  });
});
