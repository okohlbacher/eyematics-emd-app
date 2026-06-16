// retained: live React component (not a re-export shim). Listed as a
// Phase 22 shim candidate by 22-RESEARCH but per D-15 (reality check) it is
// not a dedup target — this file holds chart rendering logic. No action
// required beyond this disposition comment.
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ScatterPointItem } from 'recharts';
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
import {
  canvasContextAvailable,
  type CanvasScatterPoint,
  drawScatter,
  hitTestScatter,
} from './scatterCanvas';

// K2 (v1.16-A): canvas rendering for the heavy scatter layer is used only when a real
// 2D context is available (browser). In jsdom (no `canvas` package) / SSR this is
// false, so the existing per-point SVG <Scatter> shape path runs unchanged and the
// existing scatter tests (which assert the SVG hit-halo + per-point shape groups)
// keep passing. Computed once at module load — the environment never changes mid-run.
const SCATTER_CANVAS_MODE = canvasContextAvailable();

type LayerState = {
  median: boolean;
  perPatient: boolean;
  scatter: boolean;
  spreadBand: boolean;
};

// I2 (v1.14-p4): cap the number of scatter symbols rendered PER PANEL. Each rendered
// point draws two SVG circles (r=10 hit halo + r=4 dot); a 245-cohort yields ~7k
// points × 2 = ~14k nodes per panel and three panels (OD/OS/combined). Above this cap
// we even-stride downsample so the cloud stays visually faithful (uniform coverage,
// not a truncated prefix) while keeping DOM nodes — and therefore enable-scatter
// responsiveness — bounded. The downsampled-out points are logged, never silently
// dropped; drill-down/hover still works on every RENDERED point.
const SCATTER_RENDER_CAP = 1500;

/**
 * Even-stride downsample to at most `cap` items. Deterministic and order-preserving:
 * picks indices 0, step, 2·step, … so the retained sample spans the whole range
 * (uniform coverage) rather than a truncated head. Returns the input unchanged when
 * it already fits.
 */
function downsampleScatter<T>(points: readonly T[], cap: number): T[] {
  if (points.length <= cap) return points as T[];
  const step = points.length / cap;
  const out: T[] = [];
  for (let i = 0; i < cap; i++) {
    out.push(points[Math.floor(i * step)]);
  }
  return out;
}

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
  /** FALL-010: optional callback fired when a scatter point is clicked; receives the patient pseudonym. Not active in cross-cohort mode. */
  onPointClick?: (patientId: string) => void;
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
  onPointClick,
}: Props) {
  const { effectiveTheme } = useThemeSafe();
  const isDark = effectiveTheme === 'dark';

  // FALL-010 (A1 v2): controlled-tooltip ref for drill-down navigation.
  //
  // Recharts 3.8.1 chart-level onClick receives MouseHandlerDataParam
  // (activeIndex/activeLabel/activeCoordinate/...) WITHOUT an activePayload, so
  // the click event itself cannot tell us which scatter point was hit. Instead we
  // tap the SAME nearest-point pipeline that drives the visible tooltip: the custom
  // Tooltip content stashes the active scatter entry's patientId into this ref on
  // every render. The chart onClick then navigates to ref.current. This is the
  // exact pipeline the tester can see working (the tooltip shows the pseudonym).
  const activePatientIdRef = useRef<string | null>(null);

  // I1 (v1.14-p2): explicit hovered-scatter-datum tracking.
  //
  // The axis-level Tooltip above resolves the active entry by NEAREST X, not by
  // the point physically under the cursor. Using that pipeline for the drill-down
  // click can navigate to the WRONG patient when several scatter points share an
  // x-band. To fix both the visual highlight AND the click target, we track the
  // datum whose hand-drawn hit-halo the pointer is actually over:
  //   - `hoveredDatumRef` drives the CLICK. It is a ref (not state) so updating it
  //     on pointer enter/leave does NOT re-render the ~14k-node scatter layer; the
  //     chart-level onClick reads it synchronously. This makes wrong-patient
  //     drill-down impossible: the click resolves to the point under the cursor
  //     (the halo we entered), never the axis-tooltip's nearest-x entry.
  //   - The HIGHLIGHT is applied IMPERATIVELY to the hovered dot's SVG element
  //     (grow r + opacity on enter, revert on leave). This deliberately avoids
  //     React state: a state-driven highlight would re-render OutcomesPanel on
  //     every hover transition and Recharts would re-invoke the custom shape for
  //     all ~14k scatter nodes — the exact perf regression A6/I2 must prevent.
  const hoveredDatumRef = useRef<{ patientId: string } | null>(null);

  // J1a (v1.15-p4): IMPERATIVE hover tooltip — follows the HOVERED scatter point.
  //
  // The Recharts axis <Tooltip> resolves its content by NEAREST X, so on a scatter
  // hover it shows whichever point is closest on the x-axis, not the one under the
  // cursor (the tester's "Pop-up still shows the closest point on the x axis").
  // We render our own tooltip element and populate + position it in the SAME pointer
  // enter/leave handlers that already set hoveredDatumRef + the imperative highlight.
  // It is updated via direct DOM writes (textContent/style) — NEVER React state — so
  // a hover does NOT re-render the ~14k-node scatter layer (preserves the I1 perf
  // win). The axis tooltip is restricted to non-scatter series below so the user no
  // longer sees the nearest-x scatter pop-up.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // K2 (v1.16-A): canvas scatter rendering state. In canvas mode the Recharts
  // <Scatter> shape collects each point's resolved pixel position (cx/cy) into this
  // buffer and schedules ONE canvas repaint, instead of emitting ~2 SVG circles per
  // point. The plot-area box is captured so the canvas overlays the chart exactly and
  // mouse coordinates map to the same space as cx/cy. The highlight id drives the
  // cheap single-point overdraw (replacing the SVG attribute mutation).
  const chartWrapRef = useRef<HTMLDivElement | null>(null);
  const scatterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasPointsRef = useRef<CanvasScatterPoint[]>([]);
  const canvasBoxRef = useRef<{ width: number; height: number } | null>(null);
  const canvasRafRef = useRef<number | null>(null);
  const canvasHighlightIdRef = useRef<string | null>(null);
  // Identity of the scatter buffer pass — reset the canvas point buffer + recapture
  // the plot box on the first shape call after the rendered point set changes.
  const canvasPassRef = useRef<unknown>(null);
  // Latest formatting context for the imperative tooltip. Refs (not deps) so the
  // memoized enter handler stays stable while always reading current labels/units.
  // Written during render below (a "latest value" cache — read only inside handlers).
  const hoverFmtRef = useRef<{ xLabel: string; valueLabel: string; valueUnit: string }>(
    { xLabel: '', valueLabel: '', valueUnit: '' },
  );
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
      // Offset a little from the cursor; clamp within the container.
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

  const handlePointEnter = useCallback(
    (
      e: { currentTarget: Element; clientX?: number; clientY?: number },
      point: { patientId: string; x?: number; y?: number },
    ) => {
      hoveredDatumRef.current = { patientId: point.patientId };
      const dot = e.currentTarget.nextElementSibling; // the r=4 visible dot
      if (dot) {
        dot.setAttribute('r', '6');
        dot.setAttribute('fill-opacity', '1');
        dot.setAttribute('stroke-width', '2');
      }
      // J1a: show the hovered-point tooltip at the cursor. clientX/Y come from the
      // SVG pointer event; fall back to the hovered circle's centre if absent.
      let cx = e.clientX;
      let cy = e.clientY;
      if (cx == null || cy == null) {
        const r = (e.currentTarget as Element).getBoundingClientRect();
        cx = r.left + r.width / 2;
        cy = r.top + r.height / 2;
      }
      showHoverTooltip(cx, cy, point);
    },
    [showHoverTooltip],
  );
  const handlePointLeave = useCallback(
    (e: { currentTarget: Element }, patientId: string) => {
      // Only clear the click target if THIS point is still the hovered one — guards
      // the leave-after-enter ordering when moving between overlapping r=10 halos,
      // so the drill-down never silently falls back to nearest-x.
      if (hoveredDatumRef.current?.patientId === patientId) {
        hoveredDatumRef.current = null;
      }
      const dot = e.currentTarget.nextElementSibling;
      if (dot) {
        dot.setAttribute('r', '4');
        dot.setAttribute('fill-opacity', String(SERIES_STYLES.scatter.fillOpacity));
        dot.setAttribute('stroke-width', '1');
      }
      hideHoverTooltip();
    },
    [hideHoverTooltip],
  );

  // K2 (v1.16-A): canvas draw style (color + opacity) kept in a ref so the redraw
  // scheduler stays stable while always reading the current theme-resolved color.
  const canvasStyleRef = useRef<{ color: string; fillOpacity: number }>({
    color: EYE_COLORS.OD,
    fillOpacity: SERIES_STYLES.scatter.fillOpacity,
  });

  // K2: schedule a single canvas repaint on the next animation frame (coalesces the
  // per-point shape callbacks into ONE draw). Reads the current point buffer, box,
  // style, and highlight id. No-op outside canvas mode.
  const scheduleCanvasDraw = useCallback(() => {
    if (!SCATTER_CANVAS_MODE) return;
    if (canvasRafRef.current != null) return;
    const raf =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number;
    canvasRafRef.current = raf(() => {
      canvasRafRef.current = null;
      const canvas = scatterCanvasRef.current;
      const box = canvasBoxRef.current;
      if (!canvas || !box) return;
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      drawScatter(canvas, canvasPointsRef.current, {
        width: box.width,
        height: box.height,
        dpr,
        color: canvasStyleRef.current.color,
        fillOpacity: canvasStyleRef.current.fillOpacity,
        highlightId: canvasHighlightIdRef.current,
      });
    }) as unknown as number;
  }, []);

  // K2: pointer move over the canvas → nearest-point hit-test → imperative highlight
  // (canvas overdraw) + hover tooltip + click-target ref (same pipeline as the SVG
  // halo's enter/leave, so drill-down + tooltip behaviour is identical).
  const handleCanvasMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = scatterCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const hit = hitTestScatter(canvasPointsRef.current, px, py);
      const prevHi = canvasHighlightIdRef.current;
      if (hit && hit.patientId != null) {
        hoveredDatumRef.current = { patientId: hit.patientId };
        canvasHighlightIdRef.current = hit.patientId;
        showHoverTooltip(e.clientX, e.clientY, {
          patientId: hit.patientId,
          x: hit.x,
          y: hit.y,
        });
      } else {
        hoveredDatumRef.current = null;
        canvasHighlightIdRef.current = null;
        hideHoverTooltip();
      }
      if (prevHi !== canvasHighlightIdRef.current) scheduleCanvasDraw();
    },
    [showHoverTooltip, hideHoverTooltip, scheduleCanvasDraw],
  );

  const handleCanvasLeave = useCallback(() => {
    hoveredDatumRef.current = null;
    if (canvasHighlightIdRef.current != null) {
      canvasHighlightIdRef.current = null;
      scheduleCanvasDraw();
    }
    hideHoverTooltip();
  }, [hideHoverTooltip, scheduleCanvasDraw]);

  const handleCanvasClick = useCallback(() => {
    const id = hoveredDatumRef.current?.patientId;
    if (id && onPointClick) onPointClick(id);
  }, [onPointClick]);

  // K2: cancel any pending canvas RAF on unmount.
  useEffect(() => () => {
    if (canvasRafRef.current != null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(canvasRafRef.current);
    }
  }, []);

  // F7 (defensive): clear the stashed drill-down target when the panel's
  // underlying patient set CHANGES (e.g. a cohort switch). Without this, a stale
  // within-cohort pseudonym left in the ref from a prior cohort's hover could fire
  // on a chart click after the switch without a fresh hover. The IDOR gate in the
  // drill-down handler still rejects unknown ids, so this is defense-in-depth.
  //
  // Skip the FIRST run: on mount the tooltip pipeline may already have stashed a
  // target during this same render pass, and clearing it here would clobber a
  // legitimate hover. Only subsequent cohort changes reset the ref.
  const patientsRef = useRef(panel.patients);
  useEffect(() => {
    if (patientsRef.current !== panel.patients) {
      patientsRef.current = panel.patients;
      activePatientIdRef.current = null;
      // I1: also drop any stale hovered datum from the prior cohort.
      hoveredDatumRef.current = null;
    }
  }, [panel.patients]);

  // J1a: keep the imperative-tooltip formatting context current (mirrors
  // OutcomesTooltip's label/unit logic). Synced in an effect (not during render) so
  // the hover handlers read the latest labels without re-creating on every render.
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

  // A6 (perf): memoize per-patient <Line> data arrays. These were rebuilt inline
  // inside the render .map() on EVERY render, producing fresh object identities
  // that defeat Recharts' internal series memoization (it re-diffs every series on
  // each render). With ~200 patients × up to 6 panels this dominated render cost.
  // Keying the memo on panel.patients (stable across renders that don't change the
  // cohort) lets Recharts skip unchanged series. id/sparse are hoisted out so the
  // consuming <Line> keeps its stable key + opacity without rebuilding the array.
  // MUST sit above the early return below to satisfy Rules of Hooks (WR-01).
  const perPatientSeries = useMemo(
    () =>
      // F8 (A6 perf): skip building the per-patient <Line> data arrays entirely
      // when the layer is hidden — they were built unconditionally even when
      // layers.perPatient was false, which is the exact cost the A6 auto-off was
      // meant to avoid on large cohorts.
      !layers.perPatient
        ? []
        : panel.patients
            .filter((p) => !p.excluded && p.measurements.length >= 2)
            .map((p) => ({
              id: p.id,
              sparse: p.sparse,
              data: p.measurements.map((m) => ({
                ...m,
                __series: 'perPatient' as const,
                pseudonym: p.pseudonym,
              })),
            })),
    [panel.patients, layers.perPatient],
  );
  // I2 (v1.14-p4): downsample the scatter cloud to a bounded node count when the
  // layer is on for a large cohort. Memoized on panel.scatterPoints so it only
  // recomputes when the cohort/aggregate changes (NOT on hover — the imperative
  // highlight deliberately avoids re-rendering this layer). Skipped entirely when the
  // layer is hidden so a hidden layer costs nothing. What was dropped is logged once
  // per (re)compute — no silent truncation.
  const scatterRenderPoints = useMemo(() => {
    if (!layers.scatter) return [];
    const all = panel.scatterPoints;
    const shown = downsampleScatter(all, SCATTER_RENDER_CAP);
    if (shown.length < all.length) {
      console.info(
        `[OutcomesPanel] scatter downsampled for eye=${eye}: rendering ${shown.length} of ${all.length} points (cap=${SCATTER_RENDER_CAP}, even-stride). Drill-down/hover available on rendered points.`,
      );
    }
    return shown;
  }, [layers.scatter, panel.scatterPoints, eye]);

  // K2: when the rendered scatter set becomes EMPTY in canvas mode the per-point
  // shape never fires, so the pass-reset can't clear stale points — clear + repaint
  // here so toggling to a no-point state leaves a clean canvas.
  useEffect(() => {
    if (!SCATTER_CANVAS_MODE) return;
    if (scatterRenderPoints.length === 0) {
      canvasPassRef.current = scatterRenderPoints;
      canvasPointsRef.current = [];
      scheduleCanvasDraw();
    }
  }, [scatterRenderPoints, scheduleCanvasDraw]);

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
  // K2: keep the canvas draw style current (a latest-value ref, like hoverFmtRef) so
  // the redraw scheduler stays stable while always painting in the active color.
  // Synced in an effect (not during render) + repaints so a theme/colour change is
  // reflected on the canvas without a state-driven scatter re-render.
  useEffect(() => {
    canvasStyleRef.current = { color: seriesColor, fillOpacity: SERIES_STYLES.scatter.fillOpacity };
    scheduleCanvasDraw();
  }, [seriesColor, scheduleCanvasDraw]);

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
      {/* J1a: imperative hover tooltip — populated + positioned by the scatter
          enter/leave handlers (DOM writes, no React state → no scatter re-render).
          Follows the HOVERED point, replacing the axis tooltip's nearest-x pop-up
          for scatter points. Hidden until a point is entered. */}
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

      <div ref={chartWrapRef} className="relative" style={{ width: '100%', height: 320 }}>
      {/* K2 (v1.16-A): canvas scatter overlay — one DOM node carrying the whole
          (capped) cloud, drawn imperatively from the buffer the <Scatter> shape fills.
          Only rendered in canvas mode + when the layer is on; it captures pointer
          events for hover/click hit-testing (the SVG hit halo is not emitted in this
          mode). Sits above the chart's plot but below the tooltip (z-10). */}
      {SCATTER_CANVAS_MODE && !isCrossMode && layers.scatter && (
        <canvas
          ref={scatterCanvasRef}
          data-testid={`outcomes-scatter-canvas-${eye}`}
          className="absolute inset-0 z-[5]"
          style={{ width: '100%', height: '100%', cursor: onPointClick ? 'pointer' : 'default' }}
          onMouseMove={handleCanvasMove}
          onMouseLeave={handleCanvasLeave}
          onClick={handleCanvasClick}
        />
      )}
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart
          data={panel.medianGrid}
          {...(onPointClick
            ? {
                // I1 (v1.14-p2): chart-level click navigates to the HOVERED scatter
                // datum (the hit-halo physically under the cursor) when one exists,
                // so the click always opens the point the user is pointing at — never
                // a different point that merely shares its x-band. Only when no point
                // is hovered (e.g. a click in empty plot area where Recharts still
                // fires the chart onClick) do we fall back to the axis-tooltip's
                // nearest-x patientId. A click with neither is a no-op.
                onClick: () => {
                  const patientId =
                    hoveredDatumRef.current?.patientId ?? activePatientIdRef.current;
                  if (patientId) onPointClick(patientId);
                },
              }
            : {})}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
          {yMetric !== 'absolute' && (
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="5 5" />
          )}
          <XAxis
            dataKey="x"
            type="number"
            tickCount={5}
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
          <YAxis tickCount={5} tick={{ fontSize: 11, fill: chartColors.axisTick }} stroke={chartColors.grid} domain={yDomain(yMetric, panel.medianGrid, metric)} />
          <Tooltip
            content={(props: { active?: boolean; payload?: ReadonlyArray<{ payload?: Record<string, unknown> }> }) => {
              // FALL-010 (A1 v2): on every tooltip render, capture the active scatter
              // entry's patientId into the ref so the chart-level onClick can navigate.
              // The scatter payload entries carry `patientId`; median/per-patient entries
              // do not. When no scatter entry is active (tooltip off, or hovering a
              // non-scatter series), reset to null so a click becomes a no-op.
              const scatterEntry = props.active && Array.isArray(props.payload)
                ? props.payload.find(
                    (e) => typeof e?.payload?.patientId === 'string',
                  )
                : undefined;
              if (onPointClick) {
                // FALL-010: keep capturing the nearest-x scatter patientId as the
                // CLICK fallback (used only when no point is actually hovered).
                activePatientIdRef.current = scatterEntry
                  ? (scatterEntry.payload!.patientId as string)
                  : null;
              }
              // J1a (v1.15-p4): the axis tooltip resolves by NEAREST X. For a SCATTER
              // hover that means the wrong point — so suppress the axis pop-up when a
              // scatter entry is active; the imperative hover tooltip (driven by the
              // point physically under the cursor) shows the correct point instead.
              // Non-scatter series (median / per-patient line) keep the axis tooltip.
              if (scatterEntry) return null;
              return (
                <OutcomesTooltip
                  active={props.active}
                  payload={props.payload as never}
                  yMetric={yMetric}
                  axisMode={axisMode}
                  layers={layers}
                  t={t}
                  locale={locale}
                  valueLabelKey={valueLabelKey}
                />
              );
            }}
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
            perPatientSeries.map((p) => (
                <Line
                  key={p.id}
                  data={p.data}
                  dataKey="y"
                  type="linear"
                  stroke={SERIES_STYLES.perPatient.color}
                  strokeWidth={SERIES_STYLES.perPatient.strokeWidth}
                  strokeOpacity={p.sparse ? SERIES_STYLES.perPatient.opacitySparse : SERIES_STYLES.perPatient.opacityDense}
                  dot={false}
                  isAnimationActive={false}
                  // J1b (v1.15-p4): click a patient's trajectory LINE → that patient's
                  // case, alongside the scatter-point click. Same drill-down handler +
                  // IDOR gate (onPointClick → handlePointDrillDown resolves the
                  // pseudonym within cohort.cases). Only wired in single-cohort mode
                  // (onPointClick is undefined in cross-mode) and only while the
                  // per-patient layer is shown (this branch). p.id is the pseudonym.
                  {...(onPointClick
                    ? {
                        cursor: 'pointer',
                        // J1b + review #5: set hoveredDatumRef to THIS line's patient
                        // before navigating, so if Recharts also fires the chart-level
                        // onClick on the same click it resolves to the SAME patient
                        // (idempotent) rather than the nearest-x scatter fallback —
                        // no wrong-patient double-navigation regardless of handler order.
                        onClick: () => {
                          hoveredDatumRef.current = { patientId: p.id };
                          onPointClick(p.id);
                        },
                      }
                    : {})}
                  // CRITICAL: without legendType="none", every patient produces a
                  // legend chip (icon "-o-" + dataKey "y"). With 300+ patients the
                  // Recharts <Legend> overflows and tiles the panel. See
                  // docs/reviews/2026-04-16 bug report.
                  legendType="none"
                />
              ))}

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

          {/* FALL-010 (A1 v2): render Scatter AFTER the median/IQR series so the
              drill-down points sit ON TOP of the median line (previously the median
              <Line> rendered last and overlaid the tiny scatter symbols, stealing
              clicks in-browser). The symbol-level onClick is kept as belt-and-braces
              alongside the chart-level ref-mediated handler. */}
          {!isCrossMode && layers.scatter && (
            <Scatter
              data={scatterRenderPoints}
              // FALL-010 root cause (live-browser): without an explicit dataKey the
              // Scatter never resolves its y coordinate (the YAxis carries no dataKey
              // in this composed chart — the Lines each declare their own), so every
              // symbol rendered with cx/cy=null, i.e. no geometry at all.
              dataKey="y"
              fill={seriesColor}
              fillOpacity={SERIES_STYLES.scatter.fillOpacity}
              isAnimationActive={false}
              // FALL-010 (live-browser verified): Recharts 3.8.1 renders EMPTY
              // recharts-shape groups for Scatter even with a ZAxis range — the
              // symbols never get geometry. An explicit shape bypasses the
              // ZAxis/size mechanism entirely: always-visible r=4 circle with an
              // oversized transparent r=10 hit halo for reliable clicking.
              //
              // I1 (v1.14-p2): the r=10 halo is also the per-point HOVER hit target.
              // Its pointer-enter/leave record the hovered datum (ref → click target,
              // state → highlight) so the highlighted/clicked point is the one under
              // the cursor, not the axis-tooltip's nearest-x entry. The point keeps a
              // larger radius + full opacity while hovered.
              shape={(props: unknown) => {
                const { cx, cy, payload } = props as {
                  cx?: number;
                  cy?: number;
                  payload?: { patientId?: string; x?: number; y?: number };
                };
                if (cx == null || cy == null) return <g />;
                const patientId = payload?.patientId;
                // K2 (v1.16-A): canvas mode — collect this point's resolved pixel
                // position into the buffer and emit NO SVG (so the ~2 circles/point
                // node wall disappears). The first point of a render pass resets the
                // buffer + captures the plot box; all points coalesce into ONE canvas
                // repaint scheduled on the next frame. Hover/click run off the buffer.
                if (SCATTER_CANVAS_MODE) {
                  if (canvasPassRef.current !== scatterRenderPoints) {
                    canvasPassRef.current = scatterRenderPoints;
                    canvasPointsRef.current = [];
                    const wrap = chartWrapRef.current;
                    if (wrap) {
                      canvasBoxRef.current = {
                        width: wrap.clientWidth,
                        height: wrap.clientHeight,
                      };
                    }
                  }
                  canvasPointsRef.current.push({ cx, cy, patientId, x: payload?.x, y: payload?.y });
                  scheduleCanvasDraw();
                  return <g />;
                }
                // J1a: wire the per-point hover (tooltip + highlight) whenever the
                // point carries a patientId — independent of drill-down. The click
                // ref is harmless without onPointClick; the chart onClick only acts
                // on it when onPointClick is provided.
                const hoverable = patientId != null;
                return (
                  <g>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={10}
                      fill="transparent"
                      onMouseEnter={
                        hoverable
                          ? (e) =>
                              handlePointEnter(e, {
                                patientId: patientId!,
                                x: payload?.x,
                                y: payload?.y,
                              })
                          : undefined
                      }
                      onMouseLeave={hoverable ? (e) => handlePointLeave(e, patientId!) : undefined}
                    />
                    {/* r=4 dot. pointerEvents:none so the r=10 halo is the sole hit
                        target (no sibling-occlusion flicker when over the centre).
                        The highlight is applied imperatively in the enter/leave
                        handlers — never via state — to avoid re-rendering the layer. */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill={seriesColor}
                      fillOpacity={SERIES_STYLES.scatter.fillOpacity}
                      stroke={seriesColor}
                      strokeWidth={1}
                      style={{ pointerEvents: 'none' }}
                    />
                  </g>
                );
              }}
              // Suppress legend chip — scatter points are an aggregate overlay.
              legendType="none"
              // FALL-010: drill-down — only wired when caller provides the callback.
              {...(onPointClick
                ? {
                    cursor: 'pointer',
                    onClick: (datum: ScatterPointItem) => {
                      const patientId = (datum as unknown as { patientId?: string }).patientId;
                      if (patientId) onPointClick(patientId);
                    },
                  }
                : {})}
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
    </div>
  );
}
