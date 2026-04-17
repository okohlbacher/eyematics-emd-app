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
