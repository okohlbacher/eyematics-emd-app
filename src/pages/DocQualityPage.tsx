import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { usePageAudit } from '../hooks/usePageAudit';
import { downloadCsv, datedFilename } from '../utils/download';
import {
  getCenterShorthand,
  getObservationsByCode,
  LOINC_VISUS,
  LOINC_CRT,
  LOINC_IOP,
} from '../services/fhirLoader';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import {
  BarChart3,
  Download,
  Building2,
  CheckCircle2,
  AlertCircle,
  Filter,
} from 'lucide-react';
import type { PatientCase } from '../types/fhir';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TimeRange = '6m' | '1y' | 'all';

interface CenterMetrics {
  centerId: string;
  centerLabel: string;
  patientCount: number;
  observationCount: number;
  completeness: number;   // Vollzähligkeit  – % patients with all required fields
  dataCompleteness: number; // Vollständigkeit – % observations with non-null values
  plausibility: number;  // Plausibilität   – % observations in plausible ranges
  overall: number;       // weighted average
}

// ---------------------------------------------------------------------------
// Plausibility range helpers
// ---------------------------------------------------------------------------

function isVisusInRange(v: number): boolean {
  return v >= 0 && v <= 2.0;
}

function isCrtInRange(v: number): boolean {
  return v >= 100 && v <= 800;
}

function isIopInRange(v: number): boolean {
  return v >= 5 && v <= 40;
}

// ---------------------------------------------------------------------------
// Metric calculation
// ---------------------------------------------------------------------------

function cutoffDate(range: TimeRange): Date | null {
  const now = new Date();
  if (range === '6m') {
    return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  }
  if (range === '1y') {
    return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  }
  return null;
}

function filterCasesByTimeRange(cases: PatientCase[], range: TimeRange): PatientCase[] {
  const cutoff = cutoffDate(range);
  if (!cutoff) return cases;

  return cases.map((c) => {
    const obs = c.observations.filter((o) => {
      if (!o.effectiveDateTime) return false;
      return new Date(o.effectiveDateTime) >= cutoff;
    });
    return { ...c, observations: obs };
  });
}

function computeMetrics(cases: PatientCase[]): Omit<CenterMetrics, 'centerId' | 'centerLabel'> {
  const patientCount = cases.length;

  if (patientCount === 0) {
    return {
      patientCount: 0,
      observationCount: 0,
      completeness: 0,
      dataCompleteness: 0,
      plausibility: 0,
      overall: 0,
    };
  }

  // --- Vollzähligkeit (Completeness) ---
  // A patient is "complete" if they have birthDate, gender, >=1 condition, >=1 observation
  const completePatients = cases.filter(
    (c) =>
      c.birthDate !== '' &&
      c.gender !== 'unknown' &&
      c.conditions.length >= 1 &&
      c.observations.length >= 1
  ).length;
  const completeness = (completePatients / patientCount) * 100;

  // --- Vollständigkeit (Data completeness) ---
  // % of observations that have a non-null valueQuantity.value
  const allObs = cases.flatMap((c) => c.observations);
  const observationCount = allObs.length;
  const obsWithValue = allObs.filter(
    (o) => o.valueQuantity?.value != null
  ).length;
  const dataCompleteness =
    observationCount === 0 ? 100 : (obsWithValue / observationCount) * 100;

  // --- Plausibilität (Plausibility) ---
  // For observations with known LOINC codes (Visus, CRT, IOP), check if values are in range
  let plausibleCount = 0;
  let checkableCount = 0;

  cases.forEach((c) => {
    const viusObs = getObservationsByCode(c.observations, LOINC_VISUS);
    const crtObs = getObservationsByCode(c.observations, LOINC_CRT);
    const iopObs = getObservationsByCode(c.observations, LOINC_IOP);

    viusObs.forEach((o) => {
      const v = o.valueQuantity?.value;
      if (v != null) {
        checkableCount++;
        if (isVisusInRange(v)) plausibleCount++;
      }
    });
    crtObs.forEach((o) => {
      const v = o.valueQuantity?.value;
      if (v != null) {
        checkableCount++;
        if (isCrtInRange(v)) plausibleCount++;
      }
    });
    iopObs.forEach((o) => {
      const v = o.valueQuantity?.value;
      if (v != null) {
        checkableCount++;
        if (isIopInRange(v)) plausibleCount++;
      }
    });
  });

  const plausibility =
    checkableCount === 0 ? 100 : (plausibleCount / checkableCount) * 100;

  // --- Overall score (weighted average: 40% completeness, 30% dataCompleteness, 30% plausibility) ---
  const overall =
    completeness * 0.4 + dataCompleteness * 0.3 + plausibility * 0.3;

  return {
    patientCount,
    observationCount,
    completeness,
    dataCompleteness,
    plausibility,
    overall,
  };
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function scoreColor(score: number): string {
  if (score > 80) return '#22c55e'; // green-500
  if (score >= 60) return '#f59e0b'; // amber-500
  return '#ef4444'; // red-500
}

function scoreBgClass(score: number): string {
  if (score > 80) return 'bg-green-100 text-green-800 border-green-200';
  if (score >= 60) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

function scoreIconColor(score: number): string {
  if (score > 80) return 'text-green-500';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-500';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface MetricCardProps {
  label: string;
  score: number;
  description?: string;
}

function MetricCard({ label, score, description }: MetricCardProps) {
  const rounded = Math.round(score);
  return (
    <div className={`rounded-xl border p-4 ${scoreBgClass(score)}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium">{label}</span>
        {score > 80 ? (
          <CheckCircle2 className={`w-4 h-4 ${scoreIconColor(score)}`} />
        ) : (
          <AlertCircle className={`w-4 h-4 ${scoreIconColor(score)}`} />
        )}
      </div>
      <div className="text-2xl font-bold">{rounded}%</div>
      {description && (
        <div className="text-xs mt-1 opacity-75">{description}</div>
      )}
      {/* Progress bar */}
      <div className="mt-2 h-1.5 rounded-full bg-white/40">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(rounded, 100)}%`, backgroundColor: scoreColor(score) }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip for Recharts
// ---------------------------------------------------------------------------

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <div className="font-semibold text-gray-800 mb-2">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-gray-600">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: entry.color }}
          />
          <span>{entry.name}:</span>
          <span className="font-medium">{Math.round(entry.value)}%</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DocQualityPage() {
  const { cases, loading } = useData();
  const { t } = useLanguage();

  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [selectedCenter, setSelectedCenter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  usePageAudit('view_doc_quality', 'audit_detail_view_doc_quality');

  // Group cases by center
  const casesByCenter = useMemo(() => {
    const map = new Map<string, PatientCase[]>();
    cases.forEach((c) => {
      const existing = map.get(c.centerId) ?? [];
      map.set(c.centerId, [...existing, c]);
    });
    return map;
  }, [cases]);

  // Compute per-center metrics respecting the time range filter
  const centerMetrics: CenterMetrics[] = useMemo(() => {
    const results: CenterMetrics[] = [];
    casesByCenter.forEach((centerCases, centerId) => {
      const filtered = filterCasesByTimeRange(centerCases, timeRange);
      const centerLabel = getCenterShorthand(
        centerId,
        centerCases[0]?.centerName ?? centerId
      );
      results.push({
        centerId,
        centerLabel,
        ...computeMetrics(filtered),
      });
    });
    return results.sort((a, b) => b.overall - a.overall);
  }, [casesByCenter, timeRange]);

  // Unique center list for the selector
  const centerOptions = useMemo(
    () => centerMetrics.map((m) => ({ id: m.centerId, label: m.centerLabel })),
    [centerMetrics]
  );

  // Currently selected center detail
  const detailMetrics = useMemo(
    () =>
      selectedCenter === 'all'
        ? null
        : centerMetrics.find((m) => m.centerId === selectedCenter) ?? null,
    [selectedCenter, centerMetrics]
  );

  // Data for the overview bar chart
  const chartData = useMemo(
    () =>
      centerMetrics.map((m) => ({
        name: m.centerLabel,
        [t('docQualityCompleteness')]: Math.round(m.completeness),
        [t('docQualityDataCompleteness')]: Math.round(m.dataCompleteness),
        [t('docQualityPlausibility')]: Math.round(m.plausibility),
        [t('docQualityOverall')]: Math.round(m.overall),
      })),
    [centerMetrics, t]
  );

  // CSV export
  const handleExport = () => {
    const headers = [
      t('center'),
      t('docQualityPatients'),
      t('docQualityObservations'),
      t('docQualityCompleteness') + ' (%)',
      t('docQualityDataCompleteness') + ' (%)',
      t('docQualityPlausibility') + ' (%)',
      t('docQualityOverall') + ' (%)',
    ];
    const rows = centerMetrics.map((m) => [
      m.centerLabel,
      String(m.patientCount),
      String(m.observationCount),
      String(Math.round(m.completeness)),
      String(Math.round(m.dataCompleteness)),
      String(Math.round(m.plausibility)),
      String(Math.round(m.overall)),
    ]);
    downloadCsv(headers, rows, datedFilename('doc-quality-report', 'csv'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <BarChart3 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('docQualityTitle')}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {t('docQualitySubtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              showFilters
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            {t('docQualityTimeRange')}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            {t('docQualityExport')}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Filter bar                                                           */}
      {/* ------------------------------------------------------------------ */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              {t('docQualityTimeRange')}:
            </span>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm">
              {(
                [
                  { value: '6m', label: t('docQualityLast6Months') },
                  { value: '1y', label: t('docQualityLastYear') },
                  { value: 'all', label: t('docQualityAllTime') },
                ] as { value: TimeRange; label: string }[]
              ).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setTimeRange(value)}
                  className={`px-3 py-1.5 transition-colors ${
                    timeRange === value
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">
              {t('center')}:
            </span>
            <select
              value={selectedCenter}
              onChange={(e) => setSelectedCenter(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{t('docQualityAllCenters')}</option>
              {centerOptions.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Summary cards (all centers aggregated)                              */}
      {/* ------------------------------------------------------------------ */}
      {selectedCenter === 'all' && centerMetrics.length > 0 && (() => {
        const agg = {
          completeness:
            centerMetrics.reduce((s, m) => s + m.completeness, 0) /
            centerMetrics.length,
          dataCompleteness:
            centerMetrics.reduce((s, m) => s + m.dataCompleteness, 0) /
            centerMetrics.length,
          plausibility:
            centerMetrics.reduce((s, m) => s + m.plausibility, 0) /
            centerMetrics.length,
          overall:
            centerMetrics.reduce((s, m) => s + m.overall, 0) /
            centerMetrics.length,
        };
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label={t('docQualityCompleteness')}
              score={agg.completeness}
              description={t('docQualityCompletenessAvg')}
            />
            <MetricCard
              label={t('docQualityDataCompleteness')}
              score={agg.dataCompleteness}
              description={t('docQualityDataCompletenessAvg')}
            />
            <MetricCard
              label={t('docQualityPlausibility')}
              score={agg.plausibility}
              description={t('docQualityPlausibilityAvg')}
            />
            <MetricCard
              label={t('docQualityOverall')}
              score={agg.overall}
              description={t('docQualityOverallAvg')}
            />
          </div>
        );
      })()}

      {/* ------------------------------------------------------------------ */}
      {/* Overview bar chart – all centers side by side                       */}
      {/* ------------------------------------------------------------------ */}
      {selectedCenter === 'all' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            {t('docQualityAllCenters')}
          </h2>

          {centerMetrics.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              {t('noData')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                barCategoryGap="20%"
                barGap={2}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={{ stroke: '#e5e7eb' }}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                />
                <Bar
                  dataKey={t('docQualityCompleteness')}
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={scoreColor(
                        entry[t('docQualityCompleteness')] as number
                      )}
                    />
                  ))}
                </Bar>
                <Bar
                  dataKey={t('docQualityDataCompleteness')}
                  fill="#8b5cf6"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey={t('docQualityPlausibility')}
                  fill="#f59e0b"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey={t('docQualityOverall')}
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Per-center table (all centers view)                                 */}
      {/* ------------------------------------------------------------------ */}
      {selectedCenter === 'all' && centerMetrics.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-700">
                  {t('center')}
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">
                  {t('docQualityPatients')}
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">
                  {t('docQualityObservations')}
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">
                  {t('docQualityCompleteness')}
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">
                  {t('docQualityDataCompleteness')}
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">
                  {t('docQualityPlausibility')}
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">
                  {t('docQualityOverall')}
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {centerMetrics.map((m) => (
                <tr
                  key={m.centerId}
                  className="hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => setSelectedCenter(m.centerId)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    {m.centerLabel}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {m.patientCount}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {m.observationCount}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ScoreBadge score={m.completeness} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ScoreBadge score={m.dataCompleteness} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ScoreBadge score={m.plausibility} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ScoreBadge score={m.overall} bold />
                  </td>
                  <td className="px-4 py-3 text-right text-blue-500 text-xs">
                    {t('docQualityDetails')} &rarr;
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Center detail view                                                  */}
      {/* ------------------------------------------------------------------ */}
      {selectedCenter !== 'all' && detailMetrics && (
        <div className="space-y-4">
          {/* Back button + header */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedCenter('all')}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              &larr; {t('docQualityAllCenters')}
            </button>
            <span className="text-gray-300">/</span>
            <span className="text-sm font-semibold text-gray-800 flex items-center gap-1">
              <Building2 className="w-4 h-4 text-gray-500" />
              {detailMetrics.centerLabel}
            </span>
          </div>

          <h2 className="text-lg font-semibold text-gray-800">
            {t('docQualityCenterDetail')} — {detailMetrics.centerLabel}
          </h2>

          {/* Summary stats */}
          <div className="flex gap-4 flex-wrap text-sm text-gray-600">
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-3 py-1.5">
              <Building2 className="w-4 h-4 text-gray-400" />
              <span>
                {detailMetrics.patientCount} {t('docQualityPatients')}
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-3 py-1.5">
              <CheckCircle2 className="w-4 h-4 text-gray-400" />
              <span>
                {detailMetrics.observationCount} {t('docQualityObservations')}
              </span>
            </div>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label={t('docQualityCompleteness')}
              score={detailMetrics.completeness}
              description={t('docQualityCompletenessDesc')}
            />
            <MetricCard
              label={t('docQualityDataCompleteness')}
              score={detailMetrics.dataCompleteness}
              description={t('docQualityDataCompletenessDesc')}
            />
            <MetricCard
              label={t('docQualityPlausibility')}
              score={detailMetrics.plausibility}
              description={t('docQualityPlausibilityDesc')}
            />
            <MetricCard
              label={t('docQualityOverall')}
              score={detailMetrics.overall}
              description={t('docQualityOverallDesc')}
            />
          </div>

          {/* Detail chart for the selected center */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              {t('docQualityCompleteness')} / {t('docQualityDataCompleteness')} /{' '}
              {t('docQualityPlausibility')}
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={[
                  {
                    name: detailMetrics.centerLabel,
                    [t('docQualityCompleteness')]: Math.round(
                      detailMetrics.completeness
                    ),
                    [t('docQualityDataCompleteness')]: Math.round(
                      detailMetrics.dataCompleteness
                    ),
                    [t('docQualityPlausibility')]: Math.round(
                      detailMetrics.plausibility
                    ),
                    [t('docQualityOverall')]: Math.round(detailMetrics.overall),
                  },
                ]}
                margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                barCategoryGap="30%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" hide />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                <Bar
                  dataKey={t('docQualityCompleteness')}
                  fill={scoreColor(detailMetrics.completeness)}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey={t('docQualityDataCompleteness')}
                  fill={scoreColor(detailMetrics.dataCompleteness)}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey={t('docQualityPlausibility')}
                  fill={scoreColor(detailMetrics.plausibility)}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey={t('docQualityOverall')}
                  fill={scoreColor(detailMetrics.overall)}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Plausibility reference table */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              {t('docQualityPlausibilityRanges')}
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-3 py-2 font-medium text-gray-600">
                    {t('docQualityParameter')}
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">
                    {t('docQualityRange')}
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-gray-600">
                    LOINC
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                <tr>
                  <td className="px-3 py-2 text-gray-800">Visus</td>
                  <td className="px-3 py-2 text-gray-600">0 – 2.0</td>
                  <td className="px-3 py-2 text-gray-400 font-mono text-xs">
                    {LOINC_VISUS}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-800">CRT</td>
                  <td className="px-3 py-2 text-gray-600">100 – 800 µm</td>
                  <td className="px-3 py-2 text-gray-400 font-mono text-xs">
                    {LOINC_CRT}
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-gray-800">IOP</td>
                  <td className="px-3 py-2 text-gray-600">5 – 40 mmHg</td>
                  <td className="px-3 py-2 text-gray-400 font-mono text-xs">
                    {LOINC_IOP}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline badge component (defined after the main component to keep it local)
// ---------------------------------------------------------------------------

function ScoreBadge({ score, bold = false }: { score: number; bold?: boolean }) {
  const rounded = Math.round(score);
  let cls =
    'inline-flex items-center justify-end gap-1 text-xs font-medium px-2 py-0.5 rounded-full ';
  if (score > 80) cls += 'bg-green-100 text-green-700';
  else if (score >= 60) cls += 'bg-amber-100 text-amber-700';
  else cls += 'bg-red-100 text-red-700';

  return (
    <span className={cls} style={{ fontWeight: bold ? 700 : undefined }}>
      {rounded}%
    </span>
  );
}
