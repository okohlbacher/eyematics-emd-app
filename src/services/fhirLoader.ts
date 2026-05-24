import type {
  CenterInfo,
  FhirBundle,
  FhirResource,
  Observation,
  Organization,
  Patient,
} from '../types/fhir';
import { authFetch } from './authHeaders';
import { getDataSourceConfig, loadBundlesFromSource } from './dataSource';

// retained: live module (loadAllBundles, extractCenters, loadCenterShorthands,
// etc.) that also re-exports a stable public surface for pure helpers from
// shared/. Not a pure shim per D-15 — the re-exports are colocated with the
// live browser-only loader logic that DataContext and services depend on.
// Callers that only need the pure helpers can import from shared/ directly;
// callers that also need the loader logic continue to import from here.
//
// Diagnosis-display knowledge moved to `src/services/terminology.ts` in Phase
// 25 (TERM-02 / D-03). The 9-entry seed map lives there; callers use
// `useDiagnosisDisplay`, `getCachedDisplay`, or `getCachedFullText`.
export * from '../../shared/fhirCodes';
export { getLatestObservation,getObservationsByCode } from '../../shared/fhirQueries';
export { applyFilters, extractPatientCases, getAge } from '../../shared/patientCases';

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
  const observations = resourcesOfType<Observation>(bundles, 'Observation');

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
      // D-04: patientCount = patients with ≥1 Observation (excludes stubs).
      // Same structural rule as D-03: absence of Observations = stub.
      patientCount: orgPatients.filter((p) =>
        observations.some((o) => o.subject.reference === `Patient/${p.id}`)
      ).length,
      lastUpdated: bundle?.meta?.lastUpdated ?? '',
    };
  });
}

/**
 * D-09: Count ALL Patient resources across the provided bundles.
 * Does NOT exclude stubs — this is the Datenvollzähligkeit denominator.
 * The bundles parameter already contains only the user's permitted bundles
 * (server-side filtering by req.auth.centers), so no extra center filter
 * is needed for the full-page LandingPage display.
 */
export function countRawPatients(bundles: FhirBundle[]): number {
  return bundles.reduce(
    (sum, b) =>
      sum + b.entry.filter((e) => e.resource.resourceType === 'Patient').length,
    0,
  );
}

// extractPatientCases, getAge — re-exported from shared/patientCases above (M1 fix).

/**
 * Center shorthand cache — loaded from server via /api/fhir/centers (M-03).
 * Falls back to built-in defaults until the API response arrives.
 */
let _centerShorthands: Record<string, string> = {
  'org-uka': 'UKA',
  'org-ukc': 'UKC',
  'org-ukg': 'UKG',
  'org-ukl': 'UKL',
  'org-ukm': 'UKM',
  'org-ukt': 'UKT',
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

// applyFilters — re-exported from shared/patientCases above (M1 fix).
// getDiagnosisLabel + getDiagnosisFullText removed in Phase 25 (TERM-02);
// the 9-entry seed map and resolver live in `src/services/terminology.ts`.
