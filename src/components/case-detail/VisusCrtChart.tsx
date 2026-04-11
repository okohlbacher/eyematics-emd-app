import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CRITICAL_CRT_THRESHOLD } from '../../config/clinicalThresholds';
import type { TranslationKey } from '../../i18n/translations';
import type { Observation } from '../../types/fhir';
import { translateClinical } from '../../utils/clinicalTerms';

interface CombinedDataPoint {
  date: string;
  visus?: number;
  crt?: number;
  visusMeasured?: boolean;
  crtMeasured?: boolean;
}

export interface VisusCrtChartProps {
  combinedData: CombinedDataPoint[];
  cohortAvgVisus: number;
  cohortAvgCrt: number;
  highlightDate: string | null;
  dateFmt: string;
  locale: string;
  t: (key: TranslationKey) => string;
  visusObs: Observation[];
}

export default function VisusCrtChart({
  combinedData,
  cohortAvgVisus,
  cohortAvgCrt,
  highlightDate,
  dateFmt,
  locale,
  t,
  visusObs,
}: VisusCrtChartProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-1">
        {t('visusAndCrt')}
      </h3>
      <p className="text-xs text-gray-400 mb-1">{t('interpolatedHint')}</p>
      {/* N05.07: Visus type, correction, measurement method */}
      {visusObs[0]?.method && (
        <p className="text-xs text-gray-500 mb-3">
          {translateClinical(visusObs[0].method.coding?.[0]?.display ?? '', locale)}
          {visusObs[0].component?.find((c) => c.code.coding[0]?.code === '79844-7') && (
            <span className="ml-2 text-gray-400">
              ({visusObs[0].component.find((c) => c.code.coding[0]?.code === '79844-7')?.valueQuantity?.unit})
            </span>
          )}
        </p>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={combinedData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis
            yAxisId="visus"
            domain={[0, 1]}
            tick={{ fontSize: 10 }}
            label={{ value: 'Visus', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#10b981' }}
          />
          <YAxis
            yAxisId="crt"
            orientation="right"
            tick={{ fontSize: 10 }}
            label={{ value: 'CRT (\u00b5m)', angle: 90, position: 'insideRight', fontSize: 11, fill: '#8b5cf6' }}
          />
          <Tooltip />
          <Legend />
          <ReferenceLine
            yAxisId="visus"
            y={cohortAvgVisus}
            stroke="#94a3b8"
            strokeDasharray="5 5"
            label={{ value: `Visus \u00d8 ${cohortAvgVisus.toFixed(2)}`, position: 'insideTopLeft', fontSize: 9, fill: '#94a3b8' }}
          />
          <ReferenceLine
            yAxisId="crt"
            y={cohortAvgCrt}
            stroke="#c4b5fd"
            strokeDasharray="5 5"
            label={{ value: `CRT \u00d8 ${cohortAvgCrt.toFixed(0)}`, position: 'insideTopRight', fontSize: 9, fill: '#c4b5fd' }}
          />
          <ReferenceLine
            yAxisId="crt"
            y={CRITICAL_CRT_THRESHOLD}
            stroke="#ef4444"
            strokeDasharray="3 3"
            label={{ value: t('critical'), fontSize: 9, fill: '#ef4444' }}
          />
          {highlightDate && (
            <ReferenceLine
              yAxisId="visus"
              x={highlightDate}
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="4 2"
              label={{ value: new Date(highlightDate).toLocaleDateString(dateFmt), position: 'top', fontSize: 10, fill: '#f59e0b' }}
            />
          )}
          <Line
            yAxisId="visus"
            type="monotone"
            dataKey="visus"
            stroke="#10b981"
            name="Visus"
            strokeWidth={2}
            dot={(props: Record<string, unknown>) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: { visusMeasured?: boolean } };
              if (cx == null || cy == null) return <circle key={`v-${cx}`} />;
              return payload?.visusMeasured
                ? <circle key={`v-${cx}`} cx={cx} cy={cy} r={4} fill="#10b981" stroke="#fff" strokeWidth={1} />
                : <circle key={`v-${cx}`} cx={cx} cy={cy} r={3} fill="#fff" stroke="#10b981" strokeWidth={2} strokeDasharray="2 1" />;
            }}
            connectNulls
          />
          <Line
            yAxisId="crt"
            type="monotone"
            dataKey="crt"
            stroke="#8b5cf6"
            name="CRT (\u00b5m)"
            strokeWidth={2}
            dot={(props: Record<string, unknown>) => {
              const { cx, cy, payload } = props as { cx: number; cy: number; payload: { crtMeasured?: boolean } };
              if (cx == null || cy == null) return <circle key={`c-${cx}`} />;
              return payload?.crtMeasured
                ? <circle key={`c-${cx}`} cx={cx} cy={cy} r={4} fill="#8b5cf6" stroke="#fff" strokeWidth={1} />
                : <circle key={`c-${cx}`} cx={cx} cy={cy} r={3} fill="#fff" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="2 1" />;
            }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
