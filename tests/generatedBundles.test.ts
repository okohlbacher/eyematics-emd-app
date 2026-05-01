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

import { extractCenters, extractPatientCases } from '../src/services/fhirLoader';
import type { FhirBundle } from '../src/types/fhir';

const CASES = [
  { file: 'center-chemnitz.json',   orgId: 'org-ukc'  },
  { file: 'center-greifswald.json', orgId: 'org-ukg'  },
  { file: 'center-leipzig.json',    orgId: 'org-ukl'  },
  { file: 'center-muenster.json',   orgId: 'org-ukm'  },
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

      // Every case has ≥1 IVOM Procedure; per-patient procedures are aggregated
      // across both eyes (extractPatientCases groups by subject), so a
      // bilateral AMD patient may approach 22+22 procedures — bound at 44.
      // fixture refreshed in Phase 26 / SYNTH-04: cohort-differentiated IVI
      // ranges per D-09 (AMD [1,22], DME [1,12], RVO [1,8]).
      for (const pc of cases) {
        expect(pc.procedures.length).toBeGreaterThanOrEqual(1);
        expect(pc.procedures.length).toBeLessThanOrEqual(44);
      }

      // Every patient has at least one visus observation (LOINC 79880-1).
      const visusCount = cases.filter(pc =>
        pc.observations.some(o => o.code.coding.some(cd => cd.code === '79880-1')),
      ).length;
      expect(visusCount).toBe(cases.length);

      // Every patient has at least one anti-VEGF / IVI-related MedicationStatement.
      // fixture refreshed in Phase 26 / SYNTH-04: cohort-differentiated drug mix
      // per D-09 — AMD: Aflibercept/Bevacizumab; DME adds Faricimab (S01LA09);
      // RVO adds Dexamethasone implant (S01BA01).
      const ALLOWED_DRUGS = new Set(['S01LA05', 'L01XC07', 'S01LA09', 'S01BA01']);
      const medCount = cases.filter(pc =>
        pc.medications.some(m =>
          m.medicationCodeableConcept?.coding?.some(cd => ALLOWED_DRUGS.has(cd.code)),
        ),
      ).length;
      expect(medCount).toBe(cases.length);
    });
  }
});
