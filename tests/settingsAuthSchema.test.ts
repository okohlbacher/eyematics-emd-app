/**
 * Plan 20-01 / Task 2 — settings.yaml `auth:` namespace validator + getAuthSettings.
 *
 * Goes through the public PUT /api/settings surface to exercise the validator
 * end-to-end (mirrors tests/settingsApi.test.ts mocking pattern).
 */

import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../server/fhirApi.js', () => ({ invalidateFhirCache: vi.fn() }));
vi.mock('../server/initAuth.js', () => ({ updateAuthConfig: vi.fn() }));
vi.mock('../server/hashCohortId.js', () => ({ initHashCohortId: vi.fn() }));
vi.mock('../server/outcomesAggregateCache.js', () => ({
  initOutcomesAggregateCache: vi.fn(),
  invalidateAllAggregates: vi.fn(),
}));

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  // Default: a settings file with a valid auth: block — getAuthSettings tests
  // exercise this directly.
  const yaml = 'twoFactorEnabled: false\ntherapyInterrupterDays: 120\ntherapyBreakerDays: 365\ndataSource:\n  type: local\n  blazeUrl: "http://localhost:8080/fhir"\nauth:\n  refreshTokenTtlMs: 28800000\n  refreshAbsoluteCapMs: 43200000\n  refreshCookieSecure: true\n';
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn().mockReturnValue(true),
      readFileSync: vi.fn().mockReturnValue(yaml),
      writeFileSync: vi.fn(),
    },
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn().mockReturnValue(yaml),
    writeFileSync: vi.fn(),
  };
});

import { getAuthSettings, settingsApiRouter } from '../server/settingsApi';

function createApp(role = 'admin') {
  const app = express();
  app.use(express.text({ type: '*/*' }));
  app.use((req, _res, next) => {
    req.auth = { sub: 'admin', preferred_username: 'admin', role, centers: [], iat: 0, exp: 0 };
    next();
  });
  app.use('/api/settings', settingsApiRouter);
  return app;
}

const BASE_YAML =
  'twoFactorEnabled: false\n' +
  'therapyInterrupterDays: 120\n' +
  'therapyBreakerDays: 365\n' +
  'dataSource:\n  type: local\n  blazeUrl: "http://localhost:8080/fhir"\n';

describe('settings.yaml auth namespace — validateSettingsSchema (Phase 20)', () => {
  it('accepts a well-formed auth block (PUT 200)', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/settings')
      .set('Content-Type', 'text/yaml')
      .send(BASE_YAML + 'auth:\n  refreshTokenTtlMs: 28800000\n  refreshAbsoluteCapMs: 43200000\n  refreshCookieSecure: true\n');
    expect(res.status).toBe(200);
  });

  it('rejects refreshTokenTtlMs > refreshAbsoluteCapMs (D-24 invariant)', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/settings')
      .set('Content-Type', 'text/yaml')
      .send(BASE_YAML + 'auth:\n  refreshTokenTtlMs: 50000000\n  refreshAbsoluteCapMs: 43200000\n');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/refreshTokenTtlMs must be <=/);
  });

  it('rejects refreshTokenTtlMs <= 0', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/settings')
      .set('Content-Type', 'text/yaml')
      .send(BASE_YAML + 'auth:\n  refreshTokenTtlMs: 0\n');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/refreshTokenTtlMs must be a positive integer/);
  });

  it('rejects non-boolean refreshCookieSecure', async () => {
    const app = createApp();
    const res = await request(app)
      .put('/api/settings')
      .set('Content-Type', 'text/yaml')
      .send(BASE_YAML + 'auth:\n  refreshCookieSecure: "yes"\n');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/refreshCookieSecure must be a boolean/);
  });
});

describe('getAuthSettings() — reads settings.yaml at call time', () => {
  it('returns the auth block from settings.yaml', () => {
    const s = getAuthSettings();
    expect(s.refreshTokenTtlMs).toBe(28_800_000);
    expect(s.refreshAbsoluteCapMs).toBe(43_200_000);
    expect(s.refreshCookieSecure).toBe(true);
  });
});
