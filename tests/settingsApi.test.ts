/**
 * T-01: Tests for settingsApi.ts — admin-only PUT guard, non-admin field stripping.
 * Security boundary: otpCode/maxLoginAttempts must never leak to non-admin users.
 */

import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import yaml from 'js-yaml';

// Mock dependencies
vi.mock('../server/fhirApi.js', () => ({ invalidateFhirCache: vi.fn() }));
vi.mock('../server/initAuth.js', () => ({ updateAuthConfig: vi.fn() }));

// Mock fs to return our test settings
// IN-08: the cohortHashSecret literal below is 41 chars; it MUST stay >=32 chars
// to satisfy hashCohortId init (server/hashCohortId.ts). Drifting below 32 would
// break any downstream PUT-time secret-length check added in a later phase.
vi.mock('node:fs', async () => {
  const yaml = 'twoFactorEnabled: false\notpCode: "999999"\nmaxLoginAttempts: 5\nprovider: local\ntherapyInterrupterDays: 120\ntherapyBreakerDays: 365\ndataSource:\n  type: local\n  blazeUrl: "http://localhost:8080/fhir"\naudit:\n  cohortHashSecret: "test-cohort-hash-secret-32-chars-min-xxxx"\n'; // >=32 chars to satisfy hashCohortId init
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
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

const VALID_YAML = 'twoFactorEnabled: false\notpCode: "999999"\nmaxLoginAttempts: 5\nprovider: local\ntherapyInterrupterDays: 120\ntherapyBreakerDays: 365\ndataSource:\n  type: local\n  blazeUrl: "http://localhost:8080/fhir"\naudit:\n  cohortHashSecret: "test-cohort-hash-secret-32-chars-min-xxxx"\n'; // >=32 chars to satisfy hashCohortId init

import { settingsApiRouter } from '../server/settingsApi';

function createApp(role: string, username = 'testuser') {
  const app = express();
  app.use(express.text({ type: '*/*' }));
  app.use((req, _res, next) => {
    req.auth = { sub: username, preferred_username: username, role, centers: [], iat: 0, exp: 0 };
    next();
  });
  app.use('/api/settings', settingsApiRouter);
  return app;
}

describe('settingsApi', () => {
  describe('GET /api/settings', () => {
    it('returns full settings including otpCode for admin', async () => {
      const app = createApp('admin');
      const res = await request(app).get('/api/settings');
      expect(res.status).toBe(200);
      const parsed = yaml.load(res.text) as Record<string, unknown>;
      expect(parsed).toHaveProperty('otpCode');
      expect(parsed).toHaveProperty('maxLoginAttempts');
      expect(parsed).toHaveProperty('provider');
    });

    it('strips otpCode, maxLoginAttempts, provider for non-admin', async () => {
      const app = createApp('researcher');
      const res = await request(app).get('/api/settings');
      expect(res.status).toBe(200);
      const parsed = yaml.load(res.text) as Record<string, unknown>;
      expect(parsed).not.toHaveProperty('otpCode');
      expect(parsed).not.toHaveProperty('maxLoginAttempts');
      expect(parsed).not.toHaveProperty('provider');
      // Non-sensitive fields should still be present
      expect(parsed).toHaveProperty('twoFactorEnabled');
      expect(parsed).toHaveProperty('therapyInterrupterDays');
    });

    it('strips audit.cohortHashSecret for non-admin (T-11-04)', async () => {
      const app = createApp('researcher');
      const res = await request(app).get('/api/settings');
      expect(res.status).toBe(200);
      const parsed = yaml.load(res.text) as Record<string, unknown>;
      const audit = parsed.audit as Record<string, unknown> | undefined;
      // Either audit is absent entirely (if it only held cohortHashSecret) OR present without cohortHashSecret
      if (audit !== undefined) {
        expect(audit).not.toHaveProperty('cohortHashSecret');
      }
    });

    it('returns audit.cohortHashSecret for admin (no stripping)', async () => {
      const app = createApp('admin');
      const res = await request(app).get('/api/settings');
      expect(res.status).toBe(200);
      const parsed = yaml.load(res.text) as Record<string, unknown>;
      expect(parsed).toHaveProperty('audit');
      const audit = parsed.audit as Record<string, unknown>;
      expect(audit).toHaveProperty('cohortHashSecret');
    });
  });

  describe('PUT /api/settings', () => {
    it('returns 403 for non-admin', async () => {
      const app = createApp('researcher');
      const res = await request(app)
        .put('/api/settings')
        .type('text')
        .send(VALID_YAML);
      expect(res.status).toBe(403);
    });

    it('accepts valid settings from admin', async () => {
      const app = createApp('admin');
      const res = await request(app)
        .put('/api/settings')
        .type('text')
        .send(VALID_YAML);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });

    it('rejects empty body', async () => {
      const app = createApp('admin');
      const res = await request(app)
        .put('/api/settings')
        .type('text')
        .send('');
      expect(res.status).toBe(400);
    });

    it('rejects invalid YAML', async () => {
      const app = createApp('admin');
      const res = await request(app)
        .put('/api/settings')
        .type('text')
        .send(': : invalid yaml {{');
      expect(res.status).toBe(400);
    });

    it('rejects invalid provider enum', async () => {
      const app = createApp('admin');
      const settings = yaml.dump({
        twoFactorEnabled: false,
        provider: 'ldap',
        therapyInterrupterDays: 120,
        therapyBreakerDays: 365,
        dataSource: { type: 'local', blazeUrl: 'http://localhost:8080/fhir' },
      });
      const res = await request(app)
        .put('/api/settings')
        .type('text')
        .send(settings);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('provider');
    });

    it('rejects invalid dataSource.type enum', async () => {
      const app = createApp('admin');
      const settings = yaml.dump({
        twoFactorEnabled: false,
        therapyInterrupterDays: 120,
        therapyBreakerDays: 365,
        dataSource: { type: 'postgres', blazeUrl: 'http://localhost:8080/fhir' },
      });
      const res = await request(app)
        .put('/api/settings')
        .type('text')
        .send(settings);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('dataSource.type');
    });
  });
});
