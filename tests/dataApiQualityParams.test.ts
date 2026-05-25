/**
 * Contract tests for qualityParams persistence in POST + GET /saved-searches (40-02-PLAN.md Task 2).
 *
 * TDD RED phase: written before production code changes.
 * Verifies: sanitizeQualityParams called on POST; quality_params persisted/mapped on GET.
 *
 * Reuses the harness from tests/dataApiSavedSearch.test.ts:
 * supertest + jwt makeToken + buildApp + dataDb mock.
 */

import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_SECRET = 'test-jwt-secret-for-quality-params-tests';

// ---------------------------------------------------------------------------
// Mock initAuth — no file I/O during tests
// ---------------------------------------------------------------------------

vi.mock('../server/initAuth.js', () => ({
  loadUsers: vi.fn(() => []),
  saveUsers: vi.fn(async () => {}),
  getJwtSecret: () => TEST_SECRET,
  getAuthConfig: () => ({ twoFactorEnabled: false, maxLoginAttempts: 5, otpCode: '123456' }),
  _migrateCenterIds: vi.fn((users: unknown[]) => ({ users, changed: false })),
}));

// ---------------------------------------------------------------------------
// Mock dataDb — capture addSavedSearch calls; control getSavedSearches
// ---------------------------------------------------------------------------

const addSavedSearchSpy = vi.fn();
const getSavedSearchesMock = vi.fn(() => []);

vi.mock('../server/dataDb.js', () => ({
  getQualityFlags: vi.fn(() => []),
  setQualityFlags: vi.fn(),
  getSavedSearches: getSavedSearchesMock,
  addSavedSearch: addSavedSearchSpy,
  removeSavedSearch: vi.fn(),
  getExcludedCases: vi.fn(() => []),
  setExcludedCases: vi.fn(),
  getReviewedCases: vi.fn(() => []),
  setReviewedCases: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock fhirApi — no center validation needed for these tests
// ---------------------------------------------------------------------------

vi.mock('../server/fhirApi.js', () => ({
  fhirApiRouter: express.Router(),
  invalidateFhirCache: vi.fn(),
  getCaseToCenter: vi.fn(() => new Map()),
  isBypass: vi.fn((role: string) => role === 'admin'),
  getOrgIdFromBundle: vi.fn(() => null),
  filterBundlesByCenters: vi.fn((bundles: unknown[]) => bundles),
  buildCaseIndex: vi.fn(() => new Map()),
}));

// ---------------------------------------------------------------------------
// Mock outcomesAggregateCache — prevents real cache init
// ---------------------------------------------------------------------------

vi.mock('../server/outcomesAggregateCache.js', () => ({
  invalidateByCohort: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

const { dataApiRouter } = await import('../server/dataApi.js');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeToken(username: string, role: string, centers: string[]): string {
  return jwt.sign(
    { sub: username, preferred_username: username, role, centers },
    TEST_SECRET,
    { algorithm: 'HS256', expiresIn: '10m' },
  );
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      try {
        req.auth = jwt.verify(header.slice(7), TEST_SECRET) as typeof req.auth;
      } catch {
        // ignore invalid tokens
      }
    }
    next();
  });
  app.use('/data', dataApiRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Contract tests
// ---------------------------------------------------------------------------

describe('POST /saved-searches — qualityParams sanitization + persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSavedSearchesMock.mockReturnValue([]);
  });

  // (a) qualityParams with a known + unknown key: only known key persisted
  it('(a) strips unknown keys from qualityParams before persistence', async () => {
    const app = buildApp();
    const token = makeToken('forscher1', 'researcher', ['org-uka']);

    const res = await request(app)
      .post('/data/saved-searches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Cohort A',
        filters: {},
        qualityParams: ['missingVisus', 'bogus'],
      });

    expect(res.status).toBe(201);
    expect(addSavedSearchSpy).toHaveBeenCalledOnce();
    const [, rowArg] = addSavedSearchSpy.mock.calls[0] as [string, { quality_params: string | null }];
    expect(rowArg.quality_params).toBe(JSON.stringify(['missingVisus']));
  });

  // (b) POST without qualityParams → quality_params persisted as null
  it('(b) POST without qualityParams persists null quality_params', async () => {
    const app = buildApp();
    const token = makeToken('forscher1', 'researcher', ['org-uka']);

    const res = await request(app)
      .post('/data/saved-searches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Cohort B',
        filters: {},
      });

    expect(res.status).toBe(201);
    expect(addSavedSearchSpy).toHaveBeenCalledOnce();
    const [, rowArg] = addSavedSearchSpy.mock.calls[0] as [string, { quality_params: string | null }];
    expect(rowArg.quality_params).toBeNull();
  });

  // (b2) POST with qualityParams as a non-array value → quality_params persisted as null
  it('(b2) POST with non-array qualityParams persists null quality_params', async () => {
    const app = buildApp();
    const token = makeToken('forscher1', 'researcher', ['org-uka']);

    const res = await request(app)
      .post('/data/saved-searches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Cohort B2',
        filters: {},
        qualityParams: 'missingVisus',
      });

    expect(res.status).toBe(201);
    expect(addSavedSearchSpy).toHaveBeenCalledOnce();
    const [, rowArg] = addSavedSearchSpy.mock.calls[0] as [string, { quality_params: string | null }];
    expect(rowArg.quality_params).toBeNull();
  });

  // (a2) POST response includes qualityParams for successful request with qualityParams
  it('(a2) POST response includes sanitized qualityParams in savedSearch', async () => {
    const app = buildApp();
    const token = makeToken('forscher1', 'researcher', ['org-uka']);

    const res = await request(app)
      .post('/data/saved-searches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Cohort A2',
        filters: {},
        qualityParams: ['visusJump', 'crtCritical'],
      });

    expect(res.status).toBe(201);
    const { savedSearch } = res.body as { savedSearch: { qualityParams?: string[] } };
    expect(savedSearch.qualityParams).toEqual(['visusJump', 'crtCritical']);
  });
});

describe('GET /saved-searches — qualityParams mapping from DB row', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // (c) Row with quality_params JSON → response includes qualityParams array
  it('(c) maps quality_params JSON from DB row to qualityParams in response', async () => {
    const app = buildApp();
    const token = makeToken('forscher1', 'researcher', ['org-uka']);

    getSavedSearchesMock.mockReturnValue([
      {
        id: 'search-001',
        name: 'My Cohort',
        created_at: '2026-01-01T00:00:00.000Z',
        filters: JSON.stringify({ diagnosis: ['AMD'] }),
        quality_params: JSON.stringify(['visusJump']),
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const res = await request(app)
      .get('/data/saved-searches')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { savedSearches } = res.body as { savedSearches: Array<{ qualityParams?: string[] }> };
    expect(savedSearches).toHaveLength(1);
    expect(savedSearches[0].qualityParams).toEqual(['visusJump']);
  });

  // (d) Row with quality_params null → response record has no qualityParams (undefined)
  it('(d) maps null quality_params to absent qualityParams in response (back-compat)', async () => {
    const app = buildApp();
    const token = makeToken('forscher1', 'researcher', ['org-uka']);

    getSavedSearchesMock.mockReturnValue([
      {
        id: 'search-002',
        name: 'Old Cohort',
        created_at: '2026-01-01T00:00:00.000Z',
        filters: JSON.stringify({}),
        quality_params: null,
        updated_at: '2026-01-01T00:00:00.000Z',
      },
    ]);

    const res = await request(app)
      .get('/data/saved-searches')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { savedSearches } = res.body as { savedSearches: Array<Record<string, unknown>> };
    expect(savedSearches).toHaveLength(1);
    // qualityParams must be absent (undefined → omitted from JSON response)
    expect(Object.prototype.hasOwnProperty.call(savedSearches[0], 'qualityParams')).toBe(false);
  });
});
