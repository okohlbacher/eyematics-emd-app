import type {
  CenterInfo,
  FhirBundle,
  FhirResource,
  Organization,
  Patient,
} from '../types/fhir';
import { authFetch } from './authHeaders';
import { getDataSourceConfig, loadBundlesFromSource } from './dataSource';

// retained: live module (loadAllBundles, extractCenters, loadCenterShorthands,
// getDiagnosisLabel, getDiagnosisFullText, etc.) that also re-exports a stable
// public surface for pure helpers from shared/. Not a pure shim per D-15 — the
// re-exports are colocated with the live browser-only loader logic that
// DataContext and services depend on. Callers that only need the pure helpers
// can import from shared/ directly; callers that also need the loader logic
// continue to import from here.
export * from '../../shared/fhirCodes';
export { getObservationsByCode, getLatestObservation } from '../../shared/fhirQueries';
export { extractPatientCases, applyFilters, getAge } from '../../shared/patientCases';

import {
  SNOMED_AMD,
  SNOMED_DR,
} from '../../shared/fhirCodes';

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

// extractPatientCases, getAge — re-exported from shared/patientCases above (M1 fix).

/**
 * Center shorthand cache — loaded from server via /api/fhir/centers (M-03).
 * Falls back to built-in defaults until the API response arrives.
 */
let _centerShorthands: Record<string, string> = {
  'org-uka':  'UKA',
  'org-ukc':  'UKC',
  'org-ukd':  'UKD',
  'org-ukg':  'UKG',
  'org-ukl':  'UKL',
  'org-ukmz': 'UKMZ',
  'org-ukt':  'UKT',
};

/** Load center shorthands from server. Called once at app startup. */
export async function loadCenterShorthands(): Promise<void> {
  try {
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

// applyFilters — re-exported from shared/patientCases above (M1 fix).
