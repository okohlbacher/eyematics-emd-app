/**
 * hashCohortId: HMAC-SHA256-based cohort identifier hashing for PII-minimal audit events.
 *
 * Usage:
 *   1. Call initHashCohortId(dataDir, settings) ONCE at server startup (server/index.ts step 3.5),
 *      AFTER initAuth and BEFORE initAuditDb.
 *   2. Call hashCohortId(id) wherever a cohort id must be recorded without exposing the raw id.
 *
 * Phase 11 decisions honored:
 *   - D-04: HMAC-SHA256, 16-hex-char truncation (64 bits)
 *   - D-05: secret sourced from data/cohort-hash-secret.txt (file-first), falling back to
 *            settings.yaml under `audit.cohortHashSecret` for existing deployments
 *   - D-06: deterministic — same (secret, id) → same hash across restarts
 *   - D-07: exported for Phase 12 AGG-05 reuse without modification
 *
 * Phase 14 / SEC-02:
 *   - File-first: if data/cohort-hash-secret.txt exists, use it (ignores settings)
 *   - Settings fallback: if file absent and settings has cohortHashSecret ≥32 chars, use it
 *   - Auto-generate: if both absent, generate crypto.randomBytes(32).toString('hex'),
 *     write to data/cohort-hash-secret.txt with mode 0o600
 *
 * Threats mitigated:
 *   - T-11-02: deterministic HMAC with persisted secret; no per-process salt, no time input
 *   - T-11-03: missing/short secret file throws at startup (fail-fast)
 *   - T-11-05: secret never logged; no console output references the secret value
 *   - T-14-03: auto-generated 64-char hex secret eliminates dev placeholder risk
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DEV_PLACEHOLDER = 'dev-cohort-hash-secret-please-replace-in-prod-xxxxxxxxxxxxxx';

let _secret: string | null = null;

export function initHashCohortId(dataDir: string, settings: Record<string, unknown>): void {
  const secretFile = path.join(dataDir, 'cohort-hash-secret.txt');

  if (fs.existsSync(secretFile)) {
    // File-first path: use file secret if it exists
    const fromFile = fs.readFileSync(secretFile, 'utf-8').trim();
    if (fromFile.length < 32) {
      throw new Error('[hashCohortId] cohort-hash-secret.txt exists but is too short (min 32 chars)');
    }
    _secret = fromFile;
  } else {
    // Fall back to settings for existing deployments that have cohortHashSecret in settings.yaml
    const auditSection = (settings.audit ?? {}) as Record<string, unknown>;
    const fromSettings = auditSection.cohortHashSecret;
    if (typeof fromSettings === 'string' && fromSettings.length >= 32) {
      _secret = fromSettings;
    } else {
      // Auto-generate for fresh deployments (SEC-02)
      _secret = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(secretFile, _secret, { encoding: 'utf-8', mode: 0o600 });
      console.log(`[hashCohortId] Generated new cohort hash secret at ${secretFile}`);
    }
  }

  if (_secret === DEV_PLACEHOLDER) {
    console.warn('[hashCohortId] WARNING: dev placeholder secret is active — replace before production use');
  }
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
