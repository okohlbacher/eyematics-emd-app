/// <reference lib="webworker" />
/**
 * J2 (v1.15-p4): cohort-trajectory aggregation Web Worker.
 *
 * Moves the CLIENT-path aggregation (`computeCohortTrajectory` /
 * `computeCrtTrajectory`, both pure — no DOM, no I/O) OFF the main thread so the
 * UI (layer toggles, Einstellungen drawer, metric tabs) stays interactive while a
 * large cohort is being aggregated. The tester's "dashboard remains unresponsive
 * until the plots are loaded" symptom is the synchronous main-thread aggregation +
 * panel build; this addresses the aggregation half.
 *
 * Protocol (structured-clone friendly — plain objects only):
 *   in:  { id, metric: 'visus' | 'crt', input: TrajectoryInput }
 *   out: { id, ok: true, result: TrajectoryResult }
 *      | { id, ok: false, error: string }
 *
 * The `id` round-trips so the caller can match a response to its request and
 * ignore stale responses from superseded params (cohort/metric/axis change).
 *
 * The SERVER-aggregation path is unchanged — it never reaches this worker.
 *
 * Test/SSR safety: this file is only ever instantiated via `new Worker(new URL(...))`
 * behind a `typeof Worker !== 'undefined'` guard (see cohortTrajectoryClient.ts). In
 * jsdom/Node there is no real Worker, so the synchronous fallback runs instead and
 * this module is never loaded.
 */
import {
  type AxisMode,
  computeCohortTrajectory,
  computeCrtTrajectory,
  type SpreadMode,
  type TrajectoryResult,
  type YMetric,
} from '../../../shared/cohortTrajectory';
import type { PatientCase } from '../../../shared/types/fhir';

export interface TrajectoryWorkerInput {
  cases: PatientCase[];
  axisMode: AxisMode;
  yMetric: YMetric;
  gridPoints: number;
  spreadMode: SpreadMode;
}

export interface TrajectoryWorkerRequest {
  id: number;
  metric: 'visus' | 'crt';
  input: TrajectoryWorkerInput;
}

export type TrajectoryWorkerResponse =
  | { id: number; ok: true; result: TrajectoryResult }
  | { id: number; ok: false; error: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<TrajectoryWorkerRequest>) => {
  const { id, metric, input } = e.data;
  try {
    const result =
      metric === 'crt' ? computeCrtTrajectory(input) : computeCohortTrajectory(input);
    const msg: TrajectoryWorkerResponse = { id, ok: true, result };
    ctx.postMessage(msg);
  } catch (err) {
    const msg: TrajectoryWorkerResponse = {
      id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
    ctx.postMessage(msg);
  }
};
