/** Phase 13 / METRIC-01 — computeCrtTrajectory parity with visus and CRT-specific branches. */
import { describe, it, expect } from 'vitest';
// @ts-expect-error — Plan 02 will add this export to shared/cohortTrajectory.ts
import { computeCrtTrajectory } from '../shared/cohortTrajectory';
import type { PatientCase } from '../shared/types/fhir';

const LOINC_CRT = 'LP267955-5';

function makeCase(pseudonym: string, crtByEye: Record<'od' | 'os', Array<{ date: string; um: number }>>): PatientCase {
  const observations = (['od', 'os'] as const).flatMap((eye) =>
    crtByEye[eye].map((m) => ({
      resourceType: 'Observation' as const,
      code: { coding: [{ system: 'http://loinc.org', code: LOINC_CRT }] },
      bodySite: { coding: [{ code: eye === 'od' ? '24028007' : '8966001' }] },
      effectiveDateTime: m.date,
      valueQuantity: { value: m.um, unit: 'um' },
    })),
  );
  return { pseudonym, observations, procedures: [] } as unknown as PatientCase;
}

describe.skip('computeCrtTrajectory', () => {
  it('returns absolute µm values in [0, 800] range for absolute yMetric', () => {
    const cases = [makeCase('P1', {
      od: [{ date: '2024-01-01', um: 300 }, { date: '2024-06-01', um: 250 }],
      os: [{ date: '2024-01-01', um: 310 }, { date: '2024-06-01', um: 260 }],
    })];
    const result = computeCrtTrajectory({ cases, axisMode: 'days', yMetric: 'absolute', gridPoints: 30 });
    expect(result.od.summary.patientCount).toBe(1);
    expect(result.od.medianGrid.every((g: any) => g.y >= 0 && g.y <= 800 || !Number.isFinite(g.y))).toBe(true);
  });

  it('computes delta µm from baseline (improvement = negative delta µm)', () => {
    const cases = [makeCase('P1', {
      od: [{ date: '2024-01-01', um: 400 }, { date: '2024-06-01', um: 300 }],
      os: [],
    })];
    const result = computeCrtTrajectory({ cases, axisMode: 'days', yMetric: 'delta', gridPoints: 30 });
    const nonNaNMedians = result.od.medianGrid.map((g: any) => g.y).filter(Number.isFinite);
    expect(Math.min(...nonNaNMedians)).toBeLessThanOrEqual(0);
  });

  it('computes delta_percent clamped to ±200%', () => {
    const cases = [makeCase('P1', {
      od: [{ date: '2024-01-01', um: 100 }, { date: '2024-06-01', um: 500 }],
      os: [],
    })];
    const result = computeCrtTrajectory({ cases, axisMode: 'days', yMetric: 'delta_percent', gridPoints: 30 });
    const vals = result.od.medianGrid.map((g: any) => g.y).filter(Number.isFinite);
    expect(Math.max(...vals)).toBeLessThanOrEqual(200);
  });

  it('excludes patients with no CRT observations (no LOINC_CRT)', () => {
    const cases = [makeCase('P1', { od: [], os: [] })];
    const result = computeCrtTrajectory({ cases, axisMode: 'days', yMetric: 'absolute', gridPoints: 30 });
    expect(result.od.summary.measurementCount).toBe(0);
  });
});
