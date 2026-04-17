/**
 * Clinical threshold constants used across the application.
 * Centralizes magic numbers from CaseDetailPage, QualityPage, and DocQualityPage.
 */

// --- Critical value thresholds ---
export const CRITICAL_CRT_THRESHOLD = 400;       // µm — CRT critical exceedance
export const CRITICAL_VISUS_THRESHOLD = 0.1;      // decimal — Visus critical low
export const CRITICAL_IOP_THRESHOLD = 21;         // mmHg — IOP critical high
export const VISUS_JUMP_THRESHOLD = 0.3;          // decimal — sudden visus change

// --- Chart colors ---
export const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
