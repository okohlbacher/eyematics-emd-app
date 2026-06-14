import { PLAUSIBILITY_DEFAULTS } from '../../shared/thresholdConfig';
import {
  getObservationsByCode,
  LOINC_CRT,
  LOINC_IOP,
  LOINC_VISUS,
} from '../services/fhirLoader';
import { getSettings } from '../services/settingsService';
import type { PatientCase } from '../types/fhir';

// ---------------------------------------------------------------------------
// Category colours
// ---------------------------------------------------------------------------

export type QualityCategory =
  | 'completeness'
  | 'dataCompleteness'
  | 'plausibility'
  | 'overall';

// Muted page-established palette (D-12..D-15): reuses the same CSS-var tokens
// already in use across the DocQuality / Landing pages. Tokens are dark-mode
// aware (see src/index.css), so light/dark contrast inherits automatically.
// Hues span teal / sage / indigo / amber → perceptually distinct families.
export const QUALITY_CATEGORY_COLORS: Record<QualityCategory, string> = {
  completeness: 'var(--color-teal)',
  dataCompleteness: 'var(--color-sage)',
  plausibility: 'var(--color-indigo)',
  overall: 'var(--color-amber)',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Time-range selection for the Dokumentationsqualität / Datenqualität views.
 *
 * Presets ('3m' | '6m' | '1y') select a rolling window ending "now"; 'all'
 * disables windowing. A custom range carries explicit ISO date bounds
 * (`from`/`to`, inclusive) so the user can inspect an arbitrary period.
 *
 * B1: ALL doc-quality metrics are computed from observations inside the
 * selected window only — numerator AND denominator are clipped to the same
 * window (see filterCasesByTimeRange), so a shorter window does not
 * artificially deflate the scores.
 */
export type TimeRangePreset = '3m' | '6m' | '1y' | 'all';
export interface CustomTimeRange {
  /** Inclusive lower bound, ISO date string (yyyy-mm-dd or full ISO). */
  from: string;
  /** Inclusive upper bound, ISO date string. */
  to: string;
}
export type TimeRange = TimeRangePreset | CustomTimeRange;

/** Narrowing helper: true when the range is an explicit custom {from,to}. */
export function isCustomTimeRange(range: TimeRange): range is CustomTimeRange {
  return typeof range === 'object' && range !== null;
}

export interface CenterMetrics {
  centerId: string;
  centerLabel: string;
  patientCount: number;
  observationCount: number;
  completeness: number;   // Vollzähligkeit  – % patients with all required fields
  dataCompleteness: number; // Vollständigkeit – % observations with non-null values
  plausibility: number;  // Plausibilität   – % observations in plausible ranges
  overall: number;       // weighted average
}

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

export function scoreColor(score: number): string {
  if (score > 80) return '#22c55e'; // green-500
  if (score >= 60) return '#f59e0b'; // amber-500
  return '#ef4444'; // red-500
}

export function scoreBgClass(score: number): string {
  if (score > 80) return 'bg-green-100 text-green-800 border-green-200';
  if (score >= 60) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-red-100 text-red-800 border-red-200';
}

export function scoreIconColor(score: number): string {
  if (score > 80) return 'text-green-500';
  if (score >= 60) return 'text-amber-500';
  return 'text-red-500';
}

// ---------------------------------------------------------------------------
// Plausibility range helpers (CFG-02 — bounds read from settings at call time)
// ---------------------------------------------------------------------------

function isVisusInRange(v: number): boolean {
  const p = getSettings().plausibility ?? PLAUSIBILITY_DEFAULTS;
  return v >= p.visusMin && v <= p.visusMax;
}

function isCrtInRange(v: number): boolean {
  const p = getSettings().plausibility ?? PLAUSIBILITY_DEFAULTS;
  return v >= p.crtMin && v <= p.crtMax;
}

function isIopInRange(v: number): boolean {
  const p = getSettings().plausibility ?? PLAUSIBILITY_DEFAULTS;
  return v >= p.iopMin && v <= p.iopMax;
}

// ---------------------------------------------------------------------------
// Metric calculation
// ---------------------------------------------------------------------------

/**
 * Lower bound (inclusive) of a time range, or null when the range is 'all'
 * (no lower bound) — preserved for back-compat callers (e.g. QualityPage's
 * case-level inclusion test).
 *
 * For a custom range this returns the `from` bound. Invalid/empty `from`
 * yields null (treated as "no lower bound") so a half-specified custom range
 * never throws and never silently drops everything.
 */
export function cutoffDate(range: TimeRange): Date | null {
  // Observation `effectiveDateTime` values are date-only 'YYYY-MM-DD' (UTC
  // midnight). Parse every bound in UTC to match — parsing in local time skews
  // boundary-day inclusion by the timezone offset in non-UTC zones.
  if (isCustomTimeRange(range)) {
    if (!range.from) return null;
    const d = new Date(`${range.from}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const now = new Date();
  if (range === '3m') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, now.getUTCDate()));
  }
  if (range === '6m') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 6, now.getUTCDate()));
  }
  if (range === '1y') {
    return new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), now.getUTCDate()));
  }
  return null;
}

/**
 * Resolve a TimeRange into concrete `{from, to}` Date bounds (both inclusive),
 * or null when the range is 'all' / has no usable bounds (→ no windowing).
 *
 * - presets: from = rolling cutoff, to = now (open-ended upper bound is fine
 *   since data never lies in the future, but we set it explicitly for symmetry).
 * - custom: from/to parsed from ISO strings. A from>to or unparseable pair is
 *   rejected (returns null → window disabled) so the caller never produces an
 *   empty/NaN result from a malformed range.
 */
export function timeRangeWindow(
  range: TimeRange
): { from: Date; to: Date } | null {
  if (isCustomTimeRange(range)) {
    if (!range.from || !range.to) return null;
    // Custom bounds come from <input type="date"> as 'YYYY-MM-DD' (calendar days).
    // Parse in UTC to match the observation timestamps (date-only/UTC), and make
    // the range inclusive: from = start of the 'from' day, to = end of the 'to'
    // day, so an observation timestamped any time on either boundary day is
    // included regardless of the viewer's timezone.
    const from = new Date(`${range.from}T00:00:00Z`);
    const to = new Date(`${range.to}T23:59:59.999Z`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
    if (from.getTime() > to.getTime()) return null; // guard: from>to
    return { from, to };
  }
  const cutoff = cutoffDate(range);
  if (!cutoff) return null; // 'all'
  return { from: cutoff, to: new Date() };
}

export function filterCasesByTimeRange(
  cases: PatientCase[],
  range: TimeRange
): PatientCase[] {
  const window = timeRangeWindow(range);
  if (!window) return cases;
  const { from, to } = window;
  const fromMs = from.getTime();
  const toMs = to.getTime();

  // Trim observations to those within the window, then drop cases with zero
  // observations remaining.
  // Semantics:
  //   - Grundgesamtheit = distinct pseudonyms IN WINDOW
  //   - per-center patientCount = case count IN WINDOW (cases with ≥1 obs in window)
  // Cases with observations only outside the window are excluded from metric
  // computation and patientCount so that scores and denominators reflect the
  // chosen time range rather than the full history. Both numerator (complete
  // patients) and denominator (active patients) shrink with the window → a
  // perfectly-documented short window reads ~100%, not artificially low (B1).
  return cases
    .map((c) => {
      const obs = c.observations.filter((o) => {
        if (!o.effectiveDateTime) return false;
        const t = new Date(o.effectiveDateTime).getTime();
        return t >= fromMs && t <= toMs;
      });
      return { ...c, observations: obs };
    })
    .filter((c) => c.observations.length > 0);
}

export function computeMetrics(
  cases: PatientCase[]
): Omit<CenterMetrics, 'centerId' | 'centerLabel'> {
  const patientCount = cases.length;

  if (patientCount === 0) {
    return {
      patientCount: 0,
      observationCount: 0,
      completeness: 0,
      dataCompleteness: 0,
      plausibility: 0,
      overall: 0,
    };
  }

  // --- Vollzähligkeit (Completeness) ---
  // A patient is "complete" if they have birthDate, gender, >=1 condition, >=1 observation
  const completePatients = cases.filter(
    (c) =>
      c.birthDate !== '' &&
      c.gender !== 'unknown' &&
      c.conditions.length >= 1 &&
      c.observations.length >= 1
  ).length;
  const completeness = (completePatients / patientCount) * 100;

  // --- Vollständigkeit (Data completeness) ---
  // % of observations that have a non-null valueQuantity.value
  const allObs = cases.flatMap((c) => c.observations);
  const observationCount = allObs.length;
  const obsWithValue = allObs.filter(
    (o) => o.valueQuantity?.value != null
  ).length;
  const dataCompleteness =
    observationCount === 0 ? 100 : (obsWithValue / observationCount) * 100;

  // --- Plausibilität (Plausibility) ---
  // For observations with known LOINC codes (Visus, CRT, IOP), check if values are in range
  let plausibleCount = 0;
  let checkableCount = 0;

  cases.forEach((c) => {
    const viusObs = getObservationsByCode(c.observations, LOINC_VISUS);
    const crtObs = getObservationsByCode(c.observations, LOINC_CRT);
    const iopObs = getObservationsByCode(c.observations, LOINC_IOP);

    viusObs.forEach((o) => {
      const v = o.valueQuantity?.value;
      if (v != null) {
        checkableCount++;
        if (isVisusInRange(v)) plausibleCount++;
      }
    });
    crtObs.forEach((o) => {
      const v = o.valueQuantity?.value;
      if (v != null) {
        checkableCount++;
        if (isCrtInRange(v)) plausibleCount++;
      }
    });
    iopObs.forEach((o) => {
      const v = o.valueQuantity?.value;
      if (v != null) {
        checkableCount++;
        if (isIopInRange(v)) plausibleCount++;
      }
    });
  });

  const plausibility =
    checkableCount === 0 ? 100 : (plausibleCount / checkableCount) * 100;

  // --- Overall score (weighted average: 40% completeness, 30% dataCompleteness, 30% plausibility) ---
  const overall =
    completeness * 0.4 + dataCompleteness * 0.3 + plausibility * 0.3;

  return {
    patientCount,
    observationCount,
    completeness,
    dataCompleteness,
    plausibility,
    overall,
  };
}
