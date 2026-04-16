/**
 * POST /api/outcomes/aggregate — server-side cohort trajectory aggregation.
 *
 * Phase 12 / AGG-01 / AGG-04 / AGG-05. The handler:
 *   1. Reads user + centers from req.auth (D-05) — any request-body center
 *      override is IGNORED.
 *   2. Validates D-02 body shape; rejects oversized (caller layer does 413).
 *   3. Looks up the cohort in the caller's saved-search store (D-06).
 *   4. Computes a user-scoped cache key; on hit returns meta.cacheHit=true.
 *   5. On miss loads center-filtered bundles (via static import of getCachedBundles),
 *      extracts PatientCases (inline — src/services/fhirLoader.ts transitively
 *      imports browser globals via authHeaders.ts, blocked by server tsconfig lib;
 *      plan anticipates this pivot in <interfaces>), applies the saved-search
 *      filter, calls computeCohortTrajectory from shared/, shapes the D-03
 *      response via shapeOutcomesResponse from shared/outcomesProjection
 *      (single projector — same function used by tests/outcomesAggregateParity.test.ts).
 *   6. Writes one audit_log row with hashed cohortId + payloadBytes + cacheHit
 *      (D-16) — NEVER a raw cohortId field. SKIP_AUDIT_PATHS in
 *      auditMiddleware ensures no double-write.
 */

import crypto from 'node:crypto';

import type { Request, Response } from 'express';
import { Router } from 'express';

import { LOINC_CRT, LOINC_VISUS } from '../shared/fhirCodes.js';
import { getLatestObservation } from '../shared/fhirQueries.js';
import type { AxisMode, Eye, SpreadMode, YMetric } from '../shared/cohortTrajectory.js';
import { computeCohortTrajectory } from '../shared/cohortTrajectory.js';
import type { AggregateResponse } from '../shared/outcomesProjection.js';
import { shapeOutcomesResponse } from '../shared/outcomesProjection.js';
import type {
  CohortFilter,
  Condition,
  ImagingStudy,
  MedicationStatement,
  Observation,
  Organization,
  Patient,
  PatientCase,
  Procedure,
} from '../shared/types/fhir.js';
import { logAuditEntry } from './auditDb.js';
import { getSavedSearches } from './dataDb.js';
// STATIC imports (no dynamic module loading in the request path — Task 2b adds the
// `export` keyword to server/fhirApi.ts:getCachedBundles so this import compiles).
import type { FhirBundle } from './fhirApi.js';
import {
  filterBundlesByCenters,
  getCachedBundles,
  isBypass,
} from './fhirApi.js';
import { hashCohortId } from './hashCohortId.js';
import {
  aggregateCacheGet,
  aggregateCacheSet,
} from './outcomesAggregateCache.js';

// ---------------------------------------------------------------------------
// Body validation helpers (D-02) — generic 400 messages (no internal detail)
// ---------------------------------------------------------------------------

const VALID_AXIS_MODES = new Set<AxisMode>(['days', 'treatments']);
const VALID_Y_METRICS = new Set<YMetric>(['absolute', 'delta', 'delta_percent']);
const VALID_EYES = new Set<Eye>(['od', 'os', 'combined']);
const VALID_SPREAD_MODES = new Set<SpreadMode>(['iqr', 'sd1', 'sd2']);
const MAX_COHORT_ID_LEN = 128;         // IN-01 parity with Phase 11 auditApi.ts:131
const MIN_GRID_POINTS = 2;
const MAX_GRID_POINTS = 2048;

interface ValidBody {
  cohortId: string;
  axisMode: AxisMode;
  yMetric: YMetric;
  gridPoints: number;
  eye: Eye;
  spreadMode: SpreadMode;
  includePerPatient: boolean;
  includeScatter: boolean;
}

function validateBody(raw: unknown): ValidBody | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  if (typeof body.cohortId !== 'string' || body.cohortId.length === 0 || body.cohortId.length > MAX_COHORT_ID_LEN) return null;
  if (typeof body.axisMode !== 'string' || !VALID_AXIS_MODES.has(body.axisMode as AxisMode)) return null;
  if (typeof body.yMetric !== 'string' || !VALID_Y_METRICS.has(body.yMetric as YMetric)) return null;
  if (typeof body.gridPoints !== 'number' || !Number.isFinite(body.gridPoints) || body.gridPoints < MIN_GRID_POINTS || body.gridPoints > MAX_GRID_POINTS) return null;
  if (typeof body.eye !== 'string' || !VALID_EYES.has(body.eye as Eye)) return null;
  const spreadMode = body.spreadMode === undefined ? 'iqr' : body.spreadMode;
  if (typeof spreadMode !== 'string' || !VALID_SPREAD_MODES.has(spreadMode as SpreadMode)) return null;
  const includePerPatient = body.includePerPatient === undefined ? false : body.includePerPatient;
  const includeScatter = body.includeScatter === undefined ? false : body.includeScatter;
  if (typeof includePerPatient !== 'boolean' || typeof includeScatter !== 'boolean') return null;
  return {
    cohortId: body.cohortId,
    axisMode: body.axisMode as AxisMode,
    yMetric: body.yMetric as YMetric,
    gridPoints: body.gridPoints,
    eye: body.eye as Eye,
    spreadMode: spreadMode as SpreadMode,
    includePerPatient,
    includeScatter,
  };
}

// ---------------------------------------------------------------------------
// Inline pure re-implementations of extractPatientCases / applyFilters / getAge
// (per the plan's <interfaces> pivot: src/services/fhirLoader.ts transitively
// pulls browser globals via authHeaders.ts which server tsconfig does not
// declare; reimplementing locally against shared/ imports keeps the server
// build self-contained and matches the reference semantics of fhirLoader.ts).
// ---------------------------------------------------------------------------

function resourcesOfType<T>(bundles: FhirBundle[], type: string): T[] {
  return bundles.flatMap((b) =>
    b.entry
      .filter((e) => e.resource.resourceType === type)
      .map((e) => e.resource as unknown as T),
  );
}

function extractPatientCases(bundles: FhirBundle[]): PatientCase[] {
  const patients = resourcesOfType<Patient>(bundles, 'Patient');
  const conditions = resourcesOfType<Condition>(bundles, 'Condition');
  const observations = resourcesOfType<Observation>(bundles, 'Observation');
  const procedures = resourcesOfType<Procedure>(bundles, 'Procedure');
  const imaging = resourcesOfType<ImagingStudy>(bundles, 'ImagingStudy');
  const medications = resourcesOfType<MedicationStatement>(bundles, 'MedicationStatement');
  const orgs = resourcesOfType<Organization>(bundles, 'Organization');

  return patients.map((pat) => {
    const ref = `Patient/${pat.id}`;
    const org = orgs.find((o) => o.id === pat.meta?.source);
    return {
      id: pat.id,
      pseudonym:
        pat.identifier?.find((i) => i.system === 'urn:eyematics:pseudonym')?.value ?? pat.id,
      gender: pat.gender ?? 'unknown',
      birthDate: pat.birthDate ?? '',
      centerId: pat.meta?.source ?? '',
      centerName: org?.name ?? pat.meta?.source ?? '',
      conditions: conditions.filter((c) => c.subject.reference === ref),
      observations: observations.filter((o) => o.subject.reference === ref),
      procedures: procedures.filter((p) => p.subject.reference === ref),
      imagingStudies: imaging.filter((i) => i.subject.reference === ref),
      medications: medications.filter((m) => m.subject.reference === ref),
    };
  });
}

function getAge(birthDate: string): number {
  if (!birthDate) return -1;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return -1;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

function applyFilters(cases: PatientCase[], filters: CohortFilter): PatientCase[] {
  return cases.filter((c) => {
    if (filters.centers?.length && !filters.centers.includes(c.centerId)) return false;
    if (filters.gender?.length && !filters.gender.includes(c.gender)) return false;
    if (filters.diagnosis?.length) {
      const codes = c.conditions.flatMap((cond) => cond.code.coding.map((cd) => cd.code));
      if (!filters.diagnosis.some((d) => codes.includes(d))) return false;
    }
    if (filters.ageRange) {
      const age = getAge(c.birthDate);
      if (age < filters.ageRange[0] || age > filters.ageRange[1]) return false;
    }
    if (filters.visusRange) {
      const latest = getLatestObservation(c.observations, LOINC_VISUS);
      const val = latest?.valueQuantity?.value;
      if (val == null) return false;
      if (val < filters.visusRange[0] || val > filters.visusRange[1]) return false;
    }
    if (filters.crtRange) {
      const latest = getLatestObservation(c.observations, LOINC_CRT);
      const val = latest?.valueQuantity?.value;
      if (val == null) return false;
      if (val < filters.crtRange[0] || val > filters.crtRange[1]) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Cohort resolution — center-filtered PatientCase[] from saved-search filters
// (uses STATIC imports from ./fhirApi.js — no dynamic module loading in the
// request path; makes types visible end-to-end and avoids per-request overhead)
// ---------------------------------------------------------------------------

async function resolveCohortCases(
  role: string,
  centers: string[],
  filters: CohortFilter,
): Promise<PatientCase[]> {
  const all = await getCachedBundles();
  const bundles = isBypass(role, centers) ? all : filterBundlesByCenters(all, centers);
  const cases = extractPatientCases(bundles);
  return applyFilters(cases, filters);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const outcomesAggregateRouter = Router();

outcomesAggregateRouter.post('/aggregate', async (req: Request, res: Response): Promise<void> => {
  // 1. Auth is already enforced by authMiddleware on /api/*. req.auth is present.
  const user = req.auth!.preferred_username;
  const userCenters = req.auth!.centers;
  const userRole = req.auth!.role;

  // 2. Body validation (D-02 shape). Generic 400 message (T-12-01 no enumeration).
  const validated = validateBody(req.body);
  if (!validated) {
    res.status(400).json({ error: 'Invalid request body' });
    return;
  }
  const { cohortId, axisMode, yMetric, gridPoints, eye, spreadMode, includePerPatient, includeScatter } = validated;

  // 3. Cohort ownership check (D-06). 403 identical for not-found and not-owned.
  const searches = getSavedSearches(user);
  const search = searches.find((s) => s.id === cohortId);
  if (!search) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  // 4. Cache read (D-07/D-08 user-scoped key). Literal key construction.
  const cacheKey = JSON.stringify({
    cohortId,
    axisMode,
    yMetric,
    gridPoints,
    eye,
    spreadMode,
    includePerPatient,
    includeScatter,
    user,
  });
  const cached = aggregateCacheGet(cacheKey);
  let response: AggregateResponse;
  let cacheHit = false;

  if (cached !== null) {
    // Reuse cached response but re-stamp meta.cacheHit = true (cached value has false).
    const c = cached as AggregateResponse;
    cacheHit = true;
    response = { ...c, meta: { ...c.meta, cacheHit: true } };
  } else {
    // 5. Miss: compute via shared math, then shape via the shared projector.
    let filters: CohortFilter;
    try {
      filters = JSON.parse(search.filters) as CohortFilter;
    } catch {
      res.status(500).json({ error: 'Cohort filters corrupt' });
      return;
    }
    let cases: PatientCase[];
    try {
      cases = await resolveCohortCases(userRole, userCenters, filters);
    } catch (err) {
      console.error('[outcomesAggregateApi] Cohort resolve failed:', (err as Error).message);
      res.status(502).json({ error: 'Upstream data unavailable' });
      return;
    }
    const trajectory = computeCohortTrajectory({ cases, axisMode, yMetric, gridPoints, spreadMode });
    // SINGLE projector — Plan 12-01 Task 4 output. Tests (Plan 12-03) import the
    // same function; no local re-definition here, no drift possible.
    response = shapeOutcomesResponse(trajectory, eye, includePerPatient, includeScatter, false);
    aggregateCacheSet(cacheKey, cohortId, response);
  }

  // 6. Audit row (D-16) — always fires, whether hit or miss.
  //    JSON.stringify literal NEVER contains a `cohortId` field.
  const payloadBytes = Buffer.byteLength(JSON.stringify(response), 'utf8');
  logAuditEntry({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    method: 'POST',
    path: '/api/outcomes/aggregate',
    user,
    status: 200,
    duration_ms: 0,  // sentinel — IN-10 handler-written row
    body: JSON.stringify({
      name: 'outcomes.aggregate',
      cohortHash: hashCohortId(cohortId),
      centers: userCenters,
      payloadBytes,
      cacheHit,
    }),
    query: null,
  });

  // 7. Respond — Express 5 res.json is JSON.stringify under the hood (parity gate).
  res.json(response);
});
