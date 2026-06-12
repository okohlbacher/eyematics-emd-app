import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PatientCase } from '../src/types/fhir';
import {
  computeMetrics,
  cutoffDate,
  filterCasesByTimeRange,
  QUALITY_CATEGORY_COLORS,
  type QualityCategory,
} from '../src/utils/qualityMetrics';

// ---------------------------------------------------------------------------
// filterCasesByTimeRange — A2 time-window semantics
// ---------------------------------------------------------------------------

// Frozen "now" for deterministic cutoff calculations.
// cutoffDate() uses `new Date()` internally, so we freeze time via vi.useFakeTimers.
const FROZEN_NOW = new Date('2026-06-01T00:00:00Z');

/** Minimal valid observation helper (matches shape used in QualityPage.test.tsx fixtures). */
function makeObs(effectiveDateTime: string) {
  return {
    id: `obs-${effectiveDateTime}`,
    code: { coding: [{ system: 'http://loinc.org', code: 'LP267955-5', display: 'CRT' }] },
    valueQuantity: { value: 250, unit: 'um' },
    effectiveDateTime,
  } as PatientCase['observations'][number];
}

/** Minimal valid PatientCase helper. */
function makeCase(id: string, obsDates: string[]): PatientCase {
  return {
    id,
    pseudonym: id,
    gender: 'male',
    birthDate: '1960-01-01',
    centerId: 'CENTER-TEST',
    centerName: 'Test Center',
    conditions: [],
    observations: obsDates.map(makeObs),
    medications: [],
    procedures: [],
    imagingStudies: [],
  };
}

describe('filterCasesByTimeRange — A2 window-scoped case semantics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('cutoffDate("6m") returns ~6 months before frozen now', () => {
    const cutoff = cutoffDate('6m');
    expect(cutoff).not.toBeNull();
    // Frozen now = 2026-06-01; 6m cutoff = local 2025-12-01.
    // Use getFullYear/getMonth/getDate (local calendar) to avoid timezone offset in toISOString().
    expect(cutoff!.getFullYear()).toBe(2025);
    expect(cutoff!.getMonth()).toBe(11); // 0-indexed → December
    expect(cutoff!.getDate()).toBe(1);
  });

  it('cutoffDate("all") returns null (no cutoff)', () => {
    expect(cutoffDate('all')).toBeNull();
  });

  it('range="all": all cases returned unchanged (no filtering)', () => {
    const cases = [
      makeCase('old', ['2015-01-01T00:00:00Z']),
      makeCase('recent', ['2026-05-01T00:00:00Z']),
    ];
    const result = filterCasesByTimeRange(cases, 'all');
    expect(result).toHaveLength(2);
    expect(result[0]!.observations).toHaveLength(1);
    expect(result[1]!.observations).toHaveLength(1);
  });

  it('range="6m": case with obs ONLY outside window is excluded (A2 core fix)', () => {
    // obs before 2025-12-01 → outside 6m window
    const outsideCase = makeCase('outside', ['2020-03-15T00:00:00Z']);
    // obs after 2025-12-01 → inside 6m window
    const insideCase = makeCase('inside', ['2026-04-10T00:00:00Z']);

    const result = filterCasesByTimeRange([outsideCase, insideCase], '6m');
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('inside');
  });

  it('range="6m": case with obs inside window is INCLUDED with trimmed obs', () => {
    const mixedCase = makeCase('mixed', [
      '2020-01-01T00:00:00Z', // outside window
      '2026-03-01T00:00:00Z', // inside window
    ]);

    const result = filterCasesByTimeRange([mixedCase], '6m');
    expect(result).toHaveLength(1);
    expect(result[0]!.observations).toHaveLength(1);
    expect(result[0]!.observations[0]!.effectiveDateTime).toBe('2026-03-01T00:00:00Z');
  });

  it('range="6m" then range="all": previously-excluded case is now included', () => {
    const oldCase = makeCase('old', ['2010-05-01T00:00:00Z']);

    const at6m = filterCasesByTimeRange([oldCase], '6m');
    expect(at6m).toHaveLength(0);

    const atAll = filterCasesByTimeRange([oldCase], 'all');
    expect(atAll).toHaveLength(1);
    expect(atAll[0]!.observations).toHaveLength(1);
  });

  it('range="6m": empty input produces empty output (0-safe)', () => {
    expect(filterCasesByTimeRange([], '6m')).toHaveLength(0);
  });

  it('range="6m": case with no observations at all is excluded', () => {
    const noObsCase = makeCase('empty', []);
    const result = filterCasesByTimeRange([noObsCase], '6m');
    expect(result).toHaveLength(0);
  });

  it('patientCount from computeMetrics reflects only windowed cases (not raw cases)', () => {
    const outsideCase = makeCase('outside', ['2018-01-01T00:00:00Z']);
    const insideCase = makeCase('inside', ['2026-05-15T00:00:00Z']);

    const rawMetrics = computeMetrics([outsideCase, insideCase]);
    expect(rawMetrics.patientCount).toBe(2);

    const windowed = filterCasesByTimeRange([outsideCase, insideCase], '6m');
    const windowedMetrics = computeMetrics(windowed);
    expect(windowedMetrics.patientCount).toBe(1);
  });
});

describe('QUALITY_CATEGORY_COLORS', () => {
  it('exposes exactly the four QualityCategory keys', () => {
    const expectedKeys: QualityCategory[] = [
      'completeness',
      'dataCompleteness',
      'plausibility',
      'overall',
    ];
    expect(Object.keys(QUALITY_CATEGORY_COLORS).sort()).toEqual(
      [...expectedKeys].sort()
    );
  });

  it('uses muted page-established CSS-var tokens (D-12, D-13)', () => {
    for (const key of Object.keys(QUALITY_CATEGORY_COLORS) as QualityCategory[]) {
      const value = QUALITY_CATEGORY_COLORS[key];
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
      expect(value.startsWith('var(--color-')).toBe(true);
    }
  });

  it('keeps the four series visually distinguishable (D-14)', () => {
    const values = Object.values(QUALITY_CATEGORY_COLORS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
