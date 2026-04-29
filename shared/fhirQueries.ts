/**
 * Pure FHIR query helpers over the Observation type. Pure leaf module —
 * depends ONLY on ./types/fhir. Safe to import from Node (server) and
 * browser (client). No network calls and no browser-runtime globals.
 *
 * Extracted from src/services/fhirLoader.ts as a Phase 12 precondition
 * so shared/cohortTrajectory.ts can be consumed without transitively
 * pulling src/services/authHeaders.ts (which references browser-only APIs).
 */
import type { Observation } from './types/fhir';

export function getLatestObservation(
  observations: Observation[],
  loincCode: string
): Observation | undefined {
  return observations
    .filter((o) => o.code.coding.some((c) => c.code === loincCode))
    .sort(
      (a, b) =>
        new Date(b.effectiveDateTime ?? 0).getTime() -
        new Date(a.effectiveDateTime ?? 0).getTime()
    )[0];
}

export function getObservationsByCode(
  observations: Observation[],
  loincCode: string
): Observation[] {
  return observations
    .filter((o) => o.code.coding.some((c) => c.code === loincCode))
    .sort(
      (a, b) =>
        new Date(a.effectiveDateTime ?? 0).getTime() -
        new Date(b.effectiveDateTime ?? 0).getTime()
    );
}

/**
 * Extract the first coding's `(system, code)` from a Condition-like resource.
 * Returns `code` as empty string when missing (matches existing caller fallback
 * pattern `cond.code.coding[0]?.code ?? ''`). Used by terminology resolver
 * callers (Phase 25 D-20) — pulled into shared/ once the pattern crossed the
 * 2× threshold (4 distinct call-sites).
 */
export function pickCoding(
  cond: { code?: { coding?: Array<{ system?: string; code?: string }> } }
): { system: string | undefined; code: string } {
  const c = cond.code?.coding?.[0];
  return { system: c?.system, code: c?.code ?? '' };
}
