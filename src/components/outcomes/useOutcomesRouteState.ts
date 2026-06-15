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

import type { PatientCase, SavedSearch } from '../../../shared/types/fhir';
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

/**
 * I2 (v1.14-p4): derive the size-based layer defaults from a cohort's cases.
 *
 * This is the SINGLE source of truth for "what should the layers look like for a
 * cohort of this size, absent any explicit user override". It is used both for the
 * lazy useState initializer (so the FIRST render of a large cohort already has
 * scatter + per-patient OFF — no ~14k-circle first paint) and for the reset/
 * re-derive paths. Keeping it pure + exported lets the tests assert the first-render
 * layer state without rendering the heavy chart.
 *
 * - scatter: ON iff cases.length ≤ 30 (defaultScatterOn / D-37).
 * - perPatient: ON iff distinct patients ≤ 100 (PER_PATIENT_DEFAULT_OFF_THRESHOLD / A6).
 * - median + spreadBand: always ON by default (cheap; one series each).
 */
export function deriveDefaultLayers(cases: { pseudonym?: string }[]): LayerState {
  return {
    median: true,
    perPatient: distinctPatientCount(cases) <= PER_PATIENT_DEFAULT_OFF_THRESHOLD,
    scatter: defaultScatterOn(cases.length),
    spreadBand: true,
  };
}

/**
 * I2 (v1.14-p4): resolve the active cohort synchronously from URL params + data.
 *
 * Extracted from the cohort useMemo so the lazy layer-state initializer can compute
 * the initial cohort size BEFORE the first render (the memo runs after useState, too
 * late to seed the initializer). Pure — no hooks.
 */
export function resolveCohort(
  searchParams: URLSearchParams,
  activeCases: PatientCase[],
  savedSearches: SavedSearch[],
  filterOptions: FilterOptions,
): { name: string | null; cases: PatientCase[] } | null {
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
}

type FilterOptions = {
  therapyInterrupterDays: number;
  therapyBreakerDays: number;
  crtImplausibleThresholdUm: number;
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
  // C3: the cohort-split wizard navigates here with ?compare=open so the compare
  // drawer auto-opens on the freshly created sub-cohorts. Read once at mount.
  const [compareOpen, setCompareOpen] = useState(() => searchParams.get('compare') === 'open');
  const [axisMode, setAxisMode] = useState<AxisMode>('days');
  const [yMetric, setYMetric] = useState<YMetric>('delta');
  const [gridPoints, setGridPoints] = useState<number>(120);
  const [spreadMode] = useState<SpreadMode>('iqr');
  // I2 (v1.14-p4): derive the size-based layer defaults BEFORE the first render so a
  // large cohort never paints scatter (~14k SVG circles) on first paint and then
  // strips it in a post-render effect (the old freeze). The lazy initializer resolves
  // the initial cohort synchronously from the same URL params + data the cohort memo
  // uses below, then derives scatter/per-patient from its size. Later cohort changes
  // are still handled by the override-guarded effects further down.
  const [layers, setLayers] = useState<LayerState>(() => {
    const initialCohort = resolveCohort(searchParams, activeCases, savedSearches, filterOptions);
    return deriveDefaultLayers(initialCohort?.cases ?? []);
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
  // I2 (v1.14-p4): seed from the initial cohort size so the notice is accurate on the
  // FIRST render too (matches the lazy layers initializer above).
  const [perPatientDefaultedOff, setPerPatientDefaultedOff] = useState(
    () => !layers.perPatient,
  );

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

  // Cohort resolution (OUTCOME-01 / D-03) — delegates to the shared pure resolver
  // (I2 v1.14-p4) so the lazy layer-state initializer above derives from the SAME
  // cohort the panels render.
  const cohort = useMemo(
    () => resolveCohort(searchParams, activeCases, savedSearches, filterOptions),
    [activeCases, savedSearches, searchParams, filterOptions],
  );

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

  // I2 (v1.14-p4): RE-derive the size-based layer defaults when the cohort CHANGES.
  //
  // The FIRST render is already correct (the lazy layers initializer above derives
  // from the initial cohort) — this effect exists only to react to LATER cohort
  // identity changes (cohort switch, filter edit) without reintroducing the freeze.
  // It consolidates the former separate scatter (D-37/FALL-010) and per-patient (A6)
  // auto-off effects:
  //   - Each layer is re-derived from the new cohort size unless the user has
  //     explicitly toggled it (the *UserOverriddenRef guards) — preserving the
  //     v1.13 F3 / FALL-010 override behaviour (a manually-enabled layer is never
  //     auto-reverted on a metric-tab switch or cohort change).
  //   - perPatient drives the "defaulted off" notice flag.
  //   - setLayers updater is a no-op (returns prev) when nothing changed, so this
  //     never schedules an extra render on the initial mount where the lazy init
  //     already matches.
  useEffect(() => {
    if (!cohort) return;
    const desiredPerPatient = distinctPatientCount(cohort.cases) <= PER_PATIENT_DEFAULT_OFF_THRESHOLD;
    if (!perPatientUserOverriddenRef.current) {
      setPerPatientDefaultedOff(!desiredPerPatient);
    }
    const desiredScatter = defaultScatterOn(cohort.cases.length);
    setLayers((L) => {
      let next = L;
      if (!perPatientUserOverriddenRef.current && L.perPatient !== desiredPerPatient) {
        next = { ...next, perPatient: desiredPerPatient };
      }
      // D-37/FALL-010: large-cohort scatter default is OFF only — derive it the same
      // way as the lazy init (ON iff ≤30 cases) so a shrink back below the threshold
      // also restores it, but never against an explicit user toggle.
      if (!scatterUserOverriddenRef.current && L.scatter !== desiredScatter) {
        next = { ...next, scatter: desiredScatter };
      }
      return next;
    });
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

  // A6 (F3): re-derive the large-cohort per-patient default from the CURRENT cohort
  // rather than forcing perPatient ON. A reset (metric switch or the drawer's
  // "reset defaults" button) must NOT defeat the >100-distinct-patient auto-off —
  // it resets to the DERIVED default, not to true. Also resets the override ref so
  // the cohort-change effect can keep deriving (the reset itself is not a user
  // toggle of the checkbox). The notice flag is kept in sync.
  const derivePerPatientDefaultOn = useCallback((): boolean => {
    const large =
      cohort != null &&
      distinctPatientCount(cohort.cases) > PER_PATIENT_DEFAULT_OFF_THRESHOLD;
    setPerPatientDefaultedOff(large);
    return !large;
  }, [cohort]);

  // Phase 13 / METRIC-04: metric change handler (preserves cohort/filter params).
  const resetToMetricDefaults = (m: MetricType) => {
    if (m === 'visus' || m === 'crt') {
      setYMetric('delta');
      setAxisMode('days');
      // I2 (v1.14-p4) — override-persistence: a metric-tab switch must NOT revert a
      // layer the user explicitly toggled (the F3 wedge, re-confirmed for scatter:
      // the old code reset scatter to the size-derived default on every switch,
      // silently disabling a manually-enabled scatter on a large cohort).
      //   - A layer with an active user-override ref keeps its CURRENT value.
      //   - A non-overridden layer is re-derived from cohort size (NOT forced true —
      //     preserves the original F3 fix: a large cohort keeps per-patient OFF).
      // The override refs are NOT cleared here (only the explicit "reset defaults"
      // button clears them). perPatientDefaultedOff is kept accurate via
      // derivePerPatientDefaultOn only when per-patient is not overridden.
      setLayers((prev) => ({
        median: true,
        perPatient: perPatientUserOverriddenRef.current
          ? prev.perPatient
          : derivePerPatientDefaultOn(),
        scatter: scatterUserOverriddenRef.current
          ? prev.scatter
          : defaultScatterOn(cohort?.cases.length ?? 0),
        spreadBand: true,
      }));
    }
    // interval / responder: no reset needed — they ignore yMetric/axisMode/layers.
  };

  // F3: the Settings "reset defaults" button routes through here instead of the
  // override-marking setLayersWithOverride. Re-derives the large-cohort per-patient
  // default and clears the override ref, so reset respects the >100 auto-off.
  const resetLayersToDefaults = useCallback(() => {
    perPatientUserOverriddenRef.current = false;
    // I2 review (HIGH): also clear the scatter override, else "reset defaults"
    // resets the value but leaves scatter pinned out of the auto-derive effect
    // (it would never re-derive on a later cohort switch).
    scatterUserOverriddenRef.current = false;
    setLayers(() => ({
      median: true,
      perPatient: derivePerPatientDefaultOn(),
      scatter: defaultScatterOn(cohort?.cases.length ?? 0),
      spreadBand: true,
    }));
  }, [cohort, derivePerPatientDefaultOn]);

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
      // J7 (v1.15-p3): only KEEP an already-locked primary (the ?cohort= the view was
      // opened with). Do NOT promote nextIds[0] to a new locked primary — the cohort-
      // split flow opens compare with ?cohorts= and NO ?cohort=, and the sub-cohorts
      // must all stay freely deselectable (nothing force-locked). When a primary
      // already exists it is preserved + kept selected (the single-cohort→compare flow
      // it was opened from is unchanged).
      const primary = primaryCohortId ?? null;
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
    // F3: reset-to-defaults that re-derives the large-cohort per-patient default
    // (drawer "reset defaults" button) instead of marking a user override.
    resetLayersToDefaults,
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
