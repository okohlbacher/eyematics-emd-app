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
 *
 * retained: server-only live module (settings init + HMAC compute). Listed
 * as a Phase 22 shim candidate by 22-RESEARCH; confirmed per D-15 that this
 * is NOT a dedup target — HMAC secret never crosses to browser. Module-local
 * `_secret` state is required. No action required beyond this disposition.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

let _secret: string | null = null;

/**
 * Secret values we ship in this repo or know to be unsafe defaults.
 * Any of these appearing in settings.yaml must fail-closed — they
 * would otherwise pass the length guard and let a deployment ship a
 * publicly known HMAC key (C4 / T-11-03 hardened).
 */
const KNOWN_DEFAULT_SECRETS = new Set<string>([
  'dev-cohort-hash-secret-please-replace-in-prod-xxxxxxxxxxxxxx',
  'changeme',
  'please-change-me',
]);

/**
 * Initialize the cohort-id HMAC secret.
 *
 * Precedence:
 *   1. `data/cohort-hash-secret.txt` — generated on first launch (mode 0o600).
 *      This is the canonical source so no deployment accidentally ships the
 *      repo's placeholder value.
 *   2. `settings.audit.cohortHashSecret` — honored only if the file does not
 *      exist AND the value is not in KNOWN_DEFAULT_SECRETS AND is ≥64 chars.
 *      (v1.7+: new deployments use the file; the settings-key path is kept
 *      for backward compatibility with existing sites that already rotated
 *      to a strong secret in settings.yaml.)
 *
 * If neither source yields a usable secret, a fresh 256-bit secret is
 * generated and persisted to `data/cohort-hash-secret.txt`.
 */
export function initHashCohortId(settings: Record<string, unknown>, dataDir?: string): void {
  // Path-1: file on disk takes precedence
  if (dataDir) {
    const secretFile = path.join(dataDir, 'cohort-hash-secret.txt');
    if (fs.existsSync(secretFile)) {
      const fromFile = fs.readFileSync(secretFile, 'utf-8').trim();
      if (!fromFile) {
        throw new Error('[hashCohortId] cohort-hash-secret.txt exists but is empty — delete it to regenerate');
      }
      if (fromFile.length < 32) {
        throw new Error('[hashCohortId] FATAL: cohort-hash-secret.txt must contain at least 32 chars');
      }
      _secret = fromFile;
      return;
    }
  }

  // Path-2: settings.yaml value (legacy)
  const auditSection = (settings.audit ?? {}) as Record<string, unknown>;
  const fromSettings = auditSection.cohortHashSecret;
  if (typeof fromSettings === 'string' && fromSettings.length > 0) {
    if (KNOWN_DEFAULT_SECRETS.has(fromSettings)) {
      throw new Error(
        '[hashCohortId] FATAL: settings.audit.cohortHashSecret is a known placeholder value. ' +
        'Delete it from settings.yaml and restart — a strong secret will be auto-generated at data/cohort-hash-secret.txt.',
      );
    }
    if (fromSettings.length < 64) {
      throw new Error(
        '[hashCohortId] FATAL: settings.audit.cohortHashSecret must be at least 64 chars (256-bit hex). ' +
        'Remove it from settings.yaml to use the auto-generated file-based secret instead.',
      );
    }
    _secret = fromSettings;
    return;
  }

  // Path-3: auto-generate — requires dataDir
  if (!dataDir) {
    throw new Error(
      '[hashCohortId] FATAL: no cohort hash secret found and no dataDir supplied for auto-generation',
    );
  }
  const generated = crypto.randomBytes(32).toString('hex');
  const secretFile = path.join(dataDir, 'cohort-hash-secret.txt');
  fs.writeFileSync(secretFile, generated, { encoding: 'utf-8', mode: 0o600 });
  console.log(`[hashCohortId] Generated new cohort-hash secret at ${secretFile}`);
  _secret = generated;
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
