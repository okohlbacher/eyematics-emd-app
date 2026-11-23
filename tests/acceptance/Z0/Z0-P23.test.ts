// Z0-P23 — pure-logic checks behind "Achsenbeschriftungen der Verläufe zeigen gerundete Werte" and "Einheitliches
// Zahlenformat in Aggregiert, Verläufe und Einzelfallansicht" (acceptance/Z0/Z0-P23.feature; Q41, Q42) for the cases the
// Playwright scenarios cannot reach with the synthetic data: zoomed and short x ranges (treatment counts), and the
// fixed bin labels of the case-view distributions.
import { describe, expect, it } from 'vitest';

import { chartNumberFormat, localizeDecimals, niceTicks } from '../../../src/components/charts/chartStyle';

const NICE = [1, 2, 2.5, 5];
function stepOf(ticks: number[]): number {
  return ticks[1] - ticks[0];
}
function isNice(step: number): boolean {
  const exp = Math.floor(Math.log10(step));
  return NICE.some((m) => Math.abs(step / 10 ** exp - m) < 1e-9);
}

describe('[Z0-P23] Achsenbeschriftungen der Verläufe zeigen gerundete Werte', () => {
  it('x ticks (minStep 1) are whole numbers on an integer step for every span, incl. zoomed and treatment axes', () => {
    for (const [lo, hi] of [[0, 12], [3, 14], [-5, 986.6], [10, 12], [0, 3], [-30, 1095], [7.4, 19.9]]) {
      const ticks = niceTicks(lo, hi, 6, 1);
      expect(ticks.length, `${lo}..${hi}`).toBeGreaterThan(0);
      for (const v of ticks) expect(Number.isInteger(v), `${lo}..${hi}: ${v}`).toBe(true);
      if (ticks.length > 1) {
        expect(Number.isInteger(stepOf(ticks)), `${lo}..${hi} step`).toBe(true);
        expect(isNice(stepOf(ticks)), `${lo}..${hi} step`).toBe(true);
      }
      for (const v of ticks) expect(v >= lo - 1e-9 && v <= hi + 1e-9, `${lo}..${hi}: ${v} inside`).toBe(true);
    }
  });

  it('y ticks lie on one step of 1, 2, 2.5 or 5 × 10^n with at most 2 decimals', () => {
    for (const [lo, hi] of [[-113.4, 113.4], [-1, 1], [0, 1], [0, 800], [-11.5, 11.5], [-0.37, 0.41], [-1043, 1043]]) {
      const ticks = niceTicks(lo, hi, 5);
      expect(ticks.length, `${lo}..${hi}`).toBeGreaterThan(1);
      const step = stepOf(ticks);
      expect(isNice(step), `${lo}..${hi} step ${step}`).toBe(true);
      for (let i = 1; i < ticks.length; i++) expect(Math.abs(ticks[i] - ticks[i - 1] - step)).toBeLessThan(1e-9);
      for (const v of ticks) {
        expect(Math.abs(v / step - Math.round(v / step))).toBeLessThan(1e-9);
        expect((String(v).split('.')[1] ?? '').length).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe('[Z0-P23] Einheitliches Zahlenformat in Aggregiert, Verläufe und Einzelfallansicht', () => {
  it('German uses a decimal comma, English a decimal point, neither groups digits', () => {
    expect(chartNumberFormat('de', 2)(0.5)).toBe('0,5');
    expect(chartNumberFormat('en', 2)(0.5)).toBe('0.5');
    expect(chartNumberFormat('de', 2, 2)(0.22)).toBe('0,22');
    expect(chartNumberFormat('de', 2)(9.8)).toBe('9,8');
    expect(chartNumberFormat('de', 2)(1000)).toBe('1000');
    expect(chartNumberFormat('en', 2)(1000)).toBe('1000');
  });

  it('fixed bin labels follow the locale', () => {
    expect(localizeDecimals('0.2–0.4', 'de')).toBe('0,2–0,4');
    expect(localizeDecimals('0.2–0.4', 'en')).toBe('0.2–0.4');
    expect(localizeDecimals('>400', 'de')).toBe('>400');
  });
});
