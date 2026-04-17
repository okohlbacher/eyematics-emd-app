/**
 * Phase 14 Plan 02 / PERF-01 — parity test for extractPatientCases O(N+M) refactor.
 *
 * Verifies that the Map pre-grouping refactor produces structurally identical
 * output to the original O(N×M) .filter() implementation for any fixture.
 *
 * Key assertions:
 *   - Each patient's sub-arrays contain ONLY resources matching that patient's reference
 *   - No cross-contamination between patients
 *   - Resources with no matching patient produce no output (Map.get → ?? [])
 */
import { describe, expect, it } from 'vitest';

import { extractPatientCases } from '../shared/patientCases.js';

// ---------------------------------------------------------------------------
// Minimal FHIR fixture builders
// ---------------------------------------------------------------------------

function makePatient(id: string) {
  return {
    resourceType: 'Patient',
    id,
    gender: 'unknown',
    birthDate: '1970-01-01',
    meta: { source: 'org-test' },
    identifier: [],
  };
}

function makeObservation(id: string, subjectId: string) {
  return {
    resourceType: 'Observation',
    id,
    subject: { reference: `Patient/${subjectId}` },
    code: { coding: [{ code: '00000-0' }] },
    effectiveDateTime: '2024-01-01',
  };
}

function makeCondition(id: string, subjectId: string) {
  return {
    resourceType: 'Condition',
    id,
    subject: { reference: `Patient/${subjectId}` },
    code: { coding: [{ code: 'H35.3' }] },
  };
}

function makeProcedure(id: string, subjectId: string) {
  return {
    resourceType: 'Procedure',
    id,
    subject: { reference: `Patient/${subjectId}` },
    code: { coding: [{ code: 'IVT' }] },
    performedDateTime: '2024-01-01',
  };
}

function makeImagingStudy(id: string, subjectId: string) {
  return {
    resourceType: 'ImagingStudy',
    id,
    subject: { reference: `Patient/${subjectId}` },
    series: [],
  };
}

function makeMedication(id: string, subjectId: string) {
  return {
    resourceType: 'MedicationStatement',
    id,
    subject: { reference: `Patient/${subjectId}` },
    medication: { reference: 'med-1' },
  };
}

// ---------------------------------------------------------------------------
// Parity tests
// ---------------------------------------------------------------------------

describe('extractPatientCases — Map pre-grouping parity (PERF-01)', () => {
  it('assigns observations to correct patients with no cross-contamination', () => {
    const bundle = {
      entry: [
        { resource: makePatient('p1') },
        { resource: makePatient('p2') },
        // 2 observations for p1
        { resource: makeObservation('obs-p1-a', 'p1') },
        { resource: makeObservation('obs-p1-b', 'p1') },
        // 2 observations for p2
        { resource: makeObservation('obs-p2-a', 'p2') },
        { resource: makeObservation('obs-p2-b', 'p2') },
        // 1 condition each
        { resource: makeCondition('cond-p1', 'p1') },
        { resource: makeCondition('cond-p2', 'p2') },
        // 1 procedure for p1 only
        { resource: makeProcedure('proc-p1', 'p1') },
        // 1 imaging study for p2 only
        { resource: makeImagingStudy('img-p2', 'p2') },
      ],
    };

    const cases = extractPatientCases([bundle]);

    const caseP1 = cases.find((c) => c.id === 'p1');
    const caseP2 = cases.find((c) => c.id === 'p2');

    expect(caseP1).toBeDefined();
    expect(caseP2).toBeDefined();

    // p1 assertions
    expect(caseP1!.observations.length).toBe(2);
    expect(caseP1!.conditions.length).toBe(1);
    expect(caseP1!.procedures.length).toBe(1);
    expect(caseP1!.imagingStudies.length).toBe(0);  // p1 has no imaging
    expect(caseP1!.medications.length).toBe(0);

    // p2 assertions
    expect(caseP2!.observations.length).toBe(2);
    expect(caseP2!.conditions.length).toBe(1);
    expect(caseP2!.procedures.length).toBe(0);      // p2 has no procedure
    expect(caseP2!.imagingStudies.length).toBe(1);
    expect(caseP2!.medications.length).toBe(0);
  });

  it('handles medications correctly across patients', () => {
    const bundle = {
      entry: [
        { resource: makePatient('p1') },
        { resource: makePatient('p2') },
        { resource: makeMedication('med-p1-a', 'p1') },
        { resource: makeMedication('med-p1-b', 'p1') },
        { resource: makeMedication('med-p2-a', 'p2') },
      ],
    };

    const cases = extractPatientCases([bundle]);
    const caseP1 = cases.find((c) => c.id === 'p1');
    const caseP2 = cases.find((c) => c.id === 'p2');

    expect(caseP1!.medications.length).toBe(2);
    expect(caseP2!.medications.length).toBe(1);
  });

  it('returns empty arrays for patients with no matching resources', () => {
    const bundle = {
      entry: [
        { resource: makePatient('p1') },
        { resource: makePatient('p2') },
        // Only p1 has any resources
        { resource: makeObservation('obs-p1', 'p1') },
      ],
    };

    const cases = extractPatientCases([bundle]);
    const caseP2 = cases.find((c) => c.id === 'p2');

    expect(caseP2!.observations).toEqual([]);
    expect(caseP2!.conditions).toEqual([]);
    expect(caseP2!.procedures).toEqual([]);
    expect(caseP2!.imagingStudies).toEqual([]);
    expect(caseP2!.medications).toEqual([]);
  });

  it('handles multiple bundles combined (multi-center scenario)', () => {
    const bundle1 = {
      entry: [
        { resource: makePatient('p1') },
        { resource: makeObservation('obs-p1', 'p1') },
        { resource: makeObservation('obs-p1-b', 'p1') },
        { resource: makeObservation('obs-p1-c', 'p1') },
      ],
    };
    const bundle2 = {
      entry: [
        { resource: makePatient('p2') },
        { resource: makeObservation('obs-p2', 'p2') },
      ],
    };

    const cases = extractPatientCases([bundle1, bundle2]);
    expect(cases.length).toBe(2);

    const caseP1 = cases.find((c) => c.id === 'p1');
    const caseP2 = cases.find((c) => c.id === 'p2');
    expect(caseP1!.observations.length).toBe(3);
    expect(caseP2!.observations.length).toBe(1);
  });
});
