/**
 * Phase 12 Plan 03 / AGG-02 — byte-identity parity between client projection
 * and server response for POST /api/outcomes/aggregate.
 *
 * The test runs computeCohortTrajectory() directly in-process to produce a
 * "clientShaped" expected object (via shapeOutcomesResponse from
 * shared/outcomesProjection — the SAME projector the server handler uses),
 * then posts to the server and asserts JSON.stringify string equality.
 * Zero tolerance. No fuzzy compare.
 *
 * Key design: there is literally no "client projection" distinct from the
 * "server projection". Both sides call shapeOutcomesResponse from
 * shared/outcomesProjection.ts. Any change to the projection reaches both
 * sides in the same commit by construction — AGG-02 key-order drift closed
 * (Pitfall #1, cause #1 in 12-RESEARCH.md).
 *
 * Sampling matrix (12-RESEARCH §Nyquist):
 *   - days/absolute/combined (canonical)
 *   - treatments/delta/od (exercises treatmentIndexAt + delta paths)
 *   - days/delta_percent/os (exercises clamp(-200,200) boundary)
 *   - days/absolute/combined with perPatient + scatter flags
 *   - 1-patient degenerate cohort
 *   - 2-patient IQR-boundary cohort
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

import { initAuditDb } from '../server/auditDb';
import { addSavedSearch, initDataDb } from '../server/dataDb';
import { _resetForTesting as _resetHashCohortId, initHashCohortId } from '../server/hashCohortId';
// @ts-expect-error — server/outcomesAggregateApi.ts is created in parallel by Plan 12-02
import { outcomesAggregateRouter } from '../server/outcomesAggregateApi';
// @ts-expect-error — server/outcomesAggregateCache.ts is created in parallel by Plan 12-02
import {
  _resetForTesting as resetCache,
  initOutcomesAggregateCache,
} from '../server/outcomesAggregateCache';
import {
  type AxisMode,
  computeCohortTrajectory,
  type Eye,
  type YMetric,
} from '../shared/cohortTrajectory';
import { LOINC_VISUS, SNOMED_EYE_LEFT, SNOMED_EYE_RIGHT, SNOMED_IVI } from '../shared/fhirCodes';
import { shapeOutcomesResponse } from '../shared/outcomesProjection';
import type { PatientCase } from '../shared/types/fhir';

// ---------------------------------------------------------------------------
// Mulberry32 PRNG — deterministic seed → patient cases.
// Mirrors scripts/generate-center-bundle.ts for reproducibility.
// Literal seed = 42 anchors the T-12-test-01 tampering mitigation.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a deterministic cohort of N PatientCases. Each patient gets 3..12
 * visus observations (LOINC 79880-1) alternating between OD and OS bodySite,
 * spaced 0..60 days apart from a 2024-01-01 base, with decimal values in
 * 0.1..1.0 (so logmar math is well-defined and the clamp branch is
 * exercised on delta_percent).
 */
function makeSeedCohort(seed: number, n: number): PatientCase[] {
  const rand = mulberry32(seed);
  const base = new Date('2024-01-01T00:00:00Z').getTime();
  const cases: PatientCase[] = [];
  for (let i = 0; i < n; i++) {
    const obsCount = 3 + Math.floor(rand() * 10); // 3..12
    const observations = [];
    let tOffset = 0;
    for (let j = 0; j < obsCount; j++) {
      tOffset += Math.floor(rand() * 60); // day spacing 0..59
      const decimal = 0.1 + rand() * 0.9; // 0.1..1.0
      observations.push({
        resourceType: 'Observation' as const,
        id: `seed-${seed}-p${i}-obs-${j}`,
        status: 'final',
        code: { coding: [{ code: LOINC_VISUS, system: 'http://loinc.org' }] },
        subject: { reference: `Patient/seed-${seed}-p${i}` },
        effectiveDateTime: new Date(base + tOffset * 86400000).toISOString(),
        valueQuantity: { value: decimal, unit: 'decimal' },
        bodySite: { coding: [{ code: j % 2 === 0 ? SNOMED_EYE_RIGHT : SNOMED_EYE_LEFT }] },
      });
    }
    // One IVI procedure per patient to exercise the `treatments` axis mode.
    const procedures = [
      {
        resourceType: 'Procedure' as const,
        id: `seed-${seed}-p${i}-proc-0`,
        status: 'completed',
        code: { coding: [{ code: SNOMED_IVI }] },
        subject: { reference: `Patient/seed-${seed}-p${i}` },
        performedDateTime: new Date(base + 15 * 86400000).toISOString(),
        bodySite: [{ coding: [{ code: SNOMED_EYE_RIGHT }] }],
      },
    ];
    cases.push({
      id: `seed-${seed}-p${i}`,
      pseudonym: `seed-${seed}-p${i}`,
      gender: 'unknown',
      birthDate: '1960-01-01',
      centerId: 'org-uka',
      centerName: 'org-uka',
      conditions: [],
      observations,
      procedures,
      imagingStudies: [],
      medications: [],
    } as unknown as PatientCase);
  }
  return cases;
}

// ---------------------------------------------------------------------------
// Mocks — same seam as outcomesAggregateApi.test.ts. The parity test needs
// the server handler to compute against the EXACT same PatientCase[] the
// in-test call to computeCohortTrajectory uses. Mocking extractPatientCases
// to return our seed cohort achieves this deterministically.
// ---------------------------------------------------------------------------

const mockBundles = { bundles: [] as Array<{ resourceType: 'Bundle'; type: string; entry: [] }> };
let currentFixture: PatientCase[] = [];

vi.mock('../server/fhirApi.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/fhirApi.js')>();
  return {
    ...actual,
    getCachedBundles: vi.fn(async () => mockBundles.bundles),
    filterBundlesByCenters: vi.fn((_b: unknown, _c: string[]) => mockBundles.bundles),
  };
});

// The handler imports extractPatientCases from shared/patientCases.ts (not fhirLoader).
vi.mock('../shared/patientCases.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/patientCases.js')>();
  return {
    ...actual,
    extractPatientCases: vi.fn(() => currentFixture),
  };
});

// ---------------------------------------------------------------------------
// Test app + setup (mirror outcomesAggregateApi.test.ts)
// ---------------------------------------------------------------------------

const TEST_USER = 'parity-user';
const SEEDED_COHORT_ID = 'parity-cohort';

function createApp(): Express {
  const app = express();
  app.use((req, _res, next) => {
    req.auth = {
      sub: TEST_USER,
      preferred_username: TEST_USER,
      role: 'researcher',
      centers: ['org-uka'],
      iat: 0,
      exp: 0,
    };
    next();
  });
  app.use('/api/outcomes/aggregate', express.json({ limit: '16kb' }));
  app.use('/api/outcomes/aggregate', compression());
  app.use('/api/outcomes', outcomesAggregateRouter);
  return app;
}

let tmpDir: string;
let APP: Express;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outcomes-agg-parity-'));
  initAuditDb(tmpDir);
  initDataDb(tmpDir);
  _resetHashCohortId();
  initHashCohortId({ audit: { cohortHashSecret: 'x'.repeat(64) } });
  initOutcomesAggregateCache({});
  resetCache();

  // Seed saved search row for the parity cohort id.
  const now = new Date().toISOString();
  addSavedSearch(TEST_USER, {
    id: SEEDED_COHORT_ID,
    name: 'Parity Cohort',
    created_at: now,
    filters: JSON.stringify({}),
    updated_at: now,
  });

  APP = createApp();
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.clearAllMocks();
  currentFixture = [];
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AGG-02 byte-identity parity', () => {
  it.each<[AxisMode, YMetric, Eye, boolean, boolean, string]>([
    ['days', 'absolute', 'combined', false, false, 'canonical 50-patient days/absolute/combined'],
    ['treatments', 'delta', 'od', false, false, 'treatments axis + delta metric + OD eye'],
    ['days', 'delta_percent', 'os', false, false, 'delta_percent clamp boundary + OS eye'],
    ['days', 'absolute', 'combined', true, true, 'opt-in perPatient + scatter arrays'],
  ])(
    'server response is JSON.stringify byte-equal to clientShaped for 50-patient cohort (%s/%s/%s, perPatient=%s, scatter=%s)',
    async (axisMode, yMetric, eye, includePerPatient, includeScatter) => {
      const cases = makeSeedCohort(42, 50);
      currentFixture = cases;

      const clientTrajectory = computeCohortTrajectory({
        cases,
        axisMode,
        yMetric,
        gridPoints: 120,
        spreadMode: 'iqr',
      });
      const clientShaped = shapeOutcomesResponse(
        clientTrajectory,
        eye,
        includePerPatient,
        includeScatter,
        false, // cacheHit:false on miss
      );

      const server = await request(APP)
        .post('/api/outcomes/aggregate')
        .send({
          cohortId: SEEDED_COHORT_ID,
          axisMode,
          yMetric,
          gridPoints: 120,
          eye,
          spreadMode: 'iqr',
          includePerPatient,
          includeScatter,
        });

      expect(server.status).toBe(200);
      expect(JSON.stringify(server.body)).toBe(JSON.stringify(clientShaped));
    },
  );

  it('1-patient cohort (degenerate) — byte-identity holds', async () => {
    const cases = makeSeedCohort(42, 1);
    currentFixture = cases;

    const clientTrajectory = computeCohortTrajectory({
      cases,
      axisMode: 'days',
      yMetric: 'absolute',
      gridPoints: 120,
      spreadMode: 'iqr',
    });
    const clientShaped = shapeOutcomesResponse(clientTrajectory, 'combined', false, false, false);

    const server = await request(APP)
      .post('/api/outcomes/aggregate')
      .send({
        cohortId: SEEDED_COHORT_ID,
        axisMode: 'days',
        yMetric: 'absolute',
        gridPoints: 120,
        eye: 'combined',
        spreadMode: 'iqr',
        includePerPatient: false,
        includeScatter: false,
      });

    expect(server.status).toBe(200);
    expect(JSON.stringify(server.body)).toBe(JSON.stringify(clientShaped));
  });

  it('2-patient cohort (IQR boundary) — byte-identity holds', async () => {
    const cases = makeSeedCohort(42, 2);
    currentFixture = cases;

    const clientTrajectory = computeCohortTrajectory({
      cases,
      axisMode: 'days',
      yMetric: 'absolute',
      gridPoints: 120,
      spreadMode: 'iqr',
    });
    const clientShaped = shapeOutcomesResponse(clientTrajectory, 'combined', false, false, false);

    const server = await request(APP)
      .post('/api/outcomes/aggregate')
      .send({
        cohortId: SEEDED_COHORT_ID,
        axisMode: 'days',
        yMetric: 'absolute',
        gridPoints: 120,
        eye: 'combined',
        spreadMode: 'iqr',
        includePerPatient: false,
        includeScatter: false,
      });

    expect(server.status).toBe(200);
    expect(JSON.stringify(server.body)).toBe(JSON.stringify(clientShaped));
  });
});
