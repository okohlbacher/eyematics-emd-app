import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { CRITICAL_CRT_THRESHOLD } from '../../config/clinicalThresholds';
import { useThemeSafe } from '../../context/ThemeContext';
import type { CombinedDataPoint } from '../../hooks/useCaseData';
import type { TranslationKey } from '../../i18n/translations';
import type { Observation, Procedure } from '../../types/fhir';
import { translateClinical } from '../../utils/clinicalTerms';
import { InfoTooltip } from '../primitives';
import { caseChartColors, IQR_FILL_OPACITY } from './chartTheme';

/** Patient curve colours — shared so the legend swatches stay in sync. */
const VISUS_COLOR = '#10b981';
const CRT_COLOR = '#8b5cf6';
const VISUS_MEDIAN_COLOR = '#6ee7b7';
const CRT_MEDIAN_COLOR = '#c4b5fd';

export interface VisusCrtChartProps {
  /** A3 v2: single merged data array — patient rows already carry the cohort
   *  reference fields (visusMedian/crtMedian, visusBand/crtBand) and the relative
   *  time (relMonths). No per-series `data` props.
   *
   *  L5 (v1.17): the individual trajectory's X axis is now DYNAMIC — keyed on the
   *  calendar `date` when the cohort overlay is OFF, and on the relative
   *  `relMonths` ("Monate seit Erstvisite") when the overlay is ON, so the
   *  patient and the relative-time-aligned cohort band share one axis. IVI markers
   *  and the click-highlight follow whichever axis is active. */
  combinedData: CombinedDataPoint[];
  cohortAvgVisus: number;
  cohortAvgCrt: number;
  highlightDate: string | null;
  dateFmt: string;
  locale: string;
  t: (key: TranslationKey) => string;
  visusObs: Observation[];
  /** FALL-011: toggle the cohort reference overlay on/off (default off). */
  showCohortReference?: boolean;
  /** IVI injections, rendered as markers on whichever axis is active (L5). */
  injections?: Procedure[];
  /** The date of the currently-highlighted injection (emphasises its marker). */
  highlightInjectionDate?: string | null;
  /** Click handler for an IVI marker — toggles the injection highlight. */
  onInjectionClick?: (date: string) => void;
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
  showCohortReference = false,
  injections = [],
  highlightInjectionDate = null,
  onInjectionClick,
}: VisusCrtChartProps) {
  // L11b: theme-aware chart colours (Recharts can't read Tailwind dark: classes).
  const { effectiveTheme } = useThemeSafe();
  const isDark = effectiveTheme === 'dark';
  const colors = caseChartColors(isDark);

  const hasReference =
    showCohortReference &&
    combinedData.some((d) => d.visusBand != null || d.crtBand != null || d.visusMedian != null || d.crtMedian != null);

  // L5: when the overlay is on we plot on the relative-month axis; otherwise the
  // calendar-date axis. The X dataKey, IVI marker x, and highlight x all switch.
  const useRelativeAxis = hasReference;

  // Resolve an ISO date string to its relative-month bucket via combinedData
  // (each row carries both `date` and `relMonths`). Used to place date-keyed
  // markers (IVI / highlight) on the relative axis when it is active.
  const relMonthsForDate = (iso: string): number | null => {
    const row = combinedData.find((d) => d.date === iso);
    return row ? row.relMonths : null;
  };

  // M6: on the calendar axis (now a linear TIME axis keyed on epoch-ms) a date
  // marker's x must be epoch milliseconds, not the ISO string. Resolve via the
  // matching row's `dateMs` (falling back to a direct parse for injection dates
  // that may not have a measurement row — though the hook seeds those too).
  const msForDate = (iso: string): number | null => {
    const row = combinedData.find((d) => d.date === iso);
    if (row?.dateMs) return row.dateMs;
    const ms = new Date(iso).getTime();
    return Number.isNaN(ms) ? null : ms;
  };

  // M6/L5: a date-keyed marker's x — relative-month bucket on the relative axis,
  // epoch-ms on the linear calendar axis.
  const xForDate = (iso: string): number | null =>
    useRelativeAxis ? relMonthsForDate(iso) : msForDate(iso);

  const injectionMarkers = injections
    .map((inj) => inj.performedDateTime?.substring(0, 10) ?? '')
    .filter((d) => d !== '')
    .map((date) => ({
      date,
      x: xForDate(date),
    }))
    .filter((m): m is { date: string; x: number } => m.x != null);

  const highlightX = highlightDate ? xForDate(highlightDate) : null;

  // F4 + L4c: custom tooltip — unified across the absolute and relative plots.
  // Shows the patient's measured Visus/CRT AND (when the overlay is active) the
  // cohort MEDIAN, but NEVER the raw IQR band ([p25,p75]) values nor the
  // interpolation series. Content + format are identical on both axes; only the
  // label adapts (calendar date vs "X Monate seit Erstvisite").
  const fmtVisus = (v: number) => v.toFixed(2);
  const fmtCrt = (v: number) => `${v.toFixed(0)} µm`;
  const renderTooltip = (props: {
    active?: boolean;
    label?: unknown;
    payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown; color?: string; payload?: CombinedDataPoint }>;
  }) => {
    if (!props.active || !Array.isArray(props.payload) || props.payload.length === 0) {
      return null;
    }
    // Allowed series: measured Visus/CRT + cohort medians. Exclude bands + interp.
    const rows: Array<{ key: string; name: string; color?: string; text: string }> = [];
    for (const e of props.payload) {
      const key = String(e.dataKey ?? '');
      if (typeof e.value !== 'number') continue;
      if (key === 'visus') rows.push({ key, name: 'Visus', color: e.color, text: fmtVisus(e.value) });
      else if (key === 'crt') rows.push({ key, name: t('crtLegendLabel'), color: e.color, text: fmtCrt(e.value) });
      else if (key === 'visusMedian') rows.push({ key, name: t('cohortReferenceMedianVisus'), color: e.color, text: fmtVisus(e.value) });
      else if (key === 'crtMedian') rows.push({ key, name: t('cohortReferenceMedianCrt'), color: e.color, text: fmtCrt(e.value) });
    }
    if (rows.length === 0) return null;
    const ref = props.payload.find((e) => e.payload?.date)?.payload;
    const rawDate = ref?.date ?? '';
    const label = useRelativeAxis
      ? ref != null
        ? `${ref.relMonths} ${t('relativeMonthsAxisLabel')}`
        : ''
      : rawDate
        ? new Date(rawDate).toLocaleDateString(dateFmt)
        : '';
    return (
      <div
        className="rounded-lg shadow-lg px-3 py-2 text-sm border"
        style={{ background: colors.tooltipBg, borderColor: colors.tooltipBorder }}
      >
        {label && (
          <div className="text-xs font-semibold mb-1" style={{ color: colors.tooltipHeading }}>{label}</div>
        )}
        {rows.map((r) => (
          <div key={r.key} className="text-xs" style={{ color: colors.tooltipText }}>
            <span style={{ color: r.color }}>{r.name}</span>: {r.text}
          </div>
        ))}
      </div>
    );
  };

  // L4b: custom legend so the IQR band swatches reproduce the EXACT rendered band
  // colour (the semi-transparent fill), not the opaque patient-curve colour.
  // Recharts' default rect swatch paints at full opacity; we draw our own swatch
  // with the band's fill + IQR_FILL_OPACITY for the cohort IQR entries and a line
  // glyph for everything else, keeping the legend faithful to the plot.
  const renderLegend = (props: {
    payload?: ReadonlyArray<{ value?: unknown; color?: string; dataKey?: unknown; type?: string }>;
  }) => {
    if (!Array.isArray(props.payload)) return null;
    return (
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs mt-1" style={{ color: colors.legend }}>
        {props.payload.map((entry, i) => {
          const key = String(entry.dataKey ?? '');
          const isBand = key === 'visusBand' || key === 'crtBand';
          return (
            <li key={`${key}-${i}`} className="flex items-center gap-1.5">
              {isBand ? (
                // L4b: shaded swatch matching the rendered band (fill @ IQR opacity).
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: 14,
                    height: 10,
                    background: entry.color,
                    opacity: IQR_FILL_OPACITY,
                    border: `1px solid ${entry.color}`,
                  }}
                />
              ) : (
                <span
                  aria-hidden
                  style={{ display: 'inline-block', width: 14, height: 0, borderTop: `2px solid ${entry.color}` }}
                />
              )}
              <span>{String(entry.value ?? '')}</span>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-1.5">
        {t('visusAndCrt')}
        {/* K-bl1 + L10: short explanation; when the overlay is on, append the
            overlay-specific note about the IQR band + relative-time alignment. */}
        <InfoTooltip
          text={
            hasReference
              ? `${t('visusCrtPlotInfo')} ${t('cohortOverlayInfoVisusCrt')}`
              : t('visusCrtPlotInfo')
          }
        />
      </h3>
      {/* N05.07: Visus type, correction, measurement method */}
      {visusObs[0]?.method && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          {translateClinical(visusObs[0].method.coding?.[0]?.display ?? '', locale)}
          {visusObs[0].component?.find((c) => c.code.coding[0]?.code === '79844-7') && (
            <span className="ml-2 text-gray-400 dark:text-gray-500">
              ({visusObs[0].component.find((c) => c.code.coding[0]?.code === '79844-7')?.valueQuantity?.unit})
            </span>
          )}
        </p>
      )}
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={combinedData}>
          <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
          {/* L5/M6: dynamic X axis. Overlay OFF → linear calendar-TIME axis keyed
              on epoch-ms (type="number", scale="time") so tick spacing is
              proportional to elapsed time, NOT the row index. Overlay ON → numeric
              relative-month axis ("Monate seit Erstvisite") so the
              relative-time-aligned cohort band shares the patient's axis. */}
          {useRelativeAxis ? (
            <XAxis
              dataKey="relMonths"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(m: number) => String(m)}
              tick={{ fontSize: 10, fill: colors.axisTick }}
              stroke={colors.grid}
              label={{ value: t('relativeMonthsAxisLabel'), position: 'insideBottom', offset: -2, fontSize: 10, fill: colors.axisLabel }}
            />
          ) : (
            <XAxis
              dataKey="dateMs"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(ms: number) => (ms ? new Date(ms).toLocaleDateString(dateFmt, { month: '2-digit', year: '2-digit' }) : '')}
              tick={{ fontSize: 10, fill: colors.axisTick }}
              stroke={colors.grid}
            />
          )}
          <YAxis
            yAxisId="visus"
            domain={[0, 1]}
            tickCount={5}
            allowDecimals
            tick={{ fontSize: 10, fill: colors.axisTick }}
            stroke={colors.grid}
            label={{ value: t('visusShortLabel'), angle: -90, position: 'insideLeft', fontSize: 11, fill: VISUS_COLOR }}
          />
          <YAxis
            yAxisId="crt"
            orientation="right"
            tickCount={5}
            allowDecimals={false}
            tick={{ fontSize: 10, fill: colors.axisTick }}
            stroke={colors.grid}
            label={{ value: t('crtLegendLabel'), angle: -90, position: 'insideRight', fontSize: 11, fill: CRT_COLOR }}
          />
          <Tooltip content={renderTooltip} />
          <Legend content={renderLegend} />
          <ReferenceLine
            yAxisId="visus"
            y={cohortAvgVisus}
            stroke="#94a3b8"
            strokeDasharray="5 5"
            label={{ value: `Visus Ø ${cohortAvgVisus.toFixed(2)}`, position: 'insideTopLeft', fontSize: 9, fill: '#94a3b8' }}
          />
          <ReferenceLine
            yAxisId="crt"
            y={cohortAvgCrt}
            stroke="#c4b5fd"
            strokeDasharray="5 5"
            label={{ value: `CRT Ø ${cohortAvgCrt.toFixed(0)}`, position: 'insideTopRight', fontSize: 9, fill: '#c4b5fd' }}
          />
          <ReferenceLine
            yAxisId="crt"
            y={CRITICAL_CRT_THRESHOLD()}
            stroke="#ef4444"
            strokeDasharray="3 3"
            label={{ value: t('critical'), fontSize: 9, fill: '#ef4444' }}
          />
          {/* L5/L6: IVI injection markers keyed on the active axis (relMonths when
              the overlay is on, calendar date otherwise). The highlighted one is
              solid, thicker and amber. */}
          {injectionMarkers.map((m) => {
            const active = highlightInjectionDate === m.date;
            return (
              <ReferenceLine
                key={`ivi-${m.date}`}
                yAxisId="visus"
                x={m.x}
                stroke={active ? '#f59e0b' : '#3b82f6'}
                strokeWidth={active ? 2 : 1}
                strokeDasharray={active ? undefined : '2 2'}
                onClick={onInjectionClick ? () => onInjectionClick(m.date) : undefined}
                style={onInjectionClick ? { cursor: 'pointer' } : undefined}
                label={{ value: 'IVI', position: 'insideBottom', fontSize: 8, fill: active ? '#f59e0b' : '#3b82f6' }}
              />
            );
          })}
          {highlightX != null && highlightDate && (
            <ReferenceLine
              yAxisId="visus"
              x={highlightX}
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="4 2"
              label={{ value: new Date(highlightDate).toLocaleDateString(dateFmt), position: 'top', fontSize: 10, fill: '#f59e0b' }}
            />
          )}
          {/* FALL-011 (A3 v2): cohort reference overlay — one translucent RANGE
              Area per metric ([p25, p75] tuple), rendered before the patient lines
              so the patient series stays on top. */}
          {hasReference && (
            <>
              <Area
                yAxisId="visus"
                dataKey="visusBand"
                stroke="none"
                fill={VISUS_COLOR}
                fillOpacity={IQR_FILL_OPACITY}
                name={t('cohortReferenceBandVisus')}
                legendType="rect"
                connectNulls
                isAnimationActive={false}
              />
              <Area
                yAxisId="crt"
                dataKey="crtBand"
                stroke="none"
                fill={CRT_COLOR}
                fillOpacity={IQR_FILL_OPACITY}
                name={t('cohortReferenceBandCrt')}
                legendType="rect"
                connectNulls
                isAnimationActive={false}
              />
              <Line
                yAxisId="visus"
                type="monotone"
                dataKey="visusMedian"
                stroke={VISUS_MEDIAN_COLOR}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                name={t('cohortReferenceMedianVisus')}
                dot={false}
                connectNulls
              />
              <Line
                yAxisId="crt"
                type="monotone"
                dataKey="crtMedian"
                stroke={CRT_MEDIAN_COLOR}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                name={t('cohortReferenceMedianCrt')}
                dot={false}
                connectNulls
              />
            </>
          )}
          {/* Measured Visus curve — values on .visus are always real measurements.
              L7/L8: filled dots only (no open-circle interpolated markers), and
              connectNulls draws straight through gaps so no marker sits off the
              line. Interpolated values are NOT rendered as distinct markers. */}
          <Line
            yAxisId="visus"
            type="monotone"
            dataKey="visus"
            stroke={VISUS_COLOR}
            name={t('visusYAxisLabel')}
            strokeWidth={2}
            dot={(props: Record<string, unknown>) => {
              const { cx, cy } = props as { cx?: number; cy?: number };
              if (cx == null || cy == null) return <circle key={`v-${cx}-${cy}`} r={0} />;
              return <circle key={`v-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={VISUS_COLOR} stroke="#fff" strokeWidth={1} />;
            }}
            connectNulls
          />
          {/* Measured CRT curve — values on .crt are always real measurements. */}
          <Line
            yAxisId="crt"
            type="monotone"
            dataKey="crt"
            stroke={CRT_COLOR}
            name={t('crtLegendLabel')}
            strokeWidth={2}
            dot={(props: Record<string, unknown>) => {
              const { cx, cy } = props as { cx?: number; cy?: number };
              if (cx == null || cy == null) return <circle key={`c-${cx}-${cy}`} r={0} />;
              return <circle key={`c-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill={CRT_COLOR} stroke="#fff" strokeWidth={1} />;
            }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
