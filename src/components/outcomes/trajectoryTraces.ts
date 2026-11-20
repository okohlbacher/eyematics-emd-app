/**
 * Pure series builders for the Verläufe trajectory panels (Z0-P23: Recharts; formerly plotlyTraces.ts).
 *
 * Library-neutral descriptors, so the series contract (layers, order, colours, names) is unit-testable without
 * rendering, and the live Recharts chart and the jsdom marker DOM render from the SAME descriptors.
 * Order is the z-order: IQR bands (bottom) → per-patient lines → scatter → medians (top).
 * No point cap (team answer C8 b).
 */
import type { GridPoint, PanelResult } from '../../utils/cohortTrajectory';
import { SERIES_STYLES } from './palette';

export type LayerState = {
  median: boolean;
  perPatient: boolean;
  scatter: boolean;
  spreadBand: boolean;
};

/** A single scatter point with the patient pseudonym for drill-down. */
export interface ScatterDatum {
  x: number;
  y: number;
  patientId: string;
}

export interface PerPatientSeries {
  id: string;
  sparse: boolean;
  x: number[];
  y: Array<number | null>;
}

export type TraceDescriptor =
  | { kind: 'iqr'; seriesKey: string; cohortId?: string; x: number[]; low: Array<number | null>; high: Array<number | null>; color: string; fillOpacity: number }
  | { kind: 'perpatient'; cohortId?: string; patientId: string; x: number[]; y: Array<number | null>; color: string; width: number; opacity: number }
  | { kind: 'scatter'; cohortId?: string; points: ScatterDatum[]; color: string; opacity: number }
  | { kind: 'median'; seriesKey: string; cohortId?: string; name: string; x: number[]; y: Array<number | null>; color: string; width: number };

/**
 * IDOR gate (security boundary): return the navigable patient id ONLY if it is a string AND a pseudonym known to this
 * panel; null for anything else (unknown/crafted id, non-string, stale value).
 */
export function resolveDrillDownId(pid: unknown, knownPatientIds: ReadonlySet<string>): string | null {
  return typeof pid === 'string' && knownPatientIds.has(pid) ? pid : null;
}

/** Per-patient line series of a panel (≥2 measurements, not excluded). */
export function perPatientSeriesOf(panel: PanelResult): PerPatientSeries[] {
  return panel.patients
    .filter((p) => !p.excluded && p.measurements.length >= 2)
    .map((p) => ({
      id: p.pseudonym,
      sparse: p.sparse,
      x: p.measurements.map((m) => m.x),
      y: p.measurements.map((m) => (typeof m.y === 'number' ? m.y : null)),
    }));
}

/** Z0-P12: the measurements of one highlighted case (cases with critical values), per panel and cohort. */
export interface CriticalSeries {
  cohortId?: string;
  patientId: string;
  x: number[];
  y: Array<number | null>;
}

/** Z0-P12: series of the panel's cases in `ids` with at least one measurement (one series per case, Q11 a). */
export function criticalSeriesOf(panel: PanelResult, ids: ReadonlySet<string>, cohortId?: string): CriticalSeries[] {
  return panel.patients
    .filter((p) => !p.excluded && p.measurements.length > 0 && ids.has(p.pseudonym))
    .map((p) => ({
      cohortId,
      patientId: p.pseudonym,
      x: p.measurements.map((m) => m.x),
      y: p.measurements.map((m) => (typeof m.y === 'number' ? m.y : null)),
    }));
}

function iqrOf(grid: GridPoint[], seriesKey: string, color: string, cohortId?: string): TraceDescriptor {
  return {
    kind: 'iqr',
    seriesKey,
    cohortId,
    x: grid.map((g) => g.x),
    low: grid.map((g) => g.p25 ?? null),
    high: grid.map((g) => g.p75 ?? null),
    color,
    fillOpacity: SERIES_STYLES.iqr.fillOpacity,
  };
}

function perPatientOf(p: PerPatientSeries, color: string, cohortId?: string): TraceDescriptor {
  return {
    kind: 'perpatient',
    cohortId,
    patientId: p.id,
    x: p.x,
    y: p.y,
    color,
    width: SERIES_STYLES.perPatient.strokeWidth,
    opacity: p.sparse ? SERIES_STYLES.perPatient.opacitySparse : SERIES_STYLES.perPatient.opacityDense,
  };
}

/** Series of a SINGLE-cohort panel. */
export function buildSingleCohortTraces(args: {
  panel: PanelResult;
  layers: LayerState;
  scatterPoints: ScatterDatum[];
  colors: { series: string; perPatient: string };
  medianName: string;
  perPatientSeries: PerPatientSeries[];
}): TraceDescriptor[] {
  const { panel, layers, scatterPoints, colors, medianName, perPatientSeries } = args;
  const out: TraceDescriptor[] = [];
  if (layers.spreadBand && panel.medianGrid.length > 0) out.push(iqrOf(panel.medianGrid, 's0', colors.series));
  if (layers.perPatient) for (const p of perPatientSeries) out.push(perPatientOf(p, colors.perPatient));
  if (layers.scatter && scatterPoints.length > 0) {
    out.push({ kind: 'scatter', points: scatterPoints, color: colors.series, opacity: SERIES_STYLES.scatter.fillOpacity });
  }
  if (layers.median && panel.medianGrid.length > 0) {
    out.push({
      kind: 'median',
      seriesKey: 's0',
      name: medianName,
      x: panel.medianGrid.map((g) => g.x),
      y: panel.medianGrid.map((g) => g.y),
      color: colors.series,
      width: SERIES_STYLES.median.strokeWidth,
    });
  }
  return out;
}

/** One cohort's series payload for the cross-cohort overlay. */
export interface CrossCohortSeriesInput {
  cohortId: string;
  cohortName: string;
  patientCount: number;
  color: string;
  medianGrid: GridPoint[];
  scatterPoints?: ScatterDatum[];
  perPatientSeries?: PerPatientSeries[];
}

/**
 * Cross-cohort series: all IQR bands first, then per-patient lines and scatter per cohort (opt-in via the layer
 * toggles, each in the cohort colour), then all medians on top. The median carries the legend name.
 */
export function buildCrossCohortTraces(args: {
  series: CrossCohortSeriesInput[];
  layers: LayerState;
  legendName: (s: CrossCohortSeriesInput) => string;
}): TraceDescriptor[] {
  const { series, layers, legendName } = args;
  const out: TraceDescriptor[] = [];
  series.forEach((s, i) => {
    if (layers.spreadBand && s.medianGrid.length > 0) out.push(iqrOf(s.medianGrid, `s${i}`, s.color, s.cohortId));
  });
  if (layers.perPatient) {
    for (const s of series) for (const p of s.perPatientSeries ?? []) out.push(perPatientOf(p, s.color, s.cohortId));
  }
  if (layers.scatter) {
    for (const s of series) {
      const pts = s.scatterPoints ?? [];
      if (pts.length > 0) {
        out.push({ kind: 'scatter', cohortId: s.cohortId, points: pts, color: s.color, opacity: SERIES_STYLES.scatter.fillOpacity });
      }
    }
  }
  series.forEach((s, i) => {
    if (s.medianGrid.length === 0) return;
    out.push({
      kind: 'median',
      seriesKey: `s${i}`,
      cohortId: s.cohortId,
      name: legendName(s),
      x: s.medianGrid.map((g) => g.x),
      y: s.medianGrid.map((g) => g.y),
      color: s.color,
      width: SERIES_STYLES.median.strokeWidth,
    });
  });
  return out;
}

/** One row per x of the median/IQR series, keyed `m_<seriesKey>` / `iqr_<seriesKey>` for the Recharts chart. */
export function mergeSeriesRows(traces: TraceDescriptor[]): Array<Record<string, number | [number, number] | null>> {
  const rows = new Map<number, Record<string, number | [number, number] | null>>();
  const row = (x: number) => {
    let r = rows.get(x);
    if (!r) {
      r = { x };
      rows.set(x, r);
    }
    return r;
  };
  for (const tr of traces) {
    if (tr.kind === 'median') {
      tr.x.forEach((x, i) => { row(x)[`m_${tr.seriesKey}`] = tr.y[i] ?? null; });
    } else if (tr.kind === 'iqr') {
      tr.x.forEach((x, i) => {
        const lo = tr.low[i];
        const hi = tr.high[i];
        row(x)[`iqr_${tr.seriesKey}`] = lo != null && hi != null ? [lo, hi] : null;
      });
    }
  }
  return [...rows.values()].sort((a, b) => (a.x as number) - (b.x as number));
}

/** x extent over every series (medians, bands, per-patient lines, scatter); [0, 1] when empty. */
export function xExtent(traces: TraceDescriptor[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  const see = (x: number) => {
    if (!Number.isFinite(x)) return;
    if (x < lo) lo = x;
    if (x > hi) hi = x;
  };
  for (const tr of traces) {
    if (tr.kind === 'scatter') tr.points.forEach((p) => see(p.x));
    else tr.x.forEach(see);
  }
  if (lo === Infinity) return [0, 1];
  return lo === hi ? [lo - 1, hi + 1] : [lo, hi];
}

/** Convert a #rrggbb hex to an rgba() string at the given alpha. */
export function rgba(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}
