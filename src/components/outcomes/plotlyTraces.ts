/**
 * Pure trace/layout builders for the Plotly cohort Verläufe panels (WS-1 / v1.17).
 *
 * Kept separate from OutcomesPanel so the trace shapes (and the K1 layer/series
 * contract) are unit-testable without rendering Plotly, and so the live browser path
 * and the jsdom fallback render from the SAME descriptors. The OutcomesPanel maps
 * these descriptors to Plotly `data` (browser) or to testable fallback DOM (jsdom).
 */
import type { GridPoint, PanelResult } from '../../utils/cohortTrajectory';
import { SERIES_STYLES } from './palette';
import type { PlotlyData } from './plotlyTypes';

export type LayerState = {
  median: boolean;
  perPatient: boolean;
  scatter: boolean;
  spreadBand: boolean;
};

/** A single rendered scatter point with the patient pseudonym for drill-down. */
export interface ScatterDatum {
  x: number;
  y: number;
  patientId: string;
}

/**
 * Even-stride downsample to at most `cap` items. Deterministic + order-preserving:
 * picks indices 0, step, 2·step, … so the retained sample spans the whole range
 * (uniform coverage) rather than a truncated head. Returns the input unchanged when
 * it already fits.
 */
export function downsampleScatter<T>(points: readonly T[], cap: number): T[] {
  if (points.length <= cap) return points as T[];
  const step = points.length / cap;
  const out: T[] = [];
  for (let i = 0; i < cap; i++) {
    out.push(points[Math.floor(i * step)]);
  }
  return out;
}

/**
 * Cap the number of scatter points PER PANEL. scattergl draws to WebGL so the cap is
 * far less critical than the old SVG node wall, but a uniform sample keeps hover/click
 * hit-resolution and the legend honest. Larger than the v1.16 SVG cap (1500) because
 * WebGL has no per-point DOM cost.
 */
export const SCATTER_RENDER_CAP = 6000;

/**
 * IDOR gate (security boundary): given a raw Plotly click event, return the navigable
 * patientId ONLY if its `customdata` is a string AND a pseudonym known to this panel.
 * Returns null for anything else — an unknown/crafted `customdata`, a non-string, a
 * stale trace, or a missing point. Extracted as a pure function so the gate itself
 * (not a reimplementation) can be unit-tested against a hostile customdata.
 */
export function resolveDrillDownId(raw: unknown, knownPatientIds: ReadonlySet<string>): string | null {
  const e = raw as { points?: ReadonlyArray<{ customdata?: unknown }> } | null | undefined;
  const pid = e?.points?.[0]?.customdata;
  return typeof pid === 'string' && knownPatientIds.has(pid) ? pid : null;
}

export interface TraceColors {
  /** logMAR / CRT series colour (eye- or cohort-resolved). */
  series: string;
  perPatient: string;
}

/**
 * Build the ordered list of Plotly traces for a SINGLE-cohort panel. Order matters
 * for z-stacking: IQR band (bottom) → per-patient lines → median → scatter (top).
 */
export function buildSingleCohortTraces(args: {
  panel: PanelResult;
  layers: LayerState;
  scatterPoints: ScatterDatum[];
  colors: TraceColors;
  medianName: string;
  hovertemplate: (label: string) => string;
  perPatientSeries: Array<{ id: string; sparse: boolean; x: number[]; y: Array<number | null> }>;
}): PlotlyData[] {
  const { panel, layers, scatterPoints, colors, medianName, hovertemplate, perPatientSeries } = args;
  const traces: PlotlyData[] = [];

  // IQR band (Streuband): two scatter traces — lower (no fill) then upper (fill to
  // previous y) — so it reads as a shaded range between p25 and p75.
  if (layers.spreadBand && panel.medianGrid.length > 0) {
    const xs = panel.medianGrid.map((g) => g.x);
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: xs,
      y: panel.medianGrid.map((g) => g.p25),
      line: { width: 0, color: colors.series },
      hoverinfo: 'skip',
      showlegend: false,
      legendgroup: 'iqr',
      name: 'iqr-lower',
    });
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: xs,
      y: panel.medianGrid.map((g) => g.p75),
      line: { width: 0, color: colors.series },
      fill: 'tonexty',
      fillcolor: rgba(colors.series, SERIES_STYLES.iqr.fillOpacity),
      hoverinfo: 'skip',
      showlegend: false,
      legendgroup: 'iqr',
      name: 'iqr-upper',
    });
  }

  // Per-patient lines (thin grey). Each carries customdata=pseudonym for click/hover.
  if (layers.perPatient) {
    for (const p of perPatientSeries) {
      traces.push({
        type: 'scatter',
        mode: 'lines',
        x: p.x,
        y: p.y,
        line: {
          width: SERIES_STYLES.perPatient.strokeWidth,
          color: colors.perPatient,
        },
        opacity: p.sparse
          ? SERIES_STYLES.perPatient.opacitySparse
          : SERIES_STYLES.perPatient.opacityDense,
        customdata: p.x.map(() => p.id),
        // M2 (v1.18 WS-A): suppress Plotly's NATIVE hover label so it never
        // double-shows alongside our custom imperative tooltip. 'none' (not 'skip')
        // keeps the `plotly_hover` event firing (so the detailed tooltip — and the
        // M1 line-emphasis below — still works); 'skip' would kill the event too.
        hoverinfo: 'none',
        showlegend: false,
        name: `perpatient-${p.id}`,
      });
    }
  }

  // Median line (thick, series colour).
  if (layers.median && panel.medianGrid.length > 0) {
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: panel.medianGrid.map((g) => g.x),
      y: panel.medianGrid.map((g) => g.y),
      line: { width: SERIES_STYLES.median.strokeWidth, color: colors.series },
      name: medianName,
      showlegend: true,
      hovertemplate: hovertemplate(medianName),
    });
  }

  // Scatter cloud (scattergl / WebGL). customdata = patientId for drill-down.
  if (layers.scatter && scatterPoints.length > 0) {
    traces.push({
      type: 'scattergl',
      mode: 'markers',
      x: scatterPoints.map((p) => p.x),
      y: scatterPoints.map((p) => p.y),
      customdata: scatterPoints.map((p) => p.patientId),
      text: scatterPoints.map((p) => p.patientId),
      marker: {
        size: 7,
        color: rgba(colors.series, SERIES_STYLES.scatter.fillOpacity),
        line: { width: 0 },
      },
      // M2 (v1.18 WS-A): 'none' suppresses Plotly's NATIVE hover label (which showed
      // only the pseudonym and double-stacked with our detailed custom tooltip) while
      // STILL firing `plotly_hover` — which drives the single detailed tooltip. Do NOT
      // use 'skip' (that disables the hover event entirely). `text` is retained for the
      // fallback/customdata path. End state: exactly ONE tooltip on scatter hover.
      hoverinfo: 'none',
      showlegend: false,
      name: 'scatter',
    });
  }

  return traces;
}

/** One cohort's series payload for the cross-cohort overlay. */
export interface CrossCohortSeriesInput {
  cohortId: string;
  cohortName: string;
  patientCount: number;
  color: string;
  medianGrid: GridPoint[];
  /** M3 (v1.18 WS-A): per-cohort scatter cloud, drawn when `layers.scatter` is on. */
  scatterPoints?: ScatterDatum[];
  /** M3: per-cohort per-patient lines, drawn when `layers.perPatient` is on. */
  perPatientSeries?: Array<{ id: string; sparse: boolean; x: number[]; y: Array<number | null> }>;
}

/**
 * Build cross-cohort traces. Z-order per cohort: IQR band → per-patient lines →
 * scatter (bands first across all cohorts so no cohort's band hides another's lines),
 * then all medians on top.
 *
 * M3 (v1.18 WS-A): the scatter / per-patient layers now actually render in compare
 * mode — each in its OWN cohort colour — gated on the same layer toggles as the
 * single-cohort path. Drill-down stays disabled in cross mode (by design), but hover
 * tooltips work: scatter carries customdata=pseudonym and per-patient lines carry it
 * too, while `hoverinfo:'none'` keeps the single custom tooltip (no native label).
 */
export function buildCrossCohortTraces(args: {
  series: CrossCohortSeriesInput[];
  layers?: LayerState;
}): PlotlyData[] {
  const layers = args.layers;
  const traces: PlotlyData[] = [];
  // IQR bands (bottom of the z-stack) for every cohort first.
  for (const s of args.series) {
    if (s.medianGrid.length === 0) continue;
    const xs = s.medianGrid.map((g) => g.x);
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: xs,
      y: s.medianGrid.map((g) => g.p25),
      line: { width: 0, color: s.color },
      hoverinfo: 'skip',
      showlegend: false,
      legendgroup: s.cohortId,
      name: `iqr-${s.cohortId}`,
    });
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: xs,
      y: s.medianGrid.map((g) => g.p75),
      line: { width: 0, color: s.color },
      fill: 'tonexty',
      fillcolor: rgba(s.color, SERIES_STYLES.iqr.fillOpacity),
      hoverinfo: 'skip',
      showlegend: false,
      legendgroup: s.cohortId,
      name: `iqr-upper-${s.cohortId}`,
    });
  }
  // M3: per-cohort per-patient lines (opt-in via the toggle), in the cohort colour.
  if (layers?.perPatient) {
    for (const s of args.series) {
      for (const p of s.perPatientSeries ?? []) {
        traces.push({
          type: 'scatter',
          mode: 'lines',
          x: p.x,
          y: p.y,
          line: { width: SERIES_STYLES.perPatient.strokeWidth, color: s.color },
          opacity: p.sparse
            ? SERIES_STYLES.perPatient.opacitySparse
            : SERIES_STYLES.perPatient.opacityDense,
          customdata: p.x.map(() => p.id),
          hoverinfo: 'none',
          showlegend: false,
          legendgroup: s.cohortId,
          name: `perpatient-${s.cohortId}-${p.id}`,
        });
      }
    }
  }
  // M3: per-cohort scatter cloud (opt-in via the toggle), in the cohort colour.
  if (layers?.scatter) {
    for (const s of args.series) {
      const pts = s.scatterPoints ?? [];
      if (pts.length === 0) continue;
      traces.push({
        type: 'scattergl',
        mode: 'markers',
        x: pts.map((p) => p.x),
        y: pts.map((p) => p.y),
        customdata: pts.map((p) => p.patientId),
        text: pts.map((p) => p.patientId),
        marker: {
          size: 7,
          color: rgba(s.color, SERIES_STYLES.scatter.fillOpacity),
          line: { width: 0 },
        },
        hoverinfo: 'none',
        showlegend: false,
        legendgroup: s.cohortId,
        name: `scatter-${s.cohortId}`,
      });
    }
  }
  // Medians on top.
  for (const s of args.series) {
    if (s.medianGrid.length === 0) continue;
    traces.push({
      type: 'scatter',
      mode: 'lines',
      x: s.medianGrid.map((g) => g.x),
      y: s.medianGrid.map((g) => g.y),
      line: { width: SERIES_STYLES.median.strokeWidth, color: s.color },
      name: `${s.cohortName} (N=${s.patientCount} patients)`,
      legendgroup: s.cohortId,
      showlegend: true,
    });
  }
  return traces;
}

/** Convert a #rrggbb hex to an rgba() string at the given alpha. */
export function rgba(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
