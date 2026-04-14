/**
 * Tests for scripts/generate-center-bundle.ts — synthetic FHIR bundle generator.
 *
 * TDD RED → GREEN: behavior spec from 07-02-PLAN.md Task 1.
 * Covers determinism + structural invariants + cohort/code coverage.
 */

import { describe, expect, it } from 'vitest';

import { generateCenterBundle } from '../scripts/generate-center-bundle';

const COMMON = {
  centerId: 'org-test',
  shorthand: 'TEST',
  name: 'Test Universitätsklinikum',
  city: 'Testcity',
  state: 'TT',
  patients: 12,
};

interface BundleEntry {
  resource: {
    resourceType: string;
    id: string;
    [k: string]: unknown;
  };
}

interface Bundle {
  resourceType: string;
  type: string;
  meta: { lastUpdated: string; source: string };
  entry: BundleEntry[];
}

describe('generateCenterBundle (DATA-GEN-01..04)', () => {
  it('returns a FHIR Bundle of type "collection" with Organization at entry[0]', () => {
    const b = generateCenterBundle({ ...COMMON, seed: 42 }) as Bundle;
    expect(b.resourceType).toBe('Bundle');
    expect(b.type).toBe('collection');
    expect(b.entry[0]?.resource.resourceType).toBe('Organization');
    expect(b.entry[0]?.resource.id).toBe('org-test');
    expect((b.entry[0]?.resource as { name?: string }).name).toBe('Test Universitätsklinikum');
  });

  it('emits exactly the requested number of Patient entries', () => {
    const b = generateCenterBundle({ ...COMMON, seed: 7 }) as Bundle;
    const patients = b.entry.filter(e => e.resource.resourceType === 'Patient');
    expect(patients).toHaveLength(COMMON.patients);
  });

  it('every Patient has meta.source === centerId and a pseudonym EM-<SH>-NNNN', () => {
    const b = generateCenterBundle({ ...COMMON, seed: 7 }) as Bundle;
    const patients = b.entry
      .filter(e => e.resource.resourceType === 'Patient')
      .map(e => e.resource as { meta?: { source?: string }; identifier?: Array<{ system?: string; value: string }> });
    for (const p of patients) {
      expect(p.meta?.source).toBe('org-test');
      const pseudo = p.identifier?.find(i => i.system === 'urn:eyematics:pseudonym');
      expect(pseudo).toBeDefined();
      expect(pseudo!.value).toMatch(/^EM-TEST-\d{4}$/);
    }
  });

  it('every Patient has at least one Condition with an AMD/DME/RVO SNOMED code', () => {
    const b = generateCenterBundle({ ...COMMON, seed: 7 }) as Bundle;
    const validCohortCodes = new Set(['267718000', '312903003', '362098006']);
    const patients = b.entry.filter(e => e.resource.resourceType === 'Patient');
    const conditions = b.entry.filter(e => e.resource.resourceType === 'Condition');
    for (const p of patients) {
      const ref = `Patient/${p.resource.id}`;
      const matched = conditions.filter(
        c => (c.resource as { subject: { reference: string } }).subject.reference === ref,
      );
      expect(matched.length).toBeGreaterThanOrEqual(1);
      const codes = matched.flatMap(c =>
        (c.resource as { code: { coding: Array<{ code: string }> } }).code.coding.map(cd => cd.code),
      );
      expect(codes.some(code => validCohortCodes.has(code))).toBe(true);
    }
  });

  it('every Patient has ≥2 visus (LOINC 79880-1) Observations covering at least one eye', () => {
    const b = generateCenterBundle({ ...COMMON, seed: 7 }) as Bundle;
    const patients = b.entry.filter(e => e.resource.resourceType === 'Patient');
    const obs = b.entry.filter(e => e.resource.resourceType === 'Observation');
    for (const p of patients) {
      const ref = `Patient/${p.resource.id}`;
      const visus = obs.filter(o => {
        const r = o.resource as { subject: { reference: string }; code: { coding: Array<{ code: string }> } };
        return r.subject.reference === ref && r.code.coding.some(c => c.code === '79880-1');
      });
      expect(visus.length).toBeGreaterThanOrEqual(2);
      const eyes = new Set(
        visus
          .map(o => (o.resource as { bodySite?: { coding: Array<{ code: string }> } }).bodySite?.coding[0]?.code)
          .filter(Boolean),
      );
      // at least one eye-side bodySite present
      expect([...eyes].some(c => c === '362503005' || c === '362502000')).toBe(true);
    }
  });

  it('every Patient has between 1 and 20 Procedures (SNOMED 36189003) in ascending performedDateTime order', () => {
    const b = generateCenterBundle({ ...COMMON, seed: 7 }) as Bundle;
    const patients = b.entry.filter(e => e.resource.resourceType === 'Patient');
    const procs = b.entry.filter(e => e.resource.resourceType === 'Procedure');
    for (const p of patients) {
      const ref = `Patient/${p.resource.id}`;
      const ivoms = procs
        .filter(pr => (pr.resource as { subject: { reference: string } }).subject.reference === ref)
        .map(pr => pr.resource as { code: { coding: Array<{ code: string }> }; performedDateTime?: string });
      expect(ivoms.length).toBeGreaterThanOrEqual(1);
      expect(ivoms.length).toBeLessThanOrEqual(20);
      for (const iv of ivoms) {
        expect(iv.code.coding.some(c => c.code === '36189003')).toBe(true);
      }
      const dates = ivoms.map(iv => iv.performedDateTime!).filter(Boolean);
      const sorted = [...dates].sort();
      expect(dates).toEqual(sorted);
    }
  });

  it('every Patient has at least one MedicationStatement with ATC S01LA05 or L01XC07', () => {
    const b = generateCenterBundle({ ...COMMON, seed: 7 }) as Bundle;
    const patients = b.entry.filter(e => e.resource.resourceType === 'Patient');
    const meds = b.entry.filter(e => e.resource.resourceType === 'MedicationStatement');
    for (const p of patients) {
      const ref = `Patient/${p.resource.id}`;
      const patientMeds = meds.filter(
        m => (m.resource as { subject: { reference: string } }).subject.reference === ref,
      );
      expect(patientMeds.length).toBeGreaterThanOrEqual(1);
      const codes = patientMeds.flatMap(m =>
        (m.resource as { medicationCodeableConcept?: { coding: Array<{ code: string }> } }).medicationCodeableConcept?.coding.map(c => c.code) ?? [],
      );
      expect(codes.some(c => c === 'S01LA05' || c === 'L01XC07')).toBe(true);
    }
  });

  it('is byte-deterministic given the same seed and inputs', () => {
    const a = generateCenterBundle({ ...COMMON, seed: 12345 });
    const b = generateCenterBundle({ ...COMMON, seed: 12345 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('different seeds produce different output', () => {
    const a = JSON.stringify(generateCenterBundle({ ...COMMON, seed: 1 }));
    const b = JSON.stringify(generateCenterBundle({ ...COMMON, seed: 2 }));
    expect(a).not.toBe(b);
  });

  it('throws if patients > 500 (DoS guard, threat T-07-07)', () => {
    expect(() => generateCenterBundle({ ...COMMON, patients: 501, seed: 1 })).toThrow();
  });
});
