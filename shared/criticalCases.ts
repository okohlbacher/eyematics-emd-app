/**
 * Z0-P09 / Z0-P12: cases with critical CRT values — the count and list in the cohort analysis header (P09) and the
 * highlighted series in Verläufe (P12) use this one predicate (D-01: cross-boundary helper in shared/).
 */
import { LOINC_CRT } from './fhirCodes';
import { getObservationsByCode } from './fhirQueries';
import type { PatientCase } from './types/fhir';

export interface CriticalCase {
  id: string;
  pseudonym: string;
  maxCrt: number;
}

/** Cases with any CRT above `threshold`, with their highest CRT, sorted by it descending (Q28). */
export function criticalCasesOf(cases: PatientCase[], threshold: number): CriticalCase[] {
  return cases
    .flatMap((c) => {
      const values = getObservationsByCode(c.observations, LOINC_CRT)
        .map((o) => o.valueQuantity?.value)
        .filter((v): v is number => typeof v === 'number');
      if (values.length === 0) return [];
      const maxCrt = Math.max(...values);
      return maxCrt > threshold ? [{ id: c.id, pseudonym: c.pseudonym, maxCrt }] : [];
    })
    .sort((a, b) => b.maxCrt - a.maxCrt || a.pseudonym.localeCompare(b.pseudonym));
}
