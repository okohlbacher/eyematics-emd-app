/**
 * Phase 13 / METRIC-02 / D-04 — Treatment-interval distribution.
 *
 * Computes bucketized gaps (in days) between consecutive SNOMED_IVI procedures
 * per patient, filtered by eye. Returns 6 fixed bins + median gap.
 *
 * For eye='combined': per-eye sequences (OD and OS) are computed independently
 * and gaps from both eyes are pooled. This avoids spurious 0-day cross-eye gaps
 * when a patient has same-day OD and OS injections.
 */
import { eyeOf, percentile } from './cohortTrajectory';
import { SNOMED_IVI } from './fhirCodes';
import type { PatientCase } from './types/fhir';

export type IntervalEye = 'od' | 'os' | 'combined';

export interface IntervalBin {
  label: string;
  count: number;
}

export interface IntervalDistribution {
  bins: IntervalBin[];
  medianGap: number;
}

/** Half-open bin boundaries: [min, max). 180+d is [180, Infinity). */
export const INTERVAL_BINS = [
  { label: '0–30d', min: 0, max: 30 },
  { label: '30–60d', min: 30, max: 60 },
  { label: '60–90d', min: 60, max: 90 },
  { label: '90–120d', min: 90, max: 120 },
  { label: '120–180d', min: 120, max: 180 },
  { label: '180+d', min: 180, max: Infinity },
] as const;

/**
 * Resolve eye laterality from a procedure bodySite, handling both the
 * SNOMED laterality codes (362503005 / 362502000) used by eyeOf() and the
 * SNOMED structure codes (24028007 / 8966001) used in synthetic bundles.
 */
function eyeOfProc(bodySite: unknown): 'od' | 'os' | null {
  // Delegate to the shared eyeOf for the primary code set
  const primary = eyeOf(bodySite);
  if (primary !== null) return primary;

  // Fallback: check for SNOMED structure codes
  let coding: Array<{ code?: string }> | undefined;
  if (Array.isArray(bodySite)) {
    const first = bodySite[0] as { coding?: Array<{ code?: string }> } | undefined;
    coding = first?.coding;
  } else if (typeof bodySite === 'object' && bodySite !== null) {
    coding = (bodySite as { coding?: Array<{ code?: string }> }).coding;
  }
  if (!coding || !Array.isArray(coding)) return null;
  const code = coding[0]?.code;
  // SNOMED: Right eye structure = 24028007, Left eye structure = 8966001
  if (code === '24028007') return 'od';
  if (code === '8966001') return 'os';
  return null;
}

/** Zero-filled bins matching INTERVAL_BINS order (used for empty-state / starting value). */
function emptyBins(): IntervalBin[] {
  return INTERVAL_BINS.map((b) => ({ label: b.label, count: 0 }));
}

/** Bucket a single gap in days into the bin index (0-5), or -1 if gap is negative. */
function binIndex(gapDays: number): number {
  if (gapDays < 0) return -1;
  for (let i = 0; i < INTERVAL_BINS.length; i++) {
    const b = INTERVAL_BINS[i];
    if (gapDays >= b.min && gapDays < b.max) return i;
  }
  return -1;
}

/**
 * Extract sorted procedure dates for a specific eye from a patient case.
 * Only includes procedures with SNOMED_IVI code and matching eye laterality.
 * When eye is null, includes ALL IVI procedures (used internally for per-eye combined pool).
 */
function getEyeDates(pc: PatientCase, filterEye: 'od' | 'os' | null): string[] {
  return (pc.procedures ?? [])
    .filter((p) => (p.code?.coding ?? []).some((c) => c?.code === SNOMED_IVI))
    .filter((p) => {
      if (filterEye === null) return true;
      const procEye = eyeOfProc(p.bodySite);
      return procEye === filterEye;
    })
    .map((p) => p.performedDateTime)
    .filter((d): d is string => typeof d === 'string' && d.length > 0)
    .sort();
}

/**
 * Compute consecutive-pair gaps (in days) from a sorted list of date strings.
 * Returns only non-negative gaps.
 */
function computeGaps(sortedDates: string[]): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]).getTime();
    const curr = new Date(sortedDates[i]).getTime();
    if (!Number.isFinite(prev) || !Number.isFinite(curr)) continue;
    const gap = Math.floor((curr - prev) / 86400000);
    if (gap >= 0) gaps.push(gap);
  }
  return gaps;
}

export function computeIntervalDistribution(
  cases: PatientCase[],
  eye: IntervalEye,
): IntervalDistribution {
  const bins = emptyBins();
  const allGaps: number[] = [];

  for (const pc of cases ?? []) {
    let gapsForCase: number[];

    if (eye === 'combined') {
      // Compute per-eye gaps independently to avoid cross-eye spurious gaps,
      // then pool them together.
      const odDates = getEyeDates(pc, 'od');
      const osDates = getEyeDates(pc, 'os');
      gapsForCase = [...computeGaps(odDates), ...computeGaps(osDates)];
    } else {
      const dates = getEyeDates(pc, eye);
      gapsForCase = computeGaps(dates);
    }

    for (const gap of gapsForCase) {
      const idx = binIndex(gap);
      if (idx >= 0) bins[idx].count += 1;
      allGaps.push(gap);
    }
  }

  const sortedGaps = [...allGaps].sort((a, b) => a - b);
  const medianGap = sortedGaps.length === 0 ? 0 : Math.floor(percentile(sortedGaps, 0.5));

  return { bins, medianGap };
}
