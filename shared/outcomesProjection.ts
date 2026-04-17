/**
 * Phase 12 / AGG-02 — single source of truth for the D-03 wire-shape projector.
 *
 * shapeOutcomesResponse takes a TrajectoryResult (pure math output from
 * shared/cohortTrajectory.ts) plus the eye selector + opt-in flags + cacheHit
 * stamp, and returns the AggregateResponse with a literal, deterministic key
 * order: median, iqrLow, iqrHigh, [perPatient], [scatter], meta.
 *
 * IMPORTANT: The server handler (server/outcomesAggregateApi.ts) and the
 * parity test (tests/outcomesAggregateParity.test.ts) BOTH import this
 * function. Do not duplicate the projection logic anywhere else — the single
 * definition is what eliminates AGG-02 byte-parity drift (Pitfall #1, cause
 * #1: object key order).
 */

import type {
  Eye,
  GridPoint,
  PatientSeries,
  TrajectoryResult,
} from './cohortTrajectory';

export interface AggregateMeta {
  patientCount: number;
  excludedCount: number;
  measurementCount: number;
  cacheHit: boolean;
}

export interface AggregateResponse {
  median: GridPoint[];
  iqrLow: number[];
  iqrHigh: number[];
  perPatient?: PatientSeries[];
  scatter?: Array<{ x: number; y: number; patientId: string }>;
  meta: AggregateMeta;
}

/**
 * Project TrajectoryResult → AggregateResponse with literal key order.
 * - median first, then iqrLow, then iqrHigh
 * - perPatient and scatter ONLY emitted when the corresponding flag is true
 *   (absent keys are preferable to "undefined" values for JSON.stringify parity)
 * - meta LAST with patientCount → excludedCount → measurementCount → cacheHit
 */
export function shapeOutcomesResponse(
  trajectory: TrajectoryResult,
  eye: Eye,
  includePerPatient: boolean,
  includeScatter: boolean,
  cacheHit: boolean,
): AggregateResponse {
  const panel =
    eye === 'od' ? trajectory.od : eye === 'os' ? trajectory.os : trajectory.combined;

  const result: AggregateResponse = {
    median: panel.medianGrid,
    iqrLow: panel.medianGrid.map((g) => g.p25),
    iqrHigh: panel.medianGrid.map((g) => g.p75),
    meta: {
      patientCount: panel.summary.patientCount,
      excludedCount: panel.summary.excludedCount,
      measurementCount: panel.summary.measurementCount,
      cacheHit,
    },
  };
  if (includePerPatient) result.perPatient = panel.patients;
  if (includeScatter) result.scatter = panel.scatterPoints;
  return result;
}
