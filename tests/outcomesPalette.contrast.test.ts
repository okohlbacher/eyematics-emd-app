/**
 * VQA-02 / D-02: WCAG AA contrast gate for outcomes chart palette.
 *
 * Scope: light mode only (panel background #ffffff).
 * Dark mode deferred per .planning/phases/10-visual-ux-qa-preview-stability/10-CONTEXT.md §Deferred.
 * Threshold: >= 3.0 (WCAG 2.1 SC 1.4.11 graphical elements).
 */
import { describe, expect, it } from 'vitest';

import {
  computeContrastRatio,
  DARK_COHORT_PALETTES,
  DARK_EYE_COLORS,
  EYE_COLORS,
  PANEL_BACKGROUND,
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

const DARK_BG = '#111827';
const WCAG_AA_TEXT = 4.5;
const WCAG_GRAPHICAL = 3.0;

describe('DARK_EYE_COLORS WCAG AA text contrast vs #111827', () => {
  for (const [key, hex] of Object.entries(DARK_EYE_COLORS)) {
    it(`DARK_EYE_COLORS['${key}']=${hex} ratio >= 4.5`, () => {
      expect(computeContrastRatio(hex as string, DARK_BG)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
  }
});

describe('DARK_COHORT_PALETTES WCAG graphical contrast vs #111827', () => {
  DARK_COHORT_PALETTES.forEach((hex, i) => {
    it(`DARK_COHORT_PALETTES[${i}]=${hex} ratio >= 3.0`, () => {
      expect(computeContrastRatio(hex, DARK_BG)).toBeGreaterThanOrEqual(WCAG_GRAPHICAL);
    });
  });
});
