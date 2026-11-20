/** Cohort analysis page — EMDREQ-ANL-001 to ANL-004 (center distribution, temporal trends, distributions, adverse events).
 *
 * Two tabs, selected via ?tab=aggregate|trajectories:
 *   - aggregate (default): center / diagnosis / visus-trend / CRT / age-vs-visus charts
 *   - trajectories:        OD / OS / combined Visus trajectory panels (OUTCOME-01..12)
 *
 * Phase 42 / ANL-011: cross-cohort comparison in the Aggregated tab.
 * When ?cohorts=id1,id2[,...] is present and at least 2 known savedSearch ids resolve,
 * the Aggregated tab switches to a comparison layout:
 *   - Per-cohort diagnosis distribution (small-multiple pies, one per cohort)
 *   - Per-cohort age-vs-Visus scatter (one ScatterChart, one Scatter series per cohort)
 * Both use COHORT_PALETTES[idx] for color consistency with the Trajectories compare plots.
 * Single-cohort mode is unchanged.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { criticalCasesOf } from '../../shared/criticalCases';
import CriticalCasesDialog from '../components/analysis/CriticalCasesDialog';
import ChartLegend from '../components/charts/ChartLegend';
import {
  AXIS_TICK_FONT_SIZE,
  CHART_CARD_CLASS,
  CHART_TITLE_CLASS,
  cohortColor,
  CRT_COLOR,
  VISUS_COLOR,
} from '../components/charts/chartStyle';
import ChartTooltipBox from '../components/charts/ChartTooltipBox';
import CompareCohortsButton from '../components/charts/CompareCohortsButton';
import { CenterMultiSelect } from '../components/common/CenterMultiSelect';
import CohortCompareDrawer from '../components/outcomes/CohortCompareDrawer';
import { compareHandlers } from '../components/outcomes/compareSelection';
import OutcomesView from '../components/outcomes/OutcomesView';
import { readPersistedViewState, writePersistedViewState } from '../components/outcomes/outcomesViewStatePersist';
import { rechartsTheme } from '../components/outcomes/palette';
import { distinctPatientCount, withBaseCohort } from '../components/outcomes/useOutcomesRouteState';
import { CHART_COLORS } from '../config/clinicalThresholds';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { useThemeSafe } from '../context/ThemeContext';
import { useRecentActivity } from '../hooks/useRecentActivity';
import { ALL_PATIENTS_COHORT_ID, withAllPatientsCohort } from '../services/allPatientsCohort';
import { groupByParent } from '../services/cohortNames';
import { applyFilters } from '../services/fhirLoader';
import { getSettings } from '../services/settingsService';
import type { CohortFilter, PatientCase, SavedSearch } from '../types/fhir';
import {
  ageVisusOf,
  centerDistributionOf,
  crtDistributionOf,
  diagnosisDistributionOf,
  type DiagnosisSlice,
  mergeByCategory,
  visusTrendOf,
} from '../utils/aggregateDistributions';
import { parseCohortFilterJson, summarizeCohortFilter } from '../utils/cohortFilterSerialization';

type AnalysisTab = 'aggregate' | 'trajectories';

/** Props the Recharts Tooltip passes to a custom content function (the subset used here). */
interface TooltipProps {
  active?: boolean;
  label?: unknown;
  payload?: ReadonlyArray<{ name?: unknown; value?: unknown; color?: string; dataKey?: unknown; payload?: unknown }>;
}

// Z0-P22: "Kohorte wählen" values that are not saved-cohort ids.
const ALL_PATIENTS_OPTION = '';
const FILTERED_COHORT_OPTION = '__filtered__';

function isAnalysisTab(v: string | null): v is AnalysisTab {
  return v === 'aggregate' || v === 'trajectories';
}

export default function AnalysisPage() {
  const { activeCases, savedSearches, loading } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const { locale, t } = useLanguage();
  const { record } = useRecentActivity();
  // M12 (v1.18 WS-A): theme-aware Recharts tokens so the aggregate-tab charts
  // (center/diagnosis/trend/CRT/age-vs-visus + compare layout) restyle for dark mode.
  const { effectiveTheme } = useThemeSafe();
  const isDark = effectiveTheme === 'dark';
  const ct = rechartsTheme(isDark);

  // Tab selection via ?tab=aggregate|trajectories (default: aggregate).
  const tab: AnalysisTab = useMemo(() => {
    const raw = searchParams.get('tab');
    return isAnalysisTab(raw) ? raw : 'aggregate';
  }, [searchParams]);

  // Z0-P23: the Aggregiert compare drawer belongs to its tab; it is closed when the tab changes.
  const [compareOpen, setCompareOpen] = useState(false);
  const closeCompare = useCallback(() => setCompareOpen(false), []);

  const selectTab = useCallback(
    (next: AnalysisTab) => {
      setCompareOpen(false);
      const sp = new URLSearchParams(searchParams);
      if (next === 'aggregate') sp.delete('tab');
      else sp.set('tab', next);
      setSearchParams(sp, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  // Phase 42 / ANL-011: cross-cohort URL parsing — placed here above any early return per Rules of Hooks.
  // Mirrors the pattern OutcomesView uses for consistency (same COHORT_PALETTES index order).
  const rawCohortsParam = searchParams.get('cohorts');
  const primaryCohortId = searchParams.get('cohort');
  const isCrossMode = Boolean(rawCohortsParam);

  // Resolve active cohort: either a saved search (?cohort=<id>) or inline filters (?filters=<json>).
  const savedSearchId = searchParams.get('cohort');
  const activeSavedSearch = useMemo(
    () => (savedSearchId ? (savedSearches.find((s) => s.id === savedSearchId) ?? null) : null),
    [savedSearchId, savedSearches],
  );

  // Record a recent-activity entry on mount (UX-02).
  // path captures the full URL so cohort/filter params are preserved for restoration.
  useEffect(() => {
    record({
      id: savedSearchId ?? 'analysis',
      label: activeSavedSearch?.name ?? t('navAnalysis'),
      sub: t('navAnalysis'),
      path: window.location.pathname + window.location.search,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only; record/t/savedSearchId are stable at mount

  // M-04: explicitly pick known CohortFilter keys to prevent prototype pollution (F-04 shared serializer).
  // Z0-P22: ?filters= (the unsaved filtered cohort) stays in the URL while a saved cohort is chosen in
  // "Kohorte wählen", so it remains selectable; ?cohort= takes precedence.
  const urlFilters: CohortFilter = useMemo(
    () => parseCohortFilterJson(searchParams.get('filters')),
    [searchParams],
  );
  // If a saved search is referenced, use its stored filters (KOH-005 / Issue 4 fix).
  const filters: CohortFilter = activeSavedSearch ? activeSavedSearch.filters : urlFilters;

  /**
   * ANL-012: name of the unsaved filtered cohort (?filters=), null without one.
   * - with ?name=: the supplied name (React auto-escapes text content — T-42-06)
   * - without ?name=: synthesized from t('analysisFilteredCohort') + summarizeCohortFilter
   * Total length is capped at 80 chars with ellipsis to mirror OutcomesView cross-mode truncation.
   * Z0-P22 (Q26 a): the header and the "Kohorte wählen" option use this same text.
   */
  const filteredCohortName: string | null = useMemo(() => {
    if (searchParams.get('filters') === null) return null;
    const urlName = searchParams.get('name')?.trim();
    if (urlName) return urlName.length > 80 ? urlName.slice(0, 79) + '…' : urlName;
    const base = t('analysisFilteredCohort');
    const summary = summarizeCohortFilter(urlFilters, locale);
    const full = summary ? `${base} · ${summary}` : base;
    return full.length > 80 ? full.slice(0, 79) + '…' : full;
  }, [searchParams, urlFilters, t, locale]);

  /** ANL-012: display name — saved name, else the filtered cohort, else null ("Alle Patienten", Z0-P17). */
  const displayCohortName: string | null = activeSavedSearch ? activeSavedSearch.name : filteredCohortName;

  // Z0-P22 (Q16): "Kohorte wählen" options — "Alle Patienten", the unsaved filtered cohort (if any), then the saved
  // cohorts by name with sub-cohorts indented under their parent.
  const cohortOptions: Array<{ value: string; label: string }> = useMemo(() => {
    const byName = (a: SavedSearch, b: SavedSearch) => a.name.localeCompare(b.name, locale);
    const { parents, flat, subcohortsByParentId } = groupByParent(savedSearches);
    const saved = [...parents, ...flat].sort(byName).flatMap((s) => [
      { value: s.id, label: s.name },
      ...[...(subcohortsByParentId.get(s.id) ?? [])].sort(byName).map((sub) => ({
        value: sub.id,
        label: `\u00A0\u00A0\u00A0↳ ${sub.name}`,
      })),
    ]);
    return [
      { value: ALL_PATIENTS_OPTION, label: t('overlayCohortAllPatients') },
      ...(filteredCohortName ? [{ value: FILTERED_COHORT_OPTION, label: filteredCohortName }] : []),
      ...saved,
    ];
  }, [savedSearches, filteredCohortName, t, locale]);

  const selectedCohortOption = savedSearchId ?? (filteredCohortName ? FILTERED_COHORT_OPTION : ALL_PATIENTS_OPTION);

  // Z0-P22: choosing a cohort writes ?cohort= (both tabs follow); "Alle Patienten" also drops the filtered cohort.
  // A running comparison keeps its other cohorts (withBaseCohort); "Alle Patienten" enters it as its reserved id.
  const selectCohort = useCallback(
    (value: string) => {
      setSearchParams((p) => {
        const savedId = value === ALL_PATIENTS_OPTION || value === FILTERED_COHORT_OPTION ? null : value;
        const next = withBaseCohort(p, savedId, value === ALL_PATIENTS_OPTION ? ALL_PATIENTS_COHORT_ID : savedId);
        if (value === ALL_PATIENTS_OPTION) {
          next.delete('filters');
          next.delete('name');
        }
        return next;
      });
    },
    [setSearchParams],
  );

  const cohort = useMemo(() => {
    const s = getSettings();
    return applyFilters(activeCases, filters, {
      therapyInterrupterDays: s.therapyInterrupterDays,
      therapyBreakerDays: s.therapyBreakerDays,
      crtImplausibleThresholdUm: s.crtImplausibleThresholdUm,
    });
  }, [activeCases, filters]);

  // ---------------------------------------------------------------------------
  // Phase 42 / ANL-011: cross-cohort series resolution
  // ---------------------------------------------------------------------------

  // Z0-P05: compare ids resolve against the saved searches plus "Alle Patienten" (reserved id, no filters).
  const compareSearches = useMemo(
    () => withAllPatientsCohort(savedSearches, t('overlayCohortAllPatients')),
    [savedSearches, t],
  );

  /** Parse, deduplicate, cap at 4, drop unknown ids, always include primary first. */
  const crossCohortIds: string[] = useMemo(() => {
    if (!rawCohortsParam) return [];
    const raw = rawCohortsParam.split(',').map((s) => s.trim()).filter(Boolean);
    const known = raw.filter((id) => compareSearches.some((s) => s.id === id));
    const withPrimary =
      primaryCohortId && !known.includes(primaryCohortId)
        ? [primaryCohortId, ...known]
        : known;
    return withPrimary.slice(0, 4);
  }, [rawCohortsParam, primaryCohortId, compareSearches]);

  /** Per-cohort series: cases + color + name. Active when crossCohortIds.length >= 2. */
  const crossCohorts: Array<{
    cohortId: string;
    cohortName: string;
    patientCount: number;
    color: string;
    cases: PatientCase[];
  }> = useMemo(() => {
    if (crossCohortIds.length < 2) return [];
    const s = getSettings();
    const filterOptions = {
      therapyInterrupterDays: s.therapyInterrupterDays,
      therapyBreakerDays: s.therapyBreakerDays,
      crtImplausibleThresholdUm: s.crtImplausibleThresholdUm,
    };
    return crossCohortIds.flatMap((id, idx) => {
      const saved = compareSearches.find((s) => s.id === id);
      if (!saved) return [];
      const cases = applyFilters(activeCases, saved.filters, filterOptions);
      const color = cohortColor(idx, isDark);
      return [{ cohortId: id, cohortName: saved.name, patientCount: cases.length, color, cases }];
    });
  }, [crossCohortIds, compareSearches, activeCases, isDark]);

  // Z0-P17: cohorts compared with the active cohort (compare mode only), in selection order.
  const comparedCohortNames: string[] = useMemo(
    () => crossCohorts.filter((c) => c.cohortId !== savedSearchId).map((c) => c.cohortName),
    [crossCohorts, savedSearchId],
  );

  // ---------------------------------------------------------------------------
  // Phase 42 / SC-4: center multi-select — CLIENT-SIDE NARROWING ONLY.
  // activeCases already come from the server restricted to authorized centers.
  // Selecting centers here can only narrow, never widen, server results.
  // Empty selection = all authorized centers (no narrowing applied).
  // ---------------------------------------------------------------------------

  // Derive unique center display names from activeCases (the full server-authorized set).
  const centerOptions: string[] = useMemo(() => {
    const names = new Set<string>();
    activeCases.forEach((c) => names.add(c.centerName));
    return Array.from(names).sort();
  }, [activeCases]);

  // Z0-P06 (Q24 a): the centre selection is kept for the session (same store as the chart settings).
  const [selectedCenters, setSelectedCentersState] = useState<string[]>(
    () => readPersistedViewState()?.centers ?? [],
  );
  const setSelectedCenters = useCallback((next: string[]) => {
    setSelectedCentersState(next);
    writePersistedViewState(null, { centers: next });
  }, []);

  // Apply center narrowing to the single-cohort view (no effect on cross-cohort
  // since each cohort operates on activeCases through applyFilters independently;
  // cross-cohort views are filtered per-cohort below via centeredCrossCohortsActive).
  const centeredCohort = useMemo(() => {
    if (selectedCenters.length === 0) return cohort;
    return cohort.filter((c) => selectedCenters.includes(c.centerName));
  }, [cohort, selectedCenters]);

  // Z0-P04: the cohort the header shows (name + centre narrowing, Q5) is the cohort Verläufe renders.
  // An unknown ?cohort= id keeps the Verläufe empty state (null), as before.
  const trajectoriesCohort = useMemo(
    () => (savedSearchId && !activeSavedSearch ? null : { name: displayCohortName, cases: centeredCohort }),
    [savedSearchId, activeSavedSearch, displayCohortName, centeredCohort],
  );

  // Cross-cohort narrowing: apply center filter to each cohort's cases.
  const centeredCrossCohorts = useMemo(() => {
    if (selectedCenters.length === 0) return crossCohorts;
    return crossCohorts.map((entry) => ({
      ...entry,
      cases: entry.cases.filter((c) => selectedCenters.includes(c.centerName)),
      patientCount: entry.cases.filter((c) => selectedCenters.includes(c.centerName)).length,
    }));
  }, [crossCohorts, selectedCenters]);

  const centerDist = useMemo(() => centerDistributionOf(centeredCohort), [centeredCohort]);
  const diagDist = useMemo(() => diagnosisDistributionOf(centeredCohort, locale), [centeredCohort, locale]);
  const visusTrend = useMemo(() => visusTrendOf(centeredCohort), [centeredCohort]);
  const crtDistribution = useMemo(() => crtDistributionOf(centeredCohort), [centeredCohort]);
  const ageVisusScatter = useMemo(() => ageVisusOf(centeredCohort), [centeredCohort]);

  const medianVisus = useMemo(() => {
    if (ageVisusScatter.length === 0) return null;
    const sorted = ageVisusScatter.map((p) => p.visus).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }, [ageVisusScatter]);

  // Z0-P09 (Q28/Q36): cases with a CRT above the settings threshold, one list per cohort in compare mode
  // (each count opens the list of its own cohort); without comparison one list for the active cohort.
  const crtThreshold = getSettings().crtImplausibleThresholdUm;
  const criticalLists = useMemo(() => {
    if (centeredCrossCohorts.length >= 2) {
      return centeredCrossCohorts.map((c) => ({
        key: c.cohortId,
        cohortName: c.cohortName,
        compare: true,
        cases: criticalCasesOf(c.cases, crtThreshold),
      }));
    }
    return [{
      key: '',
      cohortName: displayCohortName ?? t('overlayCohortAllPatients'),
      compare: false,
      cases: criticalCasesOf(centeredCohort, crtThreshold),
    }];
  }, [centeredCrossCohorts, centeredCohort, crtThreshold, displayCohortName, t]);
  const [openCriticalKey, setOpenCriticalKey] = useState<string | null>(null);
  const openCriticalList = criticalLists.find((l) => l.key === openCriticalKey) ?? null;
  const closeCriticalList = useCallback(() => setOpenCriticalKey(null), []);

  // ---------------------------------------------------------------------------
  // Z0-P23: comparison on Aggregiert — the same ?cohorts= selection, drawer and handlers as on Verläufe.
  // ---------------------------------------------------------------------------
  const compare = compareHandlers({
    primaryCohortId,
    crossCohortIds,
    isCrossMode: crossCohortIds.length >= 2,
    setSearchParams,
    setCompareOpen,
  });
  const compareSelection = crossCohortIds.length > 0 ? crossCohortIds : (primaryCohortId ? [primaryCohortId] : []);
  const showCompare = isCrossMode && centeredCrossCohorts.length >= 2;

  // Drawer counts — the same narrowing (centres) and filters as the compare series.
  const comparePatientCounts = useMemo<Record<string, number>>(() => {
    const st = getSettings();
    const filterOptions = {
      therapyInterrupterDays: st.therapyInterrupterDays,
      therapyBreakerDays: st.therapyBreakerDays,
      crtImplausibleThresholdUm: st.crtImplausibleThresholdUm,
    };
    const base = selectedCenters.length === 0 ? activeCases : activeCases.filter((c) => selectedCenters.includes(c.centerName));
    return Object.fromEntries(compareSearches.map((x) => [x.id, applyFilters(base, x.filters, filterOptions).length]));
  }, [compareSearches, activeCases, selectedCenters]);

  const compareCenter = useMemo(
    () => mergeByCategory(
      centeredCrossCohorts.map((c) => ({ cohortId: c.cohortId, rows: centerDistributionOf(c.cases) })),
      (r) => r.name, (r) => r.count, 'name', (a, b) => a.localeCompare(b),
    ),
    [centeredCrossCohorts],
  );
  const compareVisusTrend = useMemo(
    () => mergeByCategory(
      centeredCrossCohorts.map((c) => ({ cohortId: c.cohortId, rows: visusTrendOf(c.cases) })),
      (r) => r.quarter, (r) => r.mean, 'quarter', (a, b) => a.localeCompare(b),
    ),
    [centeredCrossCohorts],
  );
  const compareCrt = useMemo(
    () => mergeByCategory(
      centeredCrossCohorts.map((c) => ({ cohortId: c.cohortId, rows: crtDistributionOf(c.cases) })),
      (r) => r.range, (r) => r.count, 'range',
    ),
    [centeredCrossCohorts],
  );

  // Z0-P23: one tooltip box for every chart — heading = x-axis value, rows "<Bezeichnung>: <Wert>".
  const axisTick = { fontSize: AXIS_TICK_FONT_SIZE, fill: ct.axisTick };
  const categoryTooltip = (headingPrefix = '', fmt: (v: number) => string = (v) => String(v)) =>
    function CategoryTooltip(props: TooltipProps) {
      if (!props.active || !props.payload?.length) return null;
      const rows = props.payload
        .filter((e) => typeof e.value === 'number')
        .map((e, i) => ({ key: `${String(e.dataKey)}-${i}`, label: String(e.name ?? ''), value: fmt(e.value as number), color: e.color }));
      if (rows.length === 0) return null;
      return <ChartTooltipBox heading={`${headingPrefix}${String(props.label ?? '')}`} rows={rows} />;
    };
  const diagnosisTooltip = (props: TooltipProps) => {
    const d = props.payload?.[0]?.payload as DiagnosisSlice | undefined;
    if (!props.active || !d) return null;
    return <ChartTooltipBox heading={d.fullText} rows={[{ key: 'n', label: t('cases'), value: String(d.value) }]} />;
  };
  const ageVisusTooltip = (props: TooltipProps) => {
    const pt = props.payload?.[0]?.payload as { age: number; visus: number } | undefined;
    if (!props.active || !pt) return null;
    return (
      <ChartTooltipBox
        heading={`${t('age')}: ${pt.age} J.`}
        rows={[{ key: 'v', label: t('visus'), value: pt.visus.toFixed(2) }]}
      />
    );
  };

  const tabButton = (id: AnalysisTab, label: string) => {
    const active = tab === id;
    return (
      <button
        type="button"
        role="tab"
        aria-selected={active}
        aria-controls={`analysis-tab-${id}`}
        onClick={() => selectTab(id)}
        className={
          'px-4 py-2 text-sm font-medium border-b-2 transition-colors focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 ' +
          (active
            ? 'text-blue-600 border-blue-600'
            : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300')
        }
      >
        {label}
      </button>
    );
  };

  return (
    <div className="p-8 dark:bg-gray-900 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{t('analysisTitle')}</h1>
        {/* Z0-P17 (Q4/Q27): the active cohort is always named above both tabs — saved name, "Gefilterte Kohorte …"
            or "Alle Patienten" — followed by the compared cohorts in compare mode. */}
        <p
          data-testid="analysis-active-cohort"
          className="text-sm font-medium text-blue-700 dark:text-blue-400 mt-0.5"
        >
          {t('analysisActiveCohort')} <span>{displayCohortName ?? t('overlayCohortAllPatients')}</span>
          {comparedCohortNames.length > 0 && ` · ${t('analysisComparedWith')} ${comparedCohortNames.join(', ')}`}
        </p>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {centeredCohort.length} {t('casesInCohort')}
          {/* Z0-P04 (C5 a): the header names patients and cases. */}
          {' · '}
          {t('analysisPatientCount').replace('{count}', String(distinctPatientCount(centeredCohort)))}
          {/* Z0-P09: each count opens its list "Fälle mit kritischen Werten". */}
          {criticalLists.filter((l) => l.cases.length > 0).map((l) => (
            <button
              key={l.key}
              type="button"
              aria-haspopup="dialog"
              onClick={() => setOpenCriticalKey(l.key)}
              className="ml-3 text-red-600 dark:text-red-400 font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              {l.compare && `${l.cohortName}: `}
              {l.cases.length} {t('casesWithCritical').replace('{threshold}', String(crtThreshold))}
            </button>
          ))}
        </p>
        {openCriticalList && (
          <CriticalCasesDialog
            cohortName={openCriticalList.cohortName}
            cases={openCriticalList.cases}
            onClose={closeCriticalList}
          />
        )}
        {/* Z0-P22: switch the active cohort for both tabs. */}
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="analysis-cohort-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('analysisSelectCohort')}
          </label>
          <select
            id="analysis-cohort-select"
            value={selectedCohortOption}
            onChange={(e) => selectCohort(e.target.value)}
            className="max-w-md rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            {cohortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Center multi-select — SC-4: client-side narrowing only (server is sole authority). */}
      {centerOptions.length > 1 && (
        <div className="mb-4 max-w-xs" data-testid="analysis-center-filter">
          <CenterMultiSelect
            options={centerOptions}
            selected={selectedCenters}
            onChange={setSelectedCenters}
          />
        </div>
      )}

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label={t('analysisTitle')}
        className="mb-6 flex gap-2 border-b border-gray-200 dark:border-gray-700"
      >
        {tabButton('aggregate', t('analysisTabAggregate'))}
        {tabButton('trajectories', t('analysisTabTrajectories'))}
      </div>

      {tab === 'trajectories' ? (
        <section
          id="analysis-tab-trajectories"
          role="tabpanel"
          aria-labelledby="analysis-tab-trajectories-button"
          data-testid="analysis-tab-trajectories"
        >
          {/* I2 review (cold-load): only mount OutcomesView once data has loaded.
              Its layer defaults are derived synchronously at mount from the cohort
              size; mounting while cases are still [] would default scatter/per-patient
              ON and then paint the heavy ~14k-circle layer once before the
              cohort-change effect strips it. Gating on `loading` lets the lazy
              initializer see the real cohort, so the first render is already light. */}
          {loading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-gray-500 text-sm italic">
              <span role="status" aria-live="polite" data-testid="analysis-trajectories-loading">
                {t('outcomesClientComputingLabel')}
              </span>
            </div>
          ) : (
            <OutcomesView cohort={trajectoriesCohort} centers={selectedCenters} />
          )}
        </section>
      ) : (
        <section
          id="analysis-tab-aggregate"
          role="tabpanel"
          aria-labelledby="analysis-tab-aggregate-button"
          data-testid="analysis-tab-aggregate"
          className="space-y-6"
        >
        {/* Z0-P23: "Kohorten vergleichen" at the same position as on Verläufe (rightmost header control). */}
        <header className="mb-6 flex items-start justify-between">
          <div>
            {showCompare && (
              <p className="text-gray-500 dark:text-gray-400 text-sm" data-testid="aggregate-compare-subtitle">
                {t('outcomesCrossMode').replace('{count}', String(centeredCrossCohorts.length))}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <CompareCohortsButton
              label={t('outcomesCompareOpenDrawer')}
              onClick={compare.openCompare}
              expanded={compareOpen}
              controls="outcomes-compare-drawer"
            />
          </div>
        </header>

        {showCompare ? (
          /* Phase 42 / ANL-011 + Z0-P23 (Q17): every chart shows one series per compared cohort, in the cohort
             colours of Verläufe; the cohort legend names each cohort with its patient count. */
          <>
            <ChartLegend
              ariaLabel={t('analysisCompareLegendAriaLabel')}
              entries={centeredCrossCohorts.map((c) => ({
                key: c.cohortId,
                label: `${c.cohortName} (N=${c.patientCount} ${t('outcomesComparePatientsUnit')})`,
                color: c.color,
              }))}
            />
            <div className="grid grid-cols-2 gap-6">
              {/* Center distribution — grouped bars per cohort */}
              <div data-testid="compare-center" className={CHART_CARD_CLASS}>
                <h3 className={`${CHART_TITLE_CLASS} mb-4`}>{t('centerDistribution')}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={compareCenter}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                    <XAxis dataKey="name" tick={axisTick} stroke={ct.axisTick} />
                    <YAxis tick={axisTick} stroke={ct.axisTick} />
                    <Tooltip content={categoryTooltip()} cursor={{ fill: ct.grid, fillOpacity: 0.3 }} />
                    {centeredCrossCohorts.map((c) => (
                      <Bar key={c.cohortId} dataKey={c.cohortId} name={c.cohortName} fill={c.color} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Diagnosis distribution — one pie per cohort */}
              <div data-testid="compare-diagnosis" className={CHART_CARD_CLASS}>
                <h3 className={`${CHART_TITLE_CLASS} mb-4`}>{t('analysisCompareDiagnosisTitle')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  {centeredCrossCohorts.map((cohort) => {
                    const cohortDiagDist = diagnosisDistributionOf(cohort.cases, locale);
                    return (
                      <div key={cohort.cohortId} data-cohort-series={cohort.cohortName}>
                        <h4 className="text-sm font-semibold mb-2" style={{ color: cohort.color }}>
                          {cohort.cohortName}
                        </h4>
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie
                              data={cohortDiagDist}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              stroke="none"
                              label={({ name, value }) => `${name}: ${value}`}
                            >
                              {cohortDiagDist.map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip content={diagnosisTooltip} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Temporal visus trend — one line per cohort */}
              <div data-testid="compare-visus-trend" className={CHART_CARD_CLASS}>
                <h3 className={`${CHART_TITLE_CLASS} mb-4`}>{t('visusTrend')}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={compareVisusTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                    <XAxis dataKey="quarter" tick={axisTick} stroke={ct.axisTick} />
                    <YAxis domain={[0, 1]} tick={axisTick} stroke={ct.axisTick} />
                    <Tooltip content={categoryTooltip(`${t('quarter')}: `, (v) => v.toFixed(3))} />
                    <Legend wrapperStyle={{ color: ct.legend, fontSize: AXIS_TICK_FONT_SIZE }} />
                    {centeredCrossCohorts.map((c) => (
                      <Line key={c.cohortId} type="monotone" dataKey={c.cohortId} name={c.cohortName} stroke={c.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* CRT distribution — grouped bars per cohort */}
              <div data-testid="compare-crt" className={CHART_CARD_CLASS}>
                <h3 className={`${CHART_TITLE_CLASS} mb-4`}>{t('crtDistribution')}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={compareCrt}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                    <XAxis dataKey="range" tick={axisTick} stroke={ct.axisTick} />
                    <YAxis tick={axisTick} stroke={ct.axisTick} />
                    <Tooltip content={categoryTooltip()} cursor={{ fill: ct.grid, fillOpacity: 0.3 }} />
                    {centeredCrossCohorts.map((c) => (
                      <Bar key={c.cohortId} dataKey={c.cohortId} name={c.cohortName} fill={c.color} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Age-vs-Visus — one Scatter series per cohort */}
              <div data-testid="compare-age-visus" className={`${CHART_CARD_CLASS} col-span-2`}>
                <h3 className={`${CHART_TITLE_CLASS} mb-4`}>{t('analysisCompareAgeVisusTitle')}</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                    <XAxis type="number" dataKey="age" name={t('age')} unit=" J." domain={['dataMin', 'dataMax']} tick={axisTick} stroke={ct.axisTick} />
                    <YAxis type="number" dataKey="visus" name={t('visus')} domain={[0, 1]} tick={axisTick} stroke={ct.axisTick} />
                    <Tooltip cursor={{ strokeDasharray: '3 3' }} content={ageVisusTooltip} />
                    <Legend wrapperStyle={{ color: ct.legend, fontSize: AXIS_TICK_FONT_SIZE }} />
                    {centeredCrossCohorts.map((cohort) => (
                      <Scatter key={cohort.cohortId} data={ageVisusOf(cohort.cases)} fill={cohort.color} name={cohort.cohortName} />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        ) : (
          /* Single-cohort layout — original five charts */
          <div className="grid grid-cols-2 gap-6">
            {/* Center distribution */}
            <div className={CHART_CARD_CLASS}>
              <h3 className={`${CHART_TITLE_CLASS} mb-4`}>{t('centerDistribution')}</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={centerDist}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="name" tick={axisTick} stroke={ct.axisTick} />
                  <YAxis tick={axisTick} stroke={ct.axisTick} />
                  <Tooltip content={categoryTooltip()} cursor={{ fill: ct.grid, fillOpacity: 0.3 }} />
                  <Bar dataKey="count" fill="#3b82f6" name={t('cases')} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Diagnosis distribution */}
            <div className={CHART_CARD_CLASS}>
              <h3 className={`${CHART_TITLE_CLASS} mb-2`}>{t('diagnosisDistribution')}</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">{t('diagnosisHoverHint')}</p>
              <div className="flex gap-3 items-stretch">
                <div className="flex-1 min-w-0">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={diagDist}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        stroke="none"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {diagDist.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={diagnosisTooltip} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul
                  aria-label={t('diagnosisLegendAriaLabel')}
                  className="w-48 shrink-0 max-h-[250px] overflow-y-auto pr-1 text-xs space-y-1.5"
                >
                  {diagDist.map((d, i) => (
                    <li key={d.name} className="flex items-start gap-2">
                      <span
                        className="mt-1 w-2.5 h-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        aria-hidden="true"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-gray-800 dark:text-gray-200">
                          {d.name} <span className="text-gray-400 dark:text-gray-500">({d.value})</span>
                        </div>
                        <div className="text-gray-500 dark:text-gray-400 leading-snug">
                          {d.fullText}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Temporal visus trend */}
            <div data-testid="visus-trend-chart" className={CHART_CARD_CLASS}>
              <h3 className={`${CHART_TITLE_CLASS} mb-4`}>{t('visusTrend')}</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={visusTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="quarter" tick={axisTick} stroke={ct.axisTick} />
                  <YAxis domain={[0, 1]} tick={axisTick} stroke={ct.axisTick} />
                  <Tooltip content={categoryTooltip(`${t('quarter')}: `, (v) => v.toFixed(3))} />
                  <Legend wrapperStyle={{ color: ct.legend, fontSize: AXIS_TICK_FONT_SIZE }} />
                  <Line
                    type="monotone"
                    dataKey="mean"
                    className="series-visus"
                    stroke={VISUS_COLOR}
                    name={t('meanVisus')}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* CRT distribution */}
            <div data-testid="crt-distribution-chart" className={CHART_CARD_CLASS}>
              <h3 className={`${CHART_TITLE_CLASS} mb-4`}>{t('crtDistribution')}</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={crtDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="range" tick={axisTick} stroke={ct.axisTick} />
                  <YAxis tick={axisTick} stroke={ct.axisTick} />
                  <Tooltip content={categoryTooltip()} cursor={{ fill: ct.grid, fillOpacity: 0.3 }} />
                  <Bar dataKey="count" className="series-crt" fill={CRT_COLOR} name={t('measurements')} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Age vs Visus scatter */}
            <div data-testid="age-visus-chart" className={`${CHART_CARD_CLASS} col-span-2`}>
              <h3 className={`${CHART_TITLE_CLASS} mb-4`}>{t('ageVsVisus')}</h3>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis type="number" dataKey="age" name={t('age')} unit=" J." domain={['dataMin', 'dataMax']} tick={axisTick} stroke={ct.axisTick} />
                  <YAxis type="number" dataKey="visus" name={t('visus')} domain={[0, 1]} tick={axisTick} stroke={ct.axisTick} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} content={ageVisusTooltip} />
                  <Scatter data={ageVisusScatter} className="series-visus" fill={VISUS_COLOR} name={displayCohortName ?? t('overlayCohortAllPatients')} />
                  {medianVisus !== null && (
                    <ReferenceLine
                      y={medianVisus}
                      stroke="#dc2626"
                      strokeDasharray="4 4"
                      ifOverflow="extendDomain"
                      label={{
                        value: `${t('outcomesLayerMedian')}: ${medianVisus.toFixed(2)}`,
                        position: 'insideTopRight',
                        fill: '#dc2626',
                        fontSize: 12,
                      }}
                    />
                  )}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <CohortCompareDrawer
          open={compareOpen}
          onClose={closeCompare}
          savedSearches={compareSearches}
          patientCounts={comparePatientCounts}
          primaryCohortId={primaryCohortId}
          selectedIds={compareSelection}
          onChange={compare.handleCompareChange}
          onReset={compare.handleCompareReset}
          t={t as (k: string) => string}
        />
        </section>
      )}
    </div>
  );
}
