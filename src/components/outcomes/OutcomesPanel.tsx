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
import type { AxisMode, PanelResult, YMetric } from '../../utils/cohortTrajectory';
import OutcomesTooltip from './OutcomesTooltip';

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
  titleKey: 'outcomesPanelOd' | 'outcomesPanelOs' | 'outcomesPanelCombined';
}

function yDomain(yMetric: YMetric): [number | string, number | string] {
  if (yMetric === 'absolute') return [0, 2];
  if (yMetric === 'delta_percent') return [-200, 200];
  return ['auto', 'auto'];
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
}: Props) {
  const subtitle = `${panel.summary.patientCount} · ${panel.summary.measurementCount}`;
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
          <YAxis tick={{ fontSize: 11 }} domain={yDomain(yMetric)} />
          <Tooltip
            content={
              <OutcomesTooltip
                yMetric={yMetric}
                axisMode={axisMode}
                t={t}
                locale={locale}
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
              fillOpacity={0.15}
              stroke="none"
              isAnimationActive={false}
            />
          )}

          {layers.perPatient &&
            panel.patients
              .filter((p) => !p.excluded && p.measurements.length >= 2)
              .map((p) => (
                <Line
                  key={p.id}
                  data={p.measurements}
                  dataKey="y"
                  type="linear"
                  stroke={color}
                  strokeWidth={1.5}
                  strokeOpacity={p.sparse ? 0.3 : 0.6}
                  dot={false}
                  isAnimationActive={false}
                />
              ))}

          {layers.scatter && (
            <Scatter
              data={panel.scatterPoints}
              fill={color}
              fillOpacity={0.5}
              isAnimationActive={false}
            />
          )}

          {layers.median && (
            <Line
              data={panel.medianGrid}
              dataKey="y"
              type="linear"
              stroke={color}
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
