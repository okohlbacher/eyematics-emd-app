/** Phase 13 / METRIC-02 — computeIntervalDistribution buckets injection gaps. */
import { describe, it, expect } from 'vitest';
import { computeIntervalDistribution } from '../shared/intervalMetric';
import type { PatientCase } from '../shared/types/fhir';

const SNOMED_IVI = '36189003';

function makeCaseWithIvi(pseudonym: string, dates: Array<{ date: string; eye: 'od' | 'os' }>): PatientCase {
  const procedures = dates.map((d) => ({
    resourceType: 'Procedure' as const,
    code: { coding: [{ system: 'http://snomed.info/sct', code: SNOMED_IVI }] },
    bodySite: { coding: [{ code: d.eye === 'od' ? '24028007' : '8966001' }] },
    performedDateTime: d.date,
  }));
  return { pseudonym, observations: [], procedures } as unknown as PatientCase;
}

describe('computeIntervalDistribution', () => {
  it('returns 6 bins with correct labels', () => {
    const result = computeIntervalDistribution([], 'combined');
    expect(result.bins.map((b: any) => b.label)).toEqual(['0–30d', '30–60d', '60–90d', '90–120d', '120–180d', '180+d']);
  });

  it('buckets a 45-day gap into the 30–60d bin', () => {
    const cases = [makeCaseWithIvi('P1', [
      { date: '2024-01-01', eye: 'od' },
      { date: '2024-02-15', eye: 'od' }, // 45 days later
    ])];
    const result = computeIntervalDistribution(cases, 'od');
    const bin30_60 = result.bins.find((b: any) => b.label === '30–60d');
    expect(bin30_60?.count).toBe(1);
  });

  it('computes median gap across all patients', () => {
    const cases = [makeCaseWithIvi('P1', [
      { date: '2024-01-01', eye: 'od' },
      { date: '2024-02-01', eye: 'od' }, // 31 days
      { date: '2024-04-01', eye: 'od' }, // 60 days
      { date: '2024-07-01', eye: 'od' }, // 91 days
    ])];
    const result = computeIntervalDistribution(cases, 'od');
    expect(result.medianGap).toBe(60);
  });

  it('filters by eye when eye=os', () => {
    const cases = [makeCaseWithIvi('P1', [
      { date: '2024-01-01', eye: 'od' },
      { date: '2024-02-15', eye: 'od' },
      { date: '2024-01-01', eye: 'os' },
      { date: '2024-03-15', eye: 'os' }, // 74 days
    ])];
    const result = computeIntervalDistribution(cases, 'os');
    const bin60_90 = result.bins.find((b: any) => b.label === '60–90d');
    expect(bin60_90?.count).toBe(1);
    expect(result.bins.reduce((s: number, b: any) => s + b.count, 0)).toBe(1);
  });

  it('skips patients with fewer than 2 IVI procedures', () => {
    const cases = [makeCaseWithIvi('P1', [{ date: '2024-01-01', eye: 'od' }])];
    const result = computeIntervalDistribution(cases, 'od');
    expect(result.bins.every((b: any) => b.count === 0)).toBe(true);
  });

  it('180+d bin captures 200-day gap', () => {
    const cases = [makeCaseWithIvi('P1', [
      { date: '2024-01-01', eye: 'od' },
      { date: '2024-07-19', eye: 'od' }, // 200 days
    ])];
    const result = computeIntervalDistribution(cases, 'od');
    const binPlus = result.bins.find((b: any) => b.label === '180+d');
    expect(binPlus?.count).toBe(1);
  });
});
