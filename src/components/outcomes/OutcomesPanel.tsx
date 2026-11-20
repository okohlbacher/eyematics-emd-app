/**
 * OutcomesPanel — cohort Verläufe trajectory chart.
 *
 * Z0-P23: Recharts (formerly Plotly) — the same library, card, tooltip box, legend and quantity colours as Aggregiert
 * and the case view (team rule in the feature header; C8, Q18, Q21).
 * - Median (Line) and IQR band (range Area) are Recharts series over one merged row per x.
 * - Per-patient lines and the scatter cloud are drawn by one plain SVG layer (PatientLayer) from the chart's axis
 *   scales — one element per patient/point, no Recharts series each — and memoised, so toggling the IQR band or the
 *   median does not re-render them (performance, Q21 b). No point cap (C8 b).
 * - Zoom: drag across the plot (ReferenceArea) or the Brush below it; "Zoom zurücksetzen" restores (Q21 a).
 * - Hover: the shared tooltip box — median rows on the axis tooltip; a patient line/point shows its own box.
 *   Click on a patient line/point → IDOR-gated drill-down (single-cohort only).
 *
 * jsdom has no layout (no ResizeObserver): the panel then renders a marker DOM from the same series descriptors
 * (data-testids per series) and wires hover/click to the same handlers, so unit tests never need an SVG layout.
 */
import { Info } from 'lucide-react';
import { memo, type MouseEvent as ReactMouseEvent, useCallback, useMemo, useRef, useState } from 'react';
import {
  Area,
  Brush,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  useXAxisInverseScale,
  useXAxisScale,
  useYAxisScale,
  XAxis,
  YAxis,
} from 'recharts';

import { useThemeSafe } from '../../context/ThemeContext';
import type { AxisMode, GridPoint, PanelResult, YMetric } from '../../utils/cohortTrajectory';
import { caseChartColors } from '../case-detail/chartTheme';
import ChartLegend from '../charts/ChartLegend';
import {
  AXIS_TICK_FONT_SIZE,
  CHART_CARD_CLASS,
  CHART_TITLE_CLASS,
  CRT_COLOR,
  themedCohortColor,
  VISUS_COLOR,
} from '../charts/chartStyle';
import ChartTooltipBox, { type ChartTooltipRow } from '../charts/ChartTooltipBox';
import HoverTooltip from '../primitives/Tooltip';
import { SERIES_STYLES } from './palette';
import {
  buildCrossCohortTraces,
  buildSingleCohortTraces,
  type LayerState,
  mergeSeriesRows,
  perPatientSeriesOf,
  resolveDrillDownId,
  rgba,
  type ScatterDatum,
  type TraceDescriptor,
  xExtent,
} from './trajectoryTraces';

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
  /** Kept for callers; the series colour is the quantity colour (Visus/CRT, Q18), cohort colours in compare mode. */
  color?: string;
  axisMode: AxisMode;
  yMetric: YMetric;
  layers: LayerState;
  t: (key: string) => string;
  locale: 'de' | 'en';
  titleKey: 'outcomesPanelOd' | 'outcomesPanelOs' | 'outcomesPanelCombined'
          | 'metricsCrtPanelOd' | 'metricsCrtPanelOs' | 'metricsCrtPanelCombined';
  metric?: 'visus' | 'crt';  // default 'visus' for backward compat
  cohortSeries?: CohortSeriesEntry[];
  /** FALL-010: optional callback fired when a point/line is clicked; receives the patient pseudonym. Not active in cross-cohort mode. */
  onPointClick?: (patientId: string) => void;
}

function yDomain(
  yMetric: YMetric,
  medianGrid: GridPoint[],
  metric: 'visus' | 'crt' = 'visus',
): [number, number] {
  if (yMetric === 'absolute') {
    // CRT: 0–800 µm clinical range. Visus logMAR: 0–1.0 covers 20/200→20/20.
    return metric === 'crt' ? [0, 800] : [0, 1];
  }
  if (yMetric === 'delta_percent') {
    const vals = medianGrid.flatMap((g) => [g.y, g.p25 ?? g.y, g.p75 ?? g.y]).filter(Number.isFinite);
    if (vals.length === 0) return [-100, 100];
    const maxAbs = Math.max(...vals.map(Math.abs)) * 1.15;
    return [-Math.max(maxAbs, 10), Math.max(maxAbs, 10)];
  }
  if (metric === 'visus') return [-1, 1];
  const vals = medianGrid.flatMap((g) => [g.y, g.p25 ?? g.y, g.p75 ?? g.y]).filter(Number.isFinite);
  if (vals.length === 0) return [-1, 1];
  const maxAbs = Math.max(...vals.map(Math.abs)) * 1.15;
  return [-Math.max(maxAbs, 5), Math.max(maxAbs, 5)];
}

/** Hovered patient (line or point) for the patient tooltip and the emphasis overlay. */
interface PatientHover {
  patientId: string;
  x?: number;
  y?: number;
  clientX: number;
  clientY: number;
  /** Index into the per-patient traces (line emphasis) or -1 for a scatter point. */
  lineIndex: number;
  /** Tooltip position in the panel (set by the hover handler). */
  left?: number;
  top?: number;
}

const canLayout = () => typeof ResizeObserver !== 'undefined';

export default function OutcomesPanel({
  panel,
  eye,
  axisMode,
  yMetric,
  layers,
  t,
  locale,
  titleKey,
  metric = 'visus',
  cohortSeries,
  onPointClick,
}: Props) {
  const { effectiveTheme } = useThemeSafe();
  const isDark = effectiveTheme === 'dark';
  const colors = caseChartColors(isDark);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isCrossMode = Array.isArray(cohortSeries) && cohortSeries.length > 0;
  const seriesColor = metric === 'crt' ? CRT_COLOR : VISUS_COLOR;

  const subtitle = `${panel.summary.patientCount} · ${panel.summary.measurementCount}`;
  const xLabel = axisMode === 'days' ? t('outcomesTooltipDay') : t('outcomesTooltipTreatmentIndex');

  // N9: y-axis title reflecting the active metric + mode.
  const yLabelKey = metric === 'crt'
    ? (yMetric === 'absolute' ? 'outcomesYAxisCrtAbsolute' : yMetric === 'delta' ? 'outcomesYAxisCrtDelta' : 'outcomesYAxisCrtDeltaPercent')
    : (yMetric === 'absolute' ? 'outcomesYAxisVisusAbsolute' : yMetric === 'delta' ? 'outcomesYAxisVisusDelta' : 'outcomesYAxisVisusDeltaPercent');
  const yLabel = t(yLabelKey);
  // Z0-P23 (C15): the single-cohort median is named like the case view's ("Kohorten-Median Visus/CRT").
  const medianName = t(metric === 'crt' ? 'cohortReferenceMedianCrt' : 'cohortReferenceMedianVisus');

  const numberFmt = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale]);
  const formatX = useCallback(
    (x: number) => (axisMode === 'days' ? `${xLabel} ${Math.round(x)}` : `${xLabel}${Math.round(x)}`),
    [axisMode, xLabel],
  );
  const formatY = useCallback((y: number) => numberFmt.format(y), [numberFmt]);

  const perPatientSeries = useMemo(
    () => (!layers.perPatient || isCrossMode ? [] : perPatientSeriesOf(panel)),
    [panel, layers.perPatient, isCrossMode],
  );
  const scatterPoints = useMemo<ScatterDatum[]>(
    () => (!layers.scatter || isCrossMode ? [] : (panel.scatterPoints as ScatterDatum[])),
    [layers.scatter, isCrossMode, panel.scatterPoints],
  );

  const totalPatients = isCrossMode
    ? cohortSeries!.reduce((n, s) => n + s.panel.summary.patientCount, 0)
    : panel.summary.patientCount;

  const traces = useMemo<TraceDescriptor[]>(() => {
    if (isCrossMode) {
      return buildCrossCohortTraces({
        layers,
        legendName: (s) => `${s.cohortName} (N=${s.patientCount} ${t('outcomesComparePatientsUnit')})`,
        series: cohortSeries!.map((s) => ({
          cohortId: s.cohortId,
          cohortName: s.cohortName,
          patientCount: s.patientCount,
          color: themedCohortColor(s.color, isDark),
          medianGrid: s.panel.medianGrid,
          scatterPoints: layers.scatter ? (s.panel.scatterPoints as ScatterDatum[]) : undefined,
          perPatientSeries: layers.perPatient ? perPatientSeriesOf(s.panel) : undefined,
        })),
      });
    }
    return buildSingleCohortTraces({
      panel,
      layers,
      scatterPoints,
      colors: { series: seriesColor, perPatient: SERIES_STYLES.perPatient.color },
      medianName,
      perPatientSeries,
    });
  }, [isCrossMode, cohortSeries, panel, layers, scatterPoints, seriesColor, medianName, perPatientSeries, t, isDark]);

  // Heavy layers keep their identity across IQR/median toggles (memoised on their own inputs).
  const lineTraces = useMemo(
    () => traces.filter((tr): tr is Extract<TraceDescriptor, { kind: 'perpatient' }> => tr.kind === 'perpatient'),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the per-patient inputs, not on IQR/median toggles
    [isCrossMode, cohortSeries, perPatientSeries, layers.perPatient, isDark],
  );
  const scatterTraces = useMemo(
    () => traces.filter((tr): tr is Extract<TraceDescriptor, { kind: 'scatter' }> => tr.kind === 'scatter'),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the scatter inputs, not on IQR/median toggles
    [isCrossMode, cohortSeries, scatterPoints, layers.scatter, isDark],
  );
  const medianTraces = traces.filter((tr): tr is Extract<TraceDescriptor, { kind: 'median' }> => tr.kind === 'median');
  const iqrTraces = traces.filter((tr): tr is Extract<TraceDescriptor, { kind: 'iqr' }> => tr.kind === 'iqr');
  const rows = useMemo(() => mergeSeriesRows(traces), [traces]);
  const fullXDomain = useMemo(() => xExtent(traces), [traces]);
  const [yMin, yMax] = yDomain(yMetric, panel.medianGrid, metric);

  // IDOR gate: only navigate for a pseudonym known to THIS panel.
  const knownPatientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of panel.patients) ids.add(p.pseudonym);
    for (const sp of panel.scatterPoints) ids.add(sp.patientId);
    return ids;
  }, [panel.patients, panel.scatterPoints]);
  const drillDownActive = !!onPointClick && !isCrossMode;
  const handlePatientClick = useCallback(
    (pid: string) => {
      if (!onPointClick || isCrossMode) return;
      const known = resolveDrillDownId(pid, knownPatientIds);
      if (known) onPointClick(known);
    },
    [onPointClick, isCrossMode, knownPatientIds],
  );

  // Patient hover (tooltip + emphasis). Hover over the median axis tooltip is Recharts' own state.
  const [hover, setHover] = useState<PatientHover | null>(null);
  const handlePatientHover = useCallback((h: PatientHover | null) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!h || !rect) {
      setHover(h);
      return;
    }
    setHover({
      ...h,
      left: Math.max(0, Math.min(h.clientX - rect.left + 12, rect.width - 160)),
      top: Math.max(0, h.clientY - rect.top + 12),
    });
  }, []);
  // Line emphasis only when the scatter layer is off (scatter keeps hover priority), single-cohort only.
  const lineHoverActive = !isCrossMode && layers.perPatient && !layers.scatter;

  // Zoom (Q21 a): drag across the plot or use the Brush.
  const [zoom, setZoom] = useState<[number, number] | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragTo, setDragTo] = useState<number | null>(null);
  // The Brush is uncontrolled; a zoom set outside it (drag, reset, new axis/series) remounts it so its handles
  // follow (key = brushEpoch).
  const [brushEpoch, setBrushEpoch] = useState(0);
  const setZoomOutsideBrush = (z: [number, number] | null) => {
    setZoom(z);
    setBrushEpoch((n) => n + 1);
  };
  // A zoom belongs to one x-axis and one series set: changing the axis, the y-mode or the compared cohorts resets it.
  const zoomScope = `${axisMode}|${yMetric}|${fullXDomain[0]}|${fullXDomain[1]}|${isCrossMode ? cohortSeries!.map((c) => c.cohortId).join(',') : ''}`;
  const [zoomScopeSeen, setZoomScopeSeen] = useState(zoomScope);
  if (zoomScopeSeen !== zoomScope) {
    setZoomScopeSeen(zoomScope);
    setZoom(null);
    setBrushEpoch((n) => n + 1);
  }
  const xDomain = zoom ?? fullXDomain;
  // The Brush index range lives in Recharts' chart state (dataStartIndex/dataEndIndex) and survives a remount, so it
  // is passed explicitly: all rows without a zoom, else the rows of the zoom plus the neighbour just outside each edge
  // (the median/IQR stay drawn up to the plot border; a Brush zoom's edges are rows, so its range is exact).
  let brushStart = 0;
  let brushEnd = rows.length - 1;
  if (zoom) {
    for (let i = 0; i < rows.length; i++) {
      const x = rows[i].x as number;
      if (x <= zoom[0]) brushStart = i;
      if (x >= zoom[1]) { brushEnd = i; break; }
    }
  }
  const finishDrag = () => {
    if (dragFrom != null && dragTo != null && dragFrom !== dragTo) {
      setZoomOutsideBrush([Math.min(dragFrom, dragTo), Math.max(dragFrom, dragTo)]);
    }
    setDragFrom(null);
    setDragTo(null);
  };

  const legendEntries = medianTraces.map((tr) => ({ key: tr.seriesKey, label: tr.name, color: tr.color, glyph: 'line' as const }));

  if (totalPatients === 0) {
    return (
      <div data-testid={`outcomes-panel-${eye}`} className={CHART_CARD_CLASS}>
        <h3 className={CHART_TITLE_CLASS}>{t(titleKey)}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        <div className="h-80 flex items-center justify-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">{t('outcomesPanelEmpty')}</p>
        </div>
      </div>
    );
  }

  const medianTooltip = (props: { active?: boolean; label?: unknown; payload?: ReadonlyArray<{ dataKey?: unknown; value?: unknown }> }) => {
    if (!props.active || hover || !Array.isArray(props.payload) || props.payload.length === 0) return null;
    const out: ChartTooltipRow[] = [];
    for (const e of props.payload) {
      const key = String(e.dataKey ?? '');
      if (key.startsWith('m_') && typeof e.value === 'number') {
        const tr = medianTraces.find((m) => `m_${m.seriesKey}` === key);
        if (!tr) continue;
        const label = isCrossMode ? (cohortSeries!.find((c) => c.cohortId === tr.cohortId)?.cohortName ?? tr.name) : tr.name;
        out.push({ key, label, value: formatY(e.value), color: tr.color });
      } else if (key.startsWith('iqr_') && Array.isArray(e.value) && !isCrossMode) {
        const [lo, hi] = e.value as [number, number];
        out.push({ key, label: 'IQR', value: `${formatY(lo)} – ${formatY(hi)}` });
      }
    }
    if (out.length === 0 || typeof props.label !== 'number') return null;
    return <ChartTooltipBox heading={formatX(props.label)} rows={out} />;
  };

  // One tooltip element per panel (always present; shown while a patient line/point is hovered).
  const patientRows: ChartTooltipRow[] = hover
    ? [
        { key: 'p', label: t('outcomesTooltipPatient'), value: hover.patientId },
        ...(typeof hover.y === 'number' ? [{ key: 'y', label: yLabel, value: formatY(hover.y) }] : []),
      ]
    : [];
  const patientTooltip = (
    <div
      data-testid={`outcomes-hover-tooltip-${eye}`}
      role="tooltip"
      aria-hidden="true"
      className="pointer-events-none absolute z-10"
      style={{ display: hover ? 'block' : 'none', left: hover?.left ?? 0, top: hover?.top ?? 0 }}
    >
      {hover && (
        <ChartTooltipBox heading={typeof hover.x === 'number' ? formatX(hover.x) : hover.patientId} rows={patientRows} />
      )}
    </div>
  );

  return (
    <div
      ref={containerRef}
      data-testid={`outcomes-panel-${eye}`}
      className={`relative ${CHART_CARD_CLASS}`}
      role="img"
      aria-label={
        onPointClick
          ? `${t(titleKey)} — ${panel.summary.patientCount} ${t('outcomesCardPatients')} — ${t('outcomesDrillDownHint')}`
          : `${t(titleKey)} — ${panel.summary.patientCount} ${t('outcomesCardPatients')}`
      }
    >
      {patientTooltip}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className={CHART_TITLE_CLASS}>{t(titleKey)}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        </div>
        {zoom && (
          <button
            type="button"
            onClick={() => setZoomOutsideBrush(null)}
            className="text-xs text-blue-700 dark:text-blue-300 underline"
          >
            {t('outcomesZoomReset')}
          </button>
        )}
      </div>

      {/* IQR marker for presence/absence tests. */}
      {layers.spreadBand && <div data-testid={`outcomes-panel-${eye}-iqr`} aria-hidden="true" hidden />}
      {/* y-domain regression marker. */}
      <div hidden data-testid="outcomes-panel-ydomain" data-metric={metric} data-ymetric={yMetric} data-min={yMin} data-max={yMax} />
      {/* N9: y-axis title marker. */}
      <div hidden data-testid={`outcomes-panel-${eye}-ylabel`} data-ylabel={yLabel} />

      {canLayout() ? (
        <div className="relative" style={{ width: '100%', height: 340 }}>
          {/* Z0-P03: info icon at the upper end of the (rotated) y-axis title, explaining baseline, Δ and Δ %. */}
          <span className="absolute left-0 top-1 z-10">
            <HoverTooltip text={t('outcomesYAxisInfo')} align="start" wrap>
              {(tooltipId) => (
                <button
                  type="button"
                  data-testid={`outcomes-panel-${eye}-ylabel-info`}
                  aria-label={t('outcomesYAxisInfoLabel')}
                  aria-describedby={tooltipId}
                  className="inline-flex items-center rounded text-gray-500 dark:text-gray-400 cursor-help focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                >
                  <Info className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </HoverTooltip>
          </span>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={rows}
              margin={{ top: 8, right: 16, bottom: 16, left: 8 }}
              onMouseDown={(s) => { if (typeof s?.activeLabel === 'number') setDragFrom(s.activeLabel); }}
              onMouseMove={(s) => { if (dragFrom != null && typeof s?.activeLabel === 'number') setDragTo(s.activeLabel); }}
              onMouseUp={finishDrag}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={colors.grid} />
              <XAxis
                type="number"
                dataKey="x"
                domain={xDomain}
                allowDataOverflow
                tick={{ fontSize: AXIS_TICK_FONT_SIZE, fill: colors.axisTick }}
                stroke={colors.grid}
                label={{ value: xLabel, position: 'insideBottom', offset: -8, fontSize: AXIS_TICK_FONT_SIZE, fill: colors.axisLabel }}
              />
              <YAxis
                type="number"
                domain={[yMin, yMax]}
                allowDataOverflow
                tick={{ fontSize: AXIS_TICK_FONT_SIZE, fill: colors.axisTick }}
                tickFormatter={(v: number) => formatY(v)}
                stroke={colors.grid}
                label={{ value: yLabel, angle: -90, position: 'insideLeft', fontSize: AXIS_TICK_FONT_SIZE, fill: colors.axisLabel, style: { textAnchor: 'middle' } }}
              />
              {yMetric !== 'absolute' && <ReferenceLine y={0} stroke="#94a3b8" />}
              {iqrTraces.map((tr) => (
                <Area
                  key={`iqr-${tr.seriesKey}`}
                  dataKey={`iqr_${tr.seriesKey}`}
                  className="series-iqr"
                  stroke="none"
                  fill={tr.color}
                  fillOpacity={tr.fillOpacity}
                  connectNulls
                  activeDot={false}
                  isAnimationActive={false}
                  legendType="none"
                />
              ))}
              <PatientLayer
                lines={lineTraces}
                scatter={scatterTraces}
                hover={hover}
                lineHoverActive={lineHoverActive}
                drillDownActive={drillDownActive}
                onHover={handlePatientHover}
                onClick={handlePatientClick}
                ringColor={isDark ? '#f9fafb' : '#111827'}
              />
              {medianTraces.map((tr) => (
                <Line
                  key={`m-${tr.seriesKey}`}
                  dataKey={`m_${tr.seriesKey}`}
                  className="series-median"
                  name={tr.name}
                  stroke={tr.color}
                  strokeWidth={tr.width}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
              <Tooltip content={medianTooltip} isAnimationActive={false} cursor={{ stroke: colors.grid }} />
              {dragFrom != null && dragTo != null && (
                <ReferenceArea x1={dragFrom} x2={dragTo} strokeOpacity={0.3} fill={colors.axisTick} fillOpacity={0.15} />
              )}
              {rows.length > 2 && (
                <Brush
                  key={`brush-${brushEpoch}`}
                  dataKey="x"
                  startIndex={brushStart}
                  endIndex={brushEnd}
                  height={18}
                  stroke={colors.axisTick}
                  fill="transparent"
                  tickFormatter={() => ''}
                  onChange={(r: { startIndex?: number; endIndex?: number }) => {
                    if (r.startIndex == null || r.endIndex == null) return;
                    if (r.startIndex === 0 && r.endIndex === rows.length - 1) setZoom(null);
                    else setZoom([rows[r.startIndex].x as number, rows[r.endIndex].x as number]);
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <SeriesMarkers
          eye={eye}
          isCrossMode={isCrossMode}
          traces={traces}
          lineHoverActive={lineHoverActive}
          drillDownActive={drillDownActive}
          onHover={handlePatientHover}
          onClick={handlePatientClick}
        />
      )}
      <ChartLegend entries={legendEntries} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-patient lines and scatter cloud as one plain SVG layer.
// ---------------------------------------------------------------------------

type LineTrace = Extract<TraceDescriptor, { kind: 'perpatient' }>;
type ScatterTrace = Extract<TraceDescriptor, { kind: 'scatter' }>;

function pathOf(tr: LineTrace, sx: (v: number) => number, sy: (v: number) => number): string {
  let d = '';
  let pen = false;
  for (let i = 0; i < tr.x.length; i++) {
    const y = tr.y[i];
    if (y == null || !Number.isFinite(y)) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${sx(tr.x[i]).toFixed(1)},${sy(y).toFixed(1)}`;
    pen = true;
  }
  return d;
}

interface PatientLayerProps {
  lines: LineTrace[];
  scatter: ScatterTrace[];
  hover: PatientHover | null;
  lineHoverActive: boolean;
  drillDownActive: boolean;
  onHover: (h: PatientHover | null) => void;
  onClick: (pid: string) => void;
  ringColor: string;
}

function PatientLayer({ lines, scatter, hover, lineHoverActive, drillDownActive, onHover, onClick, ringColor }: PatientLayerProps) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  const xInverse = useXAxisInverseScale();
  if (!xScale || !yScale) return null;
  const sx = (v: number) => xScale(v) as number;
  const sy = (v: number) => yScale(v) as number;
  const emphasised = hover && hover.lineIndex >= 0 ? lines[hover.lineIndex] : null;
  return (
    <g data-perpatient-layer>
      <PatientPaths
        lines={lines}
        scatter={scatter}
        sx={sx}
        sy={sy}
        xInverse={xInverse}
        lineHoverActive={lineHoverActive}
        drillDownActive={drillDownActive}
        onHover={onHover}
        onClick={onClick}
      />
      {emphasised && (
        <path
          d={pathOf(emphasised, sx, sy)}
          fill="none"
          stroke={emphasised.color}
          strokeWidth={emphasised.width * 2.5}
          strokeOpacity={0.95}
          pointerEvents="none"
        />
      )}
      {hover && hover.lineIndex < 0 && typeof hover.x === 'number' && typeof hover.y === 'number' && (
        <circle cx={sx(hover.x)} cy={sy(hover.y)} r={8} fill="none" stroke={ringColor} strokeWidth={3} pointerEvents="none" />
      )}
    </g>
  );
}

interface PatientPathsProps {
  lines: LineTrace[];
  scatter: ScatterTrace[];
  sx: (v: number) => number;
  sy: (v: number) => number;
  xInverse: ((px: number) => unknown) | undefined;
  lineHoverActive: boolean;
  drillDownActive: boolean;
  onHover: (h: PatientHover | null) => void;
  onClick: (pid: string) => void;
}

/** The heavy part — re-rendered only when its series or the scales change, not on hover or IQR/median toggles. */
const PatientPaths = memo(
  function PatientPaths({ lines, scatter, sx, sy, xInverse, lineHoverActive, drillDownActive, onHover, onClick }: PatientPathsProps) {
    const nearest = (tr: LineTrace, ev: ReactMouseEvent<SVGPathElement>) => {
      const svg = ev.currentTarget.ownerSVGElement;
      if (!svg || !xInverse) return {};
      const xv = Number(xInverse(ev.clientX - svg.getBoundingClientRect().left));
      let best = -1;
      for (let i = 0; i < tr.x.length; i++) {
        if (tr.y[i] == null) continue;
        if (best < 0 || Math.abs(tr.x[i] - xv) < Math.abs(tr.x[best] - xv)) best = i;
      }
      return best < 0 ? {} : { x: tr.x[best], y: tr.y[best] ?? undefined };
    };
    return (
      <>
        {lines.map((tr, i) => (
          <path
            key={`${tr.cohortId ?? ''}-${tr.patientId}`}
            d={pathOf(tr, sx, sy)}
            fill="none"
            stroke={tr.color}
            strokeWidth={tr.width}
            strokeOpacity={tr.opacity}
            style={drillDownActive ? { cursor: 'pointer' } : undefined}
            onMouseMove={(ev) =>
              onHover({ patientId: tr.patientId, ...nearest(tr, ev), clientX: ev.clientX, clientY: ev.clientY, lineIndex: lineHoverActive ? i : -2 })}
            onMouseLeave={() => onHover(null)}
            onClick={drillDownActive ? () => onClick(tr.patientId) : undefined}
          />
        ))}
        {scatter.map((tr) =>
          tr.points.map((p, j) => (
            <circle
              key={`${tr.cohortId ?? ''}-${j}`}
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={3.5}
              fill={rgba(tr.color, tr.opacity)}
              style={drillDownActive ? { cursor: 'pointer' } : undefined}
              onMouseEnter={(ev) => onHover({ patientId: p.patientId, x: p.x, y: p.y, clientX: ev.clientX, clientY: ev.clientY, lineIndex: -1 })}
              onMouseLeave={() => onHover(null)}
              onClick={drillDownActive ? () => onClick(p.patientId) : undefined}
            />
          )),
        )}
      </>
    );
  },
  // Scale functions are recreated by the hooks on every chart render; compare their mapping instead.
  (a, b) =>
    a.lines === b.lines &&
    a.scatter === b.scatter &&
    a.lineHoverActive === b.lineHoverActive &&
    a.drillDownActive === b.drillDownActive &&
    a.onHover === b.onHover &&
    a.onClick === b.onClick &&
    sameScale(a.sx, b.sx) &&
    sameScale(a.sy, b.sy),
);

/** Two scales map identically if they agree on three probe values (linear scales). */
function sameScale(a: (v: number) => number, b: (v: number) => number): boolean {
  if (a === b) return true;
  return [0, 1, 1000].every((v) => a(v) === b(v));
}

// ---------------------------------------------------------------------------
// jsdom marker DOM — the same descriptors as data-testids, hover/click wired to the same handlers.
// ---------------------------------------------------------------------------

function SeriesMarkers({
  eye,
  isCrossMode,
  traces,
  lineHoverActive,
  drillDownActive,
  onHover,
  onClick,
}: {
  eye: string;
  isCrossMode: boolean;
  traces: TraceDescriptor[];
  lineHoverActive: boolean;
  drillDownActive: boolean;
  onHover: (h: PatientHover | null) => void;
  onClick: (pid: string) => void;
}) {
  const lines = traces.filter((tr): tr is LineTrace => tr.kind === 'perpatient');
  const scatter = traces.filter((tr): tr is ScatterTrace => tr.kind === 'scatter');
  return (
    <div data-testid={`outcomes-fallback-${eye}`}>
      {traces.map((tr, i) =>
        tr.kind === 'median' ? (
          <div key={`m-${i}`} data-testid="outcomes-trace-median" data-name={tr.name} data-stroke-width={String(tr.width)} data-color={tr.color} />
        ) : tr.kind === 'iqr' ? (
          <div key={`i-${i}`} data-testid="outcomes-trace-iqr" data-fillcolor={rgba(tr.color, tr.fillOpacity)} />
        ) : null,
      )}
      {lines.map((tr, i) =>
        isCrossMode ? (
          <div key={`cp-${tr.cohortId}-${tr.patientId}`} data-testid={`outcomes-cross-perpatient-${tr.cohortId}-${tr.patientId}`} data-color={tr.color} />
        ) : (
          <div
            key={`pp-${tr.patientId}`}
            data-testid={`outcomes-perpatient-${tr.patientId}`}
            data-has-onclick={drillDownActive ? 'true' : 'false'}
            data-has-hover={lineHoverActive ? 'true' : 'false'}
            data-color={tr.color}
            data-stroke-width={String(tr.width)}
            onMouseEnter={lineHoverActive ? (e) => onHover({ patientId: tr.patientId, clientX: e.clientX, clientY: e.clientY, lineIndex: i }) : undefined}
            onMouseLeave={lineHoverActive ? () => onHover(null) : undefined}
            onClick={drillDownActive ? () => onClick(tr.patientId) : undefined}
          />
        ),
      )}
      {scatter.map((tr) =>
        isCrossMode ? (
          <div key={`cs-${tr.cohortId}`} data-testid={`outcomes-cross-scatter-${tr.cohortId}`} data-count={String(tr.points.length)} data-color={rgba(tr.color, tr.opacity)} />
        ) : (
          <div key="s" data-testid={`outcomes-scatter-${eye}`} data-count={String(tr.points.length)} data-has-onclick={drillDownActive ? 'true' : 'false'}>
            {tr.points.map((p, j) => (
              <div
                key={`${p.patientId}-${j}`}
                data-testid={`outcomes-scatter-point-${p.patientId}`}
                onMouseEnter={(e) => onHover({ patientId: p.patientId, x: p.x, y: p.y, clientX: e.clientX, clientY: e.clientY, lineIndex: -1 })}
                onMouseLeave={() => onHover(null)}
                onClick={() => onClick(p.patientId)}
              />
            ))}
          </div>
        ),
      )}
    </div>
  );
}
