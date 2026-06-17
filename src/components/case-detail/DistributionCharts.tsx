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
import type { ComparableDistributionBin } from '../../utils/distributionBins';
import { InfoTooltip } from '../primitives';
import { caseChartColors } from './chartTheme';

interface ScatterPoint {
  visus: number;
  crt: number;
  date: string;
}

/** N5 (v1.19 WS-B): distribution bins carry the comparable percentage figures
 *  (patientPct, cohortMedianPct) + the absolute counts (count, cohortMedianCount)
 *  used by the reworked grouped-percentage histogram when the overlay is on. */
type CohortDistributionBin = ComparableDistributionBin;

const PATIENT_VISUS_COLOR = '#10b981';
const PATIENT_CRT_COLOR = '#8b5cf6';
const COHORT_COLOR = '#9ca3af';

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

  // M8 (v1.18): overlay-OFF tooltip — patient absolute COUNT + its share of all
  // the patient's measurements (%). No cohort row when the overlay is off.
  const makeCountTooltip = (patientTotal: number) =>
    (props: {
      active?: boolean;
      label?: unknown;
      payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown; color?: string }>;
    }) => {
      if (!props.active || !Array.isArray(props.payload) || props.payload.length === 0) return null;
      const e = props.payload.find((p) => String(p.dataKey ?? '') === 'count');
      if (!e || typeof e.value !== 'number') return null;
      const pct = patientTotal > 0 ? Math.round((e.value / patientTotal) * 1000) / 10 : 0;
      const label = props.label != null ? String(props.label) : '';
      return (
        <div className="rounded-lg shadow-lg px-3 py-2 text-xs border" style={{ background: colors.tooltipBg, borderColor: colors.tooltipBorder }}>
          {label && <div className="font-semibold mb-1" style={{ color: colors.tooltipHeading }}>{label}</div>}
          <div style={{ color: colors.tooltipText }}>
            <span style={{ color: e.color }}>{t('measurements')}</span>: {e.value} ({pct}%)
          </div>
        </div>
      );
    };

  const visusTotal = visusDistribution.reduce((s, b) => s + b.count, 0);
  const crtTotal = crtDistribution.reduce((s, b) => s + b.count, 0);

  // N5 (v1.19 round-7): when the cohort overlay is on, render the comparable
  // grouped %-bars with a small CSS bar chart instead of Recharts <Bar>. Recharts
  // 3.8.1 computes a height of 0 for these grouped bars (correct value + width +
  // a healthy y-scale, yet height 0 — see project memory; resisted ~12 fixes incl.
  // version pin, explicit axis dims, and remount). A CSS chart renders the two
  // bars at heights = their % directly, so patient vs cohort-median sit on ONE
  // shared percentage scale and are directly comparable; the per-bar title shows
  // the absolute counts. Overlay-OFF keeps the (working) Recharts count chart.
  const renderCssGroupedBars = (bins: CohortDistributionBin[], patientColor: string) => {
    const rawMax = Math.max(10, ...bins.flatMap((b) => [b.patientPct, b.cohortMedianPct]));
    const yMax = Math.ceil(rawMax / 10) * 10;
    const ticks = [yMax, Math.round(yMax / 2), 0];
    return (
      <div>
        <div className="flex" style={{ height: 150 }}>
          <div className="flex flex-col justify-between pr-1 text-right" style={{ fontSize: 9, color: colors.axisTick, width: 30 }}>
            {ticks.map((tk) => <span key={tk}>{tk}%</span>)}
          </div>
          <div className="flex flex-1 items-end gap-2 border-l border-b" style={{ borderColor: colors.grid }}>
            {bins.map((bin) => (
              <div key={bin.range} className="flex flex-1 items-end justify-center gap-0.5" style={{ height: '100%' }}>
                <div
                  title={`${t('distributionPatientPct')}: ${bin.patientPct}% (${bin.count} ${t('distributionMeasurementsUnit')})`}
                  style={{ height: `${Math.min(100, (bin.patientPct / yMax) * 100)}%`, width: 9, background: patientColor, borderRadius: '2px 2px 0 0' }}
                />
                <div
                  title={`${t('distributionCohortMedianPct')}: ${bin.cohortMedianPct}% (${bin.cohortMedianCount} ${t('distributionMeasurementsUnit')})`}
                  style={{ height: `${Math.min(100, (bin.cohortMedianPct / yMax) * 100)}%`, width: 9, background: COHORT_COLOR, borderRadius: '2px 2px 0 0' }}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="flex" style={{ paddingLeft: 30 }}>
          {bins.map((bin) => (
            <span key={bin.range} className="flex-1 text-center" style={{ fontSize: 8, color: colors.axisTick }}>{bin.range}</span>
          ))}
        </div>
        <div className="flex justify-center gap-4 mt-2" style={{ fontSize: 10, color: colors.legend }}>
          <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, background: patientColor, display: 'inline-block', borderRadius: 2 }} />{t('distributionPatientPct')}</span>
          <span className="flex items-center gap-1"><span style={{ width: 10, height: 10, background: COHORT_COLOR, display: 'inline-block', borderRadius: 2 }} />{t('distributionCohortMedianPct')}</span>
        </div>
      </div>
    );
  };

  /** N5: one histogram. Overlay ON → grouped %-bars (patient % + cohort median
   *  %) on a SINGLE percentage y-axis so the two are directly comparable; the
   *  tooltip carries the absolute counts. Overlay OFF → the original single
   *  count bar on a frequency axis. `critical` marks the CRT >400 bin red. */
  const renderHistogram = (
    bins: CohortDistributionBin[],
    title: string,
    patientColor: string,
    patientTotal: number,
    critical?: { range: string },
  ) => (
    <div className="col-span-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4 text-sm flex items-center gap-2">
        {title}
        {/* N5: explain the reworked grouped-percentage histogram. */}
        {showCohortReference && <InfoTooltip text={t('distributionGroupedInfo')} />}
      </h3>
      {showCohortReference ? (
        // N5: CSS grouped %-bars (patient vs cohort median) — see renderCssGroupedBars.
        renderCssGroupedBars(bins, patientColor)
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={bins}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
            <XAxis dataKey="range" tick={{ fontSize: 9, fill: colors.axisTick }} stroke={colors.grid} />
            <YAxis allowDecimals={false} tickCount={5} tick={{ fontSize: 10, fill: colors.axisTick }} stroke={colors.grid} label={{ value: t('frequency'), angle: -90, position: 'insideLeft', fontSize: 10, fill: colors.axisLabel }} />
            <Tooltip content={makeCountTooltip(patientTotal)} />
            {critical && <ReferenceLine x={critical.range} stroke="#ef4444" strokeDasharray="3 3" />}
            <Bar dataKey="count" fill={patientColor} name={t('measurements')} radius={[3, 3, 0, 0]}>
              {critical &&
                bins.map((entry, idx) => (
                  <Cell key={idx} fill={entry.range === critical.range ? '#ef4444' : patientColor} />
                ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );

  return (
    <div className="grid grid-cols-12 gap-6 mb-6">
      {renderHistogram(visusDistribution, t('distributionVisus'), PATIENT_VISUS_COLOR, visusTotal)}
      {renderHistogram(crtDistribution, t('distributionCrt'), PATIENT_CRT_COLOR, crtTotal, { range: '>400' })}

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
