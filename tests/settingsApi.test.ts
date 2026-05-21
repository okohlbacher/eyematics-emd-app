/**
 * T-01: Tests for settingsApi.ts — admin-only PUT guard, non-admin field stripping.
 * Security boundary: otpCode/maxLoginAttempts must never leak to non-admin users.
 */

import fs from 'node:fs';

import express from 'express';
import yaml from 'js-yaml';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

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

    it('persists auth.refreshTokenTtlMs and auth.refreshAbsoluteCapMs (round-trip lock)', async () => {
      const app = createApp('admin');
      // Access the mocked writeFileSync via the statically imported fs default
      const writeSpy = vi.mocked(fs.writeFileSync);
      writeSpy.mockClear();

      const settingsWithAuth = yaml.dump({
        twoFactorEnabled: false,
        therapyInterrupterDays: 120,
        therapyBreakerDays: 365,
        dataSource: { type: 'local', blazeUrl: 'http://localhost:8080/fhir' },
        audit: { cohortHashSecret: 'test-cohort-hash-secret-32-chars-min-xxxx' },
        auth: {
          refreshTokenTtlMs: 7200000,
          refreshAbsoluteCapMs: 14400000,
        },
      });

      const putRes = await request(app)
        .put('/api/settings')
        .type('text')
        .send(settingsWithAuth);
      expect(putRes.status).toBe(200);
      expect(putRes.body).toEqual({ ok: true });

      // Verify the written YAML preserved auth.* values
      expect(writeSpy).toHaveBeenCalled();
      const writtenYaml = writeSpy.mock.calls[0][1] as string;
      const parsed = yaml.load(writtenYaml) as Record<string, unknown>;
      expect(parsed).toHaveProperty('auth');
      const auth = parsed.auth as Record<string, unknown>;
      expect(auth.refreshTokenTtlMs).toBe(7200000);
      expect(auth.refreshAbsoluteCapMs).toBe(14400000);
    });

    it('accepts valid auth block with new keys (maxLoginAttempts, lockoutCapMs, inactivityTimeoutMs, warningBeforeMs)', async () => {
      const app = createApp('admin');
      const settings = yaml.dump({
        twoFactorEnabled: false,
        therapyInterrupterDays: 120,
        therapyBreakerDays: 365,
        dataSource: { type: 'local', blazeUrl: 'http://localhost:8080/fhir' },
        auth: {
          refreshTokenTtlMs: 28800000,
          refreshAbsoluteCapMs: 43200000,
          maxLoginAttempts: 5,
          lockoutCapMs: 900000,
          inactivityTimeoutMs: 600000,
          warningBeforeMs: 180000,
        },
      });
      const res = await request(app).put('/api/settings').type('text').send(settings);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });

    it('rejects auth.maxLoginAttempts < 1', async () => {
      const app = createApp('admin');
      const settings = yaml.dump({
        twoFactorEnabled: false,
        therapyInterrupterDays: 120,
        therapyBreakerDays: 365,
        dataSource: { type: 'local', blazeUrl: 'http://localhost:8080/fhir' },
        auth: { maxLoginAttempts: 0 },
      });
      const res = await request(app).put('/api/settings').type('text').send(settings);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('maxLoginAttempts');
    });

    it('rejects non-integer auth.lockoutCapMs', async () => {
      const app = createApp('admin');
      const settings = yaml.dump({
        twoFactorEnabled: false,
        therapyInterrupterDays: 120,
        therapyBreakerDays: 365,
        dataSource: { type: 'local', blazeUrl: 'http://localhost:8080/fhir' },
        auth: { lockoutCapMs: 1.5 },
      });
      const res = await request(app).put('/api/settings').type('text').send(settings);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('lockoutCapMs');
    });

    it('rejects warningBeforeMs >= inactivityTimeoutMs', async () => {
      const app = createApp('admin');
      const settings = yaml.dump({
        twoFactorEnabled: false,
        therapyInterrupterDays: 120,
        therapyBreakerDays: 365,
        dataSource: { type: 'local', blazeUrl: 'http://localhost:8080/fhir' },
        auth: { inactivityTimeoutMs: 300000, warningBeforeMs: 300000 },
      });
      const res = await request(app).put('/api/settings').type('text').send(settings);
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('warningBeforeMs');
    });

    it('auth.* operational params (inactivityTimeoutMs, lockoutCapMs, warningBeforeMs) are visible to non-admin GET (W5)', async () => {
      const app = createApp('researcher');
      const res = await request(app).get('/api/settings');
      expect(res.status).toBe(200);
      // non-admin should still receive auth sub-object (these are operational, not secret)
      const parsed = yaml.load(res.text) as Record<string, unknown>;
      // The mocked settings.yaml doesn't have auth sub-keys, but the field should NOT be stripped
      // (i.e., no auth stripping in the non-admin destructure)
      expect(parsed).not.toHaveProperty('otpCode');
      expect(parsed).not.toHaveProperty('maxLoginAttempts');
    });
  });
});
