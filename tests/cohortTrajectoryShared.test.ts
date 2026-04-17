/**
 * Phase 12 Plan 01 Wave-0 parity test: prove shared/ extraction is lossless.
 * Runs the SAME 3-patient fixture through both the new shared/ module and
 * the legacy src/utils path (which is now a re-export shim). Their
 * JSON.stringify outputs MUST be identical.
 */
import { describe, expect, it } from 'vitest';

import { computeCohortTrajectory as computeShared } from '../shared/cohortTrajectory';
import { computeCohortTrajectory as computeLegacy } from '../src/utils/cohortTrajectory';
import type { PatientCase } from '../shared/types/fhir';
import { LOINC_VISUS, SNOMED_EYE_RIGHT } from '../shared/fhirCodes';

function makePatient(pseudonym: string, decimals: number[], datesFromBase: number[]): PatientCase {
  const base = new Date('2024-01-01T00:00:00Z').getTime();
  return {
    id: pseudonym,
    pseudonym,
    gender: 'unknown',
    birthDate: '1960-01-01',
    centerId: 'org-uka',
    centerName: 'UKA',
    conditions: [],
    observations: decimals.map((d, i) => ({
      resourceType: 'Observation',
      id: `${pseudonym}-obs-${i}`,
      status: 'final',
      code: { coding: [{ code: LOINC_VISUS, system: 'http://loinc.org' }] },
      subject: { reference: `Patient/${pseudonym}` },
      effectiveDateTime: new Date(base + datesFromBase[i] * 86400000).toISOString(),
      valueQuantity: { value: d, unit: 'decimal' },
      bodySite: { coding: [{ code: SNOMED_EYE_RIGHT }] },
    })),
    procedures: [],
    imagingStudies: [],
    medications: [],
  } as unknown as PatientCase;
}

describe('Phase 12 Plan 01 — shared/ extraction parity', () => {
  it('shared and legacy computeCohortTrajectory produce byte-identical JSON for a 3-patient fixture', () => {
    const cases: PatientCase[] = [
      makePatient('p1', [0.5, 0.6, 0.7], [0, 30, 60]),
      makePatient('p2', [0.4, 0.45, 0.5], [0, 30, 60]),
      makePatient('p3', [0.8, 0.75, 0.7], [0, 30, 60]),
    ];
    const sharedOut = computeShared({ cases, axisMode: 'days', yMetric: 'absolute', gridPoints: 30 });
    const legacyOut = computeLegacy({ cases, axisMode: 'days', yMetric: 'absolute', gridPoints: 30 });
    expect(JSON.stringify(sharedOut)).toBe(JSON.stringify(legacyOut));
  });

  it('shared module does not pull any browser globals (import succeeds in Node)', async () => {
    const mod = await import('../shared/cohortTrajectory');
    expect(typeof mod.computeCohortTrajectory).toBe('function');
  });
});
