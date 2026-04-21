/**
 * Cohort Outcome Trajectories view — OUTCOME-01..12 / Phase 09.
 *
 * Rendered as the "Trajectories" tab inside AnalysisPage. Formerly lived at
 * its own route /outcomes (src/pages/OutcomesPage.tsx, removed 2026-04-16).
 * Route resolution (?cohort / ?filter) and the audit beacon on mount are
 * preserved — the beacon now fires when this component mounts (i.e. when
 * the user switches to the Trajectories tab).
 *
 * Phase 13 / METRIC-04: inline metric tab strip (?metric= URL param).
 */
import { useEffect, useMemo, useState } from 'react';
import { Settings, GitCompare } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { useData } from '../../context/DataContext';
import { useLanguage } from '../../context/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
import { authFetch } from '../../services/authHeaders';
import { applyFilters } from '../../services/fhirLoader';
import { postAggregate, type AggregateResponse } from '../../services/outcomesAggregateService';
import { loadSettings } from '../../services/settingsService';
import type { CohortFilter } from '../../types/fhir';
import {
  type AxisMode,
  computeCohortTrajectory,
  defaultScatterOn,
  type PanelResult,
  type SpreadMode,
  type TrajectoryResult,
  type YMetric,
} from '../../utils/cohortTrajectory';
import { computeCrtTrajectory } from '../../../shared/cohortTrajectory';
import OutcomesDataPreview from './OutcomesDataPreview';
import OutcomesEmptyState from './OutcomesEmptyState';
import IntervalHistogram from './IntervalHistogram';
import OutcomesPanel from './OutcomesPanel';
import ResponderView from './ResponderView';
import OutcomesSettingsDrawer from './OutcomesSettingsDrawer';
import OutcomesSummaryCards from './OutcomesSummaryCards';
import CohortCompareDrawer from './CohortCompareDrawer';
import type { CohortSeriesEntry } from './OutcomesPanel';
import { EYE_COLORS, COHORT_PALETTES } from './palette';

// ---------------------------------------------------------------------------
// Metric types + constants (METRIC-04)
// ---------------------------------------------------------------------------

type MetricType = 'visus' | 'crt' | 'interval' | 'responder';
const VALID_METRICS = new Set<MetricType>(['visus', 'crt', 'interval', 'responder']);
const METRIC_TAB_ORDER: readonly MetricType[] = ['visus', 'crt', 'interval', 'responder'] as const;

function metricTitleKey(m: MetricType): 'metricsVisus' | 'metricsCrt' | 'metricsInterval' | 'metricsResponder' {
  if (m === 'crt') return 'metricsCrt';
  if (m === 'interval') return 'metricsInterval';
  if (m === 'responder') return 'metricsResponder';
  return 'metricsVisus';
}

// M-04 safe-pick pattern (mirrors AnalysisPage.tsx filter parsing).
function safePickFilter(raw: unknown): CohortFilter {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const parsed = raw as Record<string, unknown>;
  const safe: CohortFilter = {};
  if (Array.isArray(parsed.diagnosis)) safe.diagnosis = parsed.diagnosis.map(String);
  if (Array.isArray(parsed.gender)) safe.gender = parsed.gender.map(String);
  if (Array.isArray(parsed.ageRange) && parsed.ageRange.length === 2) safe.ageRange = [Number(parsed.ageRange[0]), Number(parsed.ageRange[1])];
  if (Array.isArray(parsed.visusRange) && parsed.visusRange.length === 2) safe.visusRange = [Number(parsed.visusRange[0]), Number(parsed.visusRange[1])];
  if (Array.isArray(parsed.crtRange) && parsed.crtRange.length === 2) safe.crtRange = [Number(parsed.crtRange[0]), Number(parsed.crtRange[1])];
  if (Array.isArray(parsed.centers)) safe.centers = parsed.centers.map(String);
  return safe;
}

type LayerState = {
  median: boolean;
  perPatient: boolean;
  scatter: boolean;
  spreadBand: boolean;
};

export default function OutcomesView() {
  const { activeCases, savedSearches } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, locale } = useLanguage();

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
    loadSettings().then((s) => {
      const t = s.outcomes?.serverAggregationThresholdPatients;
      if (typeof t === 'number' && Number.isFinite(t) && t > 0) setThreshold(t);
    }).catch(() => { /* keep default */ });
  }, []);

  // Cohort resolution (OUTCOME-01 / D-03)
  const cohort = useMemo(() => {
    const cohortId = searchParams.get('cohort');
    const filterParam = searchParams.get('filter');
    if (cohortId) {
      const saved = savedSearches.find((s) => s.id === cohortId);
      return saved ? { name: saved.name, cases: applyFilters(activeCases, saved.filters) } : null;
    }
    if (filterParam) {
      try {
        const parsed = JSON.parse(decodeURIComponent(filterParam));
        return { name: null, cases: applyFilters(activeCases, safePickFilter(parsed)) };
      } catch { return null; }
    }
    return { name: null, cases: activeCases };
  }, [activeCases, savedSearches, searchParams]);

  // D-37 default-scatter-off once cohort size known
  useEffect(() => {
    if (cohort && !defaultScatterOn(cohort.cases.length)) {
      setLayers((L) => ({ ...L, scatter: false }));
    }
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
    authFetch('/api/audit/events/view-open', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
    }).catch(() => {
      /* beacon is fire-and-forget (D-03) */
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 12 / AGG-03 / D-13 — size-based routing to server endpoint.
  // Phase 16 / Pitfall 6: bypass server routing in cross-cohort mode.
  const cohortId = searchParams.get('cohort');
  const routeServerSide = !isCrossMode && Boolean(
    cohort && cohortId && cohort.cases.length > threshold
  );

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

    Promise.all([
      postAggregate({ ...shared, eye: 'od' }),
      postAggregate({ ...shared, eye: 'os' }),
      postAggregate({ ...shared, eye: 'combined' }),
    ]).then(([od, os, combined]) => {
      if (cancelled) return;
      setServerAggregate({
        od: panelFromServer(od),
        os: panelFromServer(os),
        combined: panelFromServer(combined),
      });
    }).catch((err) => {
      if (cancelled) return;
      console.warn('[OutcomesView] Server aggregate failed — falling back to client compute', err);
      setServerAggregate(null);
    }).finally(() => {
      if (!cancelled) setServerLoading(false);
    });

    return () => { cancelled = true; };
  }, [activeMetric, routeServerSide, cohortId, axisMode, yMetric, gridPoints, spreadMode, layers.perPatient, layers.scatter]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const cases = applyFilters(activeCases, saved.filters);
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
  }, [isCrossMode, crossCohortIds, savedSearches, activeCases, activeMetric, axisMode, yMetric, gridPoints, spreadMode]);

  // Phase 16: patient counts for the compare drawer.
  const patientCounts = useMemo<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    savedSearches.forEach((s) => {
      counts[s.id] = applyFilters(activeCases, s.filters).length;
    });
    return counts;
  }, [savedSearches, activeCases]);

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

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const renderTabStrip = () => (
    <nav
      role="tablist"
      aria-label={t('metricsSelectorLabel')}
      className="flex gap-2 border-b border-gray-200 mb-6"
    >
      {METRIC_TAB_ORDER.map((m) => {
        const active = m === activeMetric;
        return (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => handleMetricChange(m)}
            onKeyDown={(e) => handleMetricKeyDown(e, m)}
            data-testid={`metric-tab-${m}`}
            className={
              active
                ? 'px-4 py-2 text-sm font-semibold text-blue-700 border-b-2 border-blue-700'
                : 'px-4 py-2 text-sm text-gray-500 hover:text-gray-700'
            }
          >
            {t(metricTitleKey(m))}
          </button>
        );
      })}
    </nav>
  );

  const renderBody = () => {
    if (!cohort || cohort.cases.length === 0) {
      return <OutcomesEmptyState variant="no-cohort" t={t as (key: TranslationKey) => string} />;
    }

    // Server fetch in flight (only relevant for visus/crt)
    if (routeServerSide && serverLoading && !serverAggregate && (activeMetric === 'visus' || activeMetric === 'crt')) {
      return (
        <div className="flex items-center gap-2 py-8 justify-center text-gray-500 text-sm italic">
          <span
            role="status"
            aria-live="polite"
            data-testid="outcomes-server-computing"
          >
            {t('outcomesServerComputingLabel')}
          </span>
        </div>
      );
    }

    if (activeMetric === 'visus') {
      if (!aggregate) {
        return <OutcomesEmptyState variant="no-cohort" t={t as (key: TranslationKey) => string} />;
      }
      if (
        aggregate.od.summary.measurementCount === 0 &&
        aggregate.os.summary.measurementCount === 0
      ) {
        return <OutcomesEmptyState variant="no-visus" t={t as (key: TranslationKey) => string} />;
      }
      if (
        cohort.cases.length > 0 &&
        aggregate.od.summary.measurementCount + aggregate.os.summary.measurementCount > 0 &&
        !layers.median &&
        !layers.perPatient &&
        !layers.scatter &&
        !layers.spreadBand
      ) {
        return <OutcomesEmptyState variant="all-eyes-filtered" t={t as (key: TranslationKey) => string} />;
      }
      return (
        <>
          <OutcomesSummaryCards
            aggregate={aggregate}
            t={t as (key: string) => string}
            locale={locale as 'de' | 'en'}
          />
          <div data-testid={layers.scatter ? 'outcomes-scatter-default-on' : 'outcomes-scatter-default-off'} />
          <div className="mt-12 grid grid-cols-1 xl:grid-cols-3 gap-6">
            <OutcomesPanel
              panel={aggregate.od}
              eye="od"
              color={EYE_COLORS.OD}
              axisMode={axisMode}
              yMetric={yMetric}
              layers={layers}
              t={t as (key: string) => string}
              locale={locale as 'de' | 'en'}
              titleKey="outcomesPanelOd"
              cohortSeries={isCrossMode && crossCohortAggregates ? crossCohortAggregates.od : undefined}
            />
            <OutcomesPanel
              panel={aggregate.os}
              eye="os"
              color={EYE_COLORS.OS}
              axisMode={axisMode}
              yMetric={yMetric}
              layers={layers}
              t={t as (key: string) => string}
              locale={locale as 'de' | 'en'}
              titleKey="outcomesPanelOs"
              cohortSeries={isCrossMode && crossCohortAggregates ? crossCohortAggregates.os : undefined}
            />
            <OutcomesPanel
              panel={aggregate.combined}
              eye="combined"
              color={EYE_COLORS['OD+OS']}
              axisMode={axisMode}
              yMetric={yMetric}
              layers={layers}
              t={t as (key: string) => string}
              locale={locale as 'de' | 'en'}
              titleKey="outcomesPanelCombined"
              cohortSeries={isCrossMode && crossCohortAggregates ? crossCohortAggregates.combined : undefined}
            />
          </div>
          <OutcomesDataPreview
            activeMetric="visus"
            cases={cohort.cases}
            aggregate={aggregate}
            t={t}
            locale={locale as 'de' | 'en'}
          />
        </>
      );
    }

    if (activeMetric === 'crt') {
      if (!crtAggregate || crtAggregate.od.summary.measurementCount + crtAggregate.os.summary.measurementCount === 0) {
        return <OutcomesEmptyState variant="no-crt" t={t as (key: TranslationKey) => string} />;
      }
      return (
        <>
          <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
            <OutcomesPanel
              panel={crtAggregate.od}
              eye="od"
              color={EYE_COLORS.OD}
              axisMode={axisMode}
              yMetric={yMetric}
              layers={layers}
              t={t as (key: string) => string}
              locale={locale as 'de' | 'en'}
              titleKey="metricsCrtPanelOd"
              metric="crt"
              cohortSeries={isCrossMode && crossCohortAggregates ? crossCohortAggregates.od : undefined}
            />
            <OutcomesPanel
              panel={crtAggregate.os}
              eye="os"
              color={EYE_COLORS.OS}
              axisMode={axisMode}
              yMetric={yMetric}
              layers={layers}
              t={t as (key: string) => string}
              locale={locale as 'de' | 'en'}
              titleKey="metricsCrtPanelOs"
              metric="crt"
              cohortSeries={isCrossMode && crossCohortAggregates ? crossCohortAggregates.os : undefined}
            />
            <OutcomesPanel
              panel={crtAggregate.combined}
              eye="combined"
              color={EYE_COLORS['OD+OS']}
              axisMode={axisMode}
              yMetric={yMetric}
              layers={layers}
              t={t as (key: string) => string}
              locale={locale as 'de' | 'en'}
              titleKey="metricsCrtPanelCombined"
              metric="crt"
              cohortSeries={isCrossMode && crossCohortAggregates ? crossCohortAggregates.combined : undefined}
            />
          </div>
          <OutcomesDataPreview
            activeMetric="crt"
            cases={cohort.cases}
            aggregate={crtAggregate}
            t={t}
            locale={locale as 'de' | 'en'}
          />
        </>
      );
    }

    if (activeMetric === 'interval') {
      return (
        <>
          <IntervalHistogram
            cases={cohort.cases}
            t={t as (k: TranslationKey) => string}
            locale={locale as 'de' | 'en'}
          />
          <OutcomesDataPreview
            activeMetric="interval"
            cases={cohort.cases}
            aggregate={aggregate ?? { od: { patients: [], scatterPoints: [], medianGrid: [], summary: { patientCount: 0, measurementCount: 0, excludedCount: 0 } }, os: { patients: [], scatterPoints: [], medianGrid: [], summary: { patientCount: 0, measurementCount: 0, excludedCount: 0 } }, combined: { patients: [], scatterPoints: [], medianGrid: [], summary: { patientCount: 0, measurementCount: 0, excludedCount: 0 } } }}
            t={t}
            locale={locale as 'de' | 'en'}
          />
        </>
      );
    }

    if (activeMetric === 'responder') {
      return (
        <>
          <ResponderView
            cases={cohort.cases}
            thresholdLetters={thresholdLetters}
            t={t as (k: TranslationKey) => string}
            locale={locale as 'de' | 'en'}
          />
          <OutcomesDataPreview
            activeMetric="responder"
            cases={cohort.cases}
            aggregate={aggregate ?? { od: { patients: [], scatterPoints: [], medianGrid: [], summary: { patientCount: 0, measurementCount: 0, excludedCount: 0 } }, os: { patients: [], scatterPoints: [], medianGrid: [], summary: { patientCount: 0, measurementCount: 0, excludedCount: 0 } }, combined: { patients: [], scatterPoints: [], medianGrid: [], summary: { patientCount: 0, measurementCount: 0, excludedCount: 0 } } }}
            t={t}
            locale={locale as 'de' | 'en'}
            thresholdLetters={thresholdLetters}
          />
        </>
      );
    }

    return null;
  };

  return (
    <div>
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {cohort?.name ? `${t('outcomesTitle')}: ${cohort.name}` : t('outcomesTitle')}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {isCrossMode && crossCohortAggregates
              ? (() => {
                  const names = crossCohortAggregates.combined.map((c) => c.cohortName);
                  let namesStr = names.join(', ');
                  if (namesStr.length > 50) namesStr = namesStr.slice(0, 47) + '…';
                  const base = t('outcomesCrossMode').replace('{count}', String(names.length));
                  return `${base} · ${namesStr}`;
                })()
              : (cohort?.name ? t('outcomesSubtitleSaved') : t('outcomesSubtitleAdhoc'))
                  .replace('{count}', String(cohort?.cases.length ?? 0))}
          </p>
          {routeServerSide && serverLoading && (
            <span
              role="status"
              aria-live="polite"
              className="ml-3 text-gray-500 text-sm italic"
              data-testid="outcomes-server-computing-header"
            >
              {t('outcomesServerComputingLabel')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={t('outcomesCompareOpenDrawer')}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
            onClick={() => setCompareOpen(true)}
          >
            <GitCompare className="w-4 h-4" />
            <span>{t('outcomesCompareOpenDrawer')}</span>
          </button>
          <button
            type="button"
            aria-label={t('outcomesOpenSettings')}
            aria-expanded={drawerOpen}
            aria-controls="outcomes-settings-drawer"
            onClick={() => setDrawerOpen((v) => !v)}
            className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Phase 13 / METRIC-04: inline metric tab strip */}
      {renderTabStrip()}

      {/* Conditional metric body */}
      {renderBody()}

      {/* Settings drawer (OUTCOME-03 through -06) */}
      <OutcomesSettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeMetric={activeMetric}
        axisMode={axisMode}
        setAxisMode={setAxisMode}
        yMetric={yMetric}
        setYMetric={setYMetric}
        gridPoints={gridPoints}
        setGridPoints={setGridPoints}
        layers={layers}
        setLayers={setLayers}
        thresholdLetters={thresholdLetters}
        setThresholdLetters={setThresholdLetters}
        patientCount={cohort?.cases.length ?? 0}
        t={t as (key: string) => string}
        isCrossMode={isCrossMode}
      />

      {/* Phase 16 / XCOHORT-01..03: cohort compare drawer */}
      <CohortCompareDrawer
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        savedSearches={savedSearches}
        patientCounts={patientCounts}
        primaryCohortId={primaryCohortId}
        selectedIds={crossCohortIds.length > 0 ? crossCohortIds : (primaryCohortId ? [primaryCohortId] : [])}
        onChange={handleCompareChange}
        onReset={handleCompareReset}
        t={t as (k: string) => string}
      />
    </div>
  );
}
