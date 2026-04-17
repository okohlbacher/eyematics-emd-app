/**
 * hashCohortId: HMAC-SHA256-based cohort identifier hashing for PII-minimal audit events.
 *
 * Usage:
 *   1. Call initHashCohortId(settings) ONCE at server startup (server/index.ts step 3.5),
 *      AFTER initAuth and BEFORE initAuditDb.
 *   2. Call hashCohortId(id) wherever a cohort id must be recorded without exposing the raw id.
 *
 * Phase 11 decisions honored:
 *   - D-04: HMAC-SHA256, 16-hex-char truncation (64 bits)
 *   - D-05: secret sourced from settings.yaml under `audit.cohortHashSecret`
 *   - D-06: deterministic — same (secret, id) → same hash across restarts
 *   - D-07: exported for Phase 12 AGG-05 reuse without modification
 *
 * Threats mitigated:
 *   - T-11-02: deterministic HMAC with persisted secret; no per-process salt, no time input
 *   - T-11-03: missing/short secret throws at startup (fail-fast)
 *   - T-11-05: secret never logged; no console output references the secret value
 */

import crypto from 'node:crypto';

let _secret: string | null = null;

export function initHashCohortId(settings: Record<string, unknown>): void {
  const auditSection = (settings.audit ?? {}) as Record<string, unknown>;
  const secret = auditSection.cohortHashSecret;
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error(
      '[hashCohortId] FATAL: settings.audit.cohortHashSecret is required and must be a string of at least 32 characters',
    );
  }
  _secret = secret;
}

export function hashCohortId(id: string): string {
  if (_secret === null) {
    throw new Error('[hashCohortId] hashCohortId() called before initHashCohortId()');
  }
  return crypto.createHmac('sha256', _secret).update(id).digest('hex').slice(0, 16);
}

/**
 * Test-only helper. Resets module state so successive init/negative-path tests
 * can exercise the "called before init" guard without module re-import tricks.
 * Do NOT call from production code.
 */
export function _resetForTesting(): void {
  _secret = null;
}
