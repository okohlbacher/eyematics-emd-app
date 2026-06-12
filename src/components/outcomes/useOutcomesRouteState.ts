/**
 * useOutcomesRouteState — Phase 44 / TECH-02 extraction from OutcomesView.tsx.
 *
 * Owns: URL param parsing (?cohort/?cohorts/?filter/?metric), cohort resolution,
 * cross-cohort id list, all session-only toggle state (axisMode/yMetric/etc.),
 * metric change/keydown handlers, compare drawer handlers, recent-activity +
 * audit beacon effects, drill-down handler, patientCounts memo.
 *
 * CRITICAL — Rules of Hooks (WR-01 / Pitfall 3): All hooks run in their original
 * top-to-bottom order from OutcomesView. The aggregation hook (useOutcomesAggregation)
 * receives all state values as arguments rather than owning its own state, so call
 * order is preserved and there are no conditional hook calls.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useData } from '../../context/DataContext';
import { useLanguage } from '../../context/LanguageContext';
import { useRecentActivity } from '../../hooks/useRecentActivity';
import { authFetch } from '../../services/authHeaders';
import { applyFilters } from '../../services/fhirLoader';
import { getSettings, loadSettings } from '../../services/settingsService';
import { safePickCohortFilter } from '../../utils/cohortFilterSerialization';
import {
  type AxisMode,
  defaultScatterOn,
  type SpreadMode,
  type TrajectoryResult,
  type YMetric,
} from '../../utils/cohortTrajectory';

// ---------------------------------------------------------------------------
// Metric types + constants (METRIC-04) — exported for tab strip + aggregation
// ---------------------------------------------------------------------------

// A6 (perf): above this distinct-patient count the per-patient line layer
// defaults OFF (thousands of <Line> SVG nodes otherwise dominate render cost).
// The toggle remains available as opt-in; an explicit user choice overrides the
// derived default. Distinct pseudonyms — not case count — drives this since the
// per-patient layer draws one line per patient.
export const PER_PATIENT_DEFAULT_OFF_THRESHOLD = 100;

/** Distinct-patient count for a cohort's cases (one pseudonym = one patient). */
export function distinctPatientCount(cases: { pseudonym?: string }[]): number {
  const set = new Set<string>();
  for (const c of cases) {
    if (typeof c.pseudonym === 'string' && c.pseudonym) set.add(c.pseudonym);
  }
  return set.size;
}

export type MetricType = 'visus' | 'crt' | 'interval' | 'responder';
export const VALID_METRICS = new Set<MetricType>(['visus', 'crt', 'interval', 'responder']);
export const METRIC_TAB_ORDER: readonly MetricType[] = ['visus', 'crt', 'interval', 'responder'] as const;

export function metricTitleKey(m: MetricType): 'metricsVisus' | 'metricsCrt' | 'metricsInterval' | 'metricsResponder' {
  if (m === 'crt') return 'metricsCrt';
  if (m === 'interval') return 'metricsInterval';
  if (m === 'responder') return 'metricsResponder';
  return 'metricsVisus';
}

export type LayerState = {
  median: boolean;
  perPatient: boolean;
  scatter: boolean;
  spreadBand: boolean;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOutcomesRouteState() {
  const { activeCases, savedSearches } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, locale } = useLanguage();
  const { record } = useRecentActivity();
  const navigate = useNavigate();

  // Phase 33: compute filter options once from getSettings() — passed to all applyFilters calls
  // so preset predicates evaluate against configured thresholds rather than applyFilters fallbacks.
  const filterOptions = useMemo(() => {
    const s = getSettings();
    return {
      therapyInterrupterDays: s.therapyInterrupterDays,
      therapyBreakerDays: s.therapyBreakerDays,
      crtImplausibleThresholdUm: s.crtImplausibleThresholdUm,
    };
  }, []); // settings are a stable singleton; recompute never needed within component lifetime

  // Phase 16 / XCOHORT-01..04: cross-cohort URL parsing (placed here, above any early return, per Pitfall 3 hook-order rule).
  const rawCohortsParam = searchParams.get('cohorts');
  const primaryCohortId = searchParams.get('cohort');
  const isCrossMode = Boolean(rawCohortsParam);

  // Parse, cap at 4, drop unknown ids, always include primary first.
  const crossCohortIds: string[] = useMemo(() => {
    if (!rawCohortsParam) return [];
    const raw = rawCohortsParam.split(',').map((s) => s.trim()).filter(Boolean);
    const known = raw.filter((id) => savedSearches.some((s) => s.id === id));
    const withPrimary = primaryCohortId && !known.includes(primaryCohortId)
      ? [primaryCohortId, ...known]
      : known;
    return withPrimary.slice(0, 4);
  }, [rawCohortsParam, primaryCohortId, savedSearches]);

  // Session-only toggle state (D-24).
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [axisMode, setAxisMode] = useState<AxisMode>('days');
  const [yMetric, setYMetric] = useState<YMetric>('delta');
  const [gridPoints, setGridPoints] = useState<number>(120);
  const [spreadMode] = useState<SpreadMode>('iqr');
  const [layers, setLayers] = useState<LayerState>({
    median: true, perPatient: true, scatter: true, spreadBand: true,
  });

  // A6 (perf): tracks whether the user has explicitly toggled the per-patient
  // layer. Once they have, the large-cohort default never overrides their choice.
  const perPatientUserOverriddenRef = useRef(false);
  // FALL-010 (live-browser find): same pattern for the scatter layer — the D-37
  // default-off effect below used to refire on every cohort identity change and
  // instantly revert the user's toggle, making scatter impossible to enable for
  // cohorts above the default threshold (and drill-down points unreachable).
  const scatterUserOverriddenRef = useRef(false);
  // True when the large-cohort default forced perPatient OFF (drives the notice).
  const [perPatientDefaultedOff, setPerPatientDefaultedOff] = useState(false);

  // A6: a setLayers wrapper for the per-patient layer that records the explicit
  // user override so the derived default no longer applies on later cohort changes.
  const setLayersWithOverride = useCallback(
    (updater: (L: LayerState) => LayerState) => {
      setLayers((prev) => {
        const next = updater(prev);
        if (next.perPatient !== prev.perPatient) {
          perPatientUserOverriddenRef.current = true;
        }
        if (next.scatter !== prev.scatter) {
          scatterUserOverriddenRef.current = true;
        }
        return next;
      });
    },
    [],
  );

  // Phase 12 / AGG-03 / D-13 — server-side routing state.
  const [threshold, setThreshold] = useState<number>(1000);
  const [serverAggregate, setServerAggregate] = useState<TrajectoryResult | null>(null);
  const [serverLoading, setServerLoading] = useState(false);

  // Phase 13 / METRIC-04: active metric derived from URL (D-01).
  const rawMetric = searchParams.get('metric');
  const activeMetric: MetricType = (rawMetric && VALID_METRICS.has(rawMetric as MetricType))
    ? (rawMetric as MetricType)
    : 'visus';

  // Phase 13 / D-05: responder threshold (session-only, resets on reload).
  const [thresholdLetters, setThresholdLetters] = useState<number>(5);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await loadSettings();
        if (cancelled) return;
        const t = s.outcomes?.serverAggregationThresholdPatients;
        if (typeof t === 'number' && Number.isFinite(t) && t > 0) setThreshold(t);
      } catch {
        /* keep default */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Cohort resolution (OUTCOME-01 / D-03)
  const cohort = useMemo(() => {
    const cohortId = searchParams.get('cohort');
    const filterParam = searchParams.get('filter');
    if (cohortId) {
      const saved = savedSearches.find((s) => s.id === cohortId);
      return saved ? { name: saved.name, cases: applyFilters(activeCases, saved.filters, filterOptions) } : null;
    }
    if (filterParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(filterParam));
        return { name: null, cases: applyFilters(activeCases, safePickCohortFilter(parsed), filterOptions) };
      } catch { return null; }
    }
    return { name: null, cases: activeCases };
  }, [activeCases, savedSearches, searchParams, filterOptions]);

  // FALL-010: drill-down handler — resolves scatter patientId (pseudonym) to PatientCase.id
  // within the already-authorized cohort.cases set; navigates to /case/:id.
  // Unknown pseudonyms produce no navigation (IDOR gate T-43-03).
  const handlePointDrillDown = useCallback(
    (patientId: string) => {
      if (!cohort) return;
      const found = cohort.cases.find((c) => c.pseudonym === patientId);
      if (found) {
        navigate(`/case/${found.id}`);
      }
    },
    [cohort, navigate],
  );

  // Record a recent-activity entry when a cohort is active (UX-02).
  // Keyed on primaryCohortId so recording updates when the user switches cohorts.
  // path captures the full URL so cohort/filter params are preserved for restoration.
  useEffect(() => {
    if (!cohort || cohort.cases.length === 0) return;
    record({
      id: primaryCohortId ?? 'outcomes',
      label: cohort.name ?? t('outcomesTitle'),
      sub: t('outcomesTitle'),
      path: window.location.pathname + window.location.search,
    });
  }, [primaryCohortId]); // eslint-disable-line react-hooks/exhaustive-deps -- record/t/cohort are stable per primaryCohortId change

  // D-37 default-scatter-off once cohort size known. FALL-010: a derived
  // DEFAULT, not a clamp — once the user explicitly toggles scatter, never
  // override their choice again (mirrors the A6 perPatient override pattern).
  useEffect(() => {
    if (scatterUserOverriddenRef.current) return;
    if (cohort && !defaultScatterOn(cohort.cases.length)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derive-from-cohort-size on cohort change; cohort is async-loaded so lifting to useMemo would require parent reshuffle. Deferred.
      setLayers((L) => (L.scatter ? { ...L, scatter: false } : L));
    }
  }, [cohort]);

  // A6 (perf): default the per-patient layer OFF for large cohorts (>100 distinct
  // patients) BEFORE aggregation/render — the server request and the panel render
  // both key off layers.perPatient, so this derived default must land before they
  // run (it does: this hook runs before useOutcomesAggregation, and the effect's
  // setLayers schedules a re-render that re-evaluates aggregation with the new
  // value). An explicit user toggle (perPatientUserOverriddenRef) wins permanently.
  useEffect(() => {
    if (!cohort) return;
    if (perPatientUserOverriddenRef.current) return;
    const large = distinctPatientCount(cohort.cases) > PER_PATIENT_DEFAULT_OFF_THRESHOLD;
    setPerPatientDefaultedOff(large);
    setLayers((L) => (L.perPatient === !large ? L : { ...L, perPatient: !large }));
  }, [cohort]);

  // Audit beacon (Phase 11 / CRREV-01) — fire-and-forget POST, once per mount.
  useEffect(() => {
    const cid = searchParams.get('cohort');
    const fp = searchParams.get('filter');
    const body: Record<string, unknown> = { name: 'open_outcomes_view' };
    if (cid) body.cohortId = cid;
    if (fp) {
      try {
        body.filter = JSON.parse(decodeURIComponent(fp));
      } catch {
        // Malformed filter param — drop from the beacon payload.
      }
    }
    void (async () => {
      try {
        await authFetch('/api/audit/events/view-open', {
          method: 'POST',
          body: JSON.stringify(body),
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          credentials: 'include', // Phase 20 cookie-auth contract (TEST-03, v1.9 Phase 21)
        });
      } catch {
        /* beacon is fire-and-forget (D-03) */
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- audit beacon fires once on mount; intentionally empty deps (Phase 11 CRREV-01)

  // Phase 12 / AGG-03 / D-13 — size-based routing to server endpoint.
  // Phase 16 / Pitfall 6: bypass server routing in cross-cohort mode.
  const cohortId = searchParams.get('cohort');

  // Phase 13 / METRIC-04: metric change handler (preserves cohort/filter params).
  const resetToMetricDefaults = (m: MetricType) => {
    if (m === 'visus' || m === 'crt') {
      setYMetric('delta');
      setAxisMode('days');
      setLayers({
        median: true,
        perPatient: true,
        scatter: defaultScatterOn(cohort?.cases.length ?? 0),
        spreadBand: true,
      });
    }
    // interval / responder: no reset needed — they ignore yMetric/axisMode/layers.
  };

  const handleMetricChange = (m: MetricType) => {
    setSearchParams((p) => {
      p.set('metric', m);
      return p;
    });
    resetToMetricDefaults(m);
  };

  const handleMetricKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, current: MetricType) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const idx = METRIC_TAB_ORDER.indexOf(current);
    const next = e.key === 'ArrowRight'
      ? METRIC_TAB_ORDER[(idx + 1) % METRIC_TAB_ORDER.length]
      : METRIC_TAB_ORDER[(idx - 1 + METRIC_TAB_ORDER.length) % METRIC_TAB_ORDER.length];
    handleMetricChange(next);
  };

  // Phase 16: patient counts for the compare drawer.
  const patientCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    savedSearches.forEach((s) => {
      counts[s.id] = applyFilters(activeCases, s.filters, filterOptions).length;
    });
    return counts;
  }, [savedSearches, activeCases, filterOptions]);

  // Phase 16: drawer onChange + onReset handlers.
  const handleCompareChange = (nextIds: string[]) => {
    setSearchParams((p) => {
      // If no primary is set in the URL, promote the first selection to primary
      // so single-selection clicks in the drawer produce visible state.
      const primary = primaryCohortId ?? nextIds[0] ?? null;
      const ensured = primary && !nextIds.includes(primary) ? [primary, ...nextIds] : nextIds;
      const capped = ensured.slice(0, 4);
      if (capped.length >= 2) {
        p.set('cohorts', capped.join(','));
        // D-05: ?cohorts= takes precedence — remove ?cohort= to avoid ambiguity, then re-add primary.
        p.delete('cohort');
        if (primary) p.set('cohort', primary);
      } else {
        p.delete('cohorts');
        if (primary) p.set('cohort', primary);
      }
      return p;
    });
  };

  const handleCompareReset = () => {
    setSearchParams((p) => {
      p.delete('cohorts');
      if (primaryCohortId) p.set('cohort', primaryCohortId);
      return p;
    });
    setCompareOpen(false);
  };

  return {
    t,
    locale,
    navigate,
    searchParams,
    setSearchParams,
    filterOptions,
    isCrossMode,
    primaryCohortId,
    crossCohortIds,
    cohort,
    cohortId,
    activeMetric,
    handlePointDrillDown,
    handleMetricChange,
    handleMetricKeyDown,
    patientCounts,
    handleCompareChange,
    handleCompareReset,
    drawerOpen,
    setDrawerOpen,
    compareOpen,
    setCompareOpen,
    axisMode,
    setAxisMode,
    yMetric,
    setYMetric,
    gridPoints,
    setGridPoints,
    spreadMode,
    layers,
    setLayers,
    // A6: wrapper that records explicit user toggles (so the large-cohort default
    // stops overriding); + flag for the "defaulted off" notice near the layer toggle.
    setLayersWithOverride,
    perPatientDefaultedOff,
    threshold,
    serverAggregate,
    setServerAggregate,
    serverLoading,
    setServerLoading,
    thresholdLetters,
    setThresholdLetters,
    // Also expose activeCases + savedSearches so aggregation hook can use them
    activeCases,
    savedSearches,
  };
}
