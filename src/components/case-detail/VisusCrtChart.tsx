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
import type { CombinedDataPoint } from '../../hooks/useCaseData';
import type { TranslationKey } from '../../i18n/translations';
import type { Observation, Procedure } from '../../types/fhir';
import { translateClinical } from '../../utils/clinicalTerms';
import { InfoTooltip } from '../primitives';

export interface VisusCrtChartProps {
  /** A3 v2: single merged data array — patient rows already carry the cohort
   *  reference fields (visusMedian/crtMedian, visusBand/crtBand) and the
   *  interpolation keys (visusInterp/crtInterp). No per-series `data` props.
   *  K3c (revert of v1.15-p5): the individual trajectory's X axis is keyed on the
   *  calendar `date` again. The cohort overlay is still aggregated by relative time
   *  since each peer's own baseline, but those reference values were already mapped
   *  onto the patient's `date` rows in useCaseData — so on this absolute-date axis
   *  the band/median align to the patient's visits at the same elapsed time. */
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
  /** A4 v2: show the interpolation caption only when interpolated points exist. */
  hasInterpolatedPoints?: boolean;
  /** K3c: IVI injections, rendered as date-keyed markers on the calendar axis. */
  injections?: Procedure[];
  /** K3d: the date of the currently-highlighted injection (emphasises its marker). */
  highlightInjectionDate?: string | null;
  /** K3d: click handler for an IVI marker — toggles the injection highlight. */
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
  hasInterpolatedPoints = false,
  injections = [],
  highlightInjectionDate = null,
  onInjectionClick,
}: VisusCrtChartProps) {
  // K3c: the trajectory X axis is the calendar `date` again, so the highlighted
  // visit and IVI markers are date-keyed (ReferenceLine x = the date string).
  const injectionMarkers = injections
    .map((inj) => ({ date: inj.performedDateTime?.substring(0, 10) ?? '' }))
    .filter((m) => m.date !== '');
  const hasReference =
    showCohortReference &&
    combinedData.some((d) => d.visusBand != null || d.crtBand != null || d.visusMedian != null || d.crtMedian != null);

  // F4: custom tooltip — the default <Tooltip /> lists every series under the
  // hovered date, including the cohort-overlay reference series (visusBand/crtBand
  // render as raw [p25,p75] arrays, plus visusMedian/crtMedian/visusInterp/crtInterp).
  // On a single-patient chart that is clinically confusing, so we show ONLY the
  // measured Visus and CRT for the hovered date (plus the date label) and exclude
  // every reference/interpolation dataKey. Styling mirrors the chart's light card.
  const renderTooltip = (props: {
    active?: boolean;
    label?: unknown;
    payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown; color?: string; payload?: CombinedDataPoint }>;
  }) => {
    if (!props.active || !Array.isArray(props.payload) || props.payload.length === 0) {
      return null;
    }
    const measured = props.payload.filter(
      (e) => e.dataKey === 'visus' || e.dataKey === 'crt',
    );
    if (measured.length === 0) return null;
    // K3c: the X dimension is the calendar date again — show the date label
    // (read off the row's `date`, falling back to the axis label).
    const row = props.payload.find((e) => e.payload?.date)?.payload;
    const rawDate = row?.date ?? (props.label != null ? String(props.label) : '');
    const dateLabel = rawDate ? new Date(rawDate).toLocaleDateString(dateFmt) : '';
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
        {dateLabel && (
          <div className="text-xs font-semibold text-gray-700 mb-1">{dateLabel}</div>
        )}
        {measured.map((e) => {
          const isVisus = e.dataKey === 'visus';
          const name = isVisus ? 'Visus' : t('crtLegendLabel');
          const value =
            typeof e.value === 'number'
              ? isVisus
                ? e.value.toFixed(2)
                : `${e.value.toFixed(0)} µm`
              : '–';
          return (
            <div key={String(e.dataKey)} className="text-xs text-gray-600">
              <span style={{ color: e.color }}>{name}</span>: {value}
            </div>
          );
        })}
      </div>
    );
  };

  // A4 v2: open-circle dot renderer for the interpolated (display-only) series.
  const interpDot = (color: string) => (props: Record<string, unknown>) => {
    const { cx, cy, value } = props as { cx?: number; cy?: number; value?: number };
    if (cx == null || cy == null || value == null) return <circle key={`i-${cx}-${cy}`} r={0} />;
    return (
      <circle
        key={`i-${cx}-${cy}`}
        cx={cx}
        cy={cy}
        r={3}
        fill="#fff"
        stroke={color}
        strokeWidth={2}
        strokeDasharray="2 1"
      />
    );
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-1 flex items-center gap-1.5">
        {t('visusAndCrt')}
        {/* K-bl1: short explanation of what the trajectory shows. */}
        <InfoTooltip text={t('visusCrtPlotInfo')} />
      </h3>
      {/* I4: the full Visus label "Visus (Dezimal, bestkorrigiert)" now lives in
          the chart legend (measured-Visus line name), so the redundant under-title
          caption is dropped. The interpolation hint stays, shown only when relevant. */}
      {hasInterpolatedPoints && (
        <p className="text-xs text-gray-400 mb-1">{t('interpolatedHint')}</p>
      )}
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
        {/* ComposedChart, not LineChart: Recharts 3.x only renders the chart type's
            own graphical items — <Area> children inside <LineChart> produce no
            geometry at all (live-browser verified), so the FALL-011 IQR bands
            silently vanished. ComposedChart supports mixed Line+Area natively. */}
        <ComposedChart data={combinedData}>
          <CartesianGrid strokeDasharray="3 3" />
          {/* K3c (revert of v1.15-p5): the individual trajectory uses the calendar
              `date` (category axis) again. The cohort overlay stays aggregated by
              relative time since each peer's own baseline, but those values were
              mapped onto the patient's date rows upstream — so band/median align to
              the patient's visits here. Ticks read the localised calendar date. */}
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => (d ? new Date(d).toLocaleDateString(dateFmt, { month: '2-digit', year: '2-digit' }) : '')}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            yAxisId="visus"
            domain={[0, 1]}
            tickCount={5}
            allowDecimals
            tick={{ fontSize: 10 }}
            label={{ value: t('visusShortLabel'), angle: -90, position: 'insideLeft', fontSize: 11, fill: '#10b981' }}
          />
          <YAxis
            yAxisId="crt"
            orientation="right"
            tickCount={5}
            allowDecimals={false}
            tick={{ fontSize: 10 }}
            label={{ value: t('crtLegendLabel'), angle: -90, position: 'insideRight', fontSize: 11, fill: '#8b5cf6' }}
          />
          <Tooltip content={renderTooltip} />
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
            y={CRITICAL_CRT_THRESHOLD()}
            stroke="#ef4444"
            strokeDasharray="3 3"
            label={{ value: t('critical'), fontSize: 9, fill: '#ef4444' }}
          />
          {/* K3c/K3d: date-keyed IVI injection markers. Each injection's calendar
              date is its x value on the category axis. K3d: the marker is clickable
              (toggles the injection highlight) and the highlighted one is emphasised
              (solid, thicker, amber). The injection dates are present as rows in
              combinedData (added in useCaseData) so the markers always land. */}
          {injectionMarkers.map((m) => {
            const active = highlightInjectionDate === m.date;
            return (
              <ReferenceLine
                key={`ivi-${m.date}`}
                yAxisId="visus"
                x={m.date}
                stroke={active ? '#f59e0b' : '#3b82f6'}
                strokeWidth={active ? 2 : 1}
                strokeDasharray={active ? undefined : '2 2'}
                onClick={onInjectionClick ? () => onInjectionClick(m.date) : undefined}
                style={onInjectionClick ? { cursor: 'pointer' } : undefined}
                label={{ value: 'IVI', position: 'insideBottom', fontSize: 8, fill: active ? '#f59e0b' : '#3b82f6' }}
              />
            );
          })}
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
          {/* FALL-011 (A3 v2): cohort reference overlay. One translucent RANGE
              Area per metric ([p25, p75] tuple) — NO white paint-over. Reads
              dataKeys from the single merged data array (no own `data` prop) so
              axis-domain distortion is structurally impossible. Rendered before
              patient lines so the patient series stays on top. */}
          {hasReference && (
            <>
              {/* Visus IQR range band — its own rect legend swatch (J3a). K3a:
                  the swatch is now Visus-specific so the two dual-axis IQR bands
                  are each explained in the legend. */}
              <Area
                yAxisId="visus"
                dataKey="visusBand"
                stroke="none"
                fill="#10b981"
                fillOpacity={0.15}
                name={t('cohortReferenceBandVisus')}
                /* J3a: render the IQR legend entry as a filled rectangle (shaded
                   range swatch), NOT the default line icon — the tester read the
                   line swatch as "an additional line" rather than a shaded band. */
                legendType="rect"
                connectNulls
                isAnimationActive={false}
              />
              {/* CRT IQR range band — K3a: previously legendType="none" left the
                  CRT band unexplained. Now it carries its own rect legend swatch. */}
              <Area
                yAxisId="crt"
                dataKey="crtBand"
                stroke="none"
                fill="#8b5cf6"
                fillOpacity={0.15}
                name={t('cohortReferenceBandCrt')}
                legendType="rect"
                connectNulls
                isAnimationActive={false}
              />
              {/* Visus median line — distinct legend name (I3a). */}
              <Line
                yAxisId="visus"
                type="monotone"
                dataKey="visusMedian"
                stroke="#6ee7b7"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                name={t('cohortReferenceMedianVisus')}
                dot={false}
                connectNulls
              />
              {/* CRT median line — distinct legend name; both cohort medians now
                  appear in the legend (I3a), only while the overlay is enabled. */}
              <Line
                yAxisId="crt"
                type="monotone"
                dataKey="crtMedian"
                stroke="#c4b5fd"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                name={t('cohortReferenceMedianCrt')}
                dot={false}
                connectNulls
              />
            </>
          )}
          {/* Measured Visus curve — values on .visus are always real measurements. */}
          <Line
            yAxisId="visus"
            type="monotone"
            dataKey="visus"
            stroke="#10b981"
            name={t('visusYAxisLabel')}
            strokeWidth={2}
            dot={(props: Record<string, unknown>) => {
              const { cx, cy } = props as { cx?: number; cy?: number };
              if (cx == null || cy == null) return <circle key={`v-${cx}-${cy}`} r={0} />;
              return <circle key={`v-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill="#10b981" stroke="#fff" strokeWidth={1} />;
            }}
            connectNulls
          />
          {/* Measured CRT curve — values on .crt are always real measurements. */}
          <Line
            yAxisId="crt"
            type="monotone"
            dataKey="crt"
            stroke="#8b5cf6"
            name={t('crtLegendLabel')}
            strokeWidth={2}
            dot={(props: Record<string, unknown>) => {
              const { cx, cy } = props as { cx?: number; cy?: number };
              if (cx == null || cy == null) return <circle key={`c-${cx}-${cy}`} r={0} />;
              return <circle key={`c-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill="#8b5cf6" stroke="#fff" strokeWidth={1} />;
            }}
            connectNulls
          />
          {/* A4 v2: interpolated display-only markers. Stroke transparent so the
              measured monotone curve is untouched — only open-circle dots show
              where a metric was interpolated between measured neighbours. */}
          {hasInterpolatedPoints && (
            <>
              <Line
                yAxisId="visus"
                type="monotone"
                dataKey="visusInterp"
                stroke="#10b981"
                strokeOpacity={0}
                name={t('interpolatedSeriesLabel')}
                legendType="none"
                dot={interpDot('#10b981')}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="crt"
                type="monotone"
                dataKey="crtInterp"
                stroke="#8b5cf6"
                strokeOpacity={0}
                name={t('interpolatedSeriesLabel')}
                legendType="none"
                dot={interpDot('#8b5cf6')}
                activeDot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
