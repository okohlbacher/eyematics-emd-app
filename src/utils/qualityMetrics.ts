import {
  getObservationsByCode,
  LOINC_CRT,
  LOINC_IOP,
  LOINC_VISUS,
} from '../services/fhirLoader';
import type { PatientCase } from '../types/fhir';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimeRange = '6m' | '1y' | 'all';

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
// Plausibility range helpers
// ---------------------------------------------------------------------------

function isVisusInRange(v: number): boolean {
  return v >= 0 && v <= 2.0;
}

function isCrtInRange(v: number): boolean {
  return v >= 100 && v <= 800;
}

function isIopInRange(v: number): boolean {
  return v >= 5 && v <= 40;
}

// ---------------------------------------------------------------------------
// Metric calculation
// ---------------------------------------------------------------------------

export function cutoffDate(range: TimeRange): Date | null {
  const now = new Date();
  if (range === '6m') {
    return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
  }
  if (range === '1y') {
    return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  }
  return null;
}

export function filterCasesByTimeRange(
  cases: PatientCase[],
  range: TimeRange
): PatientCase[] {
  const cutoff = cutoffDate(range);
  if (!cutoff) return cases;

  return cases.map((c) => {
    const obs = c.observations.filter((o) => {
      if (!o.effectiveDateTime) return false;
      return new Date(o.effectiveDateTime) >= cutoff;
    });
    return { ...c, observations: obs };
  });
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
