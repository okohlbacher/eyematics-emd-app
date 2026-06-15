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

import { CenterMultiSelect } from '../components/common/CenterMultiSelect';
import OutcomesView from '../components/outcomes/OutcomesView';
import { COHORT_PALETTES } from '../components/outcomes/palette';
import { CHART_COLORS } from '../config/clinicalThresholds';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { useRecentActivity } from '../hooks/useRecentActivity';
import {
  applyFilters,
  getAge,
  getCenterShorthand,
  getObservationsByCode,
  LOINC_CRT,
  LOINC_VISUS,
} from '../services/fhirLoader';
import { getSettings } from '../services/settingsService';
import { getCachedDisplay, getCachedFullText } from '../services/terminology';
import type { CohortFilter, PatientCase } from '../types/fhir';
import { parseCohortFilterJson, summarizeCohortFilter } from '../utils/cohortFilterSerialization';
import { computeCrtDistribution } from '../utils/distributionBins';

type AnalysisTab = 'aggregate' | 'trajectories';

function isAnalysisTab(v: string | null): v is AnalysisTab {
  return v === 'aggregate' || v === 'trajectories';
}

export default function AnalysisPage() {
  const { activeCases, savedSearches, loading } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const { locale, t } = useLanguage();
  const { record } = useRecentActivity();

  // Tab selection via ?tab=aggregate|trajectories (default: aggregate).
  const tab: AnalysisTab = useMemo(() => {
    const raw = searchParams.get('tab');
    return isAnalysisTab(raw) ? raw : 'aggregate';
  }, [searchParams]);

  const selectTab = useCallback(
    (next: AnalysisTab) => {
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

  const filters: CohortFilter = useMemo(() => {
    // If a saved search is referenced, use its stored filters (KOH-005 / Issue 4 fix).
    if (activeSavedSearch) return activeSavedSearch.filters;
    // M-04: explicitly pick known CohortFilter keys to prevent prototype pollution (F-04 shared serializer).
    return parseCohortFilterJson(searchParams.get('filters'));
  }, [activeSavedSearch, searchParams]);

  /**
   * ANL-012: Display name for the active cohort / filter set.
   * - Saved search path: activeSavedSearch.name (unchanged)
   * - Direct ?filters= path with ?name=: use the supplied name (React auto-escapes text content — T-42-06)
   * - Direct ?filters= path without ?name=: synthesize from t('analysisFilteredCohort') + summarizeCohortFilter
   * - No cohort/filter active: null (no name line rendered)
   * Total length is capped at 80 chars with ellipsis to mirror OutcomesView cross-mode truncation.
   */
  const displayCohortName: string | null = useMemo(() => {
    if (activeSavedSearch) return activeSavedSearch.name;
    const filtersParam = searchParams.get('filters');
    if (filtersParam !== null) {
      const urlName = searchParams.get('name')?.trim();
      if (urlName) {
        // User-supplied name — React text content auto-escapes (T-42-06); cap length
        return urlName.length > 80 ? urlName.slice(0, 79) + '…' : urlName;
      }
      const base = t('analysisFilteredCohort');
      const summary = summarizeCohortFilter(filters);
      const full = summary ? `${base} · ${summary}` : base;
      return full.length > 80 ? full.slice(0, 79) + '…' : full;
    }
    return null;
  }, [activeSavedSearch, searchParams, filters, t]);

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

  /** Parse, deduplicate, cap at 4, drop unknown ids, always include primary first. */
  const crossCohortIds: string[] = useMemo(() => {
    if (!rawCohortsParam) return [];
    const raw = rawCohortsParam.split(',').map((s) => s.trim()).filter(Boolean);
    const known = raw.filter((id) => savedSearches.some((s) => s.id === id));
    const withPrimary =
      primaryCohortId && !known.includes(primaryCohortId)
        ? [primaryCohortId, ...known]
        : known;
    return withPrimary.slice(0, 4);
  }, [rawCohortsParam, primaryCohortId, savedSearches]);

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
      const saved = savedSearches.find((s) => s.id === id);
      if (!saved) return [];
      const cases = applyFilters(activeCases, saved.filters, filterOptions);
      const color = COHORT_PALETTES[idx % COHORT_PALETTES.length];
      return [{ cohortId: id, cohortName: saved.name, patientCount: cases.length, color, cases }];
    });
  }, [crossCohortIds, savedSearches, activeCases]);

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

  const [selectedCenters, setSelectedCenters] = useState<string[]>([]);

  // Apply center narrowing to the single-cohort view (no effect on cross-cohort
  // since each cohort operates on activeCases through applyFilters independently;
  // cross-cohort views are filtered per-cohort below via centeredCrossCohortsActive).
  const centeredCohort = useMemo(() => {
    if (selectedCenters.length === 0) return cohort;
    return cohort.filter((c) => selectedCenters.includes(c.centerName));
  }, [cohort, selectedCenters]);

  // Cross-cohort narrowing: apply center filter to each cohort's cases.
  const centeredCrossCohorts = useMemo(() => {
    if (selectedCenters.length === 0) return crossCohorts;
    return crossCohorts.map((entry) => ({
      ...entry,
      cases: entry.cases.filter((c) => selectedCenters.includes(c.centerName)),
      patientCount: entry.cases.filter((c) => selectedCenters.includes(c.centerName)).length,
    }));
  }, [crossCohorts, selectedCenters]);

  const centerDist = useMemo(() => {
    const map = new Map<string, number>();
    centeredCohort.forEach((c) => {
      const short = getCenterShorthand(c.centerId, c.centerName);
      map.set(short, (map.get(short) ?? 0) + 1);
    });
    return Array.from(map, ([name, count]) => ({ name, count }));
  }, [centeredCohort]);

  const diagDist = useMemo(() => {
    const map = new Map<string, { count: number; code: string; system: string | undefined }>();
    centeredCohort.forEach((c) => {
      c.conditions.forEach((cond) => {
        const system = cond.code.coding[0]?.system;
        const code = cond.code.coding[0]?.code ?? '';
        const label = getCachedDisplay(system, code, locale);
        const entry = map.get(label) ?? { count: 0, code, system };
        entry.count++;
        map.set(label, entry);
      });
    });
    return Array.from(map, ([name, { count, code, system }]) => ({
      name,
      code,
      value: count,
      fullText: getCachedFullText(system, code, locale),
    })).sort((a, b) => b.value - a.value);
  }, [centeredCohort, locale]);

  const visusTrend = useMemo(() => {
    const byQuarter = new Map<string, number[]>();
    centeredCohort.forEach((c) => {
      getObservationsByCode(c.observations, LOINC_VISUS).forEach((obs) => {
        if (!obs.effectiveDateTime || !obs.valueQuantity) return;
        const d = new Date(obs.effectiveDateTime);
        const q = `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
        const arr = byQuarter.get(q) ?? [];
        arr.push(obs.valueQuantity.value);
        byQuarter.set(q, arr);
      });
    });
    return Array.from(byQuarter)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([quarter, vals]) => ({
        quarter,
        mean: +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(3),
        count: vals.length,
      }));
  }, [centeredCohort]);

  const crtDistribution = useMemo(() => {
    const allCrtObs = centeredCohort.flatMap((c) => getObservationsByCode(c.observations, LOINC_CRT));
    return computeCrtDistribution(allCrtObs);
  }, [centeredCohort]);

  const ageVisusScatter = useMemo(() => {
    // ANL-003: sort by age so X-axis is monotonically increasing
    return centeredCohort
      .map((c) => {
        const latest = getObservationsByCode(c.observations, LOINC_VISUS).slice(-1)[0];
        if (!latest?.valueQuantity) return null;
        return { age: getAge(c.birthDate), visus: latest.valueQuantity.value };
      })
      .filter(Boolean)
      .sort((a, b) => a!.age - b!.age) as { age: number; visus: number }[];
  }, [centeredCohort]);

  const medianVisus = useMemo(() => {
    if (ageVisusScatter.length === 0) return null;
    const sorted = ageVisusScatter.map((p) => p.visus).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }, [ageVisusScatter]);

  const criticalCount = useMemo(() => {
    return centeredCohort.filter((c) => {
      const crt = getObservationsByCode(c.observations, LOINC_CRT);
      return crt.some((o) => (o.valueQuantity?.value ?? 0) > 400);
    }).length;
  }, [centeredCohort]);

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
        {displayCohortName !== null && (
          <p className="text-sm font-medium text-blue-700 dark:text-blue-400 mt-0.5">
            {displayCohortName}
          </p>
        )}
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {centeredCohort.length} {t('casesInCohort')}
          {criticalCount > 0 && (
            <span className="ml-3 text-red-600 font-medium">
              {criticalCount} {t('casesWithCritical')}
            </span>
          )}
        </p>
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
            <OutcomesView />
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
        {/* ----------------------------------------------------------------
            Phase 42 / ANL-011: cross-cohort comparison layout.
            Rendered when isCrossMode && crossCohorts.length >= 2.
            Uses small-multiple pies per cohort (rather than grouped bars)
            because pie-per-cohort shows the intra-cohort distribution
            proportionally and scales cleanly to 2–4 cohorts.
            Legend: plain DOM text spans (queryByText-accessible for RTL).
        ---------------------------------------------------------------- */}
        {isCrossMode && centeredCrossCohorts.length >= 2 ? (
          <>
            {/* Cohort color legend — plain DOM text for RTL queryByText */}
            <ul
              aria-label={t('analysisCompareLegendAriaLabel')}
              className="flex flex-wrap gap-4"
            >
              {centeredCrossCohorts.map((cohort) => (
                <li key={cohort.cohortId} className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                  <span
                    className="w-3 h-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: cohort.color }}
                    aria-hidden="true"
                  />
                  {/* Plain text span — required for RTL queryByText assertions */}
                  <span>{cohort.cohortName}</span>
                  <span className="text-gray-400 dark:text-gray-500 font-normal">
                    ({cohort.patientCount})
                  </span>
                </li>
              ))}
            </ul>

            {/* Diagnosis distribution comparison — small-multiple pies per cohort */}
            <div
              data-testid="compare-diagnosis"
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
            >
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('analysisCompareDiagnosisTitle')}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {centeredCrossCohorts.map((cohort) => {
                  // Compute diagDist for this cohort using the same logic as the single-cohort path
                  const map = new Map<string, { count: number; code: string; system: string | undefined }>();
                  cohort.cases.forEach((c) => {
                    c.conditions.forEach((cond) => {
                      const system = cond.code.coding[0]?.system;
                      const code = cond.code.coding[0]?.code ?? '';
                      const label = getCachedDisplay(system, code, locale);
                      const entry = map.get(label) ?? { count: 0, code, system };
                      entry.count++;
                      map.set(label, entry);
                    });
                  });
                  const cohortDiagDist = Array.from(map, ([name, { count, code, system }]) => ({
                    name,
                    code,
                    value: count,
                    fullText: getCachedFullText(system, code, locale),
                  })).sort((a, b) => b.value - a.value);

                  return (
                    <div key={cohort.cohortId}>
                      <h4
                        className="text-sm font-semibold mb-2"
                        style={{ color: cohort.color }}
                      >
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
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const d = payload[0].payload as { name: string; value: number; fullText: string };
                              return (
                                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-sm">
                                  <p className="font-semibold text-gray-900 dark:text-gray-100">{d.fullText}</p>
                                  <p className="text-gray-500 dark:text-gray-400">{t('cases')}: {d.value}</p>
                                </div>
                              );
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Age-vs-Visus comparison — one ScatterChart, one Scatter series per cohort */}
            <div
              data-testid="compare-age-visus"
              className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
            >
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('analysisCompareAgeVisusTitle')}
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="age" name={t('age')} unit=" J." domain={['dataMin', 'dataMax']} />
                  <YAxis type="number" dataKey="visus" name={t('visus')} domain={[0, 1]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Legend />
                  {centeredCrossCohorts.map((cohort) => {
                    const cohortScatter = cohort.cases
                      .map((c) => {
                        const latest = getObservationsByCode(c.observations, LOINC_VISUS).slice(-1)[0];
                        if (!latest?.valueQuantity) return null;
                        return { age: getAge(c.birthDate), visus: latest.valueQuantity.value };
                      })
                      .filter(Boolean)
                      .sort((a, b) => a!.age - b!.age) as { age: number; visus: number }[];
                    return (
                      <Scatter
                        key={cohort.cohortId}
                        data={cohortScatter}
                        fill={cohort.color}
                        name={cohort.cohortName}
                      />
                    );
                  })}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          /* Single-cohort layout — original five charts, unchanged */
          <div className="grid grid-cols-2 gap-6">
            {/* Center distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('centerDistribution')}
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={centerDist}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" name={t('cases')} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Diagnosis distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {t('diagnosisDistribution')}
              </h3>
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
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload as { name: string; value: number; fullText: string };
                          return (
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2 text-sm">
                              <p className="font-semibold text-gray-900 dark:text-gray-100">{d.fullText}</p>
                              <p className="text-gray-500 dark:text-gray-400">{t('cases')}: {d.value}</p>
                            </div>
                          );
                        }}
                      />
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
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('visusTrend')}
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={visusTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="quarter" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 1]} />
                  <Tooltip
                    formatter={(v: unknown) => typeof v === 'number' ? v.toFixed(3) : String(v)}
                    labelFormatter={(l) => `${t('quarter')}: ${l}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="mean"
                    stroke="#10b981"
                    name={t('meanVisus')}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* CRT distribution */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('crtDistribution')}
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={crtDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="range" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8b5cf6" name={t('measurements')} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Age vs Visus scatter */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 col-span-2">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {t('ageVsVisus')}
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" dataKey="age" name={t('age')} unit=" J." domain={['dataMin', 'dataMax']} />
                  <YAxis type="number" dataKey="visus" name={t('visus')} domain={[0, 1]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                  <Scatter data={ageVisusScatter} fill="#f59e0b" />
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
        </section>
      )}
    </div>
  );
}
