/** Documentation quality benchmarking page — EMDREQ-QUAL-011 (center comparison, completeness, plausibility scores). */
import { BarChart3, Download, Filter } from 'lucide-react';
import { useMemo, useState } from 'react';

import { CenterComparisonChart } from '../components/doc-quality/CenterComparisonChart';
import { CenterDetailPanel } from '../components/doc-quality/CenterDetailPanel';
import { CenterTable } from '../components/doc-quality/CenterTable';
import { MetricCard } from '../components/doc-quality/MetricCard';
import { QualityFilterBar } from '../components/doc-quality/QualityFilterBar';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { getCenterShorthand } from '../services/fhirLoader';
import type { PatientCase } from '../types/fhir';
import { datedFilename, downloadCsv } from '../utils/download';
import {
  type CenterMetrics,
  computeMetrics,
  filterCasesByTimeRange,
  isCustomTimeRange,
  type TimeRange,
} from '../utils/qualityMetrics';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCenterMetrics(
  casesByCenter: Map<string, PatientCase[]>,
  timeRange: TimeRange
): CenterMetrics[] {
  const results: CenterMetrics[] = [];
  casesByCenter.forEach((centerCases, centerId) => {
    const filtered = filterCasesByTimeRange(centerCases, timeRange);
    // F5: a center with no in-window cases must NOT appear in the list/dropdown
    // and must NOT drag the KPI averages toward zero. filterCasesByTimeRange drops
    // cases with no in-window observations, so an empty result means "inactive in
    // this window" — skip it entirely. 0-safe: empty centerCases also skip here.
    if (filtered.length === 0) return;
    const centerLabel = getCenterShorthand(
      centerId,
      centerCases[0]?.centerName ?? centerId
    );
    results.push({ centerId, centerLabel, ...computeMetrics(filtered) });
  });
  return results.sort((a, b) => b.overall - a.overall);
}

function average(metrics: CenterMetrics[], key: keyof CenterMetrics): number {
  return (
    (metrics.reduce((s, m) => s + (m[key] as number), 0) / metrics.length) ||
    0
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

  const casesByCenter = useMemo(() => {
    const map = new Map<string, PatientCase[]>();
    cases.forEach((c) => {
      const existing = map.get(c.centerId) ?? [];
      map.set(c.centerId, [...existing, c]);
    });
    return map;
  }, [cases]);

  const centerMetrics = useMemo(
    () => buildCenterMetrics(casesByCenter, timeRange),
    [casesByCenter, timeRange]
  );

  const centerOptions = useMemo(
    () => centerMetrics.map((m) => ({ id: m.centerId, label: m.centerLabel })),
    [centerMetrics]
  );

  // QUAL-023 / WR-02: distinct-patient population scoped to the selected time window.
  // Semantics: Grundgesamtheit = distinct pseudonyms IN WINDOW.
  // filterCasesByTimeRange drops cases with 0 observations in the window, so the
  // resulting set represents only patients active in the chosen period.
  // Per-center metric.patientCount = case count IN WINDOW (same filtering applied
  // inside buildCenterMetrics via filterCasesByTimeRange).
  // 0-safe: empty cases → Set size 0.
  const distinctPatientCount = useMemo(() => {
    const windowCases = filterCasesByTimeRange(cases, timeRange);
    return new Set(windowCases.map((c) => c.pseudonym)).size;
  }, [cases, timeRange]);

  const detailMetrics = useMemo(
    () =>
      selectedCenter === 'all'
        ? null
        : centerMetrics.find((m) => m.centerId === selectedCenter) ?? null,
    [selectedCenter, centerMetrics]
  );

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
      <div className="flex items-center justify-center h-64 text-gray-500 dark:text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <BarChart3 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('docQualityTitle')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {t('docQualitySubtitle')}
              {timeRange !== 'all' && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {isCustomTimeRange(timeRange)
                    ? `${timeRange.from || '…'} – ${timeRange.to || '…'}`
                    : timeRange === '3m'
                      ? t('docQualityLast3Months')
                      : timeRange === '6m'
                        ? t('docQualityLast6Months')
                        : t('docQualityLastYear')}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              showFilters
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 text-blue-700'
                : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            <Filter className="w-4 h-4" />
            {t('docQualityTimeRange')}
          </button>
          {/* Center select — always visible */}
          <select
            value={selectedCenter}
            onChange={(e) => setSelectedCenter(e.target.value)}
            className="border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-2 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">{t('docQualityAllCenters')}</option>
            {centerOptions.map(({ id, label }) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <Download className="w-4 h-4" />
            {t('docQualityExport')}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <QualityFilterBar
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          selectedCenter={selectedCenter}
          onCenterChange={setSelectedCenter}
          centerOptions={centerOptions}
          showCenterFilter={false}
        />
      )}

      {/* Grundgesamtheit label — QUAL-023: total patient count always visible */}
      {selectedCenter === 'all' && centerMetrics.length > 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">{t('qualityPopulationLabel')}:</span>{' '}
          {distinctPatientCount}
        </p>
      )}

      {/* Aggregated summary cards */}
      {selectedCenter === 'all' && centerMetrics.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label={t('docQualityCompleteness')}
            score={average(centerMetrics, 'completeness')}
            description={t('docQualityCompletenessAvg')}
            patientCount={distinctPatientCount}
            tooltip={t('docQualityCompletenessTooltip')}
          />
          <MetricCard
            label={t('docQualityDataCompleteness')}
            score={average(centerMetrics, 'dataCompleteness')}
            description={t('docQualityDataCompletenessAvg')}
            patientCount={distinctPatientCount}
            tooltip={t('docQualityDataCompletenessTooltip')}
          />
          <MetricCard
            label={t('docQualityPlausibility')}
            score={average(centerMetrics, 'plausibility')}
            description={t('docQualityPlausibilityAvg')}
            patientCount={distinctPatientCount}
          />
          <MetricCard
            label={t('docQualityOverall')}
            score={average(centerMetrics, 'overall')}
            description={t('docQualityOverallAvg')}
            patientCount={distinctPatientCount}
          />
        </div>
      )}

      {/* Overview bar chart */}
      {selectedCenter === 'all' && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            {t('docQualityAllCenters')}
          </h2>
          <CenterComparisonChart
            metrics={centerMetrics}
            noDataLabel={t('noData')}
          />
        </div>
      )}

      {/* Per-center table */}
      {selectedCenter === 'all' && centerMetrics.length > 0 && (
        <CenterTable
          metrics={centerMetrics}
          onSelectCenter={setSelectedCenter}
        />
      )}

      {/* Center detail view */}
      {selectedCenter !== 'all' && detailMetrics && (
        <CenterDetailPanel
          metrics={detailMetrics}
          onBack={() => setSelectedCenter('all')}
        />
      )}
    </div>
  );
}
