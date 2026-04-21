/**
 * Tests for data API center validation logic in server/dataApi.ts.
 *
 * TDD: Written BEFORE production code modification (RED phase).
 * All 5 behavior specs from 05-01-PLAN.md Task 2.
 *
 * Tests PUT /quality-flags center validation and POST /saved-searches center validation.
 */

import type { NextFunction,Request, Response } from 'express';
import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_SECRET = 'test-jwt-secret-for-center-validation-tests';

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

const mockQualityFlags: unknown[] = [];

vi.mock('../server/dataDb.js', () => ({
  getQualityFlags: vi.fn(() => mockQualityFlags),
  setQualityFlags: vi.fn(),
  getSavedSearches: vi.fn(() => []),
  addSavedSearch: vi.fn(),
  removeSavedSearch: vi.fn(),
  getExcludedCases: vi.fn(() => []),
  setExcludedCases: vi.fn(),
  getReviewedCases: vi.fn(() => []),
  setReviewedCases: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock fhirApi — control the case-to-center index
// ---------------------------------------------------------------------------

// Case index: case-uka-001 belongs to org-uka, case-ukc-001 belongs to org-ukc, case-ukd-001 belongs to org-ukd
const mockCaseIndex = new Map<string, string>([
  ['case-uka-001', 'org-uka'],
  ['case-ukc-001', 'org-ukc'],
  ['case-ukd-001', 'org-ukd'],
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
  // Simulate authMiddleware by decoding JWT from Authorization header
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
// Tests
// ---------------------------------------------------------------------------

// Import mocked fhirApi module reference for resetting mock values
const fhirApiMock = await import('../server/fhirApi.js');

describe('dataApi — center validation for write operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset getCaseToCenter to return the mock index by default
    vi.mocked(fhirApiMock.getCaseToCenter).mockReturnValue(mockCaseIndex);
  });

  // Test 1: PUT /quality-flags with caseId in user's permitted center — succeeds (200)
  it('Test 1: PUT /quality-flags with caseId in permitted center succeeds', async () => {
    const app = buildApp();
    const token = makeToken('forscher1', 'researcher', ['org-uka']);

    const res = await request(app)
      .put('/data/quality-flags')
      .set('Authorization', `Bearer ${token}`)
      .send({
        qualityFlags: [
          {
            caseId: 'case-uka-001',
            parameter: 'visus',
            errorType: 'outlier',
            status: 'open',
          },
        ],
      });

    expect(res.status).toBe(200);
  });

  // Test 2: PUT /quality-flags with caseId outside user's permitted center — returns 403
  it('Test 2: PUT /quality-flags with caseId outside permitted center returns 403', async () => {
    const app = buildApp();
    // forscher1 only has org-uka, but case-ukc-001 belongs to org-ukc
    const token = makeToken('forscher1', 'researcher', ['org-uka']);

    const res = await request(app)
      .put('/data/quality-flags')
      .set('Authorization', `Bearer ${token}`)
      .send({
        qualityFlags: [
          {
            caseId: 'case-ukc-001',
            parameter: 'visus',
            errorType: 'outlier',
            status: 'open',
          },
        ],
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not accessible/i);
  });

  // Test 3: PUT /quality-flags by admin with any caseId — succeeds (bypass)
  it('Test 3: PUT /quality-flags by admin bypasses center validation', async () => {
    const app = buildApp();
    const token = makeToken('admin', 'admin', ['org-uka', 'org-ukc', 'org-ukd', 'org-ukg', 'org-ukl', 'org-ukmz', 'org-ukt']);

    const res = await request(app)
      .put('/data/quality-flags')
      .set('Authorization', `Bearer ${token}`)
      .send({
        qualityFlags: [
          {
            caseId: 'case-ukc-001',
            parameter: 'visus',
            errorType: 'outlier',
            status: 'open',
          },
        ],
      });

    expect(res.status).toBe(200);
  });

  // Test 4: POST /saved-searches with filters referencing permitted cases — succeeds
  it('Test 4: POST /saved-searches with filters for permitted cases succeeds', async () => {
    const app = buildApp();
    const token = makeToken('forscher1', 'researcher', ['org-uka']);

    const res = await request(app)
      .post('/data/saved-searches')
      .set('Authorization', `Bearer ${token}`)
      .send({
        id: 'search-001',
        name: 'Test Search',
        filters: {
          caseIds: ['case-uka-001'],
          centers: ['org-uka'],
        },
      });

    expect(res.status).toBe(201);
  });

  // Test 5: PUT /quality-flags with unknown caseId (not in FHIR cache) — rejected (H-10)
  it('Test 5: PUT /quality-flags with unknown caseId (not in cache) is rejected', async () => {
    const app = buildApp();
    // unknown-case-999 is not in mockCaseIndex — strict validation rejects it
    const token = makeToken('forscher1', 'researcher', ['org-uka']);

    const res = await request(app)
      .put('/data/quality-flags')
      .set('Authorization', `Bearer ${token}`)
      .send({
        qualityFlags: [
          {
            caseId: 'unknown-case-999',
            parameter: 'visus',
            errorType: 'outlier',
            status: 'open',
          },
        ],
      });

    expect(res.status).toBe(403);
  });
});
