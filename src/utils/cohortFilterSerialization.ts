/**
 * CohortFilter safe-pick serialization — single source of truth (F-04, Phase 36).
 *
 * The same `CohortFilter` whitelist was previously hand-maintained in three
 * places (`CohortBuilderPage`, `AnalysisPage`, `OutcomesView`), so any new
 * filter field had to be updated in three files or it would silently disappear
 * on one route. This module owns the whitelist once.
 *
 * `safePickCohortFilter` accepts an already-parsed value (sessionStorage restore
 * and post-JSON.parse paths). `parseCohortFilterJson` wraps JSON.parse + the
 * whitelist for the `?filters=<json>` URL-parsing path, returning `{}` on any
 * malformed input (matching prior AnalysisPage behavior).
 *
 * Security (M-04): only known keys with correct shapes are copied, which
 * prevents prototype pollution from untrusted session/URL payloads. `preset`
 * and `laterality` are restricted to their literal unions.
 */
import type { CohortFilter } from '../types/fhir';

const PRESET_LITERALS = ['therapyBreaker', 'implausibleCrt', 'flaggedQuality', 'implausibleVisus'] as const;
const LATERALITY_LITERALS = ['OD', 'OS', 'OU'] as const;

/**
 * Whitelist-copy a raw value into a CohortFilter. Returns `{}` for non-object
 * or array input. `flaggedCaseIds` (string[] on the wire) is reconstructed as a Set.
 */
export function safePickCohortFilter(raw: unknown): CohortFilter {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const parsed = raw as Record<string, unknown>;
  const safe: CohortFilter = {};
  if (Array.isArray(parsed.diagnosis)) safe.diagnosis = parsed.diagnosis.map(String);
  if (Array.isArray(parsed.gender)) safe.gender = parsed.gender.map(String);
  if (Array.isArray(parsed.ageRange) && parsed.ageRange.length === 2) safe.ageRange = [Number(parsed.ageRange[0]), Number(parsed.ageRange[1])];
  if (Array.isArray(parsed.visusRange) && parsed.visusRange.length === 2) safe.visusRange = [Number(parsed.visusRange[0]), Number(parsed.visusRange[1])];
  if (Array.isArray(parsed.crtRange) && parsed.crtRange.length === 2) safe.crtRange = [Number(parsed.crtRange[0]), Number(parsed.crtRange[1])];
  if (Array.isArray(parsed.centers)) safe.centers = parsed.centers.map(String);
  // Phase 33 fields (T-33-01 whitelist — prevents silent drop of preset/advanced state)
  if (typeof parsed.preset === 'string' && (PRESET_LITERALS as readonly string[]).includes(parsed.preset)) {
    safe.preset = parsed.preset as CohortFilter['preset'];
  }
  if (Array.isArray(parsed.flaggedCaseIds)) safe.flaggedCaseIds = new Set(parsed.flaggedCaseIds.map(String));
  if (Array.isArray(parsed.diagnosisSubtype)) safe.diagnosisSubtype = parsed.diagnosisSubtype.map(String);
  if (typeof parsed.hasComorbidity === 'boolean') safe.hasComorbidity = parsed.hasComorbidity;
  if (Array.isArray(parsed.hba1cRange) && parsed.hba1cRange.length === 2) safe.hba1cRange = [Number(parsed.hba1cRange[0]), Number(parsed.hba1cRange[1])];
  if (Array.isArray(parsed.medicationCodes)) safe.medicationCodes = parsed.medicationCodes.map(String);
  if (typeof parsed.laterality === 'string' && (LATERALITY_LITERALS as readonly string[]).includes(parsed.laterality)) {
    safe.laterality = parsed.laterality as CohortFilter['laterality'];
  }
  return safe;
}

/**
 * Parse a JSON filter string (e.g. the `?filters=` query param) into a
 * whitelisted CohortFilter. Returns `{}` for null/empty input or any parse error.
 */
export function parseCohortFilterJson(raw: string | null): CohortFilter {
  if (!raw) return {};
  try {
    return safePickCohortFilter(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
}
