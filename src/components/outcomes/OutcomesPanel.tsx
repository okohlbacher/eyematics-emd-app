// retained: live React component (not a re-export shim). Listed as a
// Phase 22 shim candidate by 22-RESEARCH but per D-15 (reality check) it is
// not a dedup target — this file holds chart rendering logic. No action
// required beyond this disposition comment.
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useThemeSafe } from '../../context/ThemeContext';
import type { AxisMode, GridPoint, PanelResult, YMetric } from '../../utils/cohortTrajectory';
import OutcomesTooltip from './OutcomesTooltip';
import { DARK_EYE_COLORS, EYE_COLORS, SERIES_STYLES } from './palette';

type LayerState = {
  median: boolean;
  perPatient: boolean;
  scatter: boolean;
  spreadBand: boolean;
};

export interface CohortSeriesEntry {
  cohortId: string;
  cohortName: string;
  patientCount: number;
  color: string;
  panel: PanelResult;
}

interface Props {
  panel: PanelResult;
  eye: 'od' | 'os' | 'combined';
  color: string;
  axisMode: AxisMode;
  yMetric: YMetric;
  layers: LayerState;
  t: (key: string) => string;
  locale: 'de' | 'en';
  titleKey: 'outcomesPanelOd' | 'outcomesPanelOs' | 'outcomesPanelCombined'
          | 'metricsCrtPanelOd' | 'metricsCrtPanelOs' | 'metricsCrtPanelCombined';
  metric?: 'visus' | 'crt';  // NEW — default 'visus' for backward compat
  cohortSeries?: CohortSeriesEntry[];
}

function yDomain(
  yMetric: YMetric,
  medianGrid: GridPoint[],
  metric: 'visus' | 'crt' = 'visus',
): [number | string, number | string] {
  if (yMetric === 'absolute') {
    // CRT: 0–800 µm clinical range. Visus logMAR: 0–1.0 covers 20/200→20/20 (admin feedback Apr-17).
    return metric === 'crt' ? [0, 800] : [0, 1];
  }
  if (yMetric === 'delta_percent') {
    // Data-driven symmetric range for percentage deltas (CRT and visus).
    const vals = medianGrid.flatMap((g) => [g.y, g.p25 ?? g.y, g.p75 ?? g.y]).filter(Number.isFinite);
    if (vals.length === 0) return [-100, 100];
    const maxAbs = Math.max(...vals.map(Math.abs)) * 1.15;
    return [-Math.max(maxAbs, 10), Math.max(maxAbs, 10)];
  }
  // yMetric === 'delta'
  if (metric === 'visus') {
    // Visus delta logMAR: fixed [-1, 1]. Max possible change is ±1 logMAR
    // (full range from 20/200 to 20/20 or vice versa). Admin feedback Apr-17.
    return [-1, 1];
  }
  // CRT delta µm: data-driven symmetric (µm changes can vary widely).
  const vals = medianGrid.flatMap((g) => [g.y, g.p25 ?? g.y, g.p75 ?? g.y]).filter(Number.isFinite);
  if (vals.length === 0) return [-1, 1];
  const maxAbs = Math.max(...vals.map(Math.abs)) * 1.15;
  return [-Math.max(maxAbs, 5), Math.max(maxAbs, 5)];
}

export default function OutcomesPanel({
  panel,
  eye,
  color,
  axisMode,
  yMetric,
  layers,
  t,
  locale,
  titleKey,
  metric = 'visus',
  cohortSeries,
}: Props) {
  const { effectiveTheme } = useThemeSafe();
  const isDark = effectiveTheme === 'dark';
  const chartColors = {
    grid:         isDark ? '#374151' : '#e5e7eb', // gray-700 / gray-200
    axisTick:     isDark ? '#9ca3af' : '#6b7280', // gray-400 / gray-500
    axisLabel:    isDark ? '#d1d5db' : '#374151', // gray-300 / gray-700
    legend:       isDark ? '#d1d5db' : '#374151',
    tooltipBg:    isDark ? '#1f2937' : '#ffffff',
    tooltipText:  isDark ? '#f3f4f6' : '#111827',
    tooltipBorder: isDark ? '#374151' : '#e5e7eb',
  };
  // Select eye color palette based on theme
  const eyeColors = isDark ? DARK_EYE_COLORS : EYE_COLORS;
  const resolvedColor = eye === 'od' ? eyeColors.OD : eye === 'os' ? eyeColors.OS : eyeColors['OD+OS'];
  // Use resolved theme color unless caller passes an explicit cohort-compare color.
  // Guard against stale light-mode colors passed by a parent that hasn't re-mounted
  // after a theme switch: compare against both palettes so any eye-color hex
  // (light or dark) is treated as "use resolvedColor", not "use as-is".
  const ALL_EYE_HEX = new Set([
    ...Object.values(EYE_COLORS),
    ...Object.values(DARK_EYE_COLORS),
  ]);
  const seriesColor = ALL_EYE_HEX.has(color) ? resolvedColor : color;

  const subtitle = `${panel.summary.patientCount} · ${panel.summary.measurementCount}`;
  // CRT tooltip value label key — passed to OutcomesTooltip for µm unit display
  const valueLabelKey = metric === 'crt'
    ? (yMetric === 'absolute' ? 'metricsCrtYAxisAbsolute' : yMetric === 'delta' ? 'metricsCrtYAxisDelta' : 'metricsCrtYAxisDeltaPercent')
    : undefined;
  const xLabel =
    axisMode === 'days'
      ? t('outcomesTooltipDay')
      : t('outcomesTooltipTreatmentIndex');

  const isCrossMode = Array.isArray(cohortSeries) && cohortSeries.length > 0;

  const totalPatients = isCrossMode
    ? cohortSeries!.reduce((n, s) => n + s.panel.summary.patientCount, 0)
    : panel.summary.patientCount;

  if (totalPatients === 0) {
    return (
      <div
        data-testid={`outcomes-panel-${eye}`}
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
      >
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t(titleKey)}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        <div className="h-80 flex items-center justify-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">{t('outcomesPanelEmpty')}</p>
        </div>
      </div>
    );
  }

  // IQR band projection (09-CONTEXT.md locked decision 2 — single <Area>).
  //
  // Recharts 3.8.1 `BaseLineType = number | ReadonlyArray<NullableCoordinate>` —
  // the `baseLine` prop only accepts a number OR an array of coordinates, NEVER a
  // dataKey string. Phase 8 research (08-RESEARCH.md A1) asserted dataKey support;
  // it is actually incorrect. We keep the single-Area intent of the locked decision
  // and pass baseLine as a coordinate array derived from the same medianGrid.
  const iqrData = panel.medianGrid.map((g) => ({
    x: g.x,
    iqrLow: g.p25,
    iqrHigh: g.p75,
  }));
  const iqrBaseLine = panel.medianGrid.map((g) => ({ x: g.x, y: g.p25 }));

  return (
    <div
      data-testid={`outcomes-panel-${eye}`}
      className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
      role="img"
      aria-label={`${t(titleKey)} — ${panel.summary.patientCount} ${t('outcomesCardPatients')}`}
    >
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t(titleKey)}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>

      {/* IQR marker: conditionally rendered div for test 10 assertion (presence/absence).
          Recharts does not accept arbitrary <g> wrappers as ComposedChart children,
          so we use a hidden sibling div as the testid marker. */}
      {layers.spreadBand && (
        <div
          data-testid={`outcomes-panel-${eye}-iqr`}
          aria-hidden="true"
          hidden
        />
      )}

      {/* Hidden marker div for y-domain regression tests */}
      <div
        hidden
        data-testid="outcomes-panel-ydomain"
        data-metric={metric}
        data-ymetric={yMetric}
        data-min={yDomain(yMetric, panel.medianGrid, metric)[0]}
        data-max={yDomain(yMetric, panel.medianGrid, metric)[1]}
      />

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={panel.medianGrid}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          {yMetric !== 'absolute' && (
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="5 5" />
          )}
          <XAxis
            dataKey="x"
            type="number"
            tick={{ fontSize: 11, fill: chartColors.axisTick }}
            stroke={chartColors.grid}
            label={{
              value: xLabel,
              fontSize: 11,
              fill: chartColors.axisLabel,
              position: 'insideBottom',
              offset: -4,
            }}
          />
          <YAxis tick={{ fontSize: 11, fill: chartColors.axisTick }} stroke={chartColors.grid} domain={yDomain(yMetric, panel.medianGrid, metric)} />
          <Tooltip
            content={
              <OutcomesTooltip
                yMetric={yMetric}
                axisMode={axisMode}
                layers={layers}
                t={t}
                locale={locale}
                valueLabelKey={valueLabelKey}
              />
            }
            contentStyle={{ backgroundColor: chartColors.tooltipBg, color: chartColors.tooltipText, border: `1px solid ${chartColors.tooltipBorder}` }}
            labelStyle={{ color: chartColors.tooltipText }}
            itemStyle={{ color: chartColors.tooltipText }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: chartColors.legend }} />

          {!isCrossMode && layers.spreadBand && (
            <Area
              data={iqrData}
              dataKey="iqrHigh"
              baseLine={iqrBaseLine}
              fill={seriesColor}
              fillOpacity={SERIES_STYLES.iqr.fillOpacity}
              stroke={SERIES_STYLES.iqr.stroke}
              isAnimationActive={false}
              // Suppress legend chip — IQR is a visual band, not a series.
              legendType="none"
            />
          )}

          {!isCrossMode && layers.perPatient &&
            panel.patients
              .filter((p) => !p.excluded && p.measurements.length >= 2)
              .map((p) => (
                <Line
                  key={p.id}
                  data={p.measurements.map((m) => ({
                    ...m,
                    __series: 'perPatient' as const,
                    pseudonym: p.pseudonym,
                  }))}
                  dataKey="y"
                  type="linear"
                  stroke={SERIES_STYLES.perPatient.color}
                  strokeWidth={SERIES_STYLES.perPatient.strokeWidth}
                  strokeOpacity={p.sparse ? SERIES_STYLES.perPatient.opacitySparse : SERIES_STYLES.perPatient.opacityDense}
                  dot={false}
                  isAnimationActive={false}
                  // CRITICAL: without legendType="none", every patient produces a
                  // legend chip (icon "-o-" + dataKey "y"). With 300+ patients the
                  // Recharts <Legend> overflows and tiles the panel. See
                  // docs/reviews/2026-04-16 bug report.
                  legendType="none"
                />
              ))}

          {!isCrossMode && layers.scatter && (
            <Scatter
              data={panel.scatterPoints}
              fill={seriesColor}
              fillOpacity={SERIES_STYLES.scatter.fillOpacity}
              isAnimationActive={false}
              // Suppress legend chip — scatter points are an aggregate overlay.
              legendType="none"
            />
          )}

          {!isCrossMode && layers.median && (
            <Line
              data={panel.medianGrid}
              dataKey="y"
              type="linear"
              stroke={seriesColor}
              strokeWidth={SERIES_STYLES.median.strokeWidth}
              dot={false}
              isAnimationActive={false}
              // Give the median line a human-readable legend label so the
              // sole remaining legend chip reads "Median" instead of "y".
              name={t('outcomesLayerMedian')}
            />
          )}

          {isCrossMode && cohortSeries!.map((series) => {
            const seriesIqrData = series.panel.medianGrid.map((g) => ({
              x: g.x, iqrLow: g.p25, iqrHigh: g.p75,
            }));
            const seriesBaseLine = series.panel.medianGrid.map((g) => ({ x: g.x, y: g.p25 }));
            return (
              <Area
                key={`iqr-${series.cohortId}`}
                data={seriesIqrData}
                dataKey="iqrHigh"
                baseLine={seriesBaseLine}
                fill={series.color}
                fillOpacity={SERIES_STYLES.iqr.fillOpacity}
                stroke={SERIES_STYLES.iqr.stroke}
                isAnimationActive={false}
                legendType="none"
              />
            );
          })}
          {isCrossMode && cohortSeries!.map((series) => (
            <Line
              key={`median-${series.cohortId}`}
              data={series.panel.medianGrid}
              dataKey="y"
              type="linear"
              stroke={series.color}
              strokeWidth={SERIES_STYLES.median.strokeWidth}
              dot={false}
              isAnimationActive={false}
              name={`${series.cohortName} (N=${series.patientCount} patients)`}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
