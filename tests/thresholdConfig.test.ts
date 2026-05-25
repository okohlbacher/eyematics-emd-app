/**
 * Tests for shared/thresholdConfig.ts — pure validation helpers for
 * clinical thresholds and plausibility ranges (CFG-01 / CFG-02).
 */

import { describe, expect, it } from 'vitest';

import {
  PLAUSIBILITY_DEFAULTS,
  THRESHOLD_DEFAULTS,
  validatePlausibility,
  validateThresholds,
} from '../shared/thresholdConfig';

describe('THRESHOLD_DEFAULTS', () => {
  it('contains all four threshold fields', () => {
    expect(typeof THRESHOLD_DEFAULTS.criticalCrtUm).toBe('number');
    expect(typeof THRESHOLD_DEFAULTS.criticalVisus).toBe('number');
    expect(typeof THRESHOLD_DEFAULTS.criticalIopMmHg).toBe('number');
    expect(typeof THRESHOLD_DEFAULTS.visusJump).toBe('number');
  });

  it('matches production defaults (400, 0.1, 21, 0.3)', () => {
    expect(THRESHOLD_DEFAULTS.criticalCrtUm).toBe(400);
    expect(THRESHOLD_DEFAULTS.criticalVisus).toBe(0.1);
    expect(THRESHOLD_DEFAULTS.criticalIopMmHg).toBe(21);
    expect(THRESHOLD_DEFAULTS.visusJump).toBe(0.3);
  });
});

describe('PLAUSIBILITY_DEFAULTS', () => {
  it('contains all six plausibility fields', () => {
    expect(typeof PLAUSIBILITY_DEFAULTS.visusMin).toBe('number');
    expect(typeof PLAUSIBILITY_DEFAULTS.visusMax).toBe('number');
    expect(typeof PLAUSIBILITY_DEFAULTS.crtMin).toBe('number');
    expect(typeof PLAUSIBILITY_DEFAULTS.crtMax).toBe('number');
    expect(typeof PLAUSIBILITY_DEFAULTS.iopMin).toBe('number');
    expect(typeof PLAUSIBILITY_DEFAULTS.iopMax).toBe('number');
  });

  it('matches production defaults (visus 0..2, crt 100..800, iop 5..40)', () => {
    expect(PLAUSIBILITY_DEFAULTS.visusMin).toBe(0);
    expect(PLAUSIBILITY_DEFAULTS.visusMax).toBe(2.0);
    expect(PLAUSIBILITY_DEFAULTS.crtMin).toBe(100);
    expect(PLAUSIBILITY_DEFAULTS.crtMax).toBe(800);
    expect(PLAUSIBILITY_DEFAULTS.iopMin).toBe(5);
    expect(PLAUSIBILITY_DEFAULTS.iopMax).toBe(40);
  });
});

describe('validateThresholds', () => {
  it('returns ok for production defaults', () => {
    expect(validateThresholds(THRESHOLD_DEFAULTS)).toBe('ok');
  });

  it('returns ok for criticalVisus exactly at max bound (2.0)', () => {
    expect(validateThresholds({ ...THRESHOLD_DEFAULTS, criticalVisus: 2.0 })).toBe('ok');
  });

  it('returns criticalVisusBounds when criticalVisus is <= 0', () => {
    expect(validateThresholds({ ...THRESHOLD_DEFAULTS, criticalVisus: 0 })).toBe('criticalVisusBounds');
  });

  it('returns criticalVisusBounds when criticalVisus is negative', () => {
    expect(validateThresholds({ ...THRESHOLD_DEFAULTS, criticalVisus: -0.1 })).toBe('criticalVisusBounds');
  });

  it('returns criticalVisusBounds when criticalVisus exceeds 2', () => {
    expect(validateThresholds({ ...THRESHOLD_DEFAULTS, criticalVisus: 2.1 })).toBe('criticalVisusBounds');
  });

  it('returns criticalCrtUmPositive when criticalCrtUm <= 0', () => {
    expect(validateThresholds({ ...THRESHOLD_DEFAULTS, criticalCrtUm: 0 })).toBe('criticalCrtUmPositive');
    expect(validateThresholds({ ...THRESHOLD_DEFAULTS, criticalCrtUm: -1 })).toBe('criticalCrtUmPositive');
  });

  it('returns criticalIopMmHgPositive when criticalIopMmHg <= 0', () => {
    expect(validateThresholds({ ...THRESHOLD_DEFAULTS, criticalIopMmHg: 0 })).toBe('criticalIopMmHgPositive');
    expect(validateThresholds({ ...THRESHOLD_DEFAULTS, criticalIopMmHg: -5 })).toBe('criticalIopMmHgPositive');
  });

  it('returns visusJumpPositive when visusJump <= 0', () => {
    expect(validateThresholds({ ...THRESHOLD_DEFAULTS, visusJump: 0 })).toBe('visusJumpPositive');
    expect(validateThresholds({ ...THRESHOLD_DEFAULTS, visusJump: -0.1 })).toBe('visusJumpPositive');
  });

  it('returns non-finite error when a field is NaN', () => {
    const result = validateThresholds({ ...THRESHOLD_DEFAULTS, criticalCrtUm: NaN });
    expect(result).not.toBe('ok');
  });

  it('returns non-finite error when a field is Infinity', () => {
    const result = validateThresholds({ ...THRESHOLD_DEFAULTS, criticalIopMmHg: Infinity });
    expect(result).not.toBe('ok');
  });
});

describe('validatePlausibility', () => {
  it('returns ok for production defaults', () => {
    expect(validatePlausibility(PLAUSIBILITY_DEFAULTS)).toBe('ok');
  });

  it('returns ok when visusMin is exactly 0', () => {
    expect(validatePlausibility({ ...PLAUSIBILITY_DEFAULTS, visusMin: 0 })).toBe('ok');
  });

  it('returns visusMinMax when visusMin >= visusMax', () => {
    expect(validatePlausibility({ ...PLAUSIBILITY_DEFAULTS, visusMin: 2.0, visusMax: 2.0 })).toBe('visusMinMax');
    expect(validatePlausibility({ ...PLAUSIBILITY_DEFAULTS, visusMin: 3.0, visusMax: 2.0 })).toBe('visusMinMax');
  });

  it('returns crtMinMax when crtMin >= crtMax', () => {
    expect(validatePlausibility({ ...PLAUSIBILITY_DEFAULTS, crtMin: 800, crtMax: 800 })).toBe('crtMinMax');
    expect(validatePlausibility({ ...PLAUSIBILITY_DEFAULTS, crtMin: 900, crtMax: 800 })).toBe('crtMinMax');
  });

  it('returns iopMinMax when iopMin >= iopMax', () => {
    expect(validatePlausibility({ ...PLAUSIBILITY_DEFAULTS, iopMin: 40, iopMax: 40 })).toBe('iopMinMax');
    expect(validatePlausibility({ ...PLAUSIBILITY_DEFAULTS, iopMin: 50, iopMax: 40 })).toBe('iopMinMax');
  });

  it('returns negativeBound when visusMin is negative', () => {
    expect(validatePlausibility({ ...PLAUSIBILITY_DEFAULTS, visusMin: -0.1 })).toBe('negativeBound');
  });

  it('returns negativeBound when crtMin is negative', () => {
    expect(validatePlausibility({ ...PLAUSIBILITY_DEFAULTS, crtMin: -1 })).toBe('negativeBound');
  });

  it('returns negativeBound when iopMin is negative', () => {
    expect(validatePlausibility({ ...PLAUSIBILITY_DEFAULTS, iopMin: -1 })).toBe('negativeBound');
  });

  it('returns non-finite error when a bound is NaN', () => {
    const result = validatePlausibility({ ...PLAUSIBILITY_DEFAULTS, crtMax: NaN });
    expect(result).not.toBe('ok');
  });

  it('returns non-finite error when a bound is Infinity', () => {
    const result = validatePlausibility({ ...PLAUSIBILITY_DEFAULTS, iopMax: Infinity });
    expect(result).not.toBe('ok');
  });
});
