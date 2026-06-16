import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FhirBundle, PatientCase } from '../src/types/fhir';
import {
  computeMetrics,
  countRawPatientsInWindow,
  cutoffDate,
  filterCasesByTimeRange,
  isCustomTimeRange,
  QUALITY_CATEGORY_COLORS,
  type QualityCategory,
  timeRangeWindow,
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
    // Frozen now = 2026-06-01Z; 6m cutoff = UTC 2025-12-01 (bounds parsed in UTC
    // to match date-only observation timestamps; assert in UTC so the test is TZ-independent).
    expect(cutoff!.getUTCFullYear()).toBe(2025);
    expect(cutoff!.getUTCMonth()).toBe(11); // 0-indexed → December
    expect(cutoff!.getUTCDate()).toBe(1);
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

/** A fully-documented patient (birthDate, gender, ≥1 condition) used to assert
 *  completeness reads ~100% when every windowed patient is complete. */
function makeCompleteCase(id: string, obsDates: string[]): PatientCase {
  return {
    ...makeCase(id, obsDates),
    conditions: [
      { id: `cond-${id}`, code: { coding: [{ system: 'http://snomed', code: '1', display: 'x' }] } },
    ] as PatientCase['conditions'],
  };
}

// ---------------------------------------------------------------------------
// B1 — 3m preset, custom from/to range, windowed metric denominator
// ---------------------------------------------------------------------------

describe('B1 — cutoffDate / timeRangeWindow new ranges', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('cutoffDate("3m") returns ~3 months before frozen now', () => {
    const cutoff = cutoffDate('3m');
    expect(cutoff).not.toBeNull();
    // Frozen now = 2026-06-01Z; 3m cutoff = UTC 2026-03-01 (assert in UTC, TZ-independent).
    expect(cutoff!.getUTCFullYear()).toBe(2026);
    expect(cutoff!.getUTCMonth()).toBe(2); // 0-indexed → March
    expect(cutoff!.getUTCDate()).toBe(1);
  });

  it('timeRangeWindow("all") returns null (no window)', () => {
    expect(timeRangeWindow('all')).toBeNull();
  });

  it('timeRangeWindow(preset) has from=cutoff and to≈now', () => {
    const w = timeRangeWindow('6m');
    expect(w).not.toBeNull();
    expect(w!.from.getUTCMonth()).toBe(11); // Dec 2025 (UTC cutoff)
    expect(w!.to.getTime()).toBe(FROZEN_NOW.getTime());
  });

  it('isCustomTimeRange distinguishes preset strings from {from,to}', () => {
    expect(isCustomTimeRange('6m')).toBe(false);
    expect(isCustomTimeRange('all')).toBe(false);
    expect(isCustomTimeRange({ from: '2026-01-01', to: '2026-03-01' })).toBe(true);
  });

  it('custom range: both bounds applied (inclusive from start-of-day / to end-of-day)', () => {
    const w = timeRangeWindow({ from: '2026-01-01', to: '2026-03-01' });
    expect(w).not.toBeNull();
    // Parsed in UTC (matching date-only observation timestamps): from = start of
    // day, to = end of day (inclusive).
    expect(w!.from.getTime()).toBe(new Date('2026-01-01T00:00:00Z').getTime());
    expect(w!.to.getTime()).toBe(new Date('2026-03-01T23:59:59.999Z').getTime());
  });

  it('custom range: an observation on either boundary day is included (TZ-independent, UTC)', () => {
    // Date-only timestamps like the real data (UTC midnight) on both bounds.
    const c = makeCase('c', ['2026-01-01', '2026-03-01']);
    const result = filterCasesByTimeRange([c], { from: '2026-01-01', to: '2026-03-01' });
    expect(result).toHaveLength(1);
    expect(result[0]!.observations).toHaveLength(2);
  });

  it('custom range with from>to is rejected (null → no window)', () => {
    expect(timeRangeWindow({ from: '2026-05-01', to: '2026-01-01' })).toBeNull();
  });

  it('custom range with empty/missing bound is rejected (null → no window)', () => {
    expect(timeRangeWindow({ from: '', to: '2026-01-01' })).toBeNull();
    expect(timeRangeWindow({ from: '2026-01-01', to: '' })).toBeNull();
  });

  it('custom range with unparseable date is rejected (null → no window)', () => {
    expect(timeRangeWindow({ from: 'not-a-date', to: '2026-01-01' })).toBeNull();
  });
});

describe('B1 — filterCasesByTimeRange with new ranges', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('3m preset: only cases with obs in the last 3 months survive', () => {
    const inside = makeCase('inside', ['2026-04-15T00:00:00Z']); // within 3m of 2026-06-01
    const outside = makeCase('outside', ['2026-01-15T00:00:00Z']); // before 2026-03-01 cutoff
    const result = filterCasesByTimeRange([inside, outside], '3m');
    expect(result.map((c) => c.id)).toEqual(['inside']);
  });

  it('custom range: clips to BOTH bounds (obs after `to` are excluded)', () => {
    const c = makeCase('c', [
      '2025-12-15T00:00:00Z', // before from
      '2026-02-01T00:00:00Z', // inside
      '2026-05-01T00:00:00Z', // after to
    ]);
    const result = filterCasesByTimeRange([c], { from: '2026-01-01', to: '2026-03-01' });
    expect(result).toHaveLength(1);
    expect(result[0]!.observations).toHaveLength(1);
    expect(result[0]!.observations[0]!.effectiveDateTime).toBe('2026-02-01T00:00:00Z');
  });

  it('malformed custom range (from>to): returns cases unwindowed (0-safe, no empty collapse)', () => {
    const c = makeCase('c', ['2026-02-01T00:00:00Z']);
    const result = filterCasesByTimeRange([c], { from: '2026-05-01', to: '2026-01-01' });
    // window disabled → all cases returned untrimmed (never silently zero)
    expect(result).toHaveLength(1);
    expect(result[0]!.observations).toHaveLength(1);
  });
});

describe('I5 (v1.14) — Vollzähligkeit = active-in-window / full registered total', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('aggregate matches the landing definition when unfiltered (active==registered)', () => {
    // 2 active patients, raw registered total = 4 (2 stubs not in cases).
    const a = makeCompleteCase('a', ['2026-04-01T00:00:00Z']);
    const b = makeCompleteCase('b', ['2026-05-01T00:00:00Z']);
    const allWindowed = filterCasesByTimeRange([a, b], 'all');
    // rawTotal default (=cases.length) reproduces the all-time landing number
    // when there are no stubs: 2/2 = 100%.
    expect(computeMetrics(allWindowed).completeness).toBe(100);
    // With stubs (rawTotal=4): 2 active / 4 registered = 50% — the landing formula.
    expect(computeMetrics(allWindowed, 4).completeness).toBe(50);
  });

  it('does NOT collapse to ~100% as the window shrinks (numerator windowed, denominator full)', () => {
    // Two fully-documented patients: one active long ago, one active recently.
    const oldPatient = makeCompleteCase('old', ['2015-01-01T00:00:00Z']);
    const recentPatient = makeCompleteCase('recent', ['2026-04-01T00:00:00Z']);
    // Full registered total stays 2 regardless of the window (NOT windowed).
    const rawTotal = 2;

    // 'all' window: both active → 2/2 = 100%.
    const allWindowed = filterCasesByTimeRange([oldPatient, recentPatient], 'all');
    expect(computeMetrics(allWindowed, rawTotal).patientCount).toBe(2);
    expect(computeMetrics(allWindowed, rawTotal).completeness).toBe(100);

    // 3m window: only the recent patient is active. Numerator shrinks to 1,
    // denominator stays 2 → 50%. This is the B1 no-collapse guarantee: the
    // metric FALLS instead of staying pinned at ~100%.
    const shortWindowed = filterCasesByTimeRange([oldPatient, recentPatient], '3m');
    const shortMetrics = computeMetrics(shortWindowed, rawTotal);
    expect(shortMetrics.patientCount).toBe(1); // numerator (active-in-window) shrank
    expect(shortMetrics.completeness).toBe(50); // denominator held full → 50%, NOT 100%
  });

  it('clamps to 100% when the numerator exceeds the denominator', () => {
    const a = makeCompleteCase('a', ['2026-04-01T00:00:00Z']);
    const b = makeCompleteCase('b', ['2026-05-01T00:00:00Z']);
    const windowed = filterCasesByTimeRange([a, b], 'all');
    // Malformed: rawTotal=1 but 2 active → clamp to 100, never >100.
    expect(computeMetrics(windowed, 1).completeness).toBe(100);
  });

  it('no NaN / 0-safe when the window has no active patients or rawTotal is 0', () => {
    const oldPatient = makeCompleteCase('old', ['2010-01-01T00:00:00Z']);
    const windowed = filterCasesByTimeRange([oldPatient], '3m');
    expect(windowed).toHaveLength(0);
    const m = computeMetrics(windowed, 5);
    expect(m.patientCount).toBe(0);
    expect(m.completeness).toBe(0); // 0 active / 5 registered = 0
    // rawTotal=0 path is also 0-safe (no division by zero).
    expect(computeMetrics(windowed, 0).completeness).toBe(0);
    expect(Number.isNaN(m.completeness)).toBe(false);
    expect(Number.isNaN(m.dataCompleteness)).toBe(false);
    expect(Number.isNaN(m.plausibility)).toBe(false);
    expect(Number.isNaN(m.overall)).toBe(false);
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

// ---------------------------------------------------------------------------
// M14 (v1.18) — Vollzähligkeit denominator follows the time-range filter
// ---------------------------------------------------------------------------

/** Build a minimal bundle with `patientCount` Patient stubs and one Observation
 *  per supplied date (subject = Patient/p<i>), so the windowed denominator can
 *  be exercised against real bundle resources. */
function makeBundle(patientIds: string[], obs: Array<{ patientId: string; date: string }>): FhirBundle {
  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: [
      ...patientIds.map((id) => ({ resource: { resourceType: 'Patient', id } })),
      ...obs.map((o, i) => ({
        resource: {
          resourceType: 'Observation',
          id: `obs-${i}`,
          status: 'final',
          subject: { reference: `Patient/${o.patientId}` },
          code: { coding: [{ system: 'http://loinc.org', code: 'LP267955-5' }] },
          effectiveDateTime: o.date,
        },
      })),
    ],
  } as unknown as FhirBundle;
}

describe('M14 — countRawPatientsInWindow restricts the denominator to the range', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('range="all" returns null (caller falls back to the full registered total)', () => {
    const bundle = makeBundle(['p1', 'p2', 'p3'], [
      { patientId: 'p1', date: '2026-05-01T00:00:00Z' },
    ]);
    expect(countRawPatientsInWindow([bundle], 'all')).toBeNull();
  });

  it('windowed range counts only patients with an observation inside the window', () => {
    // p1 active recently (inside 3m of 2026-06-01), p2 active long ago (outside),
    // p3 a pure stub (no observations). Full registered total = 3, but the 3m
    // window must count ONLY p1 — NOT the full dataset (the M14 bug).
    const bundle = makeBundle(['p1', 'p2', 'p3'], [
      { patientId: 'p1', date: '2026-05-01T00:00:00Z' },
      { patientId: 'p2', date: '2018-01-01T00:00:00Z' },
    ]);
    expect(countRawPatientsInWindow([bundle], '3m')).toBe(1);
    // The all-time total (what the bug pinned to) would be 3 — assert we differ.
    expect(countRawPatientsInWindow([bundle], '3m')).not.toBe(3);
  });

  it('counts each active patient once even with multiple in-window observations', () => {
    const bundle = makeBundle(['p1', 'p2'], [
      { patientId: 'p1', date: '2026-04-01T00:00:00Z' },
      { patientId: 'p1', date: '2026-05-01T00:00:00Z' },
      { patientId: 'p2', date: '2026-05-15T00:00:00Z' },
    ]);
    expect(countRawPatientsInWindow([bundle], '3m')).toBe(2);
  });

  it('custom range clips to both bounds', () => {
    const bundle = makeBundle(['p1', 'p2', 'p3'], [
      { patientId: 'p1', date: '2025-12-15T00:00:00Z' }, // before from
      { patientId: 'p2', date: '2026-02-01T00:00:00Z' }, // inside
      { patientId: 'p3', date: '2026-05-01T00:00:00Z' }, // after to
    ]);
    expect(countRawPatientsInWindow([bundle], { from: '2026-01-01', to: '2026-03-01' })).toBe(1);
  });

  it('0-safe: no in-window observations yields 0 (not the full total)', () => {
    const bundle = makeBundle(['p1', 'p2'], [
      { patientId: 'p1', date: '2010-01-01T00:00:00Z' },
    ]);
    expect(countRawPatientsInWindow([bundle], '3m')).toBe(0);
  });
});
