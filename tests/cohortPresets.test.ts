/**
 * tests/cohortPresets.test.ts — pure-function unit tests for applyFilters
 * preset predicates (Task 2a) and advanced-attribute predicates (Task 2b).
 *
 * No jsdom, no browser APIs — plain Vitest with inline PatientCase fixtures.
 */
import { describe, expect, it } from 'vitest';

import { applyFilters } from '../shared/patientCases.js';
import type { CohortFilter, PatientCase } from '../shared/types/fhir.js';

// ---------------------------------------------------------------------------
// Minimal PatientCase factory helpers
// ---------------------------------------------------------------------------

function makeCase(id: string, overrides: Partial<PatientCase> = {}): PatientCase {
  return {
    id,
    pseudonym: id,
    gender: 'male',
    birthDate: '1960-01-01',
    centerId: 'CENTER-A',
    centerName: 'Test Center',
    conditions: [],
    observations: [],
    procedures: [],
    imagingStudies: [],
    medications: [],
    ...overrides,
  };
}

function makeObservation(code: string, value: number | null, date = '2024-01-01') {
  return {
    resourceType: 'Observation' as const,
    id: `obs-${code}-${date}`,
    status: 'final',
    subject: { reference: 'Patient/x' },
    code: { coding: [{ code }] },
    effectiveDateTime: date,
    ...(value !== null ? { valueQuantity: { value, unit: '' } } : {}),
  };
}

function makeProcedureIVI(date: string) {
  return {
    resourceType: 'Procedure' as const,
    id: `proc-${date}`,
    status: 'completed',
    subject: { reference: 'Patient/x' },
    code: { coding: [{ code: '36189003' }] }, // SNOMED_IVI
    performedDateTime: date,
  };
}

// ---------------------------------------------------------------------------
// Task 2a — Preset predicates (4 presets + no-preset passthrough)
// ---------------------------------------------------------------------------

describe('applyFilters — preset predicates', () => {
  // ---------------------------------------------------------------------------
  // therapyBreaker
  // ---------------------------------------------------------------------------
  describe('preset: therapyBreaker', () => {
    // A "breaker" has a max gap > breakerDays (default 365)
    // Build a case with two injections more than 365 days apart
    const breakerCase = makeCase('breaker-1', {
      procedures: [
        makeProcedureIVI('2020-01-01'),
        makeProcedureIVI('2021-06-01'), // gap ~516 days > 365
      ],
    });
    // A case with < 2 injections → active
    const activeCase = makeCase('active-1', {
      procedures: [
        makeProcedureIVI('2024-01-01'),
      ],
    });
    // A case with two very recent injections ~60 days apart → active (gap < 120, lastToNow < 120)
    const activeCase2 = makeCase('active-2', {
      procedures: [
        makeProcedureIVI('2026-03-01'),
        makeProcedureIVI('2026-05-01'), // gap ~61 days; lastToNow ~21 days from 2026-05-22 → max gap ~61 < 120
      ],
    });

    it('returns only breaker cases', () => {
      const filters: CohortFilter = { preset: 'therapyBreaker' };
      const options = { therapyInterrupterDays: 120, therapyBreakerDays: 365, crtImplausibleThresholdUm: 400 };
      const result = applyFilters([breakerCase, activeCase, activeCase2], filters, options);
      expect(result.map((c) => c.id)).toEqual(['breaker-1']);
    });
  });

  // ---------------------------------------------------------------------------
  // implausibleCrt
  // ---------------------------------------------------------------------------
  describe('preset: implausibleCrt', () => {
    const highCrtCase = makeCase('high-crt-1', {
      observations: [makeObservation('LP267955-5', 450)], // > threshold 400
    });
    const normalCrtCase = makeCase('normal-crt-1', {
      observations: [makeObservation('LP267955-5', 300)], // <= threshold 400
    });
    const noCrtCase = makeCase('no-crt-1', {
      observations: [],
    });

    it('returns only cases with CRT above threshold', () => {
      const filters: CohortFilter = { preset: 'implausibleCrt' };
      const options = { therapyInterrupterDays: 120, therapyBreakerDays: 365, crtImplausibleThresholdUm: 400 };
      const result = applyFilters([highCrtCase, normalCrtCase, noCrtCase], filters, options);
      expect(result.map((c) => c.id)).toEqual(['high-crt-1']);
    });

    it('respects custom crtImplausibleThresholdUm in options', () => {
      const filters: CohortFilter = { preset: 'implausibleCrt' };
      const options = { therapyInterrupterDays: 120, therapyBreakerDays: 365, crtImplausibleThresholdUm: 200 };
      const result = applyFilters([highCrtCase, normalCrtCase, noCrtCase], filters, options);
      // both 450 and 300 exceed 200
      expect(result.map((c) => c.id)).toEqual(['high-crt-1', 'normal-crt-1']);
    });
  });

  // ---------------------------------------------------------------------------
  // flaggedQuality
  // ---------------------------------------------------------------------------
  describe('preset: flaggedQuality', () => {
    const caseA = makeCase('case-A');
    const caseB = makeCase('case-B');
    const caseC = makeCase('case-C');

    it('returns only cases whose id is in flaggedCaseIds Set', () => {
      const filters: CohortFilter = {
        preset: 'flaggedQuality',
        flaggedCaseIds: new Set(['case-A', 'case-C']),
      };
      const result = applyFilters([caseA, caseB, caseC], filters);
      expect(result.map((c) => c.id)).toEqual(['case-A', 'case-C']);
    });

    it('returns empty when flaggedCaseIds is empty set', () => {
      const filters: CohortFilter = {
        preset: 'flaggedQuality',
        flaggedCaseIds: new Set(),
      };
      const result = applyFilters([caseA, caseB], filters);
      expect(result.map((c) => c.id)).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // implausibleVisus
  // ---------------------------------------------------------------------------
  describe('preset: implausibleVisus', () => {
    const outOfRangeCase = makeCase('out-of-range-1', {
      observations: [makeObservation('79880-1', 1.5)], // > 1
    });
    const negativeCase = makeCase('negative-1', {
      observations: [makeObservation('79880-1', -0.1)], // < 0
    });
    const validCase = makeCase('valid-1', {
      observations: [makeObservation('79880-1', 0.5)], // within 0-1
    });
    const nullVisusCase = makeCase('null-visus-1', {
      observations: [], // no visus observation
    });

    it('returns cases with visus outside 0-1 range or missing', () => {
      const filters: CohortFilter = { preset: 'implausibleVisus' };
      const result = applyFilters([outOfRangeCase, negativeCase, validCase, nullVisusCase], filters);
      expect(result.map((c) => c.id)).toEqual(['out-of-range-1', 'negative-1', 'null-visus-1']);
    });

    it('excludes case with visus exactly 0', () => {
      const zeroCase = makeCase('zero-visus', {
        observations: [makeObservation('79880-1', 0)],
      });
      const filters: CohortFilter = { preset: 'implausibleVisus' };
      const result = applyFilters([zeroCase], filters);
      expect(result.map((c) => c.id)).toEqual([]);
    });

    it('excludes case with visus exactly 1', () => {
      const oneCase = makeCase('one-visus', {
        observations: [makeObservation('79880-1', 1)],
      });
      const filters: CohortFilter = { preset: 'implausibleVisus' };
      const result = applyFilters([oneCase], filters);
      expect(result.map((c) => c.id)).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // No preset — existing range filters unaffected (passthrough)
  // ---------------------------------------------------------------------------
  describe('no preset — existing filters unaffected', () => {
    it('passes all cases when filters is empty', () => {
      const cases = [makeCase('a'), makeCase('b'), makeCase('c')];
      const result = applyFilters(cases, {});
      expect(result.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    });

    it('still filters by centers when no preset', () => {
      const caseA = makeCase('a', { centerId: 'CENTER-A' });
      const caseB = makeCase('b', { centerId: 'CENTER-B' });
      const filters: CohortFilter = { centers: ['CENTER-A'] };
      const result = applyFilters([caseA, caseB], filters);
      expect(result.map((c) => c.id)).toEqual(['a']);
    });
  });
});

// ---------------------------------------------------------------------------
// Task 2b — Advanced-attribute predicates (5 attributes)
// ---------------------------------------------------------------------------

describe('applyFilters — advanced-attribute predicates', () => {
  // ---------------------------------------------------------------------------
  // hba1cRange
  // ---------------------------------------------------------------------------
  describe('hba1cRange', () => {
    const inRangeCase = makeCase('hba1c-in-range', {
      observations: [makeObservation('4548-4', 7.0)], // within [6,8]
    });
    const outRangeCase = makeCase('hba1c-out-range', {
      observations: [makeObservation('4548-4', 9.0)], // outside [6,8]
    });
    const noHba1cCase = makeCase('hba1c-missing', {
      observations: [],
    });

    it('returns only cases with HbA1c within range [6,8]', () => {
      const filters: CohortFilter = { hba1cRange: [6, 8] };
      const result = applyFilters([inRangeCase, outRangeCase, noHba1cCase], filters);
      expect(result.map((c) => c.id)).toEqual(['hba1c-in-range']);
    });
  });

  // ---------------------------------------------------------------------------
  // hasComorbidity
  // ---------------------------------------------------------------------------
  describe('hasComorbidity', () => {
    // A comorbidity is a Condition with a code that is neither SNOMED_AMD (267718000) nor SNOMED_DR (312898008)
    const comorbidityCaseOnly = makeCase('comorbidity-only', {
      conditions: [
        {
          resourceType: 'Condition',
          id: 'cond-1',
          subject: { reference: 'Patient/x' },
          code: { coding: [{ code: '73211009' }] }, // diabetes — not AMD or DR
        },
      ],
    });
    const primaryOnlyCase = makeCase('primary-only', {
      conditions: [
        {
          resourceType: 'Condition',
          id: 'cond-2',
          subject: { reference: 'Patient/x' },
          code: { coding: [{ code: '267718000' }] }, // AMD only
        },
      ],
    });
    const mixedCase = makeCase('mixed', {
      conditions: [
        {
          resourceType: 'Condition',
          id: 'cond-3',
          subject: { reference: 'Patient/x' },
          code: { coding: [{ code: '267718000' }] }, // AMD
        },
        {
          resourceType: 'Condition',
          id: 'cond-4',
          subject: { reference: 'Patient/x' },
          code: { coding: [{ code: '44054006' }] }, // type 2 diabetes — comorbidity
        },
      ],
    });

    it('returns only cases having a non-AMD/non-DR condition when hasComorbidity=true', () => {
      const filters: CohortFilter = { hasComorbidity: true };
      const result = applyFilters([comorbidityCaseOnly, primaryOnlyCase, mixedCase], filters);
      expect(result.map((c) => c.id)).toEqual(['comorbidity-only', 'mixed']);
    });

    it('does not filter when hasComorbidity is not set', () => {
      const filters: CohortFilter = {};
      const result = applyFilters([comorbidityCaseOnly, primaryOnlyCase], filters);
      expect(result.map((c) => c.id)).toEqual(['comorbidity-only', 'primary-only']);
    });
  });

  // ---------------------------------------------------------------------------
  // laterality
  // ---------------------------------------------------------------------------
  describe('laterality', () => {
    // SNOMED_EYE_RIGHT = '362503005', SNOMED_EYE_RIGHT_ALT = '24028007'
    // SNOMED_EYE_LEFT = '362502000', SNOMED_EYE_LEFT_ALT = '8966001'
    const rightEyeCase = makeCase('right-eye', {
      conditions: [
        {
          resourceType: 'Condition',
          id: 'cond-r',
          subject: { reference: 'Patient/x' },
          code: { coding: [{ code: '267718000' }] },
          bodySite: [{ coding: [{ code: '362503005' }] }], // primary right
        },
      ],
    });
    const rightEyeAltCase = makeCase('right-eye-alt', {
      conditions: [
        {
          resourceType: 'Condition',
          id: 'cond-r-alt',
          subject: { reference: 'Patient/x' },
          code: { coding: [{ code: '267718000' }] },
          bodySite: [{ coding: [{ code: '24028007' }] }], // ALT right
        },
      ],
    });
    const leftEyeCase = makeCase('left-eye', {
      conditions: [
        {
          resourceType: 'Condition',
          id: 'cond-l',
          subject: { reference: 'Patient/x' },
          code: { coding: [{ code: '267718000' }] },
          bodySite: [{ coding: [{ code: '362502000' }] }], // primary left
        },
      ],
    });
    const leftEyeAltCase = makeCase('left-eye-alt', {
      conditions: [
        {
          resourceType: 'Condition',
          id: 'cond-l-alt',
          subject: { reference: 'Patient/x' },
          code: { coding: [{ code: '267718000' }] },
          bodySite: [{ coding: [{ code: '8966001' }] }], // ALT left
        },
      ],
    });
    const noBodySiteCase = makeCase('no-bodysite', {
      conditions: [
        {
          resourceType: 'Condition',
          id: 'cond-none',
          subject: { reference: 'Patient/x' },
          code: { coding: [{ code: '267718000' }] },
          // no bodySite
        },
      ],
    });

    it('OD returns only right-eye cases (primary + alt)', () => {
      const filters: CohortFilter = { laterality: 'OD' };
      const result = applyFilters(
        [rightEyeCase, rightEyeAltCase, leftEyeCase, leftEyeAltCase, noBodySiteCase],
        filters,
      );
      expect(result.map((c) => c.id)).toEqual(['right-eye', 'right-eye-alt']);
    });

    it('OS returns only left-eye cases (primary + alt)', () => {
      const filters: CohortFilter = { laterality: 'OS' };
      const result = applyFilters(
        [rightEyeCase, rightEyeAltCase, leftEyeCase, leftEyeAltCase, noBodySiteCase],
        filters,
      );
      expect(result.map((c) => c.id)).toEqual(['left-eye', 'left-eye-alt']);
    });

    it('OU applies no laterality narrowing (all cases pass)', () => {
      const filters: CohortFilter = { laterality: 'OU' };
      const result = applyFilters(
        [rightEyeCase, rightEyeAltCase, leftEyeCase, leftEyeAltCase, noBodySiteCase],
        filters,
      );
      expect(result.map((c) => c.id)).toEqual([
        'right-eye',
        'right-eye-alt',
        'left-eye',
        'left-eye-alt',
        'no-bodysite',
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // medicationCodes
  // ---------------------------------------------------------------------------
  describe('medicationCodes', () => {
    const afliberceptCase = makeCase('aflibercept-case', {
      medications: [
        {
          resourceType: 'MedicationStatement',
          id: 'med-1',
          status: 'completed',
          subject: { reference: 'Patient/x' },
          medicationCodeableConcept: { coding: [{ code: 'S01LA05' }] }, // Aflibercept
        },
      ],
    });
    const bevacizumabCase = makeCase('bevacizumab-case', {
      medications: [
        {
          resourceType: 'MedicationStatement',
          id: 'med-2',
          status: 'completed',
          subject: { reference: 'Patient/x' },
          medicationCodeableConcept: { coding: [{ code: 'L01XC07' }] }, // Bevacizumab
        },
      ],
    });
    const noMedCase = makeCase('no-med', { medications: [] });

    it('returns only cases with a matching medication code', () => {
      const filters: CohortFilter = { medicationCodes: ['S01LA05'] };
      const result = applyFilters([afliberceptCase, bevacizumabCase, noMedCase], filters);
      expect(result.map((c) => c.id)).toEqual(['aflibercept-case']);
    });

    it('returns cases matching any of the selected codes', () => {
      const filters: CohortFilter = { medicationCodes: ['S01LA05', 'L01XC07'] };
      const result = applyFilters([afliberceptCase, bevacizumabCase, noMedCase], filters);
      expect(result.map((c) => c.id)).toEqual(['aflibercept-case', 'bevacizumab-case']);
    });
  });

  // ---------------------------------------------------------------------------
  // diagnosisSubtype
  // ---------------------------------------------------------------------------
  describe('diagnosisSubtype', () => {
    const subtypeYCase = makeCase('subtype-Y', {
      conditions: [
        {
          resourceType: 'Condition',
          id: 'cond-y',
          subject: { reference: 'Patient/x' },
          code: { coding: [{ code: 'Y' }] },
        },
      ],
    });
    const subtypeZCase = makeCase('subtype-Z', {
      conditions: [
        {
          resourceType: 'Condition',
          id: 'cond-z',
          subject: { reference: 'Patient/x' },
          code: { coding: [{ code: 'Z' }] },
        },
      ],
    });
    const noSubtypeCase = makeCase('no-subtype', { conditions: [] });

    it('returns only cases whose condition codes include the selected subtype', () => {
      const filters: CohortFilter = { diagnosisSubtype: ['Y'] };
      const result = applyFilters([subtypeYCase, subtypeZCase, noSubtypeCase], filters);
      expect(result.map((c) => c.id)).toEqual(['subtype-Y']);
    });

    it('returns cases matching any of the selected subtypes', () => {
      const filters: CohortFilter = { diagnosisSubtype: ['Y', 'Z'] };
      const result = applyFilters([subtypeYCase, subtypeZCase, noSubtypeCase], filters);
      expect(result.map((c) => c.id)).toEqual(['subtype-Y', 'subtype-Z']);
    });
  });
});
