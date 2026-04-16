/**
 * shared/patientCases.ts — pure FHIR-bundle → PatientCase[] extraction.
 *
 * Extracted from server/outcomesAggregateApi.ts (Phase 12 Plan 12-02) so that:
 *   1. The server handler can import it (no browser globals — tsconfig.server.json safe).
 *   2. Tests can vi.mock('../shared/patientCases.js') to inject synthetic PatientCases
 *      without building full FHIR bundle fixtures.
 *
 * No I/O, no browser APIs, no side effects.
 */

import { LOINC_CRT, LOINC_VISUS } from './fhirCodes.js';
import { getLatestObservation } from './fhirQueries.js';
import type {
  CohortFilter,
  Condition,
  ImagingStudy,
  MedicationStatement,
  Observation,
  Organization,
  Patient,
  PatientCase,
  Procedure,
} from './types/fhir.js';

// ---------------------------------------------------------------------------
// Bundle entry shape (minimal — matches server/fhirApi.ts FhirBundle)
// ---------------------------------------------------------------------------

interface BundleEntry {
  resource: { resourceType: string; [key: string]: unknown };
}
interface FhirBundle {
  entry: BundleEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resourcesOfType<T>(bundles: FhirBundle[], type: string): T[] {
  return bundles.flatMap((b) =>
    b.entry
      .filter((e) => e.resource.resourceType === type)
      .map((e) => e.resource as unknown as T),
  );
}

export function extractPatientCases(bundles: FhirBundle[]): PatientCase[] {
  const patients = resourcesOfType<Patient>(bundles, 'Patient');
  const conditions = resourcesOfType<Condition>(bundles, 'Condition');
  const observations = resourcesOfType<Observation>(bundles, 'Observation');
  const procedures = resourcesOfType<Procedure>(bundles, 'Procedure');
  const imaging = resourcesOfType<ImagingStudy>(bundles, 'ImagingStudy');
  const medications = resourcesOfType<MedicationStatement>(bundles, 'MedicationStatement');
  const orgs = resourcesOfType<Organization>(bundles, 'Organization');

  return patients.map((pat) => {
    const ref = `Patient/${pat.id}`;
    const org = orgs.find((o) => o.id === pat.meta?.source);
    return {
      id: pat.id,
      pseudonym:
        pat.identifier?.find((i) => i.system === 'urn:eyematics:pseudonym')?.value ?? pat.id,
      gender: pat.gender ?? 'unknown',
      birthDate: pat.birthDate ?? '',
      centerId: pat.meta?.source ?? '',
      centerName: org?.name ?? pat.meta?.source ?? '',
      conditions: conditions.filter((c) => c.subject.reference === ref),
      observations: observations.filter((o) => o.subject.reference === ref),
      procedures: procedures.filter((p) => p.subject.reference === ref),
      imagingStudies: imaging.filter((i) => i.subject.reference === ref),
      medications: medications.filter((m) => m.subject.reference === ref),
    };
  });
}

export function getAge(birthDate: string): number {
  if (!birthDate) return -1;
  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) return -1;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export function applyFilters(cases: PatientCase[], filters: CohortFilter): PatientCase[] {
  return cases.filter((c) => {
    if (filters.centers?.length && !filters.centers.includes(c.centerId)) return false;
    if (filters.gender?.length && !filters.gender.includes(c.gender)) return false;
    if (filters.diagnosis?.length) {
      const codes = c.conditions.flatMap((cond) => cond.code.coding.map((cd) => cd.code));
      if (!filters.diagnosis.some((d) => codes.includes(d))) return false;
    }
    if (filters.ageRange) {
      const age = getAge(c.birthDate);
      if (age < filters.ageRange[0] || age > filters.ageRange[1]) return false;
    }
    if (filters.visusRange) {
      const latest = getLatestObservation(c.observations, LOINC_VISUS);
      const val = latest?.valueQuantity?.value;
      if (val == null) return false;
      if (val < filters.visusRange[0] || val > filters.visusRange[1]) return false;
    }
    if (filters.crtRange) {
      const latest = getLatestObservation(c.observations, LOINC_CRT);
      const val = latest?.valueQuantity?.value;
      if (val == null) return false;
      if (val < filters.crtRange[0] || val > filters.crtRange[1]) return false;
    }
    return true;
  });
}
