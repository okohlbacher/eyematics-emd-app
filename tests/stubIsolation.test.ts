/**
 * Phase 34 Plan 01 / Wave 0 scaffold: D-03 stub-exclusion regression
 * and D-04 patientCount accuracy.
 *
 * These tests are INTENTIONALLY RED until Plan 02 lands:
 *   - extractPatientCases stub-filter (D-03)
 *   - extractCenters patientCount fix (D-04)
 *
 * They will turn green once Plan 02 inserts the filters at the
 * single chokepoint in shared/patientCases.ts and src/services/fhirLoader.ts.
 */
import { describe, expect, it } from 'vitest';

import { countRawPatients, extractCenters } from '../src/services/fhirLoader';
import { extractPatientCases } from '../shared/patientCases';
import type { FhirBundle } from '../shared/types/fhir';

// ---------------------------------------------------------------------------
// Minimal in-memory fixture bundle
// One Organization, one full Patient (has an Observation), one stub Patient (no Observations).
// ---------------------------------------------------------------------------
const bundle: FhirBundle = {
  resourceType: 'Bundle',
  type: 'collection',
  entry: [
    {
      resource: {
        resourceType: 'Organization',
        id: 'org-test',
        name: 'Test Org',
        address: [{ city: 'Testcity', state: 'TS' }],
      },
    },
    {
      resource: {
        resourceType: 'Patient',
        id: 'pat-full-001',
        meta: { source: 'org-test' },
        gender: 'female',
        birthDate: '1950-01-01',
        identifier: [{ system: 'urn:emd:pseudonym', value: 'FULL-001' }],
      },
    },
    {
      resource: {
        resourceType: 'Patient',
        id: 'pat-stub-001',
        meta: { source: 'org-test' },
        gender: 'male',
        birthDate: '1960-01-01',
        // No identifier — stubs are not enrolled
      },
    },
    {
      resource: {
        resourceType: 'Observation',
        id: 'obs-001',
        status: 'final',
        subject: { reference: 'Patient/pat-full-001' },
        code: {
          coding: [
            {
              system: 'http://loinc.org',
              code: '79893-4',
              display: 'Visual acuity',
            },
          ],
        },
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Tests — EXPECTED RED until Plan 02 lands the D-03 / D-04 filters
// ---------------------------------------------------------------------------

describe('D-03: extractPatientCases stub isolation', () => {
  it('stub patients (zero Observations) are excluded from extractPatientCases output', () => {
    const cases = extractPatientCases([bundle]);
    expect(cases.map((c) => c.id)).not.toContain('pat-stub-001');
    expect(cases.map((c) => c.id)).toContain('pat-full-001');
  });
});

describe('D-04: extractCenters patientCount accuracy', () => {
  it('patientCount reflects only clinical (non-stub) patients', () => {
    const centers = extractCenters([bundle]);
    const testCenter = centers.find((c) => c.id === 'org-test');
    expect(testCenter?.patientCount).toBe(1); // only pat-full-001
  });
});

describe('D-09: countRawPatients denominator', () => {
  it('returns total Patient count including stubs (denominator)', () => {
    // bundle has 2 Patients: pat-full-001 (clinical) + pat-stub-001 (stub)
    expect(countRawPatients([bundle])).toBe(2);
  });

  it('takes only bundles parameter — no center filter', () => {
    // Signature check: countRawPatients accepts bundles[] with no second arg
    expect(countRawPatients.length).toBe(1);
  });
});
