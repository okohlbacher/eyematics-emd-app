/**
 * Server-safe CohortFilter whitelist — twin of src/utils/cohortFilterSerialization.ts.
 *
 * F-13 (Phase 40): The server must sanitize incoming SavedSearch filters before
 * persistence. This module cannot import from src/ (client code uses DOM/browser
 * APIs and constructs Set objects). Key difference from safePickCohortFilter:
 * flaggedCaseIds is kept as string[] (wire form) — NOT reconstructed as a Set —
 * because this runs server-side and the JSON.stringify roundtrip needs a plain array.
 *
 * Security (SEC-06, T-40-02/03): only known own-keys with correct shapes are copied.
 * Unknown keys (__proto__, constructor, arbitrary blobs) are never assigned.
 * Non-object / array / null input returns {}.
 */

import type { CohortFilter } from './types/fhir.js';

const PRESET_LITERALS = ['therapyBreaker', 'implausibleCrt', 'flaggedQuality', 'implausibleVisus'] as const;
const LATERALITY_LITERALS = ['OD', 'OS', 'OU'] as const;

/**
 * Whitelist-copy a raw (unknown) value into a plain wire-form CohortFilter object.
 * Returns {} for non-object, array, or null input.
 *
 * DIFFERENCE from safePickCohortFilter: flaggedCaseIds stays as string[] (wire form).
 * The server persists and reads JSON; Set is not needed here.
 */
export function sanitizeSavedSearchFilters(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const parsed = raw as Record<string, unknown>;
  const safe: Record<string, unknown> = {};

  if (Array.isArray(parsed['diagnosis'])) {
    safe['diagnosis'] = (parsed['diagnosis'] as unknown[]).map(String);
  }
  if (Array.isArray(parsed['gender'])) {
    safe['gender'] = (parsed['gender'] as unknown[]).map(String);
  }
  if (Array.isArray(parsed['ageRange']) && (parsed['ageRange'] as unknown[]).length === 2) {
    const r = parsed['ageRange'] as unknown[];
    safe['ageRange'] = [Number(r[0]), Number(r[1])];
  }
  if (Array.isArray(parsed['visusRange']) && (parsed['visusRange'] as unknown[]).length === 2) {
    const r = parsed['visusRange'] as unknown[];
    safe['visusRange'] = [Number(r[0]), Number(r[1])];
  }
  if (Array.isArray(parsed['crtRange']) && (parsed['crtRange'] as unknown[]).length === 2) {
    const r = parsed['crtRange'] as unknown[];
    safe['crtRange'] = [Number(r[0]), Number(r[1])];
  }
  if (Array.isArray(parsed['centers'])) {
    safe['centers'] = (parsed['centers'] as unknown[]).map(String);
  }
  if (
    typeof parsed['preset'] === 'string' &&
    (PRESET_LITERALS as readonly string[]).includes(parsed['preset'])
  ) {
    safe['preset'] = parsed['preset'] as CohortFilter['preset'];
  }
  // Wire form: flaggedCaseIds is string[] — kept as string[], NOT built into a Set
  if (Array.isArray(parsed['flaggedCaseIds'])) {
    safe['flaggedCaseIds'] = (parsed['flaggedCaseIds'] as unknown[]).map(String);
  }
  if (Array.isArray(parsed['diagnosisSubtype'])) {
    safe['diagnosisSubtype'] = (parsed['diagnosisSubtype'] as unknown[]).map(String);
  }
  if (typeof parsed['hasComorbidity'] === 'boolean') {
    safe['hasComorbidity'] = parsed['hasComorbidity'];
  }
  if (Array.isArray(parsed['hba1cRange']) && (parsed['hba1cRange'] as unknown[]).length === 2) {
    const r = parsed['hba1cRange'] as unknown[];
    safe['hba1cRange'] = [Number(r[0]), Number(r[1])];
  }
  if (Array.isArray(parsed['medicationCodes'])) {
    safe['medicationCodes'] = (parsed['medicationCodes'] as unknown[]).map(String);
  }
  if (
    typeof parsed['laterality'] === 'string' &&
    (LATERALITY_LITERALS as readonly string[]).includes(parsed['laterality'])
  ) {
    safe['laterality'] = parsed['laterality'] as CohortFilter['laterality'];
  }

  return safe;
}
