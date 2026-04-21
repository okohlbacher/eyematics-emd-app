/**
 * VQA-02 / D-02: WCAG AA contrast gate for outcomes chart palette.
 *
 * Scope: light mode only (panel background #ffffff).
 * Dark mode deferred per .planning/phases/10-visual-ux-qa-preview-stability/10-CONTEXT.md §Deferred.
 * Threshold: >= 3.0 (WCAG 2.1 SC 1.4.11 graphical elements).
 */
import { describe, expect, it } from 'vitest';

import {
  COHORT_PALETTES,
  EYE_COLORS,
  PANEL_BACKGROUND,
  SERIES_STYLES,
  computeContrastRatio,
  relativeLuminance,
} from '../src/components/outcomes/palette';

describe('palette — WCAG sanity references', () => {
  it('relativeLuminance(#ffffff) ≈ 1.0', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1.0, 3);
  });
  it('relativeLuminance(#000000) ≈ 0.0', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0.0, 3);
  });
  it('computeContrastRatio(#000000, #ffffff) ≈ 21.0', () => {
    expect(computeContrastRatio('#000000', '#ffffff')).toBeCloseTo(21.0, 1);
  });
});

describe('COHORT_PALETTES (Phase 16 / XCOHORT-02)', () => {
  it('exports exactly 4 colors', () => {
    expect(COHORT_PALETTES).toHaveLength(4);
  });
  it('all entries pass WCAG 3:1 vs #ffffff', () => {
    for (const hex of COHORT_PALETTES) {
      expect(computeContrastRatio(hex, '#ffffff')).toBeGreaterThanOrEqual(3.0);
    }
  });
  it('does not overlap EYE_COLORS', () => {
    const eyes = new Set(Object.values(EYE_COLORS));
    for (const hex of COHORT_PALETTES) expect(eyes.has(hex)).toBe(false);
  });
  it('contains the 4 locked hex values in order', () => {
    expect(COHORT_PALETTES).toEqual(['#047857', '#b45309', '#0e7490', '#a21caf']);
  });
});

describe('SERIES_STYLES VIS-04 changes (D-09)', () => {
  it('perPatient uses neutral gray #9ca3af', () => {
    expect(SERIES_STYLES.perPatient.color).toBe('#9ca3af');
  });
  it('perPatient opacity is 0.22 / 0.12', () => {
    expect(SERIES_STYLES.perPatient.opacityDense).toBe(0.22);
    expect(SERIES_STYLES.perPatient.opacitySparse).toBe(0.12);
  });
  it('median strokeWidth is 4', () => {
    expect(SERIES_STYLES.median.strokeWidth).toBe(4);
  });
});

describe('EYE_COLORS WCAG AA contrast against panel background', () => {
  const WCAG_AA_GRAPHICAL = 3.0;

  for (const [key, hex] of Object.entries(EYE_COLORS)) {
    it(`EYE_COLORS['${key}']=${hex} contrast vs ${PANEL_BACKGROUND} is ≥ ${WCAG_AA_GRAPHICAL}`, () => {
      const ratio = computeContrastRatio(hex, PANEL_BACKGROUND);
      expect(
        ratio,
        `EYE_COLORS['${key}']=${hex} → ratio ${ratio.toFixed(2)} < ${WCAG_AA_GRAPHICAL}`,
      ).toBeGreaterThanOrEqual(WCAG_AA_GRAPHICAL);
    });
  }
});
