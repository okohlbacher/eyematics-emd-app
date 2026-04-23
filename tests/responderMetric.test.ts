/** Phase 13 / METRIC-03 — classifyResponders buckets at threshold boundary (logMAR sign convention). */
import { describe, expect,it } from 'vitest';

import { classifyResponders } from '../shared/responderMetric';
import type { PatientCase } from '../shared/types/fhir';

const LOINC_VISUS = '79880-1';

/** Build a case with baseline + year-1 visus observations (decimal values). */
function makeVisusCase(pseudonym: string, byEye: Record<'od' | 'os', Array<{ daysOffset: number; decimal: number }>>): PatientCase {
  const baseline = new Date('2024-01-01');
  const observations = (['od', 'os'] as const).flatMap((eye) =>
    byEye[eye].map((m) => ({
      resourceType: 'Observation' as const,
      code: { coding: [{ system: 'http://loinc.org', code: LOINC_VISUS }] },
      bodySite: { coding: [{ code: eye === 'od' ? '24028007' : '8966001' }] },
      effectiveDateTime: new Date(baseline.getTime() + m.daysOffset * 86400000).toISOString().slice(0, 10),
      valueQuantity: { value: m.decimal, unit: '1' },
    })),
  );
  return { pseudonym, observations, procedures: [] } as unknown as PatientCase;
}

describe('classifyResponders', () => {
  it('returns three buckets with PatientCase[] in each', () => {
    const result = classifyResponders([], 5, 'combined');
    expect(result).toHaveProperty('responder');
    expect(result).toHaveProperty('partial');
    expect(result).toHaveProperty('nonResponder');
    expect(Array.isArray(result.responder)).toBe(true);
  });

  it('classifies a 10-letter improvement as responder (threshold 5)', () => {
    // decimal 0.5 → logMAR 0.30; decimal 0.79 → logMAR ≈ 0.10 (improvement of 0.20 logMAR = 10 letters)
    const cases = [makeVisusCase('P1', {
      od: [{ daysOffset: 0, decimal: 0.5 }, { daysOffset: 365, decimal: 0.79 }],
      os: [],
    })];
    const result = classifyResponders(cases, 5, 'od');
    expect(result.responder.length).toBe(1);
    expect(result.nonResponder.length).toBe(0);
  });

  it('classifies a 10-letter worsening as non-responder', () => {
    // decimal 0.79 → logMAR ≈ 0.10; decimal 0.5 → logMAR 0.30 (delta +0.20 = worsened 10 letters)
    const cases = [makeVisusCase('P1', {
      od: [{ daysOffset: 0, decimal: 0.79 }, { daysOffset: 365, decimal: 0.5 }],
      os: [],
    })];
    const result = classifyResponders(cases, 5, 'od');
    expect(result.nonResponder.length).toBe(1);
    expect(result.responder.length).toBe(0);
  });

  it('classifies a 2-letter change as partial (threshold 5)', () => {
    // Small change (0.04 logMAR = 2 letters) — within partial range
    const cases = [makeVisusCase('P1', {
      od: [{ daysOffset: 0, decimal: 0.5 }, { daysOffset: 365, decimal: 0.55 }],
      os: [],
    })];
    const result = classifyResponders(cases, 5, 'od');
    expect(result.partial.length).toBe(1);
  });

  it('uses measurement closest to day 365 (not first or last)', () => {
    const cases = [makeVisusCase('P1', {
      od: [
        { daysOffset: 0, decimal: 0.5 },
        { daysOffset: 90, decimal: 0.9 },  // big improvement at day 90
        { daysOffset: 365, decimal: 0.5 }, // back to baseline at year 1
        { daysOffset: 500, decimal: 0.9 }, // improvement again later
      ],
      os: [],
    })];
    const result = classifyResponders(cases, 5, 'od');
    // Day-365 measurement = baseline → partial, not responder
    expect(result.partial.length).toBe(1);
  });

  it('filters by eye (os only)', () => {
    const cases = [makeVisusCase('P1', {
      od: [{ daysOffset: 0, decimal: 0.5 }, { daysOffset: 365, decimal: 0.79 }], // responder on OD
      os: [{ daysOffset: 0, decimal: 0.5 }, { daysOffset: 365, decimal: 0.5 }],  // partial on OS
    })];
    const result = classifyResponders(cases, 5, 'os');
    expect(result.partial.length).toBe(1);
    expect(result.responder.length).toBe(0);
  });
});
