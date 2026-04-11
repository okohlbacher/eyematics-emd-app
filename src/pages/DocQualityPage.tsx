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
      <div className="flex items-center justify-center h-64 text-gray-500">
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

      {/* Filter bar */}
      {showFilters && (
        <QualityFilterBar
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          selectedCenter={selectedCenter}
          onCenterChange={setSelectedCenter}
          centerOptions={centerOptions}
        />
      )}

      {/* Aggregated summary cards */}
      {selectedCenter === 'all' && centerMetrics.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label={t('docQualityCompleteness')}
            score={average(centerMetrics, 'completeness')}
            description={t('docQualityCompletenessAvg')}
          />
          <MetricCard
            label={t('docQualityDataCompleteness')}
            score={average(centerMetrics, 'dataCompleteness')}
            description={t('docQualityDataCompletenessAvg')}
          />
          <MetricCard
            label={t('docQualityPlausibility')}
            score={average(centerMetrics, 'plausibility')}
            description={t('docQualityPlausibilityAvg')}
          />
          <MetricCard
            label={t('docQualityOverall')}
            score={average(centerMetrics, 'overall')}
            description={t('docQualityOverallAvg')}
          />
        </div>
      )}

      {/* Overview bar chart */}
      {selectedCenter === 'all' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
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
