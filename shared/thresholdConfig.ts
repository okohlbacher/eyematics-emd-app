/**
 * Shared clinical threshold + plausibility configuration.
 * Used by client (settingsService), server (settingsApi), and Plan 02 UI.
 *
 * Keep this file free of browser/node globals so both sides can import it.
 * CFG-01 / CFG-02 — configurable clinical thresholds and plausibility ranges.
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Critical/action threshold configuration (CFG-01). */
export interface ThresholdConfig {
  /** CRT critical exceedance threshold in µm (was CRITICAL_CRT_THRESHOLD). Default 400. */
  criticalCrtUm: number;
  /** Visus critical low threshold in decimal (was CRITICAL_VISUS_THRESHOLD). Default 0.1. */
  criticalVisus: number;
  /** IOP critical high threshold in mmHg (was CRITICAL_IOP_THRESHOLD). Default 21. */
  criticalIopMmHg: number;
  /** Sudden visus change threshold in decimal (was VISUS_JUMP_THRESHOLD). Default 0.3. */
  visusJump: number;
}

/** Plausibility range configuration (CFG-02). */
export interface PlausibilityConfig {
  /** Minimum plausible Visus value (inclusive). Default 0. */
  visusMin: number;
  /** Maximum plausible Visus value (inclusive). Default 2.0. */
  visusMax: number;
  /** Minimum plausible CRT value in µm (inclusive). Default 100. */
  crtMin: number;
  /** Maximum plausible CRT value in µm (inclusive). Default 800. */
  crtMax: number;
  /** Minimum plausible IOP value in mmHg (inclusive). Default 5. */
  iopMin: number;
  /** Maximum plausible IOP value in mmHg (inclusive). Default 40. */
  iopMax: number;
}

// ---------------------------------------------------------------------------
// Production defaults (single source of truth — settingsService imports these)
// ---------------------------------------------------------------------------

export const THRESHOLD_DEFAULTS: ThresholdConfig = {
  criticalCrtUm: 400,
  criticalVisus: 0.1,
  criticalIopMmHg: 21,
  visusJump: 0.3,
};

export const PLAUSIBILITY_DEFAULTS: PlausibilityConfig = {
  visusMin: 0,
  visusMax: 2.0,
  crtMin: 100,
  crtMax: 800,
  iopMin: 5,
  iopMax: 40,
};

// ---------------------------------------------------------------------------
// Error unions
// ---------------------------------------------------------------------------

export type ThresholdError =
  | 'criticalCrtUmPositive'
  | 'criticalVisusBounds'
  | 'criticalIopMmHgPositive'
  | 'visusJumpPositive'
  | 'nonFinite';

export type PlausibilityError =
  | 'nonFinite'
  | 'negativeBound'
  | 'visusMinMax'
  | 'crtMinMax'
  | 'iopMinMax';

// ---------------------------------------------------------------------------
// Validators — pure functions; no fs, fetch, or browser globals
// ---------------------------------------------------------------------------

/**
 * Validates clinical action thresholds.
 * Mirrors validateTtl() pattern from ttlConversion.ts: returns an error code
 * string or 'ok'. Never throws for out-of-range values (D-03 throw-only applies
 * to genuinely exceptional inputs, not validation control flow).
 */
export function validateThresholds(t: ThresholdConfig): ThresholdError | 'ok' {
  const fields: (keyof ThresholdConfig)[] = [
    'criticalCrtUm',
    'criticalVisus',
    'criticalIopMmHg',
    'visusJump',
  ];
  for (const f of fields) {
    if (!Number.isFinite(t[f])) return 'nonFinite';
  }
  if (t.criticalCrtUm <= 0) return 'criticalCrtUmPositive';
  // criticalVisus must be in (0, 2] — a visus of exactly 0 is not clinically meaningful as threshold
  if (t.criticalVisus <= 0 || t.criticalVisus > 2) return 'criticalVisusBounds';
  if (t.criticalIopMmHg <= 0) return 'criticalIopMmHgPositive';
  if (t.visusJump <= 0) return 'visusJumpPositive';
  return 'ok';
}

/**
 * Validates plausibility range configuration.
 * Returns an error code string or 'ok'. Never throws for validation failures.
 */
export function validatePlausibility(p: PlausibilityConfig): PlausibilityError | 'ok' {
  const fields: (keyof PlausibilityConfig)[] = [
    'visusMin',
    'visusMax',
    'crtMin',
    'crtMax',
    'iopMin',
    'iopMax',
  ];
  for (const f of fields) {
    if (!Number.isFinite(p[f])) return 'nonFinite';
  }
  // Negative bounds — visusMin may be 0 (allowed)
  if (p.visusMin < 0 || p.visusMax < 0 || p.crtMin < 0 || p.crtMax < 0 || p.iopMin < 0 || p.iopMax < 0) {
    return 'negativeBound';
  }
  if (p.visusMin >= p.visusMax) return 'visusMinMax';
  if (p.crtMin >= p.crtMax) return 'crtMinMax';
  if (p.iopMin >= p.iopMax) return 'iopMinMax';
  return 'ok';
}
