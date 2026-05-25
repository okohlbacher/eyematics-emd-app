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
import { useEffect, useMemo } from 'react';

import { computeCrtTrajectory } from '../../../shared/cohortTrajectory';
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
import type { IntervalCohortSeries } from './IntervalHistogram';
import type { CohortSeriesEntry } from './OutcomesPanel';
import { COHORT_PALETTES } from './palette';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RouteState {
  isCrossMode: boolean;
  crossCohortIds: string[];
  cohort: { name: string | null; cases: import('../../context/DataContext').PatientCase[] } | null;
  cohortId: string | null;
  activeMetric: import('./useOutcomesRouteState').MetricType;
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
  savedSearches: import('../../context/DataContext').SavedSearch[];
  activeCases: import('../../context/DataContext').PatientCase[];
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
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing server cache when metric switches away; required to avoid stale data. Refactor to derived state is Phase 23 deferred.
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

  // D-26: single memoized aggregate keyed on all 5 inputs — feeds BOTH cards AND panels.
  // Hoisted above early-return guards to satisfy Rules of Hooks (WR-01).
  // Phase 12 / AGG-03: prefers server result when routeServerSide is active.
  const aggregate = useMemo(
    () => {
      if (routeServerSide && serverAggregate) return serverAggregate;
      if (routeServerSide && serverLoading) return null;
      if (!cohort || cohort.cases.length === 0) return null;
      return computeCohortTrajectory({
        cases: cohort.cases,
        axisMode,
        yMetric,
        gridPoints,
        spreadMode,
      });
    },
    [routeServerSide, serverAggregate, serverLoading, cohort, axisMode, yMetric, gridPoints, spreadMode],
  );

  // Phase 13 / METRIC-01: CRT aggregate memo.
  const crtAggregate = useMemo(
    () => {
      if (activeMetric !== 'crt') return null;
      if (routeServerSide && serverAggregate) return serverAggregate;
      if (routeServerSide && serverLoading) return null;
      if (!cohort || cohort.cases.length === 0) return null;
      return computeCrtTrajectory({
        cases: cohort.cases,
        axisMode,
        yMetric,
        gridPoints,
        spreadMode,
      });
    },
    [activeMetric, routeServerSide, serverAggregate, serverLoading, cohort, axisMode, yMetric, gridPoints, spreadMode],
  );

  // Phase 16 / XCOHORT-01..04: per-cohort aggregate memo.
  const crossCohortAggregates = useMemo((): null | {
    od: CohortSeriesEntry[]; os: CohortSeriesEntry[]; combined: CohortSeriesEntry[];
  } => {
    if (!isCrossMode || crossCohortIds.length === 0) return null;
    const od: CohortSeriesEntry[] = [];
    const os: CohortSeriesEntry[] = [];
    const combined: CohortSeriesEntry[] = [];
    crossCohortIds.forEach((id, idx) => {
      const saved = savedSearches.find((s) => s.id === id);
      if (!saved) return;
      const cases = applyFilters(activeCases, saved.filters, filterOptions);
      const result = activeMetric === 'crt'
        ? computeCrtTrajectory({ cases, axisMode, yMetric, gridPoints, spreadMode })
        : computeCohortTrajectory({ cases, axisMode, yMetric, gridPoints, spreadMode });
      const color = COHORT_PALETTES[idx % COHORT_PALETTES.length];
      const base = {
        cohortId: id,
        cohortName: saved.name,
        patientCount: cases.length,
        color,
      };
      od.push({ ...base, panel: result.od });
      os.push({ ...base, panel: result.os });
      combined.push({ ...base, panel: result.combined });
    });
    return { od, os, combined };
  }, [isCrossMode, crossCohortIds, savedSearches, activeCases, activeMetric, axisMode, yMetric, gridPoints, spreadMode, filterOptions]);

  // Phase 42 / ANL-010: per-cohort case series for interval histogram + responder view.
  // Uses the same cohort order and COHORT_PALETTES index as crossCohortAggregates so
  // colors are consistent across all four metric tabs.
  const crossCohortCaseSeries = useMemo((): IntervalCohortSeries[] => {
    if (!isCrossMode || crossCohortIds.length === 0) return [];
    return crossCohortIds.flatMap((id, idx) => {
      const saved = savedSearches.find((s) => s.id === id);
      if (!saved) return [];
      const cases = applyFilters(activeCases, saved.filters, filterOptions);
      const color = COHORT_PALETTES[idx % COHORT_PALETTES.length];
      return [{ cohortId: id, cohortName: saved.name, patientCount: cases.length, color, cases }];
    });
  }, [isCrossMode, crossCohortIds, savedSearches, activeCases, filterOptions]);

  return { routeServerSide, aggregate, crtAggregate, crossCohortAggregates, crossCohortCaseSeries };
}
