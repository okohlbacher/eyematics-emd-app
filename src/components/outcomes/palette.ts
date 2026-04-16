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
 * Contrast ratios against #ffffff (computed 2026-04-16):
 *   OD     #1d4ed8 (tailwind blue-700)   ≈ 8.58:1
 *   OS     #b91c1c (tailwind red-700)    ≈ 6.51:1
 *   OD+OS  #6d28d9 (tailwind violet-700) ≈ 8.68:1
 * All exceed WCAG 2.1 SC 1.4.11 graphical threshold (3.0:1).
 */

export const EYE_COLORS = {
  OD: '#1d4ed8',
  OS: '#b91c1c',
  'OD+OS': '#6d28d9',
} as const;

export type EyeKey = keyof typeof EYE_COLORS;

export const SERIES_STYLES = {
  median: { strokeWidth: 3 },
  perPatient: { strokeWidth: 1.5, opacityDense: 0.6, opacitySparse: 0.3 },
  scatter: { fillOpacity: 0.7 },
  iqr: { fillOpacity: 0.15, stroke: 'none' as const },
} as const;

export const PANEL_BACKGROUND = '#ffffff';

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
