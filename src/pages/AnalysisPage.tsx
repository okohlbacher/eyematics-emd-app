import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';

import { CHART_COLORS } from '../config/clinicalThresholds';
import { computeCrtDistribution } from '../utils/distributionBins';
import {
  applyFilters,
  getObservationsByCode,
  getAge,
  getDiagnosisLabel,
  getCenterShorthand,
  getDiagnosisFullText,
  LOINC_VISUS,
  LOINC_CRT,
} from '../services/fhirLoader';
import type { CohortFilter } from '../types/fhir';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
} from 'recharts';

export default function AnalysisPage() {
  const { activeCases } = useData();
  const [searchParams] = useSearchParams();
  const { locale, t } = useLanguage();


  const filters: CohortFilter = useMemo(() => {
    const raw = searchParams.get('filters');
    if (!raw) return {};
    try { return JSON.parse(raw); } catch { return {}; }
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

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('analysisTitle')}</h1>
        <p className="text-gray-500 mt-1">
          {cohort.length} {t('casesInCohort')}
          {criticalCount > 0 && (
            <span className="ml-3 text-red-600 font-medium">
              {criticalCount} {t('casesWithCritical')}
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Center distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
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
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-2">
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
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
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
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
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
          <h3 className="font-semibold text-gray-900 mb-4">
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
      </div>
    </div>
  );
}
