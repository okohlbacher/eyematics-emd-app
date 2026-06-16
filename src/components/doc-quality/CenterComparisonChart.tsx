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
import type { CenterMetrics, QualityCategory } from '../../utils/qualityMetrics';
import { QUALITY_CATEGORY_COLORS } from '../../utils/qualityMetrics';
import { caseChartColors } from '../case-detail/chartTheme';
import { CustomTooltip } from './CustomTooltip';

// ---------------------------------------------------------------------------
// CenterComparisonChart
// ---------------------------------------------------------------------------

export interface CenterComparisonChartProps {
  metrics: CenterMetrics[];
  noDataLabel: string;
}

export function CenterComparisonChart({
  metrics,
  noDataLabel,
}: CenterComparisonChartProps) {
  const { t } = useLanguage();
  // M12 (v1.18): theme-aware Recharts styling — Recharts cannot read Tailwind
  // `dark:` classes, so axis/grid/legend/tooltip colours are passed explicitly.
  const { effectiveTheme } = useThemeSafe();
  const isDark = effectiveTheme === 'dark';
  const colors = caseChartColors(isDark);

  const chartData = metrics.map((m) => ({
    name: m.centerLabel,
    [t('docQualityCompleteness')]: Math.round(m.completeness),
    [t('docQualityDataCompleteness')]: Math.round(m.dataCompleteness),
    [t('docQualityPlausibility')]: Math.round(m.plausibility),
    [t('docQualityOverall')]: Math.round(m.overall),
  }));

  if (metrics.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        {noDataLabel}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={chartData}
        margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
        barCategoryGap="20%"
        barGap={2}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: colors.axisTick }}
          tickLine={false}
          axisLine={{ stroke: colors.grid }}
        />
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
        {(
          [
            ['completeness', t('docQualityCompleteness')],
            ['dataCompleteness', t('docQualityDataCompleteness')],
            ['plausibility', t('docQualityPlausibility')],
            ['overall', t('docQualityOverall')],
          ] as ReadonlyArray<readonly [QualityCategory, string]>
        ).map(([category, label]) => (
          <Bar
            key={category}
            dataKey={label}
            radius={[4, 4, 0, 0]}
            fill={QUALITY_CATEGORY_COLORS[category]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
