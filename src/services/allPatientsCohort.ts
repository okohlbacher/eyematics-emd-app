/**
 * Z0-P05: the base population "Alle Patienten" as a comparison cohort.
 *
 * Represented as a virtual saved search with a reserved id and no filters, so every place that resolves
 * compare ids (`?cohorts=`) against saved searches resolves it to the included cases (activeCases, i.e.
 * without the user's exclusions — team answers Q6/Q23) without a code path of its own.
 * The id is the one the case view uses for its "Alle Patienten" overlay option.
 */
import type { SavedSearch } from '../types/fhir';

export const ALL_PATIENTS_COHORT_ID = '__all_patients__';

/** "Alle Patienten" first, then the user's saved searches. */
export function withAllPatientsCohort(savedSearches: SavedSearch[], name: string): SavedSearch[] {
  return [{ id: ALL_PATIENTS_COHORT_ID, name, createdAt: '', filters: {} }, ...savedSearches];
}
