import { Building2, CheckCircle2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useLanguage } from '../../context/LanguageContext';
import {
  LOINC_CRT,
  LOINC_IOP,
  LOINC_VISUS,
} from '../../services/fhirLoader';
import type { CenterMetrics } from '../../utils/qualityMetrics';
import { QUALITY_CATEGORY_COLORS } from '../../utils/qualityMetrics';
import { CustomTooltip } from './CustomTooltip';
import { MetricCard } from './MetricCard';

// ---------------------------------------------------------------------------
// CenterDetailPanel
// ---------------------------------------------------------------------------

export interface CenterDetailPanelProps {
  metrics: CenterMetrics;
  onBack: () => void;
}

export function CenterDetailPanel({ metrics, onBack }: CenterDetailPanelProps) {
  const { t } = useLanguage();

  const chartData = [
    {
      name: metrics.centerLabel,
      [t('docQualityCompleteness')]: Math.round(metrics.completeness),
      [t('docQualityDataCompleteness')]: Math.round(metrics.dataCompleteness),
      [t('docQualityPlausibility')]: Math.round(metrics.plausibility),
      [t('docQualityOverall')]: Math.round(metrics.overall),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Back button + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 transition-colors"
        >
          &larr; {t('docQualityAllCenters')}
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-semibold text-gray-800 flex items-center gap-1">
          <Building2 className="w-4 h-4 text-gray-500" />
          {metrics.centerLabel}
        </span>
      </div>

      <h2 className="text-lg font-semibold text-gray-800">
        {t('docQualityCenterDetail')} — {metrics.centerLabel}
      </h2>

      {/* Summary stats */}
      <div className="flex gap-4 flex-wrap text-sm text-gray-600">
        <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-3 py-1.5">
          <Building2 className="w-4 h-4 text-gray-400" />
          <span>
            {metrics.patientCount} {t('docQualityPatients')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-gray-100 rounded-lg px-3 py-1.5">
          <CheckCircle2 className="w-4 h-4 text-gray-400" />
          <span>
            {metrics.observationCount} {t('docQualityObservations')}
          </span>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label={t('docQualityCompleteness')}
          score={metrics.completeness}
          description={t('docQualityCompletenessDesc')}
        />
        <MetricCard
          label={t('docQualityDataCompleteness')}
          score={metrics.dataCompleteness}
          description={t('docQualityDataCompletenessDesc')}
        />
        <MetricCard
          label={t('docQualityPlausibility')}
          score={metrics.plausibility}
          description={t('docQualityPlausibilityDesc')}
        />
        <MetricCard
          label={t('docQualityOverall')}
          score={metrics.overall}
          description={t('docQualityOverallDesc')}
        />
      </div>

      {/* Per-metric bar chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">
          {t('docQualityCompleteness')} / {t('docQualityDataCompleteness')} /{' '}
          {t('docQualityPlausibility')}
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={chartData}
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
              fill={QUALITY_CATEGORY_COLORS.completeness}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey={t('docQualityDataCompleteness')}
              fill={QUALITY_CATEGORY_COLORS.dataCompleteness}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey={t('docQualityPlausibility')}
              fill={QUALITY_CATEGORY_COLORS.plausibility}
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey={t('docQualityOverall')}
              fill={QUALITY_CATEGORY_COLORS.overall}
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
              <td className="px-3 py-2 text-gray-400 font-mono text-xs">{LOINC_VISUS}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-gray-800">CRT</td>
              <td className="px-3 py-2 text-gray-600">100 – 800 µm</td>
              <td className="px-3 py-2 text-gray-400 font-mono text-xs">{LOINC_CRT}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-gray-800">IOP</td>
              <td className="px-3 py-2 text-gray-600">5 – 40 mmHg</td>
              <td className="px-3 py-2 text-gray-400 font-mono text-xs">{LOINC_IOP}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
