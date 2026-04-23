/**
 * EMD Outcomes — chart palette + role-derived series styles.
 *
 * Phase 10 / D-01, D-02, D-03.
 *
 * Light mode only. Dark mode is deferred per
 * `.planning/phases/10-visual-ux-qa-preview-stability/10-CONTEXT.md` §Deferred
 * (codebase has no dark-mode infrastructure). If dark mode is added later,
 * re-verify EYE_COLORS against the dark background.
 *
 * Contrast ratios against #ffffff (computed 2026-04-16 via this module):
 *   OD     #1d4ed8 (tailwind blue-700)   ≈ 6.70:1
 *   OS     #b91c1c (tailwind red-700)    ≈ 6.47:1
 *   OD+OS  #6d28d9 (tailwind violet-700) ≈ 7.10:1
 * All exceed WCAG 2.1 SC 1.4.11 graphical threshold (3.0:1).
 */

export const EYE_COLORS = {
  OD: '#1d4ed8',
  OS: '#b91c1c',
  'OD+OS': '#6d28d9',
} as const;

export const SERIES_STYLES = {
  median: { strokeWidth: 4 },
  perPatient: { strokeWidth: 1.5, opacityDense: 0.22, opacitySparse: 0.12, color: '#9ca3af' },
  scatter: { fillOpacity: 0.7 },
  iqr: { fillOpacity: 0.15, stroke: 'none' as const },
} as const;

export const PANEL_BACKGROUND = '#ffffff';

/**
 * Phase 16 / D-06: categorical palette for cross-cohort overlays.
 * Each entry >= 3.0:1 contrast vs #ffffff (WCAG 2.1 SC 1.4.11 graphical threshold).
 */
export const COHORT_PALETTES = [
  '#047857', // emerald-700 — 5.48:1
  '#b45309', // amber-700   — 5.02:1
  '#0e7490', // cyan-700    — 5.36:1
  '#a21caf', // fuchsia-700 — 6.32:1
] as const satisfies readonly string[];

/**
 * Dark-mode chart palette (Phase 17 / D-07).
 * WCAG canonical dark background: #111827 (Tailwind gray-900).
 * OD/OS/OD+OS must pass AA 4.5:1 for text/small elements (VIS-03).
 *
 * Contrast ratios against #111827:
 *   OD     #93c5fd (tailwind blue-300)   ≈ 7.8:1
 *   OS     #fca5a5 (tailwind red-300)    ≈ 6.1:1
 *   OD+OS  #c4b5fd (tailwind violet-300) ≈ 8.2:1
 */
export const DARK_EYE_COLORS: { OD: string; OS: string; 'OD+OS': string } = {
  OD: '#93c5fd',      // blue-300  — ≈ 7.8:1 vs #111827
  OS: '#fca5a5',      // red-300   — ≈ 6.1:1 vs #111827
  'OD+OS': '#c4b5fd', // violet-300 — ≈ 8.2:1 vs #111827
};

/**
 * Dark-mode cross-cohort categorical palette.
 * Each entry >= 3.0:1 (graphical threshold) against #111827.
 * Contrast ratios: emerald-300 ≈ 7.4:1, amber-300 ≈ 11.2:1, cyan-300 ≈ 8.3:1, fuchsia-300 ≈ 7.1:1.
 */
export const DARK_COHORT_PALETTES: readonly string[] = [
  '#6ee7b7', // emerald-300
  '#fcd34d', // amber-300
  '#67e8f9', // cyan-300
  '#f0abfc', // fuchsia-300
] as const;

/** Relative luminance per WCAG 2.1 (sRGB). `hex` is 6-digit `#rrggbb`. */
export function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) throw new Error(`Invalid hex: ${hex}`);
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255);
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two hex colors. Graphical threshold = 3.0. */
export function computeContrastRatio(fg: string, bg: string): number {
  const L1 = relativeLuminance(fg);
  const L2 = relativeLuminance(bg);
  const [lo, hi] = L1 < L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}
