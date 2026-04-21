/** Cohort analysis page — EMDREQ-ANL-001 to ANL-004 (center distribution, temporal trends, distributions, adverse events).
 *
 * Two tabs, selected via ?tab=aggregate|trajectories:
 *   - aggregate (default): center / diagnosis / visus-trend / CRT / age-vs-visus charts
 *   - trajectories:        OD / OS / combined Visus trajectory panels (OUTCOME-01..12)
 */
import { useCallback, useMemo } from 'react';
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
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import OutcomesView from '../components/outcomes/OutcomesView';
import { CHART_COLORS } from '../config/clinicalThresholds';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import {
  applyFilters,
  getAge,
  getCenterShorthand,
  getDiagnosisFullText,
  getDiagnosisLabel,
  getObservationsByCode,
  LOINC_CRT,
  LOINC_VISUS,
} from '../services/fhirLoader';
import type { CohortFilter } from '../types/fhir';
import { computeCrtDistribution } from '../utils/distributionBins';

type AnalysisTab = 'aggregate' | 'trajectories';

function isAnalysisTab(v: string | null): v is AnalysisTab {
  return v === 'aggregate' || v === 'trajectories';
}

export default function AnalysisPage() {
  const { activeCases } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const { locale, t } = useLanguage();

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

  const filters: CohortFilter = useMemo(() => {
    const raw = searchParams.get('filters');
    if (!raw) return {};
    // M-04: explicitly pick known CohortFilter keys to prevent prototype pollution
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const safe: CohortFilter = {};
      if (Array.isArray(parsed.diagnosis)) safe.diagnosis = parsed.diagnosis.map(String);
      if (Array.isArray(parsed.gender)) safe.gender = parsed.gender.map(String);
      if (Array.isArray(parsed.ageRange) && parsed.ageRange.length === 2) safe.ageRange = [Number(parsed.ageRange[0]), Number(parsed.ageRange[1])];
      if (Array.isArray(parsed.visusRange) && parsed.visusRange.length === 2) safe.visusRange = [Number(parsed.visusRange[0]), Number(parsed.visusRange[1])];
      if (Array.isArray(parsed.crtRange) && parsed.crtRange.length === 2) safe.crtRange = [Number(parsed.crtRange[0]), Number(parsed.crtRange[1])];
      if (Array.isArray(parsed.centers)) safe.centers = parsed.centers.map(String);
      return safe;
    } catch { return {}; }
  }, [searchParams]);

  const cohort = useMemo(() => applyFilters(activeCases, filters), [activeCases, filters]);

  const centerDist = useMemo(() => {
    const map = new Map<string, number>();
    cohort.forEach((c) => {
      const short = getCenterShorthand(c.centerId, c.centerName);
      map.set(short, (map.get(short) ?? 0) + 1);
    });
    return Array.from(map, ([name, count]) => ({ name, count }));
  }, [cohort]);

  const diagDist = useMemo(() => {
    const map = new Map<string, { count: number; code: string }>();
    cohort.forEach((c) => {
      c.conditions.forEach((cond) => {
        const code = cond.code.coding[0]?.code ?? '';
        const label = getDiagnosisLabel(code, locale);
        const entry = map.get(label) ?? { count: 0, code };
        entry.count++;
        map.set(label, entry);
      });
    });
    return Array.from(map, ([name, { count, code }]) => ({
      name,
      value: count,
      fullText: getDiagnosisFullText(code, locale),
    }));
  }, [cohort, locale]);

  const visusTrend = useMemo(() => {
    const byQuarter = new Map<string, number[]>();
    cohort.forEach((c) => {
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
  }, [cohort]);

  const crtDistribution = useMemo(() => {
    const allCrtObs = cohort.flatMap((c) => getObservationsByCode(c.observations, LOINC_CRT));
    return computeCrtDistribution(allCrtObs);
  }, [cohort]);

  const ageVisusScatter = useMemo(() => {
    return cohort
      .map((c) => {
        const latest = getObservationsByCode(c.observations, LOINC_VISUS).slice(-1)[0];
        if (!latest?.valueQuantity) return null;
        return { age: getAge(c.birthDate), visus: latest.valueQuantity.value };
      })
      .filter(Boolean) as { age: number; visus: number }[];
  }, [cohort]);

  const criticalCount = useMemo(() => {
    return cohort.filter((c) => {
      const crt = getObservationsByCode(c.observations, LOINC_CRT);
      return crt.some((o) => (o.valueQuantity?.value ?? 0) > 400);
    }).length;
  }, [cohort]);

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
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {cohort.length} {t('casesInCohort')}
          {criticalCount > 0 && (
            <span className="ml-3 text-red-600 font-medium">
              {criticalCount} {t('casesWithCritical')}
            </span>
          )}
        </p>
      </div>

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
          <OutcomesView />
        </section>
      ) : (
        <section
          id="analysis-tab-aggregate"
          role="tabpanel"
          aria-labelledby="analysis-tab-aggregate-button"
          data-testid="analysis-tab-aggregate"
          className="grid grid-cols-2 gap-6"
        >
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
          <p className="text-xs text-gray-400 mb-2">{t('diagnosisHoverHint')}</p>
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
                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
                      <p className="font-semibold text-gray-900">{d.fullText}</p>
                      <p className="text-gray-500">{t('cases')}: {d.value}</p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
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
        <div className="bg-white rounded-xl border border-gray-200 p-5 col-span-2">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {t('ageVsVisus')}
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="age" name={t('age')} unit=" J." />
              <YAxis dataKey="visus" name={t('visus')} domain={[0, 1]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={ageVisusScatter} fill="#f59e0b" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        </section>
      )}
    </div>
  );
}
