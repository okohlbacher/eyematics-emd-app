// @vitest-environment node
/**
 * J2 (v1.15-p4) — cohort-trajectory client wrapper.
 *
 * Verifies the synchronous fallback path used whenever a real Worker is
 * unavailable (jsdom/Node test envs + SSR). This is the path tests and SSR take;
 * it must return the SAME TrajectoryResult the synchronous shared functions
 * produce, so the no-worker environment never breaks (constraint: graceful
 * no-worker handling + synchronous fallback).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  computeCohortTrajectory,
  computeCrtTrajectory,
} from '../shared/cohortTrajectory';
import type { PatientCase } from '../shared/types/fhir';
import {
  computeTrajectoryAsync,
  computeTrajectorySync,
  workerAvailable,
} from '../src/components/outcomes/cohortTrajectoryClient';

// Minimal cohort with two visus + two CRT observations across two dates (OD).
function buildCases(): PatientCase[] {
  const mk = (code: string, value: number, date: string) => ({
    resourceType: 'Observation',
    id: `obs-${code}-${date}`,
    code: { coding: [{ system: 'http://loinc.org', code }] },
    valueQuantity: { value, unit: 'decimal' },
    effectiveDateTime: date,
    bodySite: { coding: [{ system: 'http://snomed.info/sct', code: '362503005' }] },
  });
  return [
    {
      id: 'CASE-1',
      pseudonym: 'PSN-1',
      observations: [
        mk('79880-1', 0.8, '2024-01-01'),
        mk('79880-1', 0.6, '2024-03-01'),
        mk('LP267955-5', 300, '2024-01-01'),
        mk('LP267955-5', 280, '2024-03-01'),
      ],
      procedures: [],
    } as unknown as PatientCase,
  ];
}

const input = {
  cases: buildCases(),
  axisMode: 'days' as const,
  yMetric: 'delta' as const,
  gridPoints: 120,
  spreadMode: 'iqr' as const,
};

describe('cohortTrajectoryClient — no-worker environment', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('workerAvailable() is false in the Node/jsdom test environment', () => {
    expect(workerAvailable()).toBe(false);
  });

  it('computeTrajectorySync(visus) matches computeCohortTrajectory', () => {
    expect(computeTrajectorySync('visus', input)).toEqual(computeCohortTrajectory(input));
  });

  it('computeTrajectorySync(crt) matches computeCrtTrajectory', () => {
    expect(computeTrajectorySync('crt', input)).toEqual(computeCrtTrajectory(input));
  });

  it('computeTrajectoryAsync resolves via the synchronous fallback when no Worker exists', async () => {
    const result = await computeTrajectoryAsync('visus', input);
    expect(result).toEqual(computeCohortTrajectory(input));
  });

  it('computeTrajectoryAsync(crt) resolves via the synchronous fallback', async () => {
    const result = await computeTrajectoryAsync('crt', input);
    expect(result).toEqual(computeCrtTrajectory(input));
  });
});
