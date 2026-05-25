/**
 * Clinical threshold accessors — thin shims over settingsService.
 * Phase 39 / CFG-01: constants are now settings-backed; the four exported names
 * are kept as functions to minimize call-site churn. Callers have been updated
 * to invoke them as functions instead of referencing the old literal constants.
 *
 * Fallbacks match the production defaults in shared/thresholdConfig.ts so
 * pre-load (synchronous getSettings() before loadSettings() resolves) is safe.
 */

import { THRESHOLD_DEFAULTS } from '../../shared/thresholdConfig';
import { getSettings } from '../services/settingsService';

/** CRT critical exceedance threshold in µm (default 400). */
export function CRITICAL_CRT_THRESHOLD(): number {
  return getSettings().thresholds?.criticalCrtUm ?? THRESHOLD_DEFAULTS.criticalCrtUm;
}

/** Visus critical low threshold in decimal (default 0.1). */
export function CRITICAL_VISUS_THRESHOLD(): number {
  return getSettings().thresholds?.criticalVisus ?? THRESHOLD_DEFAULTS.criticalVisus;
}

/** IOP critical high threshold in mmHg (default 21). */
export function CRITICAL_IOP_THRESHOLD(): number {
  return getSettings().thresholds?.criticalIopMmHg ?? THRESHOLD_DEFAULTS.criticalIopMmHg;
}

/** Sudden visus change threshold in decimal (default 0.3). */
export function VISUS_JUMP_THRESHOLD(): number {
  return getSettings().thresholds?.visusJump ?? THRESHOLD_DEFAULTS.visusJump;
}

// --- Chart colors (unchanged) ---
export const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
