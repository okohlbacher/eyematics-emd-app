import { describe, expect, it } from 'vitest';

import {
  QUALITY_CATEGORY_COLORS,
  type QualityCategory,
} from '../src/utils/qualityMetrics';

describe('QUALITY_CATEGORY_COLORS', () => {
  it('exposes exactly the four QualityCategory keys', () => {
    const expectedKeys: QualityCategory[] = [
      'completeness',
      'dataCompleteness',
      'plausibility',
      'overall',
    ];
    expect(Object.keys(QUALITY_CATEGORY_COLORS).sort()).toEqual(
      [...expectedKeys].sort()
    );
  });

  it('uses muted page-established CSS-var tokens (D-12, D-13)', () => {
    for (const key of Object.keys(QUALITY_CATEGORY_COLORS) as QualityCategory[]) {
      const value = QUALITY_CATEGORY_COLORS[key];
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
      expect(value.startsWith('var(--color-')).toBe(true);
    }
  });

  it('keeps the four series visually distinguishable (D-14)', () => {
    const values = Object.values(QUALITY_CATEGORY_COLORS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
