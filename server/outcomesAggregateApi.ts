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

import type { AxisMode, Eye, SpreadMode, YMetric } from '../shared/cohortTrajectory.js';
import { computeCohortTrajectory, computeCrtTrajectory } from '../shared/cohortTrajectory.js';
import type { AggregateResponse } from '../shared/outcomesProjection.js';
import { shapeOutcomesResponse } from '../shared/outcomesProjection.js';
import { applyFilters, extractPatientCases } from '../shared/patientCases.js';
import type { CohortFilter, PatientCase } from '../shared/types/fhir.js';
import { logAuditEntry } from './auditDb.js';
import { getSavedSearches } from './dataDb.js';
// STATIC imports (no dynamic module loading in the request path — Task 2b adds the
// `export` keyword to server/fhirApi.ts:getCachedBundles so this import compiles).
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
// T-13-03: strict allowlist for metric parameter (no enumeration on invalid values)
const VALID_METRICS = new Set<'visus' | 'crt'>(['visus', 'crt']);
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
  metric: 'visus' | 'crt';
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
  // T-13-03: metric allowlist — absent defaults to 'visus' for backward compat; unknown value → 400
  const metric = body.metric === undefined ? 'visus' : body.metric;
  if (typeof metric !== 'string' || !VALID_METRICS.has(metric as 'visus' | 'crt')) return null;
  return {
    cohortId: body.cohortId,
    axisMode: body.axisMode as AxisMode,
    yMetric: body.yMetric as YMetric,
    gridPoints: body.gridPoints,
    eye: body.eye as Eye,
    spreadMode: spreadMode as SpreadMode,
    includePerPatient,
    includeScatter,
    metric: metric as 'visus' | 'crt',
  };
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
  const { cohortId, axisMode, yMetric, gridPoints, eye, spreadMode, includePerPatient, includeScatter, metric } = validated;

  // 3. Cohort ownership check (D-06). 403 identical for not-found and not-owned.
  //    H1 fix: audit 403 so enumeration attempts are visible in the log (hashed id only).
  const searches = getSavedSearches(user);
  const search = searches.find((s) => s.id === cohortId);
  if (!search) {
    logAuditEntry({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      method: 'POST',
      path: '/api/outcomes/aggregate',
      user,
      status: 403,
      duration_ms: 0,
      body: JSON.stringify({ name: 'outcomes.aggregate', cohortHash: hashCohortId(cohortId), outcome: 'forbidden' }),
      query: null,
    });
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  // 4. Cache read (D-07/D-08 user-scoped key). Literal key construction.
  // T-13-04: metric must be in cache key so CRT and visus cache independently
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
    metric,
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
      logAuditEntry({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        method: 'POST',
        path: '/api/outcomes/aggregate',
        user,
        status: 500,
        duration_ms: 0,
        body: JSON.stringify({ name: 'outcomes.aggregate', cohortHash: hashCohortId(cohortId), outcome: 'filters_corrupt' }),
        query: null,
      });
      res.status(500).json({ error: 'Cohort filters corrupt' });
      return;
    }
    let cases: PatientCase[];
    try {
      cases = await resolveCohortCases(userRole, userCenters, filters);
    } catch (err) {
      console.error('[outcomesAggregateApi] Cohort resolve failed:', (err as Error).message);
      logAuditEntry({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        method: 'POST',
        path: '/api/outcomes/aggregate',
        user,
        status: 502,
        duration_ms: 0,
        body: JSON.stringify({ name: 'outcomes.aggregate', cohortHash: hashCohortId(cohortId), outcome: 'upstream_unavailable' }),
        query: null,
      });
      res.status(502).json({ error: 'Upstream data unavailable' });
      return;
    }
    const trajectory = metric === 'crt'
      ? computeCrtTrajectory({ cases, axisMode, yMetric, gridPoints, spreadMode })
      : computeCohortTrajectory({ cases, axisMode, yMetric, gridPoints, spreadMode });
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
      metric,
    }),
    query: null,
  });

  // 7. Respond — Express 5 res.json is JSON.stringify under the hood (parity gate).
  res.json(response);
});
