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
import { useThemeSafe } from '../../context/ThemeContext';
import type { CenterMetrics } from '../../utils/qualityMetrics';
import { QUALITY_CATEGORY_COLORS } from '../../utils/qualityMetrics';
import { caseChartColors } from '../case-detail/chartTheme';
import { CustomTooltip } from './CustomTooltip';
import { MetricCard } from './MetricCard';
import { PlausibilityRangesTable } from './PlausibilityRangesTable';

// ---------------------------------------------------------------------------
// CenterDetailPanel
// ---------------------------------------------------------------------------

export interface CenterDetailPanelProps {
  metrics: CenterMetrics;
  onBack: () => void;
}

export function CenterDetailPanel({ metrics, onBack }: CenterDetailPanelProps) {
  const { t } = useLanguage();
  // M12 (v1.18): theme-aware Recharts styling (see CenterComparisonChart).
  const { effectiveTheme } = useThemeSafe();
  const isDark = effectiveTheme === 'dark';
  const colors = caseChartColors(isDark);

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
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-1">
          <Building2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          {metrics.centerLabel}
        </span>
      </div>

      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
        {t('docQualityCenterDetail')} — {metrics.centerLabel}
      </h2>

      {/* Summary stats */}
      <div className="flex gap-4 flex-wrap text-sm text-gray-600 dark:text-gray-300">
        <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-1.5">
          <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          <span>
            {metrics.patientCount} {t('docQualityPatients')}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-1.5">
          <CheckCircle2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
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
          patientCount={metrics.patientCount}
          tooltip={t('docQualityCompletenessTooltip')}
        />
        <MetricCard
          label={t('docQualityDataCompleteness')}
          score={metrics.dataCompleteness}
          description={t('docQualityDataCompletenessDesc')}
          patientCount={metrics.patientCount}
          tooltip={t('docQualityDataCompletenessTooltip')}
        />
        <MetricCard
          label={t('docQualityPlausibility')}
          score={metrics.plausibility}
          description={t('docQualityPlausibilityDesc')}
          patientCount={metrics.patientCount}
          tooltip={t('docQualityPlausibilityTooltip')}
        />
        <MetricCard
          label={t('docQualityOverall')}
          score={metrics.overall}
          description={t('docQualityOverallDesc')}
          patientCount={metrics.patientCount}
          tooltip={t('docQualityOverallTooltip')}
        />
      </div>

      {/* Per-metric bar chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-4">
          {t('docQualityCompleteness')} / {t('docQualityDataCompleteness')} /{' '}
          {t('docQualityPlausibility')}
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={chartData}
            margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
            barCategoryGap="30%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis dataKey="name" hide />
            <YAxis
              domain={[0, 100]}
              tickCount={5}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fontSize: 11, fill: colors.axisTick }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip isDark={isDark} />} cursor={{ fill: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12, color: colors.legend }} />
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

      {/* Plausibility reference table (global ranges, shared with main view — J5a) */}
      <PlausibilityRangesTable />
    </div>
  );
}
