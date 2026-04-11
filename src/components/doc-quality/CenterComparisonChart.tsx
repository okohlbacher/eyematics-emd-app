import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useLanguage } from '../../context/LanguageContext';
import type { CenterMetrics } from '../../utils/qualityMetrics';
import { scoreColor } from '../../utils/qualityMetrics';

// ---------------------------------------------------------------------------
// Custom tooltip
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
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
        <Bar
          dataKey={t('docQualityCompleteness')}
          fill="#3b82f6"
          radius={[4, 4, 0, 0]}
        >
          {chartData.map((entry) => (
            <Cell
              key={entry.name}
              fill={scoreColor(entry[t('docQualityCompleteness')] as number)}
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
  );
}
