/**
 * Eye laterality resolution — single source of truth (F-05, Phase 36 compaction).
 *
 * Prior to this module OD/OS extraction was reimplemented four ways across
 * `cohortTrajectory.ts`, `responderMetric.ts`, `intervalMetric.ts`, and
 * `OutcomesDataPreview.tsx`, each with slightly different handling of arrays
 * and alternate SNOMED codes. This is exactly the kind of clinical transform
 * that must not drift, so all callers now route through `resolveEye`.
 *
 * Behavior is the UNION of all prior implementations:
 *   - Accepts a single CodeableConcept (Observation.bodySite) OR an array of
 *     CodeableConcept (Procedure.bodySite). For arrays, the first element's
 *     coding is inspected.
 *   - Inspects `coding[0].code` only (matches every prior implementation).
 *   - Recognizes both the primary SNOMED laterality codes and the alternate
 *     SNOMED structure codes:
 *       OD: SNOMED_EYE_RIGHT (362503005) | SNOMED_EYE_RIGHT_ALT (24028007)
 *       OS: SNOMED_EYE_LEFT  (362502000) | SNOMED_EYE_LEFT_ALT  (8966001)
 *   - Returns 'od' | 'os' | null.
 *
 * Pure — no I/O, no Date.now(), no Math.random().
 */
import {
  SNOMED_EYE_LEFT,
  SNOMED_EYE_LEFT_ALT,
  SNOMED_EYE_RIGHT,
  SNOMED_EYE_RIGHT_ALT,
} from './fhirCodes';

/**
 * Determine the eye laterality from a FHIR bodySite.
 * Accepts either:
 *   - CodeableConcept (object with .coding[]) — Observation.bodySite
 *   - Array of CodeableConcept — Procedure.bodySite
 * Returns 'od' | 'os' | null.
 */
export function resolveEye(bodySite: unknown): 'od' | 'os' | null {
  if (!bodySite) return null;

  let coding: Array<{ code?: string }> | undefined;

  if (Array.isArray(bodySite)) {
    // Procedure.bodySite is an array of CodeableConcepts
    const first = bodySite[0] as { coding?: Array<{ code?: string }> } | undefined;
    coding = first?.coding;
  } else if (typeof bodySite === 'object') {
    // Observation.bodySite is a single CodeableConcept
    coding = (bodySite as { coding?: Array<{ code?: string }> }).coding;
  }

  if (!coding || !Array.isArray(coding)) return null;

  const code = coding[0]?.code;
  if (code === SNOMED_EYE_RIGHT || code === SNOMED_EYE_RIGHT_ALT) return 'od';
  if (code === SNOMED_EYE_LEFT || code === SNOMED_EYE_LEFT_ALT) return 'os';
  return null;
}
