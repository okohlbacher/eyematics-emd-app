/**
 * useOutcomesAggregation — Phase 44 / TECH-02 extraction from OutcomesView.tsx.
 *
 * Owns: server-routing decision + effect, aggregate/crtAggregate/
 * crossCohortAggregates/crossCohortCaseSeries memos.
 *
 * Takes the full route-state object from useOutcomesRouteState as its single
 * argument — this preserves global hook call order (no new useState/useEffect
 * introduced that would change the hook count or order).
 *
 * CRITICAL — Rules of Hooks (WR-01 / Pitfall 3): This hook MUST be called
 * immediately after useOutcomesRouteState in OutcomesView, before any return.
 * The order relative to the original OutcomesView hook sequence is preserved
 * because these memos/effects ran after all state and before the render return.
 */
import { useEffect, useMemo, useState } from 'react';

import { computeCrtTrajectory } from '../../../shared/cohortTrajectory';
import type { PatientCase, SavedSearch } from '../../../shared/types/fhir';
import { applyFilters } from '../../services/fhirLoader';
import { type AggregateResponse, postAggregate } from '../../services/outcomesAggregateService';
import {
  type AxisMode,
  computeCohortTrajectory,
  type PanelResult,
  type SpreadMode,
  type TrajectoryResult,
  type YMetric,
} from '../../utils/cohortTrajectory';
import {
  computeTrajectoryAsync,
  computeTrajectorySync,
  workerAvailable,
} from './cohortTrajectoryClient';
import type { IntervalCohortSeries } from './IntervalHistogram';
import type { CohortSeriesEntry } from './OutcomesPanel';
import { COHORT_PALETTES } from './palette';
import type { MetricType } from './useOutcomesRouteState';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RouteState {
  isCrossMode: boolean;
  crossCohortIds: string[];
  cohort: { name: string | null; cases: PatientCase[] } | null;
  cohortId: string | null;
  activeMetric: MetricType;
  axisMode: AxisMode;
  yMetric: YMetric;
  gridPoints: number;
  spreadMode: SpreadMode;
  layers: { perPatient: boolean; scatter: boolean; median: boolean; spreadBand: boolean };
  threshold: number;
  serverAggregate: TrajectoryResult | null;
  setServerAggregate: (v: TrajectoryResult | null) => void;
  serverLoading: boolean;
  setServerLoading: (v: boolean) => void;
  savedSearches: SavedSearch[];
  activeCases: PatientCase[];
  filterOptions: {
    therapyInterrupterDays: number;
    therapyBreakerDays: number;
    crtImplausibleThresholdUm: number;
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOutcomesAggregation(state: RouteState) {
  const {
    isCrossMode,
    crossCohortIds,
    cohort,
    cohortId,
    activeMetric,
    axisMode,
    yMetric,
    gridPoints,
    spreadMode,
    layers,
    threshold,
    serverAggregate,
    setServerAggregate,
    serverLoading,
    setServerLoading,
    savedSearches,
    activeCases,
    filterOptions,
  } = state;

  // Phase 12 / AGG-03 / D-13 — size-based routing to server endpoint.
  // Phase 16 / Pitfall 6: bypass server routing in cross-cohort mode.
  const routeServerSide = !isCrossMode && Boolean(
    cohort && cohortId && cohort.cases.length > threshold
  );

  // J2 (v1.15-p4): above this client-side cohort case-count, run the aggregation
  // in a Web Worker (off-main-thread) so the controls (layer toggles, Einstellungen,
  // metric tabs) stay interactive while the cohort aggregates. Matches the
  // CLIENT_RENDER_STATUS_THRESHOLD_CASES in OutcomesView so the existing client-
  // computing status covers the worker-compute window too. At/below this the
  // synchronous memo is instant — worker round-trip overhead would only add latency.
  const CLIENT_WORKER_THRESHOLD_CASES = 50;

  /** Project server AggregateResponse back to the PanelResult shape the panels consume. */
  function panelFromServer(r: AggregateResponse): PanelResult {
    return {
      patients: r.perPatient ?? [],
      scatterPoints: r.scatter ?? [],
      medianGrid: r.median,
      summary: {
        patientCount: r.meta.patientCount,
        excludedCount: r.meta.excludedCount,
        measurementCount: r.meta.measurementCount,
      },
    };
  }

  // Phase 13: server routing effect — gated on activeMetric (only visus + crt route).
  useEffect(() => {
    if (activeMetric !== 'visus' && activeMetric !== 'crt') {
       
      setServerAggregate(null);
      return;
    }
    if (!routeServerSide || !cohortId) {

      setServerAggregate(null);
      return;
    }
    let cancelled = false;
    setServerLoading(true);

    const shared = {
      cohortId,
      axisMode,
      yMetric,
      gridPoints,
      spreadMode,
      includePerPatient: layers.perPatient,
      includeScatter: layers.scatter,
      metric: activeMetric as 'visus' | 'crt',
    };

    (async () => {
      try {
        const [od, os, combined] = await Promise.all([
          postAggregate({ ...shared, eye: 'od' }),
          postAggregate({ ...shared, eye: 'os' }),
          postAggregate({ ...shared, eye: 'combined' }),
        ]);
        if (cancelled) return;
        setServerAggregate({
          od: panelFromServer(od),
          os: panelFromServer(os),
          combined: panelFromServer(combined),
        });
      } catch (err) {
        if (cancelled) return;
        console.warn('[OutcomesView] Server aggregate failed — falling back to client compute', err);
        setServerAggregate(null);
      } finally {
        if (!cancelled) setServerLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [activeMetric, routeServerSide, cohortId, axisMode, yMetric, gridPoints, spreadMode, layers.perPatient, layers.scatter]); // eslint-disable-line react-hooks/exhaustive-deps -- setServerAggregate/setServerLoading are stable setState refs; including would cause loop

  // J2 (v1.15-p4): off-main-thread CLIENT aggregation.
  //
  // For a HEAVY client-side cohort (not server-routed, visus/crt, > threshold) we
  // run computeCohortTrajectory/computeCrtTrajectory in a Web Worker so the main
  // thread stays free for the UI. The result lands in `workerResult` keyed on the
  // exact inputs; the aggregate memos below read it when the key matches and return
  // null otherwise (the OutcomesView client-computing status shows meanwhile).
  //
  // At/below the threshold — and whenever no real Worker exists (jsdom/SSR) — the
  // memos compute synchronously as before, so small cohorts and tests are unaffected.
  const clientWorkerMetric: 'visus' | 'crt' | null =
    !routeServerSide && (activeMetric === 'visus' || activeMetric === 'crt')
      ? activeMetric
      : null;
  const isClientWorkerHeavy =
    clientWorkerMetric !== null &&
    workerAvailable() &&
    !!cohort &&
    cohort.cases.length > CLIENT_WORKER_THRESHOLD_CASES;
  // Key identifies the exact aggregation inputs — a change supersedes any in-flight
  // worker response (matched by id; stale ids are ignored in the client wrapper).
  const workerKey = isClientWorkerHeavy
    ? `${clientWorkerMetric}|${cohortId ?? ''}|${cohort!.cases.length}|${axisMode}|${yMetric}|${gridPoints}|${spreadMode}`
    : null;
  const [workerResult, setWorkerResult] = useState<{ key: string; result: TrajectoryResult } | null>(null);
  useEffect(() => {
    if (!isClientWorkerHeavy || !workerKey || !cohort) return;
    // Avoid re-dispatching once the result for THIS key has landed.
    //
    // NOTE: deliberately NO ref-based "in-flight" guard here. Under React 18
    // StrictMode the effect is mounted → cleaned up → re-mounted in dev; an
    // in-flight ref keyed on workerKey would make the cleanup cancel the first
    // request while the ref blocks the second from dispatching — so NOTHING ever
    // resolves (the status spins forever). Instead we let the second mount dispatch
    // a fresh request; the client wrapper round-trips a request id so the stale
    // (cancelled) first response is ignored, and the second resolves normally.
    if (workerResult?.key === workerKey) return;
    let cancelled = false;
    const input = { cases: cohort.cases, axisMode, yMetric, gridPoints, spreadMode };
    computeTrajectoryAsync(clientWorkerMetric!, input)
      .then((result) => {
        if (!cancelled) setWorkerResult({ key: workerKey, result });
      })
      .catch((err) => {
        // Mirror the server-path fallback: on worker failure, aggregate synchronously
        // on the main thread so the user still sees plots (D-03 throw-only upstream).
        console.warn('[OutcomesView] Worker aggregate failed — falling back to sync compute', err);
        if (!cancelled) {
          try {
            setWorkerResult({ key: workerKey, result: computeTrajectorySync(clientWorkerMetric!, input) });
          } catch {
            /* leave null — the memo will compute synchronously on next render */
          }
        }
      });
    return () => { cancelled = true; };
  }, [isClientWorkerHeavy, workerKey, clientWorkerMetric, cohort, axisMode, yMetric, gridPoints, spreadMode, workerResult]);

  // Resolve the fresh worker result for the CURRENT key (null if heavy + not ready).
  const freshWorkerResult = workerKey && workerResult?.key === workerKey ? workerResult.result : null;

  // K7 (v1.16-A): off-main-thread CROSS-COHORT aggregation.
  //
  // The compare drawer freeze (tester: "Kohorten vergleichen … freezes now and is
  // not usable") is the synchronous N-cohort aggregation below: each selected cohort
  // ran applyFilters + computeCohortTrajectory/computeCrtTrajectory on the MAIN
  // THREAD inside a render memo. Toggling a checkbox in the drawer changes the URL →
  // re-render → N heavy aggregations back-to-back, blocking the drawer's own input
  // handling (the freeze). We move that work into the SAME Web Worker the single-
  // cohort path uses: one request per selected cohort, assembled when all land. The
  // drawer (and the rest of the UI) stays interactive because the main thread is free.
  //
  // Resolve the per-cohort case sets ONCE (cheap applyFilters) — these feed both the
  // worker dispatch and the synchronous fallback / no-worker path below.
  const crossCohortCaseSets = useMemo(() => {
    if (!isCrossMode || crossCohortIds.length === 0) return [];
    return crossCohortIds.flatMap((id, idx) => {
      const saved = savedSearches.find((s) => s.id === id);
      if (!saved) return [];
      const cases = applyFilters(activeCases, saved.filters, filterOptions);
      const color = COHORT_PALETTES[idx % COHORT_PALETTES.length];
      return [{ id, name: saved.name, color, cases }];
    });
  }, [isCrossMode, crossCohortIds, savedSearches, activeCases, filterOptions]);

  const crossMetric: 'visus' | 'crt' = activeMetric === 'crt' ? 'crt' : 'visus';
  // Heavy when a real Worker exists AND the total work is non-trivial — mirrors the
  // single-cohort heavy gate so small compares / tests stay synchronous (no flash,
  // no timer advance needed) while real multi-hundred-case compares go off-thread.
  const isCrossWorkerHeavy =
    isCrossMode &&
    crossCohortCaseSets.length > 0 &&
    workerAvailable() &&
    crossCohortCaseSets.reduce((n, c) => n + c.cases.length, 0) > CLIENT_WORKER_THRESHOLD_CASES;
  // Key identifies the exact cross-cohort aggregation inputs — supersedes any
  // in-flight responses when it changes (matched by key; stale results ignored).
  const crossWorkerKey = isCrossWorkerHeavy
    ? `${crossMetric}|${crossCohortCaseSets.map((c) => `${c.id}:${c.cases.length}`).join(',')}|${axisMode}|${yMetric}|${gridPoints}|${spreadMode}`
    : null;
  const [crossWorkerResult, setCrossWorkerResult] = useState<{
    key: string;
    results: { id: string; result: TrajectoryResult }[];
  } | null>(null);
  useEffect(() => {
    if (!isCrossWorkerHeavy || !crossWorkerKey) return;
    if (crossWorkerResult?.key === crossWorkerKey) return;
    let cancelled = false;
    Promise.all(
      crossCohortCaseSets.map((c) =>
        computeTrajectoryAsync(crossMetric, {
          cases: c.cases,
          axisMode,
          yMetric,
          gridPoints,
          spreadMode,
        }).then((result) => ({ id: c.id, result })),
      ),
    )
      .then((results) => {
        if (!cancelled) setCrossWorkerResult({ key: crossWorkerKey, results });
      })
      .catch((err) => {
        // Mirror the single-cohort + server fallback: on worker failure aggregate
        // synchronously so the user still sees the compare plots (D-03 throw-only).
        console.warn('[OutcomesView] Cross-cohort worker aggregate failed — falling back to sync compute', err);
        if (!cancelled) {
          try {
            const results = crossCohortCaseSets.map((c) => ({
              id: c.id,
              result: computeTrajectorySync(crossMetric, {
                cases: c.cases, axisMode, yMetric, gridPoints, spreadMode,
              }),
            }));
            setCrossWorkerResult({ key: crossWorkerKey, results });
          } catch {
            /* leave null — the memo computes synchronously on next render */
          }
        }
      });
    return () => { cancelled = true; };
  }, [isCrossWorkerHeavy, crossWorkerKey, crossCohortCaseSets, crossMetric, axisMode, yMetric, gridPoints, spreadMode, crossWorkerResult]);

  const freshCrossWorkerResults =
    crossWorkerKey && crossWorkerResult?.key === crossWorkerKey ? crossWorkerResult.results : null;

  // D-26: single memoized aggregate keyed on all 5 inputs — feeds BOTH cards AND panels.
  // Hoisted above early-return guards to satisfy Rules of Hooks (WR-01).
  // Phase 12 / AGG-03: prefers server result when routeServerSide is active.
  const aggregate = useMemo(
    () => {
      if (routeServerSide && serverAggregate) return serverAggregate;
      if (routeServerSide && serverLoading) return null;
      if (!cohort || cohort.cases.length === 0) return null;
      // J2: heavy client cohort → use the worker result; null while it is computing
      // (OutcomesView shows the client-computing status). Never block the main thread
      // with a synchronous compute for the heavy path.
      if (isClientWorkerHeavy && activeMetric === 'visus') return freshWorkerResult;
      return computeCohortTrajectory({
        cases: cohort.cases,
        axisMode,
        yMetric,
        gridPoints,
        spreadMode,
      });
    },
    [routeServerSide, serverAggregate, serverLoading, cohort, axisMode, yMetric, gridPoints, spreadMode, isClientWorkerHeavy, activeMetric, freshWorkerResult],
  );

  // Phase 13 / METRIC-01: CRT aggregate memo.
  const crtAggregate = useMemo(
    () => {
      if (activeMetric !== 'crt') return null;
      if (routeServerSide && serverAggregate) return serverAggregate;
      if (routeServerSide && serverLoading) return null;
      if (!cohort || cohort.cases.length === 0) return null;
      // J2: heavy client cohort → worker result (null while computing).
      if (isClientWorkerHeavy) return freshWorkerResult;
      return computeCrtTrajectory({
        cases: cohort.cases,
        axisMode,
        yMetric,
        gridPoints,
        spreadMode,
      });
    },
    [activeMetric, routeServerSide, serverAggregate, serverLoading, cohort, axisMode, yMetric, gridPoints, spreadMode, isClientWorkerHeavy, freshWorkerResult],
  );

  // Phase 16 / XCOHORT-01..04: per-cohort aggregate memo.
  const crossCohortAggregates = useMemo((): null | {
    od: CohortSeriesEntry[]; os: CohortSeriesEntry[]; combined: CohortSeriesEntry[];
  } => {
    if (!isCrossMode || crossCohortCaseSets.length === 0) return null;
    // K7: heavy compare → use the off-thread worker results; null while they are
    // computing (OutcomesView shows the client-computing status). Never block the
    // main thread (and therefore the drawer) with the synchronous N-cohort compute.
    if (isCrossWorkerHeavy) {
      if (!freshCrossWorkerResults) return null;
      const byId = new Map(freshCrossWorkerResults.map((r) => [r.id, r.result]));
      const od: CohortSeriesEntry[] = [];
      const os: CohortSeriesEntry[] = [];
      const combined: CohortSeriesEntry[] = [];
      crossCohortCaseSets.forEach((c) => {
        const result = byId.get(c.id);
        if (!result) return;
        const base = { cohortId: c.id, cohortName: c.name, patientCount: c.cases.length, color: c.color };
        od.push({ ...base, panel: result.od });
        os.push({ ...base, panel: result.os });
        combined.push({ ...base, panel: result.combined });
      });
      return { od, os, combined };
    }
    // Small compare / no-worker (tests, SSR): synchronous compute as before.
    const od: CohortSeriesEntry[] = [];
    const os: CohortSeriesEntry[] = [];
    const combined: CohortSeriesEntry[] = [];
    crossCohortCaseSets.forEach((c) => {
      const result = activeMetric === 'crt'
        ? computeCrtTrajectory({ cases: c.cases, axisMode, yMetric, gridPoints, spreadMode })
        : computeCohortTrajectory({ cases: c.cases, axisMode, yMetric, gridPoints, spreadMode });
      const base = { cohortId: c.id, cohortName: c.name, patientCount: c.cases.length, color: c.color };
      od.push({ ...base, panel: result.od });
      os.push({ ...base, panel: result.os });
      combined.push({ ...base, panel: result.combined });
    });
    return { od, os, combined };
  }, [isCrossMode, crossCohortCaseSets, isCrossWorkerHeavy, freshCrossWorkerResults, activeMetric, axisMode, yMetric, gridPoints, spreadMode]);

  // Phase 42 / ANL-010: per-cohort case series for interval histogram + responder view.
  // Uses the same cohort order and COHORT_PALETTES index as crossCohortAggregates so
  // colors are consistent across all four metric tabs.
  const crossCohortCaseSeries = useMemo((): IntervalCohortSeries[] => {
    // K7: reuse the already-resolved per-cohort case sets (one applyFilters pass)
    // instead of re-filtering — same cohort order + colours as crossCohortAggregates.
    return crossCohortCaseSets.map((c) => ({
      cohortId: c.id,
      cohortName: c.name,
      patientCount: c.cases.length,
      color: c.color,
      cases: c.cases,
    }));
  }, [crossCohortCaseSets]);

  // J2: true while a heavy client cohort is being aggregated in the worker and the
  // result for the current key has not arrived yet — OutcomesView keeps the client-
  // computing status visible (no bare white/empty cards) until it lands.
  const clientWorkerPending = isClientWorkerHeavy && freshWorkerResult === null;

  // K7: true while the heavy cross-cohort aggregation is still off-thread — drives
  // the compare "computing" status so the panels never render with null series.
  const crossWorkerPending = isCrossWorkerHeavy && freshCrossWorkerResults === null;

  return { routeServerSide, aggregate, crtAggregate, crossCohortAggregates, crossCohortCaseSeries, clientWorkerPending, crossWorkerPending };
}
