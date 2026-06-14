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
 * Canonicalize a sanitized selection for persistence (QUAL-021 D2 back-compat).
 *
 * Collapses a selection that contains ALL known keys down to `undefined`, so that
 * a "user checked everything" cohort is byte-for-byte indistinguishable from an
 * old record that never stored qualityParams (both resolve to all checks via
 * resolveQualityParams). A proper subset (incl. []) is returned unchanged.
 *
 * Used by BOTH the create and update saved-search paths and by the client edit
 * flow so the tri-state round-trips identically (D-01: cross-boundary helper).
 *
 * Input MUST already be sanitized (sanitizeQualityParams): de-duplicated and
 * whitelisted. "Contains all keys" is therefore a length === KEY_COUNT check.
 */
export function canonicalizeQualityParams(
  selection: string[] | undefined,
): string[] | undefined {
  if (selection === undefined) return undefined;
  if (selection.length === QUALITY_PARAM_KEYS.length) return undefined;
  return selection;
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
