/**
 * OutcomesPanel — cohort Verläufe trajectory chart (WS-1 / v1.17).
 *
 * Rewritten from Recharts ComposedChart + canvas-scatter to Plotly.js (scattergl).
 * The v1.16 canvas scatter was broken (canvas never sized, SVG node wall intact,
 * ~46k DOM nodes, ~10s toggle). Plotly draws the scatter cloud to WebGL — one canvas,
 * no per-point DOM — and adds zoom/pan/box-select.
 *
 * jsdom: Plotly cannot render without a WebGL/2D context. The PlotlyChart wrapper
 * feature-detects and renders a lightweight testable fallback (built here) so the
 * test suite never touches Plotly. The fallback preserves the data-testids tests
 * rely on (panel container, hover tooltip, IQR marker, y-domain marker) and adds
 * semantic per-trace markers the rewritten outcomes tests assert against.
 *
 * K1 contract preserved: median line, IQR band (shaded range), per-patient lines,
 * scattergl points; single layer-aware tooltip (scatter-priority); click → IDOR-gated
 * drill-down; 3 panels; x/y axis modes + yDomain; dark mode via useThemeSafe.
 */
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useThemeSafe } from '../../context/ThemeContext';
import type { AxisMode, GridPoint, PanelResult, YMetric } from '../../utils/cohortTrajectory';
import { DARK_EYE_COLORS, EYE_COLORS, SERIES_STYLES } from './palette';
import PlotlyChart from './PlotlyChart';
import {
  buildCrossCohortTraces,
  buildSingleCohortTraces,
  downsampleScatter,
  type LayerState,
  resolveDrillDownId,
  SCATTER_RENDER_CAP,
  type ScatterDatum,
} from './plotlyTraces';
import type { PlotlyData, PlotlyLayout, PlotlyMouseEvent } from './plotlyTypes';

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
  // yMetric === 'delta'
  if (metric === 'visus') {
    return [-1, 1];
  }
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
  onPointClick,
}: Props) {
  const { effectiveTheme } = useThemeSafe();
  const isDark = effectiveTheme === 'dark';

  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  // Hovered patient drives the imperative tooltip + the click drill-down target.
  // A ref (not state) so hover never re-renders the chart subtree.
  const hoveredDatumRef = useRef<{ patientId: string } | null>(null);

  const isCrossMode = Array.isArray(cohortSeries) && cohortSeries.length > 0;

  // Theme-resolved colours.
  const chartColors = {
    grid:      isDark ? '#374151' : '#e5e7eb',
    axisTick:  isDark ? '#9ca3af' : '#6b7280',
    axisLabel: isDark ? '#d1d5db' : '#374151',
    legend:    isDark ? '#d1d5db' : '#374151',
    paper:     'rgba(0,0,0,0)',
  };
  const eyeColors = isDark ? DARK_EYE_COLORS : EYE_COLORS;
  const resolvedColor = eye === 'od' ? eyeColors.OD : eye === 'os' ? eyeColors.OS : eyeColors['OD+OS'];
  // Use resolved theme color unless the caller passes an explicit cohort-compare color.
  const ALL_EYE_HEX = new Set([...Object.values(EYE_COLORS), ...Object.values(DARK_EYE_COLORS)]);
  const seriesColor = ALL_EYE_HEX.has(color) ? resolvedColor : color;

  const subtitle = `${panel.summary.patientCount} · ${panel.summary.measurementCount}`;
  const xLabel = axisMode === 'days' ? t('outcomesTooltipDay') : t('outcomesTooltipTreatmentIndex');

  // Imperative tooltip formatting context — kept current in a ref so handlers read
  // the latest labels without re-binding.
  const hoverFmtRef = useRef<{ xLabel: string; valueLabel: string; valueUnit: string }>(
    { xLabel: '', valueLabel: '', valueUnit: '' },
  );
  useEffect(() => {
    const valLabelKey = metric === 'crt'
      ? (yMetric === 'absolute' ? 'metricsCrtYAxisAbsolute' : yMetric === 'delta' ? 'metricsCrtYAxisDelta' : 'metricsCrtYAxisDeltaPercent')
      : undefined;
    hoverFmtRef.current = {
      xLabel: axisMode === 'days' ? t('outcomesTooltipDay') : t('outcomesTooltipTreatmentIndex'),
      valueLabel: t('outcomesTooltipLogmar'),
      valueUnit: valLabelKey
        ? t(valLabelKey)
        : yMetric === 'absolute' ? 'logMAR' : yMetric === 'delta' ? 'Δ logMAR' : '%',
    };
  }, [axisMode, yMetric, metric, t]);

  const formatHoverTooltip = useCallback(
    (p: { patientId?: string; x?: number; y?: number }): string => {
      const fmt = hoverFmtRef.current;
      const xPart =
        typeof p.x === 'number'
          ? `${fmt.xLabel}: ${axisMode === 'days' ? `${Math.round(p.x)} d` : `#${Math.round(p.x)}`}`
          : '';
      const yPart =
        typeof p.y === 'number'
          ? `${fmt.valueLabel}: ${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(p.y)}${fmt.valueUnit ? ` ${fmt.valueUnit}` : ''}`
          : '';
      return [p.patientId ?? '', xPart, yPart].filter(Boolean).join('\n');
    },
    [axisMode, locale],
  );

  const showHoverTooltip = useCallback(
    (clientX: number, clientY: number, p: { patientId?: string; x?: number; y?: number }) => {
      const el = tooltipRef.current;
      const container = containerRef.current;
      if (!el || !container) return;
      const rect = container.getBoundingClientRect();
      el.textContent = formatHoverTooltip(p);
      const left = Math.max(0, Math.min(clientX - rect.left + 12, rect.width - 8));
      const top = Math.max(0, clientY - rect.top + 12);
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.display = 'block';
    },
    [formatHoverTooltip],
  );
  const hideHoverTooltip = useCallback(() => {
    const el = tooltipRef.current;
    if (el) el.style.display = 'none';
  }, []);

  // F7: clear the stashed drill-down target when the panel's patient set changes
  // (cohort switch). Defense-in-depth — the IDOR gate below still rejects unknown ids.
  const patientsRef = useRef(panel.patients);
  useEffect(() => {
    if (patientsRef.current !== panel.patients) {
      patientsRef.current = panel.patients;
      hoveredDatumRef.current = null;
    }
  }, [panel.patients]);

  // Per-patient line series (skipped entirely when the layer is hidden or in cross
  // mode). Memoised on panel.patients so a non-cohort rerender reuses the arrays.
  const perPatientSeries = useMemo(
    () =>
      (!layers.perPatient || isCrossMode)
        ? []
        : panel.patients
            .filter((p) => !p.excluded && p.measurements.length >= 2)
            .map((p) => ({
              id: p.pseudonym,
              sparse: p.sparse,
              x: p.measurements.map((m) => m.x),
              y: p.measurements.map((m) => (typeof m.y === 'number' ? m.y : null)),
            })),
    [panel.patients, layers.perPatient, isCrossMode],
  );

  // Scatter cloud — downsampled to the cap (even-stride) when the layer is on. Logged,
  // never silently truncated. Drill-down/hover work on every rendered point.
  const scatterRenderPoints = useMemo<ScatterDatum[]>(() => {
    if (!layers.scatter || isCrossMode) return [];
    const all = panel.scatterPoints as ScatterDatum[];
    const shown = downsampleScatter(all, SCATTER_RENDER_CAP);
    if (shown.length < all.length) {
      console.info(
        `[OutcomesPanel] scatter downsampled for eye=${eye}: rendering ${shown.length} of ${all.length} points (cap=${SCATTER_RENDER_CAP}, even-stride). Drill-down/hover available on rendered points.`,
      );
    }
    return shown;
  }, [layers.scatter, isCrossMode, panel.scatterPoints, eye]);

  const totalPatients = isCrossMode
    ? cohortSeries!.reduce((n, s) => n + s.panel.summary.patientCount, 0)
    : panel.summary.patientCount;

  // Build Plotly traces (memoised so identity is stable across hover/unrelated renders).
  const traces = useMemo<PlotlyData[]>(() => {
    if (isCrossMode) {
      return buildCrossCohortTraces({
        series: cohortSeries!.map((s) => ({
          cohortId: s.cohortId,
          cohortName: s.cohortName,
          patientCount: s.patientCount,
          color: s.color,
          medianGrid: s.panel.medianGrid,
        })),
      });
    }
    return buildSingleCohortTraces({
      panel,
      layers,
      scatterPoints: scatterRenderPoints,
      colors: { series: seriesColor, perPatient: SERIES_STYLES.perPatient.color },
      medianName: t('outcomesLayerMedian'),
      hovertemplate: (name) => `${name}<extra></extra>`,
      perPatientSeries,
    });
  }, [isCrossMode, cohortSeries, panel, layers, scatterRenderPoints, seriesColor, t, perPatientSeries]);

  const [yMin, yMax] = yDomain(yMetric, panel.medianGrid, metric);

  const layout = useMemo<PlotlyLayout>(
    () => ({
      autosize: true,
      height: 320,
      margin: { l: 48, r: 16, t: 8, b: 40 },
      paper_bgcolor: chartColors.paper,
      plot_bgcolor: chartColors.paper,
      font: { color: chartColors.axisLabel, size: 11 },
      hovermode: 'closest',
      // L12: default to zoom; pan/box-select/lasso/reset live on the modebar.
      dragmode: 'zoom',
      showlegend: true,
      legend: { orientation: 'h', y: -0.2, font: { color: chartColors.legend, size: 12 } },
      xaxis: {
        title: { text: xLabel, font: { size: 11, color: chartColors.axisLabel } },
        gridcolor: chartColors.grid,
        zerolinecolor: chartColors.grid,
        tickfont: { size: 11, color: chartColors.axisTick },
      },
      yaxis: {
        range: [yMin, yMax],
        gridcolor: chartColors.grid,
        zeroline: yMetric !== 'absolute',
        zerolinecolor: '#94a3b8',
        tickfont: { size: 11, color: chartColors.axisTick },
      },
    }),
    [chartColors.paper, chartColors.axisLabel, chartColors.grid, chartColors.legend, chartColors.axisTick, xLabel, yMin, yMax, yMetric],
  );

  // L12: modebar — zoom, pan, box-select, lasso, reset/autoscale enabled.
  const config = useMemo<Record<string, unknown>>(
    () => ({
      displaylogo: false,
      responsive: true,
      modeBarButtonsToRemove: ['toImage'],
      modeBarButtons: [['zoom2d', 'pan2d', 'select2d', 'lasso2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d', 'resetScale2d']],
    }),
    [],
  );

  // IDOR gate: only navigate for a pseudonym known to THIS panel.
  const knownPatientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of panel.patients) ids.add(p.pseudonym);
    for (const sp of panel.scatterPoints) ids.add(sp.patientId);
    return ids;
  }, [panel.patients, panel.scatterPoints]);

  const handlePlotlyClick = useCallback(
    (raw: unknown) => {
      if (!onPointClick) return;
      const pid = resolveDrillDownId(raw, knownPatientIds);
      if (pid) onPointClick(pid);
    },
    [onPointClick, knownPatientIds],
  );

  const handlePlotlyHover = useCallback(
    (raw: unknown) => {
      const e = raw as PlotlyMouseEvent;
      const pt = e.points?.[0];
      const pid = pt?.customdata;
      if (typeof pid !== 'string') return;
      hoveredDatumRef.current = { patientId: pid };
      const ev = pt?.event ?? e.event;
      const cx = ev?.clientX ?? 0;
      const cy = ev?.clientY ?? 0;
      showHoverTooltip(cx, cy, {
        patientId: pid,
        x: typeof pt?.x === 'number' ? pt.x : undefined,
        y: typeof pt?.y === 'number' ? pt.y : undefined,
      });
    },
    [showHoverTooltip],
  );

  const handlePlotlyUnhover = useCallback(() => {
    hoveredDatumRef.current = null;
    hideHoverTooltip();
  }, [hideHoverTooltip]);

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

  // jsdom fallback DOM: emits the testids the rewritten tests assert against, and
  // wires hover/click to the SAME tooltip + drill-down handlers as the live path.
  const fallback = (
    <ChartFallback
      eye={eye}
      traces={traces}
      hasScatter={!isCrossMode && layers.scatter}
      scatterPoints={scatterRenderPoints}
      onScatterHover={(pt, ev) => handlePlotlyHover({ points: [{ customdata: pt.patientId, x: pt.x, y: pt.y, event: ev }] })}
      onScatterLeave={handlePlotlyUnhover}
      onScatterClick={(pt) => handlePlotlyClick({ points: [{ customdata: pt.patientId }] })}
      onLineHover={(pid, ev) => handlePlotlyHover({ points: [{ customdata: pid, event: ev }] })}
      onLineLeave={handlePlotlyUnhover}
      onLineClick={(pid) => handlePlotlyClick({ points: [{ customdata: pid }] })}
      lineHoverActive={!isCrossMode && layers.perPatient && !layers.scatter}
      lineClickActive={!!onPointClick && !isCrossMode && layers.perPatient}
      scatterClickActive={!!onPointClick && !isCrossMode && layers.scatter}
    />
  );

  return (
    <div
      ref={containerRef}
      data-testid={`outcomes-panel-${eye}`}
      className="relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5"
      role="img"
      aria-label={
        onPointClick
          ? `${t(titleKey)} — ${panel.summary.patientCount} ${t('outcomesCardPatients')} — ${t('outcomesDrillDownHint')}`
          : `${t(titleKey)} — ${panel.summary.patientCount} ${t('outcomesCardPatients')}`
      }
    >
      {/* Single imperative hover tooltip — populated by hover handlers (DOM writes,
          no React state → no chart re-render). Scatter-priority by event ordering. */}
      <div
        ref={tooltipRef}
        data-testid={`outcomes-hover-tooltip-${eye}`}
        role="tooltip"
        aria-hidden="true"
        className="pointer-events-none absolute z-10 hidden whitespace-pre rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-xs font-medium text-gray-900 dark:text-gray-100 shadow-lg"
        style={{ display: 'none' }}
      />
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t(titleKey)}</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>

      {/* IQR marker for presence/absence tests. */}
      {layers.spreadBand && (
        <div data-testid={`outcomes-panel-${eye}-iqr`} aria-hidden="true" hidden />
      )}

      {/* y-domain regression marker. */}
      <div
        hidden
        data-testid="outcomes-panel-ydomain"
        data-metric={metric}
        data-ymetric={yMetric}
        data-min={yMin}
        data-max={yMax}
      />

      <div className="relative" style={{ width: '100%', height: 320 }}>
        <PlotlyChart
          testId={`outcomes-plotly-${eye}`}
          data={traces}
          layout={layout}
          config={config}
          onPointClick={onPointClick ? handlePlotlyClick : undefined}
          onHover={handlePlotlyHover}
          onUnhover={handlePlotlyUnhover}
          style={{ width: '100%', height: '100%' }}
          fallback={fallback}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// jsdom fallback render. Emits semantic, layer-aware testids the rewritten
// outcomes tests assert against, and wires hover/click to the panel's handlers.
// ---------------------------------------------------------------------------

interface ChartFallbackProps {
  eye: string;
  traces: PlotlyData[];
  hasScatter: boolean;
  scatterPoints: ScatterDatum[];
  onScatterHover: (pt: ScatterDatum, ev: MouseEvent) => void;
  onScatterLeave: () => void;
  onScatterClick: (pt: ScatterDatum) => void;
  onLineHover: (pid: string, ev: MouseEvent) => void;
  onLineLeave: () => void;
  onLineClick: (pid: string) => void;
  lineHoverActive: boolean;
  lineClickActive: boolean;
  scatterClickActive: boolean;
}

function ChartFallback({
  eye,
  traces,
  hasScatter,
  scatterPoints,
  onScatterHover,
  onScatterLeave,
  onScatterClick,
  onLineHover,
  onLineLeave,
  onLineClick,
  lineHoverActive,
  lineClickActive,
  scatterClickActive,
}: ChartFallbackProps) {
  // Derive per-trace markers from the trace list (same descriptors fed to Plotly).
  const medianTraces = traces.filter(
    (tr) =>
      tr.name != null &&
      !String(tr.name).startsWith('iqr') &&
      !String(tr.name).startsWith('perpatient') &&
      tr.name !== 'scatter',
  );
  const iqrTraces = traces.filter((tr) => String(tr.name).startsWith('iqr') && tr.fill === 'tonexty');
  const perPatientTraces = traces.filter((tr) => String(tr.name).startsWith('perpatient-'));

  return (
    <div data-testid={`outcomes-fallback-${eye}`}>
      {/* Median line(s) — single-cohort median or one per cohort series. */}
      {medianTraces.map((tr, i) => (
        <div
          key={`median-${i}`}
          data-testid="outcomes-trace-median"
          data-name={tr.name}
          data-stroke-width={String((tr.line as { width?: number } | undefined)?.width ?? '')}
          data-color={String((tr.line as { color?: string } | undefined)?.color ?? '')}
        />
      ))}

      {/* IQR band marker(s). */}
      {iqrTraces.map((tr, i) => (
        <div key={`iqr-${i}`} data-testid="outcomes-trace-iqr" data-fillcolor={String(tr.fillcolor ?? '')} />
      ))}

      {/* Per-patient lines — tagged by pseudonym, hover/click wired per the gates. */}
      {perPatientTraces.map((tr) => {
        const pid = String(tr.name).replace('perpatient-', '');
        return (
          <div
            key={`pp-${pid}`}
            data-testid={`outcomes-perpatient-${pid}`}
            data-has-onclick={lineClickActive ? 'true' : 'false'}
            data-has-hover={lineHoverActive ? 'true' : 'false'}
            data-color={String((tr.line as { color?: string } | undefined)?.color ?? '')}
            data-stroke-width={String((tr.line as { width?: number } | undefined)?.width ?? '')}
            onMouseEnter={lineHoverActive ? (e) => onLineHover(pid, e.nativeEvent as MouseEvent) : undefined}
            onMouseLeave={lineHoverActive ? onLineLeave : undefined}
            onClick={lineClickActive ? () => onLineClick(pid) : undefined}
          />
        );
      })}

      {/* Scatter cloud — one marker carrying the count, plus per-point nodes. */}
      {hasScatter && (
        <div
          data-testid={`outcomes-scatter-${eye}`}
          data-count={String(scatterPoints.length)}
          data-has-onclick={scatterClickActive ? 'true' : 'false'}
        >
          {scatterPoints.map((pt) => (
            <div
              key={pt.patientId}
              data-testid={`outcomes-scatter-point-${pt.patientId}`}
              onMouseEnter={(e) => onScatterHover(pt, e.nativeEvent as MouseEvent)}
              onMouseLeave={onScatterLeave}
              onClick={() => onScatterClick(pt)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
