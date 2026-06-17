import type {
  CenterInfo,
  FhirBundle,
  FhirResource,
  Observation,
  Organization,
  Patient,
} from '../types/fhir';
import { authFetch } from './authHeaders';
import { loadBundlesFromSource } from './dataSource';

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
  const bundles = await loadBundlesFromSource();
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
    // WR-05: resolve the source bundle by Organization membership, not raw id
    // equality across all resource types. Matching `e.resource.id === org.id`
    // alone could pick the wrong bundle if any non-Org resource id collided
    // with the Org id. We narrow to the Organization resource. NOTE: this still
    // assumes one Organization per bundle (the current one-Org-per-file layout)
    // — a multi-Org bundle exposes a single bundle-level meta.lastUpdated, so
    // every Org in it would share that timestamp. The rest of the codebase
    // (filterBundlesByCenters, buildCaseIndex) does not rely on 1:1, so this is
    // a documented narrowing rather than a full multi-Org fix.
    const bundle = bundles.find((b) =>
      b.entry.some(
        (e) => e.resource.resourceType === 'Organization' && e.resource.id === org.id,
      )
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

/**
 * I5 (v1.14): Per-centre raw Patient counts (INCLUDES stubs).
 *
 * Groups every Patient resource by its managing centre. A Patient — stub or
 * clinical — carries its centre as `meta.source` (the Organization id); this is
 * the SAME mapping `extractPatientCases` (`centerId: pat.meta?.source`) and
 * `extractCenters` (`p.meta?.source === org.id`) already use, so the per-centre
 * raw denominator is consistent with the clinical (stub-excluded) per-centre
 * numerators derived elsewhere.
 *
 * This is the per-centre Vollzähligkeit denominator: the full registered
 * population per centre, NOT windowed. Sum of the map values equals
 * countRawPatients(bundles).
 *
 * Limitation: a raw Patient with no `meta.source` is keyed under '' (the same
 * fallback extractPatientCases uses for centerId). In the current data every
 * Patient carries meta.source, so this only matters for malformed bundles.
 */
export function countRawPatientsByCenter(
  bundles: FhirBundle[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const b of bundles) {
    for (const e of b.entry) {
      if (e.resource.resourceType !== 'Patient') continue;
      const centerId = e.resource.meta?.source ?? '';
      counts.set(centerId, (counts.get(centerId) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * N8 (v1.19, round-7 decision): the Vollzähligkeit denominator restricted to the
 * selected time window — the count of REGISTERED patients with ≥1 observation inside
 * `window`. The tester asked for "the registered total in the time range" so the count
 * AND the percentage both track the filter (reversing the round-6 full-denominator
 * choice). With no window the caller uses countRawPatients (the full registered total,
 * landing parity). Counts each patient once (distinct Observation.subject refs).
 */
export function countRawPatientsInWindow(
  bundles: FhirBundle[],
  window: { from: Date; to: Date },
): number {
  const fromMs = window.from.getTime();
  const toMs = window.to.getTime();
  const refs = new Set<string>();
  for (const b of bundles) {
    for (const e of b.entry) {
      if (e.resource.resourceType !== 'Observation') continue;
      const obs = e.resource as Observation;
      if (!obs.effectiveDateTime) continue;
      const t = new Date(obs.effectiveDateTime).getTime();
      if (Number.isNaN(t) || t < fromMs || t > toMs) continue;
      const ref = obs.subject?.reference;
      if (ref) refs.add(ref);
    }
  }
  return refs.size;
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
