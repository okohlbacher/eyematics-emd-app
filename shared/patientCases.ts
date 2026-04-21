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

// Accept any bundle-like object — only the resourceType field is needed to filter.
// Structurally compatible with both shared/types/fhir.FhirBundle (strict) and
// server/fhirApi.FhirBundle (relaxed id?: string). The cast to unknown as T
// in resourcesOfType handles the downstream typing.
interface BundleLike {
  entry: Array<{ resource: { resourceType: string } }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resourcesOfType<T>(bundles: BundleLike[], type: string): T[] {
  return bundles.flatMap((b) =>
    b.entry
      .filter((e) => e.resource.resourceType === type)
      .map((e) => e.resource as unknown as T),
  );
}

/**
 * M3: Index resources by subject.reference once instead of calling
 * array.filter() per-patient per-resource-type. Previously O(N patients · M
 * resources); now O(N + M) with a Map lookup per patient. On a 7-center
 * bundle (~10k observations) this cuts extraction from ~seconds to ms.
 */
function groupBySubject<T extends { subject: { reference?: string } }>(resources: T[]): Map<string, T[]> {
  const byRef = new Map<string, T[]>();
  for (const r of resources) {
    const ref = r.subject.reference;
    if (!ref) continue;
    const existing = byRef.get(ref);
    if (existing) existing.push(r);
    else byRef.set(ref, [r]);
  }
  return byRef;
}

export function extractPatientCases(bundles: BundleLike[]): PatientCase[] {
  const patients = resourcesOfType<Patient>(bundles, 'Patient');
  const conditions = resourcesOfType<Condition>(bundles, 'Condition');
  const observations = resourcesOfType<Observation>(bundles, 'Observation');
  const procedures = resourcesOfType<Procedure>(bundles, 'Procedure');
  const imaging = resourcesOfType<ImagingStudy>(bundles, 'ImagingStudy');
  const medications = resourcesOfType<MedicationStatement>(bundles, 'MedicationStatement');
  const orgs = resourcesOfType<Organization>(bundles, 'Organization');

  const conditionsByRef = groupBySubject(conditions);
  const observationsByRef = groupBySubject(observations);
  const proceduresByRef = groupBySubject(procedures);
  const imagingByRef = groupBySubject(imaging);
  const medicationsByRef = groupBySubject(medications);
  const orgById = new Map(orgs.map((o) => [o.id, o]));

  return patients.map((pat) => {
    const ref = `Patient/${pat.id}`;
    const org = pat.meta?.source ? orgById.get(pat.meta.source) : undefined;
    return {
      id: pat.id,
      pseudonym:
        pat.identifier?.find((i) => i.system === 'urn:eyematics:pseudonym')?.value ?? pat.id,
      gender: pat.gender ?? 'unknown',
      birthDate: pat.birthDate ?? '',
      centerId: pat.meta?.source ?? '',
      centerName: org?.name ?? pat.meta?.source ?? '',
      conditions: conditionsByRef.get(ref) ?? [],
      observations: observationsByRef.get(ref) ?? [],
      procedures: proceduresByRef.get(ref) ?? [],
      imagingStudies: imagingByRef.get(ref) ?? [],
      medications: medicationsByRef.get(ref) ?? [],
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
