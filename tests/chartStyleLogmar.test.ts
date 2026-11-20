/**
 * Z0-P23 (Q31) — logMAR helpers of the case-view Visus/CRT chart: the "Visus Ø" mean is the mean of logMAR values
 * (not the logMAR of the decimal mean) and the IQR band bounds swap on conversion.
 */
import { describe, expect, it } from 'vitest';

import { decimalToLogmar, meanLogmar, toLogmarRow } from '../src/components/charts/chartStyle';

describe('logMAR helpers (Z0-P23, Q31)', () => {
  it('converts decimal Visus to logMAR and has no value for ≤ 0', () => {
    expect(decimalToLogmar(1)).toBeCloseTo(0, 10);
    expect(decimalToLogmar(0.1)).toBeCloseTo(1, 10);
    expect(decimalToLogmar(0)).toBeNull();
    expect(decimalToLogmar(-0.2)).toBeNull();
  });

  it('"Visus Ø" = mean of the logMAR values, values ≤ 0 left out', () => {
    // decimal 1.0 → 0.0 and 0.1 → 1.0: mean logMAR 0.5 (the logMAR of the decimal mean 0.55 would be ≈ 0.26).
    expect(meanLogmar([1, 0.1, 0])).toBeCloseTo(0.5, 10);
    expect(meanLogmar([])).toBe(0);
  });

  it('converts patient value, median and band; the band bounds swap', () => {
    const row = toLogmarRow({ date: '2024-01-01', visus: 0.5, visusMedian: 1, visusBand: [0.1, 1] as [number, number], crt: 300 });
    expect(row.visus).toBeCloseTo(0.301, 3);
    expect(row.visusMedian).toBeCloseTo(0, 10);
    expect(row.visusBand![0]).toBeCloseTo(0, 10);
    expect(row.visusBand![1]).toBeCloseTo(1, 10);
    expect(row.crt).toBe(300);
  });
});
