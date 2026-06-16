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
        hovertemplate: `${p.id}<extra></extra>`,
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
      hovertemplate: '%{text}<extra></extra>',
      showlegend: false,
      name: 'scatter',
    });
  }

  return traces;
}

/** Build cross-cohort median + IQR traces (one per cohort series). */
export function buildCrossCohortTraces(args: {
  series: Array<{ cohortId: string; cohortName: string; patientCount: number; color: string; medianGrid: GridPoint[] }>;
}): PlotlyData[] {
  const traces: PlotlyData[] = [];
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
