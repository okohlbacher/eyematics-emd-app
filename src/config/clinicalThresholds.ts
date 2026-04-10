/**
 * Clinical threshold constants used across the application.
 * Centralizes magic numbers from CaseDetailPage, QualityPage, and DocQualityPage.
 */

// --- Critical value thresholds ---
export const CRITICAL_CRT_THRESHOLD = 400;       // µm — CRT critical exceedance
export const CRITICAL_VISUS_THRESHOLD = 0.1;      // decimal — Visus critical low
export const CRITICAL_IOP_THRESHOLD = 21;         // mmHg — IOP critical high

// --- Plausibility ranges (for quality checks) ---
export const VISUS_RANGE = { min: 0, max: 2.0 };
export const CRT_RANGE = { min: 50, max: 800 };   // µm
export const IOP_RANGE = { min: 5, max: 40 };     // mmHg
export const HBA1C_RANGE = { min: 3.0, max: 15.0 }; // %

// --- Quality scoring weights ---
export const QUALITY_WEIGHTS = {
  completeness: 0.4,
  dataCompleteness: 0.3,
  plausibility: 0.3,
} as const;

// --- Chart display thresholds ---
export const VISUS_JUMP_THRESHOLD = 0.3;          // suspicious visus change between visits
export const HBA1C_TARGET_THRESHOLD = 7.0;        // diabetes control target

// --- Chart colors ---
export const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];


// --- FHIR pagination ---
export const FHIR_PAGE_SIZE = 50;
export const FHIR_MAX_PAGES = 50;
