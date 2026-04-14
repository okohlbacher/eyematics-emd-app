/**
 * Load-path smoke test — confirms that bundles emitted by Plan 07-02's
 * generator are accepted by the production fhirLoader code path used by
 * server/fhirApi.ts and the React data layer.
 *
 * Reads the actual generated files on disk (no fs mocks) so any drift
 * between generator output and loader expectations is caught.
 *
 * Closes DATA-GEN-06.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import type { FhirBundle } from '../src/types/fhir';
import { extractCenters, extractPatientCases } from '../src/services/fhirLoader';

const CASES = [
  { file: 'center-chemnitz.json',   orgId: 'org-ukc'  },
  { file: 'center-dresden.json',    orgId: 'org-ukd'  },
  { file: 'center-greifswald.json', orgId: 'org-ukg'  },
  { file: 'center-leipzig.json',    orgId: 'org-ukl'  },
  { file: 'center-mainz.json',      orgId: 'org-ukmz' },
] as const;

describe('Generated bundles — load path smoke test (DATA-GEN-06)', () => {
  for (const c of CASES) {
    it(`${c.file} loads via fhirLoader and yields extractable centers/cases`, () => {
      const raw = fs.readFileSync(path.resolve('public/data', c.file), 'utf-8');
      const bundle = JSON.parse(raw) as FhirBundle;
      expect(bundle.resourceType).toBe('Bundle');

      // Exactly one Organization, with the expected ID.
      const orgs = bundle.entry.filter(e => e.resource.resourceType === 'Organization');
      expect(orgs).toHaveLength(1);
      expect(orgs[0]!.resource.id).toBe(c.orgId);

      // fhirLoader helpers accept the bundle.
      const centers = extractCenters([bundle]);
      expect(centers).toHaveLength(1);
      expect(centers[0]!.id).toBe(c.orgId);
      expect(centers[0]!.patientCount).toBeGreaterThanOrEqual(45);

      const cases = extractPatientCases([bundle]);
      expect(cases.length).toBeGreaterThanOrEqual(45);

      // Every case has 1..20 IVOM Procedures.
      for (const pc of cases) {
        expect(pc.procedures.length).toBeGreaterThanOrEqual(1);
        expect(pc.procedures.length).toBeLessThanOrEqual(20);
      }

      // Every patient has at least one visus observation (LOINC 79880-1).
      const visusCount = cases.filter(pc =>
        pc.observations.some(o => o.code.coding.some(cd => cd.code === '79880-1')),
      ).length;
      expect(visusCount).toBe(cases.length);

      // Every patient has at least one MedicationStatement with ATC S01LA05 or L01XC07.
      const medCount = cases.filter(pc =>
        pc.medications.some(m =>
          m.medicationCodeableConcept?.coding?.some(cd => cd.code === 'S01LA05' || cd.code === 'L01XC07'),
        ),
      ).length;
      expect(medCount).toBe(cases.length);
    });
  }
});
