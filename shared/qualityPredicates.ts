/**
 * shared/qualityPredicates.ts — lifted quality-related predicate helpers.
 *
 * Lifted from QualityPage.tsx (Phase 33) so shared/patientCases.ts applyFilters
 * can call getTherapyStatus for the Therapie-Abbrecher preset without duplicating
 * the gap-calculation logic.
 *
 * No I/O, no browser APIs, no side effects.
 */
import { SNOMED_IVI } from './fhirCodes.js';
import type { PatientCase } from './types/fhir.js';

// Therapy discontinuation detection (EMDREQ-QUAL-009)
// F-20: thresholds passed as parameters instead of reading global singleton
export function getTherapyStatus(
  pc: PatientCase,
  thresholds: { interrupterDays: number; breakerDays: number },
): { status: 'active' | 'interrupter' | 'breaker'; gapDays: number } {
  const injections = pc.procedures
    .filter((p) => p.code.coding.some((c) => c.code === SNOMED_IVI))
    .map((p) => new Date(p.performedDateTime ?? '').getTime())
    .filter((t) => !isNaN(t))
    .sort((a, b) => a - b);

  if (injections.length < 2) return { status: 'active', gapDays: 0 };

  let maxGap = 0;
  for (let i = 1; i < injections.length; i++) {
    const gap = (injections[i] - injections[i - 1]) / (1000 * 60 * 60 * 24);
    if (gap > maxGap) maxGap = gap;
  }

  const lastToNow = (Date.now() - injections[injections.length - 1]) / (1000 * 60 * 60 * 24);
  if (lastToNow > maxGap) maxGap = lastToNow;

  if (maxGap > thresholds.breakerDays) return { status: 'breaker', gapDays: Math.round(maxGap) };
  if (maxGap > thresholds.interrupterDays) return { status: 'interrupter', gapDays: Math.round(maxGap) };
  return { status: 'active', gapDays: Math.round(maxGap) };
}
