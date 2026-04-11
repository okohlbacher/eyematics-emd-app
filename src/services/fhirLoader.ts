import type {
  FhirBundle,
  FhirResource,
  Organization,
  Patient,
  Condition,
  Observation,
  Procedure,
  ImagingStudy,
  MedicationStatement,
  CenterInfo,
  PatientCase,
  CohortFilter,
} from '../types/fhir';
import { getDataSourceConfig, loadBundlesFromSource } from './dataSource';

let cachedBundles: FhirBundle[] | null = null;

export async function loadAllBundles(): Promise<FhirBundle[]> {
  if (cachedBundles) return cachedBundles;
  const config = getDataSourceConfig();
  const bundles = await loadBundlesFromSource(config);
  cachedBundles = bundles;
  return bundles;
}

/** Invalidate the in-memory bundle cache (e.g. after changing data source). */
export function invalidateBundleCache(): void {
  cachedBundles = null;
}

function resourcesOfType<T extends FhirResource>(
  bundles: FhirBundle[],
  type: string
): T[] {
  return bundles.flatMap((b) =>
    b.entry
      .filter((e) => e.resource.resourceType === type)
      .map((e) => e.resource as T)
  );
}

function patientRef(id: string): string {
  return `Patient/${id}`;
}

export function extractCenters(bundles: FhirBundle[]): CenterInfo[] {
  const orgs = resourcesOfType<Organization>(bundles, 'Organization');
  const patients = resourcesOfType<Patient>(bundles, 'Patient');

  return orgs.map((org) => {
    const bundle = bundles.find((b) =>
      b.entry.some((e) => e.resource.id === org.id)
    );
    const orgPatients = patients.filter(
      (p) => p.meta?.source === org.id
    );
    return {
      id: org.id,
      name: org.name,
      city: org.address?.[0]?.city ?? '',
      state: org.address?.[0]?.state ?? '',
      patientCount: orgPatients.length,
      lastUpdated: bundle?.meta?.lastUpdated ?? '',
    };
  });
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
    const ref = patientRef(pat.id);
    const org = orgs.find((o) => o.id === pat.meta?.source);
    return {
      id: pat.id,
      pseudonym:
        pat.identifier?.find((i) => i.system === 'urn:eyematics:pseudonym')
          ?.value ?? pat.id,
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
  const birth = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export function getLatestObservation(
  observations: Observation[],
  loincCode: string
): Observation | undefined {
  return observations
    .filter((o) => o.code.coding.some((c) => c.code === loincCode))
    .sort(
      (a, b) =>
        new Date(b.effectiveDateTime ?? 0).getTime() -
        new Date(a.effectiveDateTime ?? 0).getTime()
    )[0];
}

export function getObservationsByCode(
  observations: Observation[],
  loincCode: string
): Observation[] {
  return observations
    .filter((o) => o.code.coding.some((c) => c.code === loincCode))
    .sort(
      (a, b) =>
        new Date(a.effectiveDateTime ?? 0).getTime() -
        new Date(b.effectiveDateTime ?? 0).getTime()
    );
}

export const LOINC_VISUS = '79880-1';
export const LOINC_CRT = 'LP267955-5';
export const LOINC_IOP = '56844-4';
export const LOINC_HBA1C = '4548-4';
export const LOINC_REFRACTION_SPH = '79846-2';
export const LOINC_REFRACTION_CYL = '79847-0';
export const LOINC_REFRACTION_AXIS = '79848-8';
export const SNOMED_AMD = '267718000';
export const SNOMED_DR = '312898008';
export const SNOMED_IVI = '36189003';
export const SNOMED_EYE_RIGHT = '362503005';
export const SNOMED_EYE_LEFT = '362502000';

/**
 * Center shorthand cache — loaded from server via /api/fhir/centers (M-03).
 * Falls back to built-in defaults until the API response arrives.
 */
let _centerShorthands: Record<string, string> = {
  'org-uka': 'UKA',
  'org-ukb': 'UKB',
  'org-lmu': 'LMU',
  'org-ukt': 'UKT',
  'org-ukm': 'UKM',
};

/** Load center shorthands from server. Called once at app startup. */
export async function loadCenterShorthands(): Promise<void> {
  try {
    const { authFetch } = await import('./authHeaders');
    const resp = await authFetch('/api/fhir/centers');
    if (resp.ok) {
      const data = await resp.json() as { centers: Array<{ id: string; shorthand: string }> };
      const map: Record<string, string> = {};
      for (const c of data.centers) {
        map[c.id] = c.shorthand;
      }
      _centerShorthands = map;
    }
  } catch {
    // Keep defaults on failure
  }
}

/** Short display names for centers (used in charts/tables) */
export const CENTER_SHORTHANDS: Record<string, string> = _centerShorthands;

/** Get the shorthand label for a center, falling back to full name */
export function getCenterShorthand(centerId: string, fallback?: string): string {
  return _centerShorthands[centerId] ?? fallback ?? centerId;
}

export function getDiagnosisLabel(code: string, locale: string = 'de'): string {
  switch (code) {
    case SNOMED_AMD:
      return 'AMD';
    case SNOMED_DR:
      return locale === 'en' ? 'Diabetic Retinopathy' : 'Diabetische Retinopathie';
    default:
      return code;
  }
}

/** Full display text for a code (used as tooltip). Locale-aware (m-03). */
export function getDiagnosisFullText(code: string, locale: string = 'de'): string {
  const isEn = locale === 'en';
  switch (code) {
    case SNOMED_AMD:
      return isEn
        ? 'Age-related macular degeneration (267718000)'
        : 'Altersbedingte Makuladegeneration (267718000)';
    case SNOMED_DR:
      return isEn
        ? 'Diabetic retinopathy (312898008)'
        : 'Diabetische Retinopathie (312898008)';
    case 'E11.9':
      return isEn
        ? 'Type 2 diabetes mellitus, without complications (E11.9)'
        : 'Diabetes mellitus Typ 2, ohne Komplikationen (E11.9)';
    case 'E10.9':
      return isEn
        ? 'Type 1 diabetes mellitus, without complications (E10.9)'
        : 'Diabetes mellitus Typ 1, ohne Komplikationen (E10.9)';
    case 'H40.1':
      return isEn
        ? 'Primary open-angle glaucoma (H40.1)'
        : 'Primäres Offenwinkelglaukom (H40.1)';
    case 'H25.1':
      return isEn
        ? 'Senile nuclear cataract (H25.1)'
        : 'Senile Kernkatarakt (H25.1)';
    case 'H33.0':
      return isEn
        ? 'Retinal detachment with break (H33.0)'
        : 'Netzhautablösung mit Riss (H33.0)';
    case 'I10':
      return isEn
        ? 'Essential hypertension (I10)'
        : 'Essentielle Hypertonie (I10)';
    case 'E78.0':
      return isEn
        ? 'Hypercholesterolemia (E78.0)'
        : 'Hypercholesterinämie (E78.0)';
    case 'I25.1':
      return isEn
        ? 'Coronary artery disease (I25.1)'
        : 'Koronare Herzkrankheit (I25.1)';
    default:
      return code;
  }
}

export function applyFilters(
  cases: PatientCase[],
  filters: CohortFilter
): PatientCase[] {
  return cases.filter((c) => {
    if (filters.centers?.length && !filters.centers.includes(c.centerId)) {
      return false;
    }
    if (filters.gender?.length && !filters.gender.includes(c.gender)) {
      return false;
    }
    if (filters.diagnosis?.length) {
      const codes = c.conditions.flatMap((cond) =>
        cond.code.coding.map((cd) => cd.code)
      );
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
      if (val < filters.visusRange[0] || val > filters.visusRange[1])
        return false;
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
