/**
 * Cohort Outcome Trajectories view — OUTCOME-01..12 / Phase 09.
 *
 * Rendered as the "Trajectories" tab inside AnalysisPage. Formerly lived at
 * its own route /outcomes (src/pages/OutcomesPage.tsx, removed 2026-04-16).
 * Route resolution (?cohort / ?filter) and the audit beacon on mount are
 * preserved — the beacon now fires when this component mounts (i.e. when
 * the user switches to the Trajectories tab).
 */
import { useEffect, useMemo, useState } from 'react';
import { Settings } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import { useData } from '../../context/DataContext';
import { useLanguage } from '../../context/LanguageContext';
import type { TranslationKey } from '../../i18n/translations';
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
import OutcomesDataPreview from './OutcomesDataPreview';
import OutcomesEmptyState from './OutcomesEmptyState';
import OutcomesPanel from './OutcomesPanel';
import OutcomesSettingsDrawer from './OutcomesSettingsDrawer';
import OutcomesSummaryCards from './OutcomesSummaryCards';
import { EYE_COLORS } from './palette';

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
  const [searchParams] = useSearchParams();
  const { t, locale } = useLanguage();

  // Session-only toggle state (D-24).
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [axisMode, setAxisMode] = useState<AxisMode>('days');
  const [yMetric, setYMetric] = useState<YMetric>('absolute');
  const [gridPoints, setGridPoints] = useState<number>(120);
  const [spreadMode] = useState<SpreadMode>('iqr');
  const [layers, setLayers] = useState<LayerState>({
    median: true, perPatient: true, scatter: true, spreadBand: true,
  });

  // Phase 12 / AGG-03 / D-13 — server-side routing state.
  const [threshold, setThreshold] = useState<number>(1000);
  const [serverAggregate, setServerAggregate] = useState<TrajectoryResult | null>(null);
  const [serverLoading, setServerLoading] = useState(false);

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
  // When this component mounts (= user switches to the Trajectories tab), we
  // record the "open outcomes view" audit event. Semantics preserved from the
  // removed /outcomes page: D-01 cohort id + filter go in the JSON body, never
  // the URL; D-02 fetch + keepalive; D-03 fire-and-forget.
  //
  // IN-03: The empty dependency array ([]) is intentional. This effect fires
  // EXACTLY ONCE per mount — same-route cohort switches (e.g. client-side nav
  // from ?cohort=A to ?cohort=B without remount) do NOT retrigger the beacon
  // (by design, per D-03). The eslint-disable below suppresses exhaustive-deps
  // so `searchParams` is not treated as a dependency; if the desired behaviour
  // ever changes to "fire on each cohort change", replace [] with [searchParams]
  // AND re-evaluate D-03's once-per-view guarantee.
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
    fetch('/api/audit/events/view-open', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      credentials: 'include',
    }).catch(() => {
      /* beacon is fire-and-forget (D-03) */
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 12 / AGG-03 / D-13 — size-based routing to server endpoint.
  const cohortId = searchParams.get('cohort');
  const routeServerSide = Boolean(
    cohort && cohortId && cohort.cases.length > threshold
  );

  useEffect(() => {
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
  }, [routeServerSide, cohortId, axisMode, yMetric, gridPoints, spreadMode, layers.perPatient, layers.scatter]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (!cohort || cohort.cases.length === 0) {
    return <OutcomesEmptyState variant="no-cohort" t={t as (key: TranslationKey) => string} />;
  }

  // Phase 12 / AGG-03 / D-14: server fetch is in flight — show a non-blocking loading state
  // with the testid indicator. This is distinct from "no cohort" (cohort exists but aggregate
  // is pending from the server). Rendered here (before the !aggregate early-return) so the
  // loading indicator is visible while routeServerSide is active.
  if (routeServerSide && serverLoading && !serverAggregate) {
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

  if (!aggregate) {
    return <OutcomesEmptyState variant="no-cohort" t={t as (key: TranslationKey) => string} />;
  }

  // No-visus early return: both panels have zero measurements
  if (
    aggregate.od.summary.measurementCount === 0 &&
    aggregate.os.summary.measurementCount === 0
  ) {
    return (
      <OutcomesEmptyState
        variant="no-visus"
        t={t as (key: TranslationKey) => string}
      />
    );
  }

  // VQA-05 / D-07: all-eyes-filtered — data exists but every layer toggle is off.
  // Distinct from no-visus (no data at all). Copy in D-08 directs the user to the toolbar.
  if (
    cohort.cases.length > 0 &&
    aggregate.od.summary.measurementCount + aggregate.os.summary.measurementCount > 0 &&
    !layers.median &&
    !layers.perPatient &&
    !layers.scatter &&
    !layers.spreadBand
  ) {
    return (
      <OutcomesEmptyState
        variant="all-eyes-filtered"
        t={t as (key: TranslationKey) => string}
      />
    );
  }

  return (
    <div>
      <header className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {cohort.name ? `${t('outcomesTitle')}: ${cohort.name}` : t('outcomesTitle')}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {(cohort.name ? t('outcomesSubtitleSaved') : t('outcomesSubtitleAdhoc'))
              .replace('{count}', String(cohort.cases.length))}
          </p>
          {routeServerSide && serverLoading && (
            <span
              role="status"
              aria-live="polite"
              className="ml-3 text-gray-500 text-sm italic"
              data-testid="outcomes-server-computing"
            >
              {t('outcomesServerComputingLabel')}
            </span>
          )}
        </div>
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
      </header>

      {/* Task-1.2 marker: asserts the D-37 default-scatter-off effect ran. */}
      <div
        data-testid={layers.scatter ? 'outcomes-scatter-default-on' : 'outcomes-scatter-default-off'}
      />

      {/* Summary cards row (OUTCOME-07 / D-26) */}
      <OutcomesSummaryCards
        aggregate={aggregate}
        t={t as (key: string) => string}
        locale={locale as 'de' | 'en'}
      />

      {/* Three chart panels: OD → OS → Combined (OUTCOME-02) */}
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
        />
      </div>

      {/* Data preview panel + CSV export (OUTCOME-08 / 09-03) */}
      <OutcomesDataPreview
        cases={cohort.cases}
        aggregate={aggregate}
        t={t}
        locale={locale as 'de' | 'en'}
      />

      {/* Settings drawer (OUTCOME-03 through -06) */}
      <OutcomesSettingsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        axisMode={axisMode}
        setAxisMode={setAxisMode}
        yMetric={yMetric}
        setYMetric={setYMetric}
        gridPoints={gridPoints}
        setGridPoints={setGridPoints}
        layers={layers}
        setLayers={setLayers}
        patientCount={cohort.cases.length}
        t={t as (key: string) => string}
      />
    </div>
  );
}
