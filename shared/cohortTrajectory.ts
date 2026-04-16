/**
 * Cohort Outcome Trajectories — pure math utility (Phase 8, D-33).
 *
 * Unit convention: visus observations are stored as `unit: "decimal"`
 * (Snellen decimal: 1.0 = normal, 0.1 = severe impairment). This module
 * normalizes to logMAR = -log10(decimal) at ingest. All downstream math
 * (baseline, Δ, Δ%, median, IQR, interpolation) operates in logMAR space.
 * Snellen (20/x) is computed only for CSV export and tooltips.
 *
 * All functions are pure — no Date.now(), no Math.random(), no I/O.
 */

import { getObservationsByCode } from './fhirQueries';
import {
  LOINC_CRT,
  LOINC_VISUS,
  SNOMED_EYE_LEFT,
  SNOMED_EYE_LEFT_ALT,
  SNOMED_EYE_RIGHT,
  SNOMED_EYE_RIGHT_ALT,
  SNOMED_IVI,
} from './fhirCodes';
import type { Observation, PatientCase, Procedure } from './types/fhir';

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type AxisMode = 'days' | 'treatments';
export type YMetric = 'absolute' | 'delta' | 'delta_percent';
export type SpreadMode = 'iqr' | 'sd1' | 'sd2';
export type Eye = 'od' | 'os' | 'combined';

export interface Measurement {
  date: string;
  decimal: number;
  logmar: number;
  snellenNum: number;
  snellenDen: number;
  eye: 'od' | 'os';
  x: number;        // depends on axisMode
  y: number | null; // depends on yMetric
  clipped?: boolean;
}

export interface PatientSeries {
  id: string;          // patient.pseudonym
  pseudonym: string;
  measurements: Measurement[]; // sorted by x ascending
  sparse: boolean;             // count in [2, ceil(gridPoints/10)-1]
  excluded: boolean;           // 0 measurements for this eye
  baseline: number | null;     // logMAR
}

export interface GridPoint {
  x: number;
  y: number;
  p25: number;
  p75: number;
  n: number;
}

export interface PanelResult {
  patients: PatientSeries[];
  scatterPoints: Array<{ x: number; y: number; patientId: string }>;
  medianGrid: GridPoint[];
  summary: { patientCount: number; excludedCount: number; measurementCount: number };
}

export interface TrajectoryResult {
  od: PanelResult;
  os: PanelResult;
  combined: PanelResult;
}

// ---------------------------------------------------------------------------
// Pure helpers (all exported)
// ---------------------------------------------------------------------------

/**
 * Convert Snellen decimal to logMAR.
 * Returns NaN for decimal ≤ 0 (D-40 / pitfall 7 — callers should skip NaN).
 */
export function decimalToLogmar(decimal: number): number {
  if (decimal <= 0) return NaN;
  return -Math.log10(decimal);
}

/**
 * Convert Snellen decimal to US 20/x fraction (D-28).
 * Centralized per pitfall 6 — used by both CSV export and tooltip.
 */
export function decimalToSnellen(
  decimal: number,
  numerator = 20
): { num: number; den: number } {
  return { num: numerator, den: Math.round(numerator / decimal) };
}

/**
 * Determine the eye laterality from a FHIR bodySite.
 * Accepts either:
 *   - CodeableConcept (object with .coding[]) — Observation.bodySite
 *   - Array of CodeableConcept — Procedure.bodySite
 * Returns 'od' | 'os' | null.
 */
export function eyeOf(bodySite: unknown): 'od' | 'os' | null {
  if (!bodySite) return null;

  let coding: Array<{ code?: string }> | undefined;

  if (Array.isArray(bodySite)) {
    // Procedure.bodySite is an array of CodeableConcepts
    const first = bodySite[0] as { coding?: Array<{ code?: string }> } | undefined;
    coding = first?.coding;
  } else if (typeof bodySite === 'object' && bodySite !== null) {
    // Observation.bodySite is a single CodeableConcept
    coding = (bodySite as { coding?: Array<{ code?: string }> }).coding;
  }

  if (!coding || !Array.isArray(coding)) return null;

  const code = coding[0]?.code;
  if (code === SNOMED_EYE_RIGHT || code === SNOMED_EYE_RIGHT_ALT) return 'od';
  if (code === SNOMED_EYE_LEFT || code === SNOMED_EYE_LEFT_ALT) return 'os';
  return null;
}

/**
 * Cumulative count of IVI Procedures (SNOMED_IVI) up to and including observationDate.
 *
 * For eye === 'combined': count all IVI procedures regardless of laterality.
 * For eye === 'od'/'os': require eyeOf(proc.bodySite) === eye.
 * Procedures with unrecognized laterality are excluded from OD/OS but counted in combined (D-08).
 */
export function treatmentIndexAt(
  procs: Procedure[],
  observationDate: string,
  eye: 'od' | 'os' | 'combined'
): number {
  const obsTime = new Date(observationDate).getTime();

  return procs.filter((proc) => {
    if (!proc.performedDateTime) return false;
    // Must be IVI code
    if (!proc.code.coding.some((c) => c.code === SNOMED_IVI)) return false;
    // Must be on or before observation date
    if (new Date(proc.performedDateTime).getTime() > obsTime) return false;
    // Eye filter
    if (eye === 'combined') return true;
    return eyeOf(proc.bodySite) === eye;
  }).length;
}

/**
 * Linear interpolation of a sorted (x, y) series onto a grid of x values.
 * Returns null for grid points outside the series' observed span (D-15, no extrapolation).
 * Single-point series: returns the value only at an exact grid-x match, null elsewhere.
 */
export function interpolate(
  series: Array<{ x: number; y: number }>,
  grid: number[]
): Array<number | null> {
  if (series.length === 0) return grid.map(() => null);

  const minX = series[0].x;
  const maxX = series[series.length - 1].x;

  return grid.map((gx) => {
    // Outside span → null
    if (gx < minX || gx > maxX) return null;

    // Single point — only exact match returns a value
    if (series.length === 1) {
      return gx === minX ? series[0].y : null;
    }

    // Find surrounding segment
    let lo = 0;
    let hi = series.length - 1;

    // Binary search for lo such that series[lo].x <= gx <= series[lo+1].x
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (series[mid].x <= gx) lo = mid;
      else hi = mid;
    }

    const x0 = series[lo].x;
    const x1 = series[hi].x;
    const y0 = series[lo].y;
    const y1 = series[hi].y;

    if (x0 === x1) return y0;
    return y0 + ((y1 - y0) * (gx - x0)) / (x1 - x0);
  });
}

/**
 * Linear percentile on an ALREADY-SORTED input array.
 * Empty array → NaN. Single element → that element.
 * Uses the standard linear-interpolation method (R type 7).
 */
export function percentile(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (n === 1) return sorted[0];

  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
}

/**
 * Build a uniform interpolation grid given per-patient x value arrays.
 *
 * Pools min/max across all patients and returns a uniform grid of `gridPoints` steps
 * inclusive from min to max.
 * - Empty input → []
 * - min === max → single-point grid [min]
 */
export function buildGrid(xsByPatient: number[][], gridPoints: number): number[] {
  if (xsByPatient.length === 0) return [];

  let globalMin = Infinity;
  let globalMax = -Infinity;

  for (const xs of xsByPatient) {
    for (const x of xs) {
      if (x < globalMin) globalMin = x;
      if (x > globalMax) globalMax = x;
    }
  }

  if (!isFinite(globalMin)) return [];
  if (globalMin === globalMax) return [globalMin];

  const step = (globalMax - globalMin) / (gridPoints - 1);
  return Array.from({ length: gridPoints }, (_, i) => globalMin + i * step);
}

/**
 * Determines whether the Scatter display layer should be ON by default.
 * D-37/D-39: true iff patientCount ≤ 30.
 */
export function defaultScatterOn(patientCount: number): boolean {
  return patientCount <= 30;
}

// ---------------------------------------------------------------------------
// Internal helpers (not exported)
// ---------------------------------------------------------------------------

function daysBetween(a: string, b: string): number {
  return Math.floor(
    (new Date(b).getTime() - new Date(a).getTime()) / 86400000
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function standardDeviation(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

// ---------------------------------------------------------------------------
// computeCohortTrajectory
// ---------------------------------------------------------------------------

export function computeCohortTrajectory(input: {
  cases: PatientCase[];
  axisMode: AxisMode;
  yMetric: YMetric;
  gridPoints: number;
  spreadMode?: SpreadMode;
}): TrajectoryResult {
  const { cases, axisMode, yMetric, gridPoints, spreadMode = 'iqr' } = input;

  // Build per-eye patient series
  const odSeries: PatientSeries[] = [];
  const osSeries: PatientSeries[] = [];

  for (const c of cases) {
    const allVisus = getObservationsByCode(c.observations, LOINC_VISUS);

    // Split by eye
    const odObs = allVisus.filter((o) => eyeOf(o.bodySite) === 'od');
    const osObs = allVisus.filter((o) => eyeOf(o.bodySite) === 'os');

    odSeries.push(buildPatientSeries(c, odObs, 'od', axisMode, yMetric, gridPoints));
    osSeries.push(buildPatientSeries(c, osObs, 'os', axisMode, yMetric, gridPoints));
  }

  // Combined panel: pool OD + OS measurements for each patient (D-20)
  const combinedSeries: PatientSeries[] = cases.map((c, i) => {
    const od = odSeries[i];
    const os = osSeries[i];
    const allMeas = [...od.measurements, ...os.measurements].sort(
      (a, b) => a.x - b.x
    );
    const included = !od.excluded || !os.excluded; // patient has ≥1 measurement in either eye
    return {
      id: c.pseudonym,
      pseudonym: c.pseudonym,
      measurements: allMeas,
      sparse: allMeas.length >= 2 && allMeas.length < Math.ceil(gridPoints / 10),
      excluded: !included,
      baseline: od.baseline ?? os.baseline,
    };
  });

  return {
    od: buildPanel(odSeries, gridPoints, spreadMode),
    os: buildPanel(osSeries, gridPoints, spreadMode),
    combined: buildPanel(combinedSeries, gridPoints, spreadMode),
  };
}

// ---------------------------------------------------------------------------
// Internal: build a PatientSeries for a single (patient, eye) pair
// ---------------------------------------------------------------------------
function buildPatientSeries(
  c: PatientCase,
  visusObs: Observation[],
  eye: 'od' | 'os',
  axisMode: AxisMode,
  yMetric: YMetric,
  gridPoints: number
): PatientSeries {
  if (visusObs.length === 0) {
    return {
      id: c.pseudonym,
      pseudonym: c.pseudonym,
      measurements: [],
      sparse: false,
      excluded: true,
      baseline: null,
    };
  }

  // D-05: baseline = first observation's logMAR (getObservationsByCode returns ascending)
  const baselineObs = visusObs[0];
  const baselineDecimal = baselineObs.valueQuantity?.value ?? NaN;
  const baselineLogmar = decimalToLogmar(baselineDecimal);
  const baselineDate = baselineObs.effectiveDateTime ?? '';

  const measurements: Measurement[] = [];

  for (const obs of visusObs) {
    const date = obs.effectiveDateTime ?? '';
    const decimal = obs.valueQuantity?.value ?? NaN;
    if (isNaN(decimal) || decimal <= 0) continue;
    const logmar = decimalToLogmar(decimal);
    if (isNaN(logmar)) continue;
    const { num: snellenNum, den: snellenDen } = decimalToSnellen(decimal);

    // X value
    let x: number;
    if (axisMode === 'days') {
      x = daysBetween(baselineDate, date);
    } else {
      x = treatmentIndexAt(c.procedures, date, eye);
    }

    // Y value
    let y: number | null = null;
    let clipped = false;

    if (yMetric === 'absolute') {
      y = logmar;
    } else if (yMetric === 'delta') {
      y = isNaN(baselineLogmar) ? null : logmar - baselineLogmar;
    } else {
      // delta_percent
      if (isNaN(baselineLogmar) || baselineLogmar === 0) {
        y = null;
      } else {
        const raw = ((logmar - baselineLogmar) / baselineLogmar) * 100;
        const clamped = clamp(raw, -200, 200);
        if (clamped !== raw) clipped = true;
        y = clamped;
      }
    }

    measurements.push({
      date,
      decimal,
      logmar,
      snellenNum,
      snellenDen,
      eye,
      x,
      y,
      ...(clipped ? { clipped: true } : {}),
    });
  }

  // Sort by x ascending
  measurements.sort((a, b) => a.x - b.x);

  const sparse =
    measurements.length >= 2 &&
    measurements.length < Math.ceil(gridPoints / 10);

  return {
    id: c.pseudonym,
    pseudonym: c.pseudonym,
    measurements,
    sparse,
    excluded: false,
    baseline: isNaN(baselineLogmar) ? null : baselineLogmar,
  };
}

// ---------------------------------------------------------------------------
// Internal: build a PanelResult from a list of PatientSeries
// minN: minimum number of patients needed for a grid point (D-04).
//   Visus default: 2 (IQR band must be non-degenerate).
//   CRT: 1 (single-patient µm trajectory is valid; p25=p75=median).
// ---------------------------------------------------------------------------
function buildPanel(
  allSeries: PatientSeries[],
  gridPoints: number,
  spreadMode: SpreadMode,
  minN = 2,
): PanelResult {
  const active = allSeries.filter((s) => !s.excluded);
  const excluded = allSeries.filter((s) => s.excluded);

  // Build shared grid from non-excluded patients' x values
  const xsByPatient = active.map((s) => s.measurements.map((m) => m.x));
  const grid = buildGrid(xsByPatient, gridPoints);

  // Compute median grid
  const medianGrid: GridPoint[] = [];
  for (const gx of grid) {
    // Collect interpolated y values — exclude single-measurement patients (D-18)
    const ys: number[] = [];
    for (const s of active) {
      if (s.measurements.length < 2) continue; // D-18: single-measurement → scatter only
      const xyPairs = s.measurements
        .filter((m) => m.y !== null)
        .map((m) => ({ x: m.x, y: m.y as number }));
      if (xyPairs.length === 0) continue;
      const [interpolated] = interpolate(xyPairs, [gx]);
      if (interpolated !== null) ys.push(interpolated);
    }

    // D-04 (VQA-03): for visus, require n>=2 so IQR band is non-degenerate.
    // CRT passes minN=1 to allow single-patient panels (p25=p75=median in that case).
    if (ys.length < minN) continue;

    const sorted = [...ys].sort((a, b) => a - b);
    const yMedian = percentile(sorted, 0.5);
    let p25: number;
    let p75: number;

    if (spreadMode === 'iqr') {
      p25 = percentile(sorted, 0.25);
      p75 = percentile(sorted, 0.75);
    } else if (spreadMode === 'sd1') {
      const sd = standardDeviation(ys);
      const m = mean(ys);
      p25 = m - sd;
      p75 = m + sd;
    } else {
      // sd2
      const sd = standardDeviation(ys);
      const m = mean(ys);
      p25 = m - 2 * sd;
      p75 = m + 2 * sd;
    }

    medianGrid.push({ x: gx, y: yMedian, p25, p75, n: ys.length });
  }

  // Scatter points — all individual measurements
  const scatterPoints: Array<{ x: number; y: number; patientId: string }> = [];
  for (const s of active) {
    for (const m of s.measurements) {
      if (m.y !== null) {
        scatterPoints.push({ x: m.x, y: m.y, patientId: s.id });
      }
    }
  }

  const measurementCount = active.reduce(
    (sum, s) => sum + s.measurements.length,
    0
  );

  return {
    patients: allSeries,
    scatterPoints,
    medianGrid,
    summary: {
      patientCount: active.length,
      excludedCount: excluded.length,
      measurementCount,
    },
  };
}

// ---------------------------------------------------------------------------
// computeCrtTrajectory — METRIC-01 / Phase 13 Plan 02
// Mirrors computeCohortTrajectory but reads LOINC_CRT observations whose
// valueQuantity.value is already in µm (no logMAR conversion).
// ---------------------------------------------------------------------------

export function computeCrtTrajectory(input: {
  cases: PatientCase[];
  axisMode: AxisMode;
  yMetric: YMetric;
  gridPoints: number;
  spreadMode?: SpreadMode;
}): TrajectoryResult {
  const { cases, axisMode, yMetric, gridPoints, spreadMode = 'iqr' } = input;

  const odSeries: PatientSeries[] = [];
  const osSeries: PatientSeries[] = [];

  for (const c of cases) {
    const allCrt = getObservationsByCode(c.observations, LOINC_CRT);
    const odObs = allCrt.filter((o) => eyeOf(o.bodySite) === 'od');
    const osObs = allCrt.filter((o) => eyeOf(o.bodySite) === 'os');

    odSeries.push(buildCrtPatientSeries(c, odObs, 'od', axisMode, yMetric, gridPoints));
    osSeries.push(buildCrtPatientSeries(c, osObs, 'os', axisMode, yMetric, gridPoints));
  }

  // Combined panel: pool OD + OS measurements for each patient (mirrors visus logic)
  const combinedSeries: PatientSeries[] = cases.map((c, i) => {
    const od = odSeries[i];
    const os = osSeries[i];
    const allMeas = [...od.measurements, ...os.measurements].sort((a, b) => a.x - b.x);
    const included = !od.excluded || !os.excluded;
    return {
      id: c.pseudonym,
      pseudonym: c.pseudonym,
      measurements: allMeas,
      sparse: allMeas.length >= 2 && allMeas.length < Math.ceil(gridPoints / 10),
      excluded: !included,
      baseline: od.baseline ?? os.baseline,
    };
  });

  // CRT uses minN=1: a single patient's µm trajectory is clinically meaningful.
  // (Visus uses default minN=2 so IQR band is non-degenerate per D-04.)
  return {
    od: buildPanel(odSeries, gridPoints, spreadMode, 1),
    os: buildPanel(osSeries, gridPoints, spreadMode, 1),
    combined: buildPanel(combinedSeries, gridPoints, spreadMode, 1),
  };
}

// ---------------------------------------------------------------------------
// Internal: build a PatientSeries for a single (patient, eye) pair — CRT µm
// ---------------------------------------------------------------------------
function buildCrtPatientSeries(
  c: PatientCase,
  crtObs: Observation[],
  eye: 'od' | 'os',
  axisMode: AxisMode,
  yMetric: YMetric,
  gridPoints: number,
): PatientSeries {
  if (crtObs.length === 0) {
    return {
      id: c.pseudonym,
      pseudonym: c.pseudonym,
      measurements: [],
      sparse: false,
      excluded: true,
      baseline: null,
    };
  }

  // Filter to observations with valid date + µm value, sort ascending by date.
  const sorted = [...crtObs]
    .filter(
      (o) =>
        typeof o.effectiveDateTime === 'string' &&
        typeof o.valueQuantity?.value === 'number' &&
        Number.isFinite(o.valueQuantity.value),
    )
    .sort((a, b) =>
      (a.effectiveDateTime as string).localeCompare(b.effectiveDateTime as string),
    );

  if (sorted.length === 0) {
    return {
      id: c.pseudonym,
      pseudonym: c.pseudonym,
      measurements: [],
      sparse: false,
      excluded: true,
      baseline: null,
    };
  }

  const baselineDate = sorted[0].effectiveDateTime as string;
  const baselineUm = sorted[0].valueQuantity!.value as number;

  // IVI procedure dates for treatment-index axis (same as visus)
  const iviDatesForEye: string[] = (c.procedures ?? [])
    .filter((p) => (p.code?.coding ?? []).some((cd) => cd.code === SNOMED_IVI))
    .filter((p) => eyeOf(p.bodySite) === eye)
    .map((p) => p.performedDateTime)
    .filter((d): d is string => typeof d === 'string')
    .sort();

  const measurements: Measurement[] = [];

  for (const o of sorted) {
    const obsDate = o.effectiveDateTime as string;
    const raw = o.valueQuantity!.value as number;

    // X value
    let x: number;
    if (axisMode === 'days') {
      x = daysBetween(baselineDate, obsDate);
    } else {
      x = iviDatesForEye.filter((d) => d <= obsDate).length;
    }

    // Y value
    let y: number | null = null;
    let clipped = false;

    if (yMetric === 'absolute') {
      y = raw;
    } else if (yMetric === 'delta') {
      y = raw - baselineUm;
    } else {
      // delta_percent — clamp to ±200 (matches visus)
      if (baselineUm === 0) {
        y = null;
      } else {
        const pct = ((raw - baselineUm) / baselineUm) * 100;
        const clamped = clamp(pct, -200, 200);
        if (clamped !== pct) clipped = true;
        y = clamped;
      }
    }

    // CRT measurements use rawDecimal to store µm; logmar/snellen fields set to 0
    // (the Measurement type is visus-centric; CRT reuses the shape with µm in y).
    measurements.push({
      date: obsDate,
      decimal: raw,
      logmar: raw,        // µm stored here for CRT tooltip compatibility
      snellenNum: 0,
      snellenDen: 0,
      eye,
      x,
      y,
      ...(clipped ? { clipped: true } : {}),
    });
  }

  // Sort by x ascending
  measurements.sort((a, b) => a.x - b.x);

  const sparse =
    measurements.length >= 2 &&
    measurements.length < Math.ceil(gridPoints / 10);

  return {
    id: c.pseudonym,
    pseudonym: c.pseudonym,
    measurements,
    sparse,
    excluded: false,
    baseline: baselineUm,
  };
}
