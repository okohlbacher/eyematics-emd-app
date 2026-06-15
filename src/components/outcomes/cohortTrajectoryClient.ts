/**
 * J2 (v1.15-p4): client-side entry point for cohort-trajectory aggregation.
 *
 * Chooses between the Web Worker (off-main-thread, keeps the UI responsive on
 * large cohorts) and a SYNCHRONOUS fallback (runs the same pure functions on the
 * main thread). The fallback path is used whenever a real `Worker` is unavailable
 * — jsdom/Node test environments and SSR — so tests and server rendering never
 * break (constraint: "handle the no-worker/test environment gracefully").
 *
 * The worker boundary is deliberately thin: it receives the cohort `cases` + the
 * aggregation params and returns the same `TrajectoryResult` the synchronous
 * `computeCohortTrajectory` / `computeCrtTrajectory` produce. Nothing else moves
 * off-thread. The SERVER-aggregation path (large cohorts above the configured
 * patient threshold) is unchanged and never routes through here.
 */
import {
  computeCohortTrajectory,
  computeCrtTrajectory,
  type TrajectoryResult,
} from '../../../shared/cohortTrajectory';
import type {
  TrajectoryWorkerInput,
  TrajectoryWorkerRequest,
  TrajectoryWorkerResponse,
} from './cohortTrajectory.worker';

/** True when a real DedicatedWorker can be constructed (browser, not jsdom/Node). */
export function workerAvailable(): boolean {
  return typeof Worker !== 'undefined';
}

/** Synchronous main-thread aggregation — the no-worker fallback. */
export function computeTrajectorySync(
  metric: 'visus' | 'crt',
  input: TrajectoryWorkerInput,
): TrajectoryResult {
  return metric === 'crt' ? computeCrtTrajectory(input) : computeCohortTrajectory(input);
}

// ---------------------------------------------------------------------------
// Singleton worker + request multiplexing
// ---------------------------------------------------------------------------

let worker: Worker | null = null;
let nextRequestId = 1;
const pending = new Map<
  number,
  { resolve: (r: TrajectoryResult) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./cohortTrajectory.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e: MessageEvent<TrajectoryWorkerResponse>) => {
      const msg = e.data;
      const entry = pending.get(msg.id);
      if (!entry) return; // stale/superseded response — ignore
      pending.delete(msg.id);
      if (msg.ok) entry.resolve(msg.result);
      else entry.reject(new Error(msg.error));
    };
    worker.onerror = (e) => {
      // A worker-level error has no request id; fail every in-flight request so
      // the caller's catch can fall back to the synchronous path (D-03 throw-only).
      const err = new Error(e.message || 'cohortTrajectory worker error');
      for (const [, entry] of pending) entry.reject(err);
      pending.clear();
    };
  }
  return worker;
}

/**
 * Aggregate off the main thread when a Worker is available; otherwise run the
 * synchronous fallback. Always returns a Promise so callers have ONE code path.
 *
 * Throws (rejects) if the worker reports an error — the caller (the aggregation
 * hook) then falls back to `computeTrajectorySync`, exactly mirroring the existing
 * server-path "fall back to client compute" failure handling.
 */
export function computeTrajectoryAsync(
  metric: 'visus' | 'crt',
  input: TrajectoryWorkerInput,
): Promise<TrajectoryResult> {
  if (!workerAvailable()) {
    try {
      return Promise.resolve(computeTrajectorySync(metric, input));
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error(String(err)));
    }
  }
  let w: Worker;
  try {
    w = getWorker();
  } catch {
    // Worker construction failed (e.g. CSP, bundler edge case) — degrade to sync.
    return Promise.resolve(computeTrajectorySync(metric, input));
  }
  const id = nextRequestId++;
  return new Promise<TrajectoryResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const req: TrajectoryWorkerRequest = { id, metric, input };
    w.postMessage(req);
  });
}
