/**
 * Canonical quality-check parameter keys for per-cohort quality configuration (QUAL-021, D2).
 *
 * TRI-STATE SEMANTICS for qualityParams on SavedSearch:
 *   undefined  — no explicit selection was stored; treat as ALL default checks (back-compat).
 *                Old records (before 40-02) fall into this case. Consumers must use
 *                resolveQualityParams() to expand to the full key set.
 *   []         — the user explicitly chose NO checks for this cohort. Distinct from undefined.
 *   string[]   — a non-empty subset: only those named checks apply to this cohort.
 *
 * Security (T-40-07, T-40-08): sanitizeQualityParams whitelists against QUALITY_PARAM_KEYS
 * before persistence. Non-array / unknown-key inputs are stripped or mapped to undefined.
 */

/** The six canonical quality-check parameter keys, in display order. */
export const QUALITY_PARAM_KEYS = Object.freeze([
  'missingVisus',
  'missingCrt',
  'missingInjections',
  'crtCritical',
  'visusCritical',
  'visusJump',
] as const);

/** Union type of the six canonical check keys. */
export type QualityParamKey = (typeof QUALITY_PARAM_KEYS)[number];

/**
 * Whitelist-sanitize an unknown value into a quality-param selection.
 *
 * - undefined input  → undefined (back-compat: caller should treat as "all checks")
 * - non-array input  → undefined (object, number, string, null — treated as unset)
 * - []               → [] (explicit empty selection preserved, distinct from undefined)
 * - string[]         → only values present in QUALITY_PARAM_KEYS, de-duplicated,
 *                       order-stable (first occurrence wins)
 *
 * Does NOT throw on bad input — returns undefined instead (D-03 throw-only applies to
 * unexpected runtime failures, not to external-input sanitization returns).
 */
export function sanitizeQualityParams(raw: unknown): string[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return undefined;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    if (!(QUALITY_PARAM_KEYS as readonly string[]).includes(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }
  return result;
}

/**
 * Resolve an effective quality-check key set from a stored selection.
 *
 * Implements the tri-state: undefined ⇒ all QUALITY_PARAM_KEYS (back-compat);
 * [] ⇒ [] (no checks); subset ⇒ that subset.
 *
 * Use this in consumers (quality review page, 40-03) instead of reading
 * qualityParams directly, so the back-compat fallback is always applied consistently.
 */
export function resolveQualityParams(selection: string[] | undefined): string[] {
  return selection ?? [...QUALITY_PARAM_KEYS];
}
