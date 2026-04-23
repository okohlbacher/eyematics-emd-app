/**
 * Phase 12 Plan 03 / AGG-05 — audit row assertions for POST /api/outcomes/aggregate.
 *
 * Covers:
 *   - Exactly 1 audit row per request (no double-write from middleware + handler)
 *   - row.body contains cohortHash with /^[0-9a-f]{16}$/ value (D-16)
 *   - row.body does NOT contain the raw cohortId marker (T-12-04 negative assertion,
 *     parity with Phase 11 Plan 02 `row.body !.toContain('saved-search-xyz')`)
 *   - row.query is NULL (POST with JSON body, no querystring)
 *   - row.body contains payloadBytes (positive integer) AND cacheHit (boolean)
 *   - Cache-hit requests ALSO write an audit row with cacheHit=true
 *
 * Wave-2 parallelism: imports from ../server/outcomesAggregate* resolve only
 * after Plan 12-02 is merged back to the feature branch.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import compression from 'compression';
import express, { type Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initAuditDb, queryAudit } from '../server/auditDb';
import { addSavedSearch, initDataDb } from '../server/dataDb';
import { _resetForTesting as _resetHashCohortId, initHashCohortId } from '../server/hashCohortId';
// @ts-expect-error — server/outcomesAggregateApi.ts is created in parallel by Plan 12-02
import { outcomesAggregateRouter } from '../server/outcomesAggregateApi';
// @ts-expect-error — server/outcomesAggregateCache.ts is created in parallel by Plan 12-02
import {
  _resetForTesting as resetCache,
  initOutcomesAggregateCache,
} from '../server/outcomesAggregateCache';
import { LOINC_VISUS, SNOMED_EYE_LEFT, SNOMED_EYE_RIGHT } from '../shared/fhirCodes';
import type { PatientCase } from '../shared/types/fhir';

// ---------------------------------------------------------------------------
// Mock the case-loading seam (mirrors outcomesAggregateApi.test.ts)
// ---------------------------------------------------------------------------

const mockBundles = { bundles: [] as Array<{ resourceType: 'Bundle'; type: string; entry: [] }> };
const casesByCenter: Record<string, PatientCase[]> = {};
let currentAuthCenters: string[] = [];

function currentFixtureCases(): PatientCase[] {
  const out: PatientCase[] = [];
  for (const c of currentAuthCenters) {
    if (casesByCenter[c]) out.push(...casesByCenter[c]);
  }
  return out;
}

vi.mock('../server/fhirApi.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/fhirApi.js')>();
  return {
    ...actual,
    getCachedBundles: vi.fn(async () => mockBundles.bundles),
    filterBundlesByCenters: vi.fn((_b: unknown, _c: string[]) => mockBundles.bundles),
  };
});

// The handler imports extractPatientCases from shared/patientCases.ts — mock that module.
vi.mock('../shared/patientCases.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/patientCases.js')>();
  return {
    ...actual,
    extractPatientCases: vi.fn(() => currentFixtureCases()),
  };
});

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

interface AuthShim {
  preferred_username: string;
  role: string;
  centers: string[];
}

function createApp(auth: AuthShim): Express {
  const app = express();
  app.use((req, _res, next) => {
    req.auth = { sub: auth.preferred_username, preferred_username: auth.preferred_username, role: auth.role, centers: auth.centers, iat: 0, exp: 0 };
    currentAuthCenters = auth.centers;
    next();
  });
  app.use('/api/outcomes/aggregate', express.json({ limit: '16kb' }));
  app.use('/api/outcomes/aggregate', compression());
  app.use('/api/outcomes', outcomesAggregateRouter);
  return app;
}

const RAW_MARKER = 'saved-search-xyz-raw';
const VALID_BODY = {
  axisMode: 'days',
  yMetric: 'absolute',
  gridPoints: 30,
  eye: 'combined',
  spreadMode: 'iqr',
  includePerPatient: false,
  includeScatter: false,
};

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outcomes-agg-audit-'));
  initAuditDb(tmpDir);
  initDataDb(tmpDir);
  _resetHashCohortId();
  initHashCohortId({ audit: { cohortHashSecret: 'x'.repeat(64) } });
  initOutcomesAggregateCache({});
  resetCache();

  casesByCenter['org-uka'] = [
    makePatient('p-uka-1', 'org-uka', [0.5, 0.6, 0.55, 0.58, 0.6]),
    makePatient('p-uka-2', 'org-uka', [0.4, 0.42, 0.45, 0.5, 0.48]),
    makePatient('p-uka-3', 'org-uka', [0.7, 0.72, 0.75, 0.78, 0.8]),
  ];
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.clearAllMocks();
  currentAuthCenters = [];
  for (const k of Object.keys(casesByCenter)) delete casesByCenter[k];
});

function seedSavedSearch(user: string, cohortId: string): void {
  const now = new Date().toISOString();
  addSavedSearch(user, {
    id: cohortId,
    name: `Cohort ${cohortId}`,
    created_at: now,
    filters: JSON.stringify({}),
    updated_at: now,
  });
}

describe('POST /api/outcomes/aggregate — AGG-05 audit row', () => {
  it('writes exactly 1 audit row with method=POST, path=/api/outcomes/aggregate, status=200', async () => {
    const user = 'user-a';
    seedSavedSearch(user, RAW_MARKER);
    const app = createApp({ preferred_username: user, role: 'researcher', centers: ['org-uka'] });

    const res = await request(app)
      .post('/api/outcomes/aggregate')
      .send({ cohortId: RAW_MARKER, ...VALID_BODY });

    expect(res.status).toBe(200);
    const { rows } = queryAudit({ path: '/api/outcomes/aggregate', limit: 10 });
    expect(rows).toHaveLength(1);
    expect(rows[0].method).toBe('POST');
    expect(rows[0].path).toBe('/api/outcomes/aggregate');
    expect(rows[0].status).toBe(200);
    expect(rows[0].user).toBe(user);
  });

  it('row.body contains cohortHash matching /^[0-9a-f]{16}$/', async () => {
    const user = 'user-a';
    seedSavedSearch(user, RAW_MARKER);
    const app = createApp({ preferred_username: user, role: 'researcher', centers: ['org-uka'] });

    await request(app).post('/api/outcomes/aggregate').send({ cohortId: RAW_MARKER, ...VALID_BODY });

    const { rows } = queryAudit({ path: '/api/outcomes/aggregate', limit: 10 });
    expect(rows).toHaveLength(1);
    expect(rows[0].body).not.toBeNull();
    const parsed = JSON.parse(rows[0].body!);
    expect(parsed.name).toBe('outcomes.aggregate');
    expect(parsed.cohortHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it("row.body does NOT contain the raw cohortId marker 'saved-search-xyz-raw' (T-12-04)", async () => {
    const user = 'user-a';
    seedSavedSearch(user, RAW_MARKER);
    const app = createApp({ preferred_username: user, role: 'researcher', centers: ['org-uka'] });

    await request(app).post('/api/outcomes/aggregate').send({ cohortId: RAW_MARKER, ...VALID_BODY });

    const { rows } = queryAudit({ path: '/api/outcomes/aggregate', limit: 10 });
    expect(rows).toHaveLength(1);
    // Negative assertion: the raw id must never leak into the audit row body.
    expect(rows[0].body).not.toContain('saved-search-xyz-raw');
    // Also verify the parsed row has no `cohortId` property (positive check).
    const parsed = JSON.parse(rows[0].body!);
    expect(parsed).not.toHaveProperty('cohortId');
  });

  it('row.query is NULL (POST with JSON body, no querystring)', async () => {
    const user = 'user-a';
    seedSavedSearch(user, RAW_MARKER);
    const app = createApp({ preferred_username: user, role: 'researcher', centers: ['org-uka'] });

    await request(app).post('/api/outcomes/aggregate').send({ cohortId: RAW_MARKER, ...VALID_BODY });

    const { rows } = queryAudit({ path: '/api/outcomes/aggregate', limit: 10 });
    expect(rows).toHaveLength(1);
    expect(rows[0].query).toBeNull();
  });

  it('row.body contains payloadBytes (positive integer) AND cacheHit (boolean)', async () => {
    const user = 'user-a';
    seedSavedSearch(user, RAW_MARKER);
    const app = createApp({ preferred_username: user, role: 'researcher', centers: ['org-uka'] });

    await request(app).post('/api/outcomes/aggregate').send({ cohortId: RAW_MARKER, ...VALID_BODY });

    const { rows } = queryAudit({ path: '/api/outcomes/aggregate', limit: 10 });
    const parsed = JSON.parse(rows[0].body!);
    expect(typeof parsed.payloadBytes).toBe('number');
    expect(parsed.payloadBytes).toBeGreaterThan(0);
    expect(typeof parsed.cacheHit).toBe('boolean');
    expect(parsed.cacheHit).toBe(false); // first request is a miss
  });

  it('cache-hit request ALSO writes an audit row with cacheHit=true (CONTEXT §specifics)', async () => {
    const user = 'user-a';
    seedSavedSearch(user, RAW_MARKER);
    const app = createApp({ preferred_username: user, role: 'researcher', centers: ['org-uka'] });
    const body = { cohortId: RAW_MARKER, ...VALID_BODY };

    await request(app).post('/api/outcomes/aggregate').send(body);
    await request(app).post('/api/outcomes/aggregate').send(body);

    const { rows } = queryAudit({ path: '/api/outcomes/aggregate', limit: 10 });
    expect(rows).toHaveLength(2);
    const bodies = rows.map((r) => JSON.parse(r.body!));
    // Every row carries cohortHash (never raw id) — negative invariant still holds.
    for (const b of bodies) {
      expect(b.cohortHash).toMatch(/^[0-9a-f]{16}$/);
      expect(b).not.toHaveProperty('cohortId');
    }
    // Exactly one miss and one hit across the two requests.
    const cacheHits = bodies.map((b) => b.cacheHit).sort();
    expect(cacheHits).toEqual([false, true]);
  });
});
