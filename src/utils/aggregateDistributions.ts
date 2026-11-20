/**
 * Aggregiert tab: per-cohort distributions (centre, diagnosis, Visus trend, CRT bins, age vs. Visus).
 * Z0-P23 (Q17): the single-cohort charts and every compare chart compute from the same functions.
 */
import { getAge, getCenterShorthand, getObservationsByCode, LOINC_CRT, LOINC_VISUS } from '../services/fhirLoader';
import { getCachedDisplay, getCachedFullText } from '../services/terminology';
import type { PatientCase } from '../types/fhir';
import { computeCrtDistribution } from './distributionBins';

export function centerDistributionOf(cases: PatientCase[]): Array<{ name: string; count: number }> {
  const map = new Map<string, number>();
  cases.forEach((c) => {
    const short = getCenterShorthand(c.centerId, c.centerName);
    map.set(short, (map.get(short) ?? 0) + 1);
  });
  return Array.from(map, ([name, count]) => ({ name, count }));
}

export interface DiagnosisSlice {
  name: string;
  code: string;
  value: number;
  fullText: string;
}

export function diagnosisDistributionOf(cases: PatientCase[], locale: string): DiagnosisSlice[] {
  const map = new Map<string, { count: number; code: string; system: string | undefined }>();
  cases.forEach((c) => {
    c.conditions.forEach((cond) => {
      const system = cond.code.coding[0]?.system;
      const code = cond.code.coding[0]?.code ?? '';
      const label = getCachedDisplay(system, code, locale as 'de' | 'en');
      const entry = map.get(label) ?? { count: 0, code, system };
      entry.count++;
      map.set(label, entry);
    });
  });
  return Array.from(map, ([name, { count, code, system }]) => ({
    name,
    code,
    value: count,
    fullText: getCachedFullText(system, code, locale as 'de' | 'en'),
  })).sort((a, b) => b.value - a.value);
}

export function visusTrendOf(cases: PatientCase[]): Array<{ quarter: string; mean: number; count: number }> {
  const byQuarter = new Map<string, number[]>();
  cases.forEach((c) => {
    getObservationsByCode(c.observations, LOINC_VISUS).forEach((obs) => {
      if (!obs.effectiveDateTime || !obs.valueQuantity) return;
      const d = new Date(obs.effectiveDateTime);
      const q = `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
      const arr = byQuarter.get(q) ?? [];
      arr.push(obs.valueQuantity.value);
      byQuarter.set(q, arr);
    });
  });
  return Array.from(byQuarter)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([quarter, vals]) => ({
      quarter,
      mean: +(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(3),
      count: vals.length,
    }));
}

export function crtDistributionOf(cases: PatientCase[]): ReturnType<typeof computeCrtDistribution> {
  return computeCrtDistribution(cases.flatMap((c) => getObservationsByCode(c.observations, LOINC_CRT)));
}

/** ANL-003: latest Visus per case against age, sorted by age so the x-axis is monotonic. */
export function ageVisusOf(cases: PatientCase[]): Array<{ age: number; visus: number }> {
  return cases
    .map((c) => {
      const latest = getObservationsByCode(c.observations, LOINC_VISUS).slice(-1)[0];
      if (!latest?.valueQuantity) return null;
      return { age: getAge(c.birthDate), visus: latest.valueQuantity.value };
    })
    .filter((p): p is { age: number; visus: number } => p !== null)
    .sort((a, b) => a.age - b.age);
}

/**
 * Merge per-cohort category counts into one row per category for a grouped chart: { [categoryKey]: category,
 * [cohortId]: value }. Categories keep first-seen order unless `order` sorts them.
 */
export function mergeByCategory<T>(
  series: Array<{ cohortId: string; rows: T[] }>,
  categoryOf: (r: T) => string,
  valueOf: (r: T) => number,
  categoryKey: string,
  order?: (a: string, b: string) => number,
): Array<Record<string, string | number>> {
  const rows = new Map<string, Record<string, string | number>>();
  for (const s of series) {
    for (const r of s.rows) {
      const cat = categoryOf(r);
      const row = rows.get(cat) ?? { [categoryKey]: cat };
      row[s.cohortId] = valueOf(r);
      rows.set(cat, row);
    }
  }
  const out = [...rows.values()];
  return order ? out.sort((a, b) => order(String(a[categoryKey]), String(b[categoryKey]))) : out;
}
