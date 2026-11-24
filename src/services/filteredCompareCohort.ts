/**
 * Z0-P23 (Q46): the unsaved filtered cohort (?filters=) as the fixed base cohort of a comparison.
 *
 * Like "Alle Patienten" (allPatientsCohort.ts) it is a virtual saved search with a reserved id, so the compare ids
 * (`?cohorts=`) of both analysis tabs resolve it without a code path of their own. It is offered only while it is the
 * active cohort (no ?cohort=), named as in the header ("Gefilterte Kohorte · …", Q26 a). The reserved id lives in
 * ?cohorts= only and is never written to ?cohort= (which names saved cohorts).
 */
import type { CohortFilter, SavedSearch } from '../types/fhir';

export const FILTERED_COHORT_ID = '__filtered_cohort__';

/** The base cohort id of a comparison: the saved cohort (?cohort=), else the filtered cohort, else none. */
export function compareBaseCohortId(savedCohortId: string | null, hasFilteredCohort: boolean): string | null {
  return savedCohortId ?? (hasFilteredCohort ? FILTERED_COHORT_ID : null);
}

/** The compare searches plus the filtered cohort while it is the active cohort. */
export function withFilteredCohort(
  searches: SavedSearch[],
  filtered: { name: string; filters: CohortFilter } | null,
): SavedSearch[] {
  if (!filtered) return searches;
  return [...searches, { id: FILTERED_COHORT_ID, name: filtered.name, createdAt: '', filters: filtered.filters }];
}
