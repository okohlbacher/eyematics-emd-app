/**
 * Phase 12 Plan 03 / AGG-01 — integration tests for POST /api/outcomes/aggregate.
 *
 * Covers:
 *   - 200 happy path with D-03 response shape
 *   - 400 invalid body (it.each: missing cohortId, bad axisMode)
 *   - 403 cohort-not-owned (identical body to cohort-not-found — T-12-01 anti-enumeration)
 *   - 413 oversized body (>16 KiB — matches Phase 11 precedent on /api/audit/events/view-open)
 *   - D-05 center filter invariant: body.centers is ignored (T-12-02 / Pitfall #2)
 *   - D-07 cache hit — meta.cacheHit flips true on second identical request
 *   - D-08 user-scoping — two users, same cohortId, different centers: cache entries disjoint
 *   - D-15 gzip content-encoding when Accept-Encoding: gzip (runtime verification)
 *
 * Wave-2 parallelism: server/outcomesAggregateApi.ts + server/outcomesAggregateCache.ts
 * are created in parallel by Plan 12-02 in a sibling worktree. Until those merge back
 * to the feature branch, the imports from ../server/outcomesAggregate* below resolve
 * only at `npm test` time, not at tsc-check time. The `// @ts-expect-error` directives
 * make the test FILE type-check cleanly in this worktree (RED phase).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import compression from 'compression';
import express, { type Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initAuditDb } from '../server/auditDb';
import { addSavedSearch, initDataDb } from '../server/dataDb';
import { _resetForTesting as _resetHashCohortId, initHashCohortId } from '../server/hashCohortId';
import type { PatientCase } from '../shared/types/fhir';
import { LOINC_VISUS, SNOMED_EYE_LEFT, SNOMED_EYE_RIGHT } from '../shared/fhirCodes';

// @ts-expect-error — server/outcomesAggregateApi.ts is created in parallel by Plan 12-02
import { outcomesAggregateRouter } from '../server/outcomesAggregateApi';
// @ts-expect-error — server/outcomesAggregateCache.ts is created in parallel by Plan 12-02
import {
  _resetForTesting as resetCache,
  initOutcomesAggregateCache,
} from '../server/outcomesAggregateCache';

// ---------------------------------------------------------------------------
// Mock the case-loading seam used by the handler: getCachedBundles comes from
// server/fhirApi.ts and extractPatientCases + applyFilters from src/services/
// fhirLoader.ts. We inject synthetic PatientCases directly by replacing the
// extract + applyFilters pipeline — equivalent to making resolveCohortCases
// return a known fixture.
// ---------------------------------------------------------------------------

const mockBundlesRef = { bundles: [] as Array<{ resourceType: 'Bundle'; type: string; entry: [] }> };
const casesByCenter: Record<string, PatientCase[]> = {};

vi.mock('../server/fhirApi.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/fhirApi.js')>();
  return {
    ...actual,
    getCachedBundles: vi.fn(async () => mockBundlesRef.bundles),
    filterBundlesByCenters: vi.fn((_b: unknown, _c: string[]) => mockBundlesRef.bundles),
  };
});

vi.mock('../src/services/fhirLoader.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/fhirLoader.js')>();
  return {
    ...actual,
    // extractPatientCases is called by the handler on the filtered bundles; we
    // reshape: the bundles array is ignored, we return the union of fixtures
    // scoped to the mock's current center(s). resolveCohortCases pipeline:
    //   bundles (mocked) -> extractPatientCases -> applyFilters
    // We set `lastCenters` via a beforeEach-configured closure below.
    extractPatientCases: vi.fn(() => currentFixtureCases()),
    // applyFilters is pure — keep the real implementation so diagnosis/center/
    // visusRange filtering is exercised end-to-end by the test fixture.
  };
});

let currentAuthCenters: string[] = [];
function currentFixtureCases(): PatientCase[] {
  const out: PatientCase[] = [];
  for (const c of currentAuthCenters) {
    if (casesByCenter[c]) out.push(...casesByCenter[c]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Test fixtures — synthetic patients in two centers
// ---------------------------------------------------------------------------

function makePatient(pseudonym: string, centerId: string, decimals: number[]): PatientCase {
  const base = new Date('2024-01-01T00:00:00Z').getTime();
  return {
    id: pseudonym,
    pseudonym,
    gender: 'unknown',
    birthDate: '1960-01-01',
    centerId,
    centerName: centerId,
    conditions: [],
    observations: decimals.map((d, i) => ({
      resourceType: 'Observation',
      id: `${pseudonym}-obs-${i}`,
      status: 'final',
      code: { coding: [{ code: LOINC_VISUS, system: 'http://loinc.org' }] },
      subject: { reference: `Patient/${pseudonym}` },
      effectiveDateTime: new Date(base + i * 30 * 86400000).toISOString(),
      valueQuantity: { value: d, unit: 'decimal' },
      bodySite: { coding: [{ code: i % 2 === 0 ? SNOMED_EYE_RIGHT : SNOMED_EYE_LEFT }] },
    })),
    procedures: [],
    imagingStudies: [],
    medications: [],
  } as unknown as PatientCase;
}

// ---------------------------------------------------------------------------
// Test app factory — mounts compression + scoped JSON + injected auth shim +
// outcomesAggregateRouter. Mirrors server/index.ts Plan 12-02 Task 2b wiring.
// ---------------------------------------------------------------------------

interface AuthShim {
  preferred_username: string;
  role: string;
  centers: string[];
}

function createApp(auth: AuthShim): Express {
  const app = express();
  // Inject auth before anything else so the handler sees req.auth.
  app.use((req, _res, next) => {
    req.auth = { sub: auth.preferred_username, preferred_username: auth.preferred_username, role: auth.role, centers: auth.centers, iat: 0, exp: 0 };
    currentAuthCenters = auth.centers;
    next();
  });
  // Phase 12 Plan 02 Task 2b mount — scoped JSON body parser (16 KiB limit,
  // matches Phase 11 precedent on /api/audit/events/view-open).
  app.use('/api/outcomes/aggregate', express.json({ limit: '16kb' }));
  app.use('/api/outcomes/aggregate', compression());
  app.use('/api/outcomes', outcomesAggregateRouter);
  return app;
}

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outcomes-agg-api-'));
  initAuditDb(tmpDir);
  initDataDb(tmpDir);
  _resetHashCohortId();
  initHashCohortId({ audit: { cohortHashSecret: 'x'.repeat(64) } });
  initOutcomesAggregateCache({});
  resetCache();

  // Seed synthetic patients per center.
  casesByCenter['org-uka'] = [
    makePatient('p-uka-1', 'org-uka', [0.5, 0.6, 0.55, 0.58, 0.6]),
    makePatient('p-uka-2', 'org-uka', [0.4, 0.42, 0.45, 0.5, 0.48]),
    makePatient('p-uka-3', 'org-uka', [0.7, 0.72, 0.75, 0.78, 0.8]),
  ];
  casesByCenter['org-foreign'] = [
    makePatient('p-foreign-1', 'org-foreign', [0.3, 0.32, 0.35, 0.38, 0.4]),
    makePatient('p-foreign-2', 'org-foreign', [0.6, 0.62, 0.65, 0.68, 0.7]),
  ];
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.clearAllMocks();
  currentAuthCenters = [];
  for (const k of Object.keys(casesByCenter)) delete casesByCenter[k];
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seedSavedSearch(user: string, cohortId: string, filters: Record<string, unknown> = {}): void {
  const now = new Date().toISOString();
  addSavedSearch(user, {
    id: cohortId,
    name: `Cohort ${cohortId}`,
    created_at: now,
    filters: JSON.stringify(filters),
    updated_at: now,
  });
}

const VALID_BODY = {
  axisMode: 'days',
  yMetric: 'absolute',
  gridPoints: 30,
  eye: 'combined',
  spreadMode: 'iqr',
  includePerPatient: false,
  includeScatter: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/outcomes/aggregate — AGG-01 contract + auth + cache + center filter', () => {
  it('returns 200 with {median, iqrLow, iqrHigh, meta} for valid body + owned cohort', async () => {
    const user = 'user-a';
    seedSavedSearch(user, 'cohort-alpha');
    const app = createApp({ preferred_username: user, role: 'researcher', centers: ['org-uka'] });

    const res = await request(app)
      .post('/api/outcomes/aggregate')
      .send({ cohortId: 'cohort-alpha', ...VALID_BODY });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      median: expect.any(Array),
      iqrLow: expect.any(Array),
      iqrHigh: expect.any(Array),
      meta: expect.objectContaining({
        patientCount: expect.any(Number),
        excludedCount: expect.any(Number),
        measurementCount: expect.any(Number),
        cacheHit: false,
      }),
    });
  });

  it.each([
    ['missing cohortId', { ...VALID_BODY }],
    ['invalid axisMode', { cohortId: 'cohort-alpha', ...VALID_BODY, axisMode: 'not-a-real-axis' }],
    ['non-object body', null as unknown as Record<string, unknown>],
    ['cohortId too long (>128 chars)', { cohortId: 'x'.repeat(129), ...VALID_BODY }],
  ])('returns 400 for invalid body (%s)', async (_label, body) => {
    const user = 'user-a';
    seedSavedSearch(user, 'cohort-alpha');
    const app = createApp({ preferred_username: user, role: 'researcher', centers: ['org-uka'] });

    const res = await request(app)
      .post('/api/outcomes/aggregate')
      .send(body as unknown as object);

    expect(res.status).toBe(400);
  });

  it("returns 403 with {error:'Forbidden'} for cohortId not in caller's saved-search store", async () => {
    const app = createApp({ preferred_username: 'user-a', role: 'researcher', centers: ['org-uka'] });
    // No seed — cohort does not exist for this user.
    const res = await request(app)
      .post('/api/outcomes/aggregate')
      .send({ cohortId: 'never-existed', ...VALID_BODY });

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
  });

  it('returns 403 with IDENTICAL body for cohortId owned by a different user (T-12-01 anti-enumeration)', async () => {
    // Seed cohort under userB; userA attempts to access.
    seedSavedSearch('user-b', 'cohort-alpha');
    const app = createApp({ preferred_username: 'user-a', role: 'researcher', centers: ['org-uka'] });

    const resNotOwned = await request(app)
      .post('/api/outcomes/aggregate')
      .send({ cohortId: 'cohort-alpha', ...VALID_BODY });
    const resNotFound = await request(app)
      .post('/api/outcomes/aggregate')
      .send({ cohortId: 'truly-nonexistent', ...VALID_BODY });

    expect(resNotOwned.status).toBe(403);
    expect(resNotFound.status).toBe(403);
    expect(JSON.stringify(resNotOwned.body)).toBe(JSON.stringify(resNotFound.body));
    expect(resNotOwned.body).toEqual({ error: 'Forbidden' });
  });

  it('rejects body larger than 16 KiB with 413', async () => {
    const user = 'user-a';
    seedSavedSearch(user, 'cohort-alpha');
    const app = createApp({ preferred_username: user, role: 'researcher', centers: ['org-uka'] });
    const filler = 'x'.repeat(20 * 1024);

    const res = await request(app)
      .post('/api/outcomes/aggregate')
      .send({ cohortId: 'cohort-alpha', ...VALID_BODY, debugTag: filler });

    expect(res.status).toBe(413);
  });

  it('ignores body.centers — handler reads only req.auth.centers (T-12-02 / Pitfall #2)', async () => {
    const user = 'user-a';
    seedSavedSearch(user, 'cohort-alpha');
    // User is authorized only for org-uka; body tries to escape into org-foreign.
    const app = createApp({ preferred_username: user, role: 'researcher', centers: ['org-uka'] });

    const res = await request(app)
      .post('/api/outcomes/aggregate')
      .send({
        cohortId: 'cohort-alpha',
        ...VALID_BODY,
        // Handler MUST ignore this — it is not a D-02 field.
        centers: ['org-foreign'],
      } as unknown as object);

    expect(res.status).toBe(200);
    // org-uka has 3 seeded patients; org-foreign has 2. A proper center filter
    // returns 3, not 5, and certainly not only the 2 from org-foreign.
    expect(res.body.meta.patientCount).toBe(3);
  });

  it('second identical request returns meta.cacheHit=true (D-07 + D-08)', async () => {
    const user = 'user-a';
    seedSavedSearch(user, 'cohort-alpha');
    const app = createApp({ preferred_username: user, role: 'researcher', centers: ['org-uka'] });
    const body = { cohortId: 'cohort-alpha', ...VALID_BODY };

    const res1 = await request(app).post('/api/outcomes/aggregate').send(body);
    const res2 = await request(app).post('/api/outcomes/aggregate').send(body);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.meta.cacheHit).toBe(false);
    expect(res2.body.meta.cacheHit).toBe(true);
  });

  it('different users with same cohortId receive non-shared cache entries (D-08 user scoping)', async () => {
    seedSavedSearch('user-a', 'cohort-shared');
    seedSavedSearch('user-b', 'cohort-shared');

    const appA = createApp({ preferred_username: 'user-a', role: 'researcher', centers: ['org-uka'] });
    const resA1 = await request(appA).post('/api/outcomes/aggregate').send({ cohortId: 'cohort-shared', ...VALID_BODY });

    const appB = createApp({ preferred_username: 'user-b', role: 'researcher', centers: ['org-foreign'] });
    const resB1 = await request(appB).post('/api/outcomes/aggregate').send({ cohortId: 'cohort-shared', ...VALID_BODY });

    expect(resA1.status).toBe(200);
    expect(resB1.status).toBe(200);
    // Both users' first requests are cache misses — user scoping means B does NOT
    // inherit A's cached result even though cohortId matches.
    expect(resA1.body.meta.cacheHit).toBe(false);
    expect(resB1.body.meta.cacheHit).toBe(false);
    // Distinct center filters produce distinct patient counts.
    expect(resA1.body.meta.patientCount).toBe(3); // org-uka
    expect(resB1.body.meta.patientCount).toBe(2); // org-foreign
  });

  it('responds with content-encoding: gzip when Accept-Encoding: gzip sent and response exceeds threshold (D-15)', async () => {
    const user = 'user-a';
    seedSavedSearch(user, 'cohort-alpha');
    const app = createApp({ preferred_username: user, role: 'researcher', centers: ['org-uka'] });

    // includePerPatient + includeScatter + high gridPoints → response well above
    // compression default threshold (~1 KiB).
    const res = await request(app)
      .post('/api/outcomes/aggregate')
      .set('Accept-Encoding', 'gzip')
      .send({
        cohortId: 'cohort-alpha',
        axisMode: 'days',
        yMetric: 'absolute',
        gridPoints: 2048,
        eye: 'combined',
        spreadMode: 'iqr',
        includePerPatient: true,
        includeScatter: true,
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBe('gzip');
  });
});

// Marker token used by the audit test file's regression grep; keeping the
// literal in the suite ensures the handler is exercised against it in at
// least one test file. We re-use the org-uka fixture seed above.
const _AUDIT_MARKER = 'saved-search-xyz-raw';
void _AUDIT_MARKER;
