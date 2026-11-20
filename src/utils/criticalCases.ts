/** Z0-P09: cases with critical CRT values (count and list in the cohort analysis). */
import { getObservationsByCode, LOINC_CRT } from '../services/fhirLoader';
import type { PatientCase } from '../types/fhir';

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
