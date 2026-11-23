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
import { type Locale, t, type TranslationKey } from '../i18n/translations';
import type { CohortFilter } from '../types/fhir';

const PRESET_LITERALS = ['therapyBreaker', 'implausibleCrt', 'flaggedQuality', 'implausibleVisus'] as const;
const LATERALITY_LITERALS = ['OD', 'OS', 'OU'] as const;

/**
 * Whitelist-copy a raw value into a CohortFilter. Returns `{}` for non-object
 * or array input. `flaggedCaseIds` (string[] on the wire) is reconstructed as a Set.
 */
function openBound(v: unknown): number | null {
  return v == null ? null : Number(v);
}

export function safePickCohortFilter(raw: unknown): CohortFilter {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const parsed = raw as Record<string, unknown>;
  const safe: CohortFilter = {};
  if (Array.isArray(parsed.diagnosis)) safe.diagnosis = parsed.diagnosis.map(String);
  if (Array.isArray(parsed.gender)) safe.gender = parsed.gender.map(String);
  // Z0-P01: an open age bound stays null (Number(null) would turn it into 0).
  if (Array.isArray(parsed.ageRange) && parsed.ageRange.length === 2) safe.ageRange = [openBound(parsed.ageRange[0]), openBound(parsed.ageRange[1])];
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

/**
 * Produce a short, deterministic, human-readable summary of the active fields
 * in a CohortFilter. Returns an empty string when no fields are set (caller can
 * then omit the suffix entirely).
 *
 * Field order is fixed (declared below) — only present fields appear.
 * Set-valued fields (flaggedCaseIds) are summarised as a count to avoid echoing
 * patient identifiers (security: T-42-05).
 *
 * Pure function; does not mutate input; localised via `locale` (default 'de'; Z0-P01 Q1) — the caller prepends
 * the localised "Gefilterte Kohorte" prefix; throw-only on programmer error.
 */
export function summarizeCohortFilter(f: CohortFilter, locale: Locale = 'de'): string {
  const parts: string[] = [];
  const tr = (key: TranslationKey) => t(key, locale);
  const n = (key: TranslationKey, count: number) => tr(key).replace('{n}', String(count));

  if (f.diagnosis && f.diagnosis.length > 0) {
    parts.push(`${tr('diagnosis')}: ${f.diagnosis.join(', ')}`);
  }
  if (f.diagnosisSubtype && f.diagnosisSubtype.length > 0) {
    parts.push(`${tr('cohortFilterSummarySubtype')}: ${f.diagnosisSubtype.join(', ')}`);
  }
  if (f.gender && f.gender.length > 0) {
    parts.push(`${tr('gender')}: ${f.gender.join(', ')}`);
  }
  if (f.ageRange) {
    // Z0-P01 Q1: open bounds read "Alter ≥ 70" / "Alter ≤ 60".
    const [lo, hi] = f.ageRange;
    if (lo != null && hi != null) parts.push(`${tr('age')} ${lo}–${hi}`);
    else if (lo != null) parts.push(`${tr('age')} ≥ ${lo}`);
    else if (hi != null) parts.push(`${tr('age')} ≤ ${hi}`);
  }
  if (f.visusRange) {
    parts.push(`Visus ${f.visusRange[0]}–${f.visusRange[1]}`);
  }
  if (f.crtRange) {
    parts.push(`CRT ${f.crtRange[0]}–${f.crtRange[1]} µm`);
  }
  if (f.hba1cRange) {
    parts.push(`HbA1c ${f.hba1cRange[0]}–${f.hba1cRange[1]}`);
  }
  if (f.centers && f.centers.length > 0) {
    parts.push(f.centers.length <= 2
      ? `${tr('centers')}: ${f.centers.join(', ')}`
      : n('cohortFilterSummaryCentersCount', f.centers.length));
  }
  if (f.preset) {
    parts.push(`Preset: ${f.preset}`);
  }
  if (f.laterality) {
    parts.push(`${tr('cohortFilterSummarySide')}: ${f.laterality}`);
  }
  if (f.hasComorbidity === true) {
    parts.push(tr('cohortFilterSummaryComorbidity'));
  }
  if (f.medicationCodes && f.medicationCodes.length > 0) {
    parts.push(n('cohortFilterSummaryMedications', f.medicationCodes.length));
  }
  // flaggedCaseIds: count only — never echo raw identifiers (T-42-05)
  if (f.flaggedCaseIds && f.flaggedCaseIds.size > 0) {
    parts.push(n('cohortFilterSummaryFlagged', f.flaggedCaseIds.size));
  }

  return parts.join(' · ');
}

/**
 * Z0-P04 (Q26 a, Q27): display name of an unsaved filtered cohort — `<base> · <summary>` (base = the localised
 * "Gefilterte Kohorte"), or the supplied `name` (?name=) when given; capped at 80 chars with an ellipsis.
 * The analysis header ("Aktive Kohorte: …") and the Verläufe heading use this one function.
 */
export function formatFilteredCohortName(base: string, f: CohortFilter, locale: Locale, name?: string | null): string {
  const trimmed = name?.trim();
  const summary = summarizeCohortFilter(f, locale);
  const full = trimmed || (summary ? `${base} · ${summary}` : base);
  return full.length > 80 ? full.slice(0, 79) + '…' : full;
}
