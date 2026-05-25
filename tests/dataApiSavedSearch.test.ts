/**
 * Contract tests for POST /saved-searches hardening (F-13, SEC-06, 40-01-PLAN.md Task 2).
 *
 * TDD RED phase: written before production code change.
 * Verifies: server-owned id/createdAt, filter sanitization, name/center/size validation.
 *
 * Reuses the harness pattern from tests/dataApiCenter.test.ts:
 * supertest + jwt makeToken + buildApp + dataDb mock.
 */

import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_SECRET = 'test-jwt-secret-for-saved-search-contract-tests';

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
// Mock dataDb — no SQLite during tests
// ---------------------------------------------------------------------------

const addSavedSearchSpy = vi.fn();

vi.mock('../server/dataDb.js', () => ({
  getQualityFlags: vi.fn(() => []),
  setQualityFlags: vi.fn(),
  getSavedSearches: vi.fn(() => []),
  addSavedSearch: addSavedSearchSpy,
  removeSavedSearch: vi.fn(),
  getExcludedCases: vi.fn(() => []),
  setExcludedCases: vi.fn(),
  getReviewedCases: vi.fn(() => []),
  setReviewedCases: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock fhirApi — control the case-to-center index
// ---------------------------------------------------------------------------

// case-uka-001 belongs to org-uka; case-ukc-001 belongs to org-ukc
const mockCaseIndex = new Map<string, string>([
  ['case-uka-001', 'org-uka'],
  ['case-ukc-001', 'org-ukc'],
]);

vi.mock('../server/fhirApi.js', () => ({
  fhirApiRouter: express.Router(),
  invalidateFhirCache: vi.fn(),
  getCaseToCenter: vi.fn(() => mockCaseIndex),
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

describe('POST /saved-searches — F-13 server-owned provenance + filter sanitization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // (a) Server ignores client-supplied id and createdAt
  it('(a) server ignores client-supplied id and createdAt; generates its own', async () => {
    const app = buildApp();
    const token = makeToken('forscher1', 'researcher', ['org-uka']);

    const res = await request(app)
      .post('/data/saved-searches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id: 'client-spoof',
        createdAt: '1999-01-01T00:00:00.000Z',
        name: 'My Search',
        filters: { centers: ['org-uka'] },
      });

    expect(res.status).toBe(201);
    const { savedSearch } = res.body as { savedSearch: { id: string; createdAt: string; name: string } };
    // Server must generate its own id
    expect(savedSearch.id).not.toBe('client-spoof');
    expect(savedSearch.id).toBeTruthy();
    // Server must generate its own createdAt (must be a valid ISO date, NOT 1999)
    expect(savedSearch.createdAt).not.toBe('1999-01-01T00:00:00.000Z');
    expect(new Date(savedSearch.createdAt).getFullYear()).toBeGreaterThanOrEqual(2024);
    expect(savedSearch.name).toBe('My Search');
  });

  // (b) Filter sanitization — unknown keys stripped before persistence
  it('(b) strips unknown filter keys before persistence (only known keys reach addSavedSearch)', async () => {
    const app = buildApp();
    const token = makeToken('forscher1', 'researcher', ['org-uka']);

    const res = await request(app)
      .post('/data/saved-searches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Filter Test',
        filters: { centers: ['org-uka'], evil: 'x', __proto__: {}, injected: 'payload' },
      });

    expect(res.status).toBe(201);
    // addSavedSearch must have been called with filters containing only 'centers', not 'evil'
    expect(addSavedSearchSpy).toHaveBeenCalledOnce();
    const [, rowArg] = addSavedSearchSpy.mock.calls[0] as [string, { filters: string }];
    const persistedFilters = JSON.parse(rowArg.filters) as Record<string, unknown>;
    expect(persistedFilters).toHaveProperty('centers');
    expect(persistedFilters).not.toHaveProperty('evil');
    expect(persistedFilters).not.toHaveProperty('__proto__');
    expect(persistedFilters).not.toHaveProperty('injected');
  });

  // (c) Missing name → 400
  it('(c) POST without name returns 400', async () => {
    const app = buildApp();
    const token = makeToken('forscher1', 'researcher', ['org-uka']);

    const res = await request(app)
      .post('/data/saved-searches')
      .set('Authorization', `Bearer ${token}`)
      .send({ filters: { centers: ['org-uka'] } });

    expect(res.status).toBe(400);
  });

  // (d) Blank name → 400
  it('(d) POST with blank name returns 400', async () => {
    const app = buildApp();
    const token = makeToken('forscher1', 'researcher', ['org-uka']);

    const res = await request(app)
      .post('/data/saved-searches')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: '   ', filters: {} });

    expect(res.status).toBe(400);
  });

  // (e) filters.flaggedCaseIds referencing a case in a center the user cannot access → 403
  // WR-01: flaggedCaseIds is the only whitelisted field that carries explicit case references.
  // caseIds/selectedCases are stripped by the sanitizer and are not validated.
  it('(e) POST with filters.flaggedCaseIds outside permitted center returns 403', async () => {
    const app = buildApp();
    // forscher1 only has org-uka; case-ukc-001 belongs to org-ukc
    const token = makeToken('forscher1', 'researcher', ['org-uka']);

    const res = await request(app)
      .post('/data/saved-searches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Bad Search',
        filters: { flaggedCaseIds: ['case-ukc-001'] },
      });

    expect(res.status).toBe(403);
  });

  // (e2) filters.caseIds (a non-whitelisted field) does NOT trigger 403 — it is stripped
  // by sanitizeSavedSearchFilters and never reaches the center-ownership check.
  it('(e2) POST with filters.caseIds (non-whitelisted) is stripped — returns 201', async () => {
    const app = buildApp();
    const token = makeToken('forscher1', 'researcher', ['org-uka']);

    const res = await request(app)
      .post('/data/saved-searches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Stripped Field Search',
        filters: { caseIds: ['case-ukc-001'] },
      });

    expect(res.status).toBe(201);
  });

  // (f) Valid POST with no client id/createdAt — still succeeds and returns server values
  it('(f) POST without client id/createdAt still returns 201 with server-generated values', async () => {
    const app = buildApp();
    const token = makeToken('forscher1', 'researcher', ['org-uka']);

    const res = await request(app)
      .post('/data/saved-searches')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Simple Search', filters: { diagnosis: ['AMD'] } });

    expect(res.status).toBe(201);
    const { savedSearch } = res.body as { savedSearch: { id: string; createdAt: string } };
    expect(typeof savedSearch.id).toBe('string');
    expect(savedSearch.id.length).toBeGreaterThan(0);
    expect(typeof savedSearch.createdAt).toBe('string');
    expect(new Date(savedSearch.createdAt).getTime()).not.toBeNaN();
  });
});
