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
import type { AxisMode, GridPoint, PanelResult, YMetric } from '../../utils/cohortTrajectory';
import OutcomesTooltip from './OutcomesTooltip';
import { SERIES_STYLES } from './palette';

type LayerState = {
  median: boolean;
  perPatient: boolean;
  scatter: boolean;
  spreadBand: boolean;
};

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
}: Props) {
  const subtitle = `${panel.summary.patientCount} · ${panel.summary.measurementCount}`;
  // CRT tooltip value label key — passed to OutcomesTooltip for µm unit display
  const valueLabelKey = metric === 'crt'
    ? (yMetric === 'absolute' ? 'metricsCrtYAxisAbsolute' : yMetric === 'delta' ? 'metricsCrtYAxisDelta' : 'metricsCrtYAxisDeltaPercent')
    : undefined;
  const xLabel =
    axisMode === 'days'
      ? t('outcomesTooltipDay')
      : t('outcomesTooltipTreatmentIndex');

  if (panel.summary.patientCount === 0) {
    return (
      <div
        data-testid={`outcomes-panel-${eye}`}
        className="bg-white rounded-xl border border-gray-200 p-5"
      >
        <h3 className="text-base font-semibold text-gray-900">{t(titleKey)}</h3>
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        <div className="h-80 flex items-center justify-center">
          <p className="text-sm text-gray-400">{t('outcomesPanelEmpty')}</p>
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
      className="bg-white rounded-xl border border-gray-200 p-5"
      role="img"
      aria-label={`${t(titleKey)} — ${panel.summary.patientCount} ${t('outcomesCardPatients')}`}
    >
      <h3 className="text-base font-semibold text-gray-900">{t(titleKey)}</h3>
      <p className="text-xs text-gray-500 mt-1">{subtitle}</p>

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
          <CartesianGrid strokeDasharray="3 3" />
          {yMetric !== 'absolute' && (
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="5 5" />
          )}
          <XAxis
            dataKey="x"
            type="number"
            tick={{ fontSize: 11 }}
            label={{
              value: xLabel,
              fontSize: 11,
              fill: '#6b7280',
              position: 'insideBottom',
              offset: -4,
            }}
          />
          <YAxis tick={{ fontSize: 11 }} domain={yDomain(yMetric, panel.medianGrid, metric)} />
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
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />

          {layers.spreadBand && (
            <Area
              data={iqrData}
              dataKey="iqrHigh"
              baseLine={iqrBaseLine}
              fill={color}
              fillOpacity={SERIES_STYLES.iqr.fillOpacity}
              stroke={SERIES_STYLES.iqr.stroke}
              isAnimationActive={false}
              // Suppress legend chip — IQR is a visual band, not a series.
              legendType="none"
            />
          )}

          {layers.perPatient &&
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
                  stroke={color}
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

          {layers.scatter && (
            <Scatter
              data={panel.scatterPoints}
              fill={color}
              fillOpacity={SERIES_STYLES.scatter.fillOpacity}
              isAnimationActive={false}
              // Suppress legend chip — scatter points are an aggregate overlay.
              legendType="none"
            />
          )}

          {layers.median && (
            <Line
              data={panel.medianGrid}
              dataKey="y"
              type="linear"
              stroke={color}
              strokeWidth={SERIES_STYLES.median.strokeWidth}
              dot={false}
              isAnimationActive={false}
              // Give the median line a human-readable legend label so the
              // sole remaining legend chip reads "Median" instead of "y".
              name={t('outcomesLayerMedian')}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
