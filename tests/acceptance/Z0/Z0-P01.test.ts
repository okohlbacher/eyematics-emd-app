// Z0-P01 — age filter with open bounds: predicate, sanitizers and summary (PLAN Z0 § Z0-P01, Q1). Synthetic data only.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { computeSplitGroups } from '../../../shared/cohortSplit';
import { applyFilters } from '../../../shared/patientCases';
import { sanitizeSavedSearchFilters } from '../../../shared/savedSearchSanitize';
import type { CohortFilter, PatientCase } from '../../../shared/types/fhir';
import { safePickCohortFilter, summarizeCohortFilter } from '../../../src/utils/cohortFilterSerialization';

// Synthetic cases aged 55, 70, 85 and 95 on the pinned reference date.
function caseAged(id: string, birthYear: number): PatientCase {
  return {
    id, pseudonym: id, centerId: 'CENTER-SYN', gender: 'female', birthDate: `${birthYear}-01-01`,
    conditions: [], observations: [], procedures: [], imagingStudies: [], medications: [],
  } as unknown as PatientCase;
}
const CASES = [caseAged('a55', 1971), caseAged('b70', 1956), caseAged('c85', 1941), caseAged('d95', 1931)];
const ids = (f: CohortFilter) => applyFilters(CASES, f).map((c) => c.id);

describe('[Z0-P01] age filter with open bounds', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T10:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('[Z0-P01] lower bound only filters from the lower bound, no implicit upper bound', () => {
    expect(ids({ ageRange: [70, null] })).toEqual(['b70', 'c85', 'd95']);
  });

  it('[Z0-P01] upper bound only filters up to the upper bound, no implicit lower bound', () => {
    expect(ids({ ageRange: [null, 60] })).toEqual(['a55']);
  });

  it('[Z0-P01] both bounds filter inclusively', () => {
    expect(ids({ ageRange: [70, 85] })).toEqual(['b70', 'c85']);
  });

  it('[Z0-P01] sanitizers keep open bounds as null and still accept old closed 2-tuples', () => {
    expect(sanitizeSavedSearchFilters({ ageRange: [70, null] })).toHaveProperty('ageRange', [70, null]);
    expect(sanitizeSavedSearchFilters({ ageRange: [null, 60] })).toHaveProperty('ageRange', [null, 60]);
    expect(sanitizeSavedSearchFilters({ ageRange: [20, 80] })).toHaveProperty('ageRange', [20, 80]);
    expect(safePickCohortFilter({ ageRange: [70, null] }).ageRange).toEqual([70, null]);
    expect(safePickCohortFilter({ ageRange: [null, 60] }).ageRange).toEqual([null, 60]);
    expect(safePickCohortFilter({ ageRange: [20, 80] }).ageRange).toEqual([20, 80]);
  });

  it('[Z0-P01] splitting a cohort with an open age bound keeps the bin bound on the open side', () => {
    const groups = computeSplitGroups({
      parentCases: applyFilters(CASES, { ageRange: [70, null] }),
      parentFilter: { ageRange: [70, null] },
      spec: { kind: 'range', attribute: 'age', mode: 'cutpoints', cutPoints: [80] },
    });
    expect(groups.map((g) => g.count)).toEqual([1, 2]);
    expect(groups.map((g) => applyFilters(CASES, g.filter).map((c) => c.id))).toEqual([['b70'], ['c85', 'd95']]);
  });

  it('[Z0-P01] summary uses "Alter ≥ n" / "Alter ≤ n" for open bounds (Q1), localised', () => {
    expect(summarizeCohortFilter({ ageRange: [70, null] })).toBe('Alter ≥ 70');
    expect(summarizeCohortFilter({ ageRange: [null, 60] })).toBe('Alter ≤ 60');
    expect(summarizeCohortFilter({ ageRange: [70, null] }, 'en')).toBe('Age ≥ 70');
    expect(summarizeCohortFilter({ ageRange: [null, 60] }, 'en')).toBe('Age ≤ 60');
    expect(summarizeCohortFilter({ ageRange: [50, 70] }, 'de')).toBe('Alter 50–70');
  });
});
