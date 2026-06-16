import type React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useThemeSafe } from '../../context/ThemeContext';
import type { TranslationKey } from '../../i18n/translations';
import type { DistributionBin } from '../../utils/distributionBins';
import { caseChartColors } from './chartTheme';

interface ScatterPoint {
  visus: number;
  crt: number;
  date: string;
}

/** J3d: distribution bins carry an optional cohort percentage per bin so the
 *  cohort distribution can be overlaid behind the patient's counts. */
type CohortDistributionBin = DistributionBin & { cohortPct?: number };

export interface DistributionChartsProps {
  visusDistribution: CohortDistributionBin[];
  crtDistribution: CohortDistributionBin[];
  visusCrtScatter: ScatterPoint[];
  /** J3d: cohort Visus-vs-CRT cloud drawn behind the patient's points. */
  cohortVisusCrtScatter?: Array<{ visus: number; crt: number }>;
  /** J3d: gate all cohort overlays on the same toggle as the trajectory chart. */
  showCohortReference?: boolean;
  t: (key: TranslationKey) => string;
}

export default function DistributionCharts({
  visusDistribution,
  crtDistribution,
  visusCrtScatter,
  cohortVisusCrtScatter = [],
  showCohortReference = false,
  t,
}: DistributionChartsProps) {
  // L11b: theme-aware chart colours.
  const { effectiveTheme } = useThemeSafe();
  const isDark = effectiveTheme === 'dark';
  const colors = caseChartColors(isDark);
  const legendStyle = { fontSize: 12, color: colors.legend };

  // M8 (v1.18): histogram totals so the patient's per-bin count can also be shown
  // as a relative percentage of all the patient's measurements — making the units
  // unambiguous against the cohort overlay (which is a percentage of the cohort).
  const visusTotal = visusDistribution.reduce((s, b) => s + b.count, 0);
  const crtTotal = crtDistribution.reduce((s, b) => s + b.count, 0);

  // M8: custom histogram tooltip. Disambiguates the two series:
  //   • patient bars: absolute COUNT + its share of all patient measurements (%).
  //   • cohort overlay: explicitly a PERCENTAGE of the cohort.
  const makeHistogramTooltip = (patientTotal: number) =>
    (props: {
      active?: boolean;
      label?: unknown;
      payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown; color?: string }>;
    }) => {
      if (!props.active || !Array.isArray(props.payload) || props.payload.length === 0) return null;
      const rows: Array<{ key: string; node: React.ReactNode }> = [];
      for (const e of props.payload) {
        const key = String(e.dataKey ?? '');
        if (typeof e.value !== 'number') continue;
        if (key === 'count') {
          const pct = patientTotal > 0 ? Math.round((e.value / patientTotal) * 1000) / 10 : 0;
          rows.push({
            key,
            node: (
              <>
                <span style={{ color: e.color }}>{t('measurements')}</span>: {e.value} ({pct}%)
              </>
            ),
          });
        } else if (key === 'cohortPct') {
          rows.push({
            key,
            node: (
              <>
                <span style={{ color: e.color }}>{t('cohortReferenceDistribution')}</span>: {e.value}% {t('ofCohort')}
              </>
            ),
          });
        }
      }
      if (rows.length === 0) return null;
      const label = props.label != null ? String(props.label) : '';
      return (
        <div className="rounded-lg shadow-lg px-3 py-2 text-xs border" style={{ background: colors.tooltipBg, borderColor: colors.tooltipBorder }}>
          {label && <div className="font-semibold mb-1" style={{ color: colors.tooltipHeading }}>{label}</div>}
          {rows.map((r) => (
            <div key={r.key} style={{ color: colors.tooltipText }}>{r.node}</div>
          ))}
        </div>
      );
    };

  return (
    <div className="grid grid-cols-12 gap-6 mb-6">
      {/* Visus distribution histogram */}
      <div className="col-span-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-sm">
          {t('distributionVisus')}
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={visusDistribution}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis dataKey="range" tick={{ fontSize: 9, fill: colors.axisTick }} stroke={colors.grid} />
            <YAxis yAxisId="count" allowDecimals={false} tickCount={5} tick={{ fontSize: 10, fill: colors.axisTick }} stroke={colors.grid} label={{ value: t('frequency'), angle: -90, position: 'insideLeft', fontSize: 10, fill: colors.axisLabel }} />
            {showCohortReference && (
              <YAxis yAxisId="cohort" orientation="right" tickCount={5} tick={{ fontSize: 9, fill: colors.axisTick }} stroke={colors.grid} unit="%" />
            )}
            {/* M8: custom tooltip — patient count + relative %, cohort as a %. */}
            <Tooltip content={makeHistogramTooltip(visusTotal)} />
            {showCohortReference && <Legend wrapperStyle={legendStyle} />}
            {/* J3d: cohort distribution overlay (% of cohort per bin), drawn behind
                the patient bars on its own right axis so scales don't distort. */}
            {showCohortReference && (
              <Bar yAxisId="cohort" dataKey="cohortPct" fill="#9ca3af" fillOpacity={0.35} stroke="#6b7280" strokeDasharray="2 2" name={t('cohortReferenceDistribution')} radius={[3, 3, 0, 0]} />
            )}
            <Bar yAxisId="count" dataKey="count" fill="#10b981" name={t('measurements')} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* CRT distribution histogram */}
      <div className="col-span-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-sm">
          {t('distributionCrt')}
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={crtDistribution}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis dataKey="range" tick={{ fontSize: 9, fill: colors.axisTick }} stroke={colors.grid} />
            <YAxis yAxisId="count" allowDecimals={false} tickCount={5} tick={{ fontSize: 10, fill: colors.axisTick }} stroke={colors.grid} label={{ value: t('frequency'), angle: -90, position: 'insideLeft', fontSize: 10, fill: colors.axisLabel }} />
            {showCohortReference && (
              <YAxis yAxisId="cohort" orientation="right" tickCount={5} tick={{ fontSize: 9, fill: colors.axisTick }} stroke={colors.grid} unit="%" />
            )}
            {/* M8: custom tooltip — patient count + relative %, cohort as a %. */}
            <Tooltip content={makeHistogramTooltip(crtTotal)} />
            {showCohortReference && <Legend wrapperStyle={legendStyle} />}
            <ReferenceLine yAxisId="count" x=">400" stroke="#ef4444" strokeDasharray="3 3" />
            {showCohortReference && (
              <Bar yAxisId="cohort" dataKey="cohortPct" fill="#9ca3af" fillOpacity={0.35} stroke="#6b7280" strokeDasharray="2 2" name={t('cohortReferenceDistribution')} radius={[3, 3, 0, 0]} />
            )}
            <Bar yAxisId="count" dataKey="count" fill="#8b5cf6" name={t('measurements')} radius={[3, 3, 0, 0]}>
              {crtDistribution.map((entry, idx) => (
                <Cell key={idx} fill={entry.range === '>400' ? '#ef4444' : '#8b5cf6'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Visus vs CRT scatter plot (N05.35) */}
      <div className="col-span-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-sm">
          {t('correlationVisusCrt')}
        </h3>
        {visusCrtScatter.length > 1 ? (
          <ResponsiveContainer width="100%" height={180}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis dataKey="visus" name="Visus" type="number" domain={[0, 1]} tickCount={5} tick={{ fontSize: 9, fill: colors.axisTick }} stroke={colors.grid} label={{ value: t('scatterVisusAxisLabel'), position: 'insideBottom', offset: -2, fontSize: 10, fill: colors.axisLabel }} />
              <YAxis dataKey="crt" name="CRT" unit=" µm" tickCount={5} tick={{ fontSize: 9, fill: colors.axisTick }} stroke={colors.grid} label={{ value: t('scatterCrtAxisLabel'), angle: -90, position: 'insideLeft', fontSize: 10, fill: colors.axisLabel }} />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as { visus: number; crt: number; date: string };
                  return (
                    <div className="rounded-lg shadow-lg px-3 py-2 text-xs border" style={{ background: colors.tooltipBg, borderColor: colors.tooltipBorder }}>
                      <p style={{ color: colors.tooltipText }}>{d.date}</p>
                      <p style={{ color: colors.tooltipHeading }}>Visus: <strong>{d.visus.toFixed(2)}</strong></p>
                      <p style={{ color: colors.tooltipHeading }}>CRT: <strong>{d.crt} µm</strong></p>
                    </div>
                  );
                }}
              />
              {showCohortReference && <Legend wrapperStyle={legendStyle} />}
              {/* J3d: cohort Visus-vs-CRT cloud behind the patient's points. */}
              {showCohortReference && cohortVisusCrtScatter.length > 0 && (
                <Scatter data={cohortVisusCrtScatter} fill="#94a3b8" fillOpacity={0.25} name={t('cohortReferenceScatter')} isAnimationActive={false} />
              )}
              <Scatter data={visusCrtScatter} fill="#f59e0b" name={t('measurements')} />
            </ScatterChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-400 dark:text-gray-500">{t('noData')}</p>
        )}
      </div>
    </div>
  );
}
