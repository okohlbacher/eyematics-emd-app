/**
 * C3 — Cohort "Split by" engine unit tests (shared/cohortSplit.ts).
 *
 * Covers the split → child-filter mapping for all three categorical attributes
 * and both range modes (cut points + quantile), plus the documented edge
 * decisions: half-open [lo, hi) bins (exactly-one membership), quantile ties /
 * too-few-patients, cut-point validation, and child naming + collision handling.
 */
import { describe, expect, it } from 'vitest';

import {
  buildChildName,
  computeSplitGroups,
  normalizeCutPoints,
  quantileCutPoints,
  quantileSorted,
} from '../shared/cohortSplit';
import { LOINC_CRT, LOINC_VISUS, SNOMED_AMD, SNOMED_DR } from '../shared/fhirCodes';
import type { PatientCase } from '../shared/types/fhir';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

interface MakeOpts {
  gender?: string;
  centerId?: string;
  birthDate?: string;
  visus?: number;
  crt?: number;
  diagnoses?: string[];
}

function makeCase(id: string, opts: MakeOpts = {}): PatientCase {
  const observations: unknown[] = [];
  if (opts.visus != null) {
    observations.push({
      resourceType: 'Observation',
      id: `${id}-visus`,
      status: 'final',
      code: { coding: [{ code: LOINC_VISUS, system: 'http://loinc.org' }] },
      subject: { reference: `Patient/${id}` },
      effectiveDateTime: '2024-06-01T00:00:00Z',
      valueQuantity: { value: opts.visus, unit: 'decimal' },
    });
  }
  if (opts.crt != null) {
    observations.push({
      resourceType: 'Observation',
      id: `${id}-crt`,
      status: 'final',
      code: { coding: [{ code: LOINC_CRT, system: 'http://loinc.org' }] },
      subject: { reference: `Patient/${id}` },
      effectiveDateTime: '2024-06-01T00:00:00Z',
      valueQuantity: { value: opts.crt, unit: 'um' },
    });
  }
  const conditions = (opts.diagnoses ?? []).map((code, i) => ({
    resourceType: 'Condition',
    id: `${id}-cond-${i}`,
    code: { coding: [{ code, system: 'http://snomed.info/sct' }] },
    subject: { reference: `Patient/${id}` },
  }));
  return {
    id,
    pseudonym: id,
    gender: opts.gender ?? 'unknown',
    birthDate: opts.birthDate ?? '1970-01-01',
    centerId: opts.centerId ?? 'org-a',
    centerName: opts.centerId ?? 'org-a',
    conditions,
    observations,
    procedures: [],
    imagingStudies: [],
    medications: [],
  } as unknown as PatientCase;
}

// Birth dates chosen relative to a fixed "now" assumption are brittle; instead we
// compute ages from birthDate at test time and assert on relative ordering of bins.
function birthForAge(age: number): string {
  const y = new Date().getFullYear() - age;
  return `${y}-01-01`;
}

// ---------------------------------------------------------------------------
// quantileSorted
// ---------------------------------------------------------------------------

describe('quantileSorted', () => {
  it('returns endpoints for q<=0 and q>=1', () => {
    expect(quantileSorted([1, 2, 3, 4], 0)).toBe(1);
    expect(quantileSorted([1, 2, 3, 4], 1)).toBe(4);
  });
  it('linear-interpolates the median (type-7)', () => {
    expect(quantileSorted([1, 2, 3, 4], 0.5)).toBe(2.5);
    expect(quantileSorted([1, 2, 3], 0.5)).toBe(2);
  });
  it('throws on empty input (D-03)', () => {
    expect(() => quantileSorted([], 0.5)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// quantileCutPoints — ties + too-few handling
// ---------------------------------------------------------------------------

describe('quantileCutPoints', () => {
  const round = (n: number) => Math.round(n);
  it('produces N-1 strictly increasing cut points for a spread distribution', () => {
    const cuts = quantileCutPoints([10, 20, 30, 40, 50, 60], 3, round);
    expect(cuts.length).toBe(2);
    expect(cuts[0]).toBeLessThan(cuts[1]);
  });
  it('collapses ties so fewer cuts form when the distribution is degenerate', () => {
    // All identical → every interior quantile equals the same value → dedup
    // collapses 2 requested cuts down to a single distinct cut.
    const cuts = quantileCutPoints([5, 5, 5, 5], 3, round);
    expect(cuts.length).toBe(1);
    expect(cuts[0]).toBe(5);
  });
  it('returns no cuts only for empty input', () => {
    expect(quantileCutPoints([], 3, round)).toEqual([]);
  });
  it('reduces effective groups when rounding ties two adjacent quantiles', () => {
    const cuts = quantileCutPoints([1, 1, 1, 2, 2, 2], 3, round);
    // tertile cuts ~1 and ~2 after rounding → 2 distinct cuts at most
    expect(new Set(cuts).size).toBe(cuts.length);
  });
  it('throws when groups < 2', () => {
    expect(() => quantileCutPoints([1, 2, 3], 1, round)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// normalizeCutPoints — validation
// ---------------------------------------------------------------------------

describe('normalizeCutPoints', () => {
  it('sorts, dedups, drops non-finite', () => {
    expect(normalizeCutPoints([70, 50, 50, NaN, Infinity, 60])).toEqual([50, 60, 70]);
  });
  it('throws when nothing valid remains (D-03)', () => {
    expect(() => normalizeCutPoints([NaN, Infinity])).toThrow();
  });
});

// ---------------------------------------------------------------------------
// buildChildName — collision handling
// ---------------------------------------------------------------------------

describe('buildChildName', () => {
  it('returns Parent:Sub when free', () => {
    expect(buildChildName('C1', 'Male', () => false)).toBe('C1:Male');
  });
  it('suffixes on collision, preserving the single-colon structure', () => {
    const taken = new Set(['C1:Male']);
    const name = buildChildName('C1', 'Male', (c) => taken.has(c));
    expect(name).toBe('C1:Male (2)');
    // still exactly one colon ⇒ valid subcohort name
    expect(name.split(':').length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// computeSplitGroups — categorical
// ---------------------------------------------------------------------------

describe('computeSplitGroups — categorical', () => {
  it('gender: one group per distinct value, child filter intersects parent', () => {
    const cases = [
      makeCase('a', { gender: 'female' }),
      makeCase('b', { gender: 'male' }),
      makeCase('c', { gender: 'female' }),
    ];
    const groups = computeSplitGroups({
      parentCases: cases,
      parentFilter: { centers: ['org-a'] },
      spec: { kind: 'categorical', attribute: 'gender' },
    });
    expect(groups.length).toBe(2);
    const female = groups.find((g) => g.filter.gender?.[0] === 'female');
    expect(female?.count).toBe(2);
    // child preserves parent predicate
    expect(female?.filter.centers).toEqual(['org-a']);
  });

  it('center: one group per distinct centerId present', () => {
    const cases = [
      makeCase('a', { centerId: 'org-a' }),
      makeCase('b', { centerId: 'org-b' }),
      makeCase('c', { centerId: 'org-b' }),
    ];
    const groups = computeSplitGroups({
      parentCases: cases,
      parentFilter: {},
      spec: { kind: 'categorical', attribute: 'center' },
    });
    expect(groups.length).toBe(2);
    expect(groups.find((g) => g.filter.centers?.[0] === 'org-b')?.count).toBe(2);
  });

  it('diagnosis: a case with both codes lands in BOTH groups (matches filter semantics)', () => {
    const cases = [
      makeCase('a', { diagnoses: [SNOMED_AMD] }),
      makeCase('b', { diagnoses: [SNOMED_AMD, SNOMED_DR] }),
      makeCase('c', { diagnoses: [SNOMED_DR] }),
    ];
    const groups = computeSplitGroups({
      parentCases: cases,
      parentFilter: {},
      spec: { kind: 'categorical', attribute: 'diagnosis' },
    });
    expect(groups.length).toBe(2);
    expect(groups.find((g) => g.filter.diagnosis?.[0] === SNOMED_AMD)?.count).toBe(2);
    expect(groups.find((g) => g.filter.diagnosis?.[0] === SNOMED_DR)?.count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// computeSplitGroups — range cut points (exactly-one membership)
// ---------------------------------------------------------------------------

describe('computeSplitGroups — range cut points', () => {
  it('age cut points [50,70] partition cases into 3 disjoint bins; each case counted once', () => {
    const cases = [
      makeCase('young', { birthDate: birthForAge(40) }),
      makeCase('mid', { birthDate: birthForAge(60) }),
      makeCase('boundaryLow', { birthDate: birthForAge(50) }), // exactly 50 → middle bin
      makeCase('boundaryHigh', { birthDate: birthForAge(70) }), // exactly 70 → upper bin
      makeCase('old', { birthDate: birthForAge(80) }),
    ];
    const groups = computeSplitGroups({
      parentCases: cases,
      parentFilter: {},
      spec: { kind: 'range', attribute: 'age', mode: 'cutpoints', cutPoints: [50, 70] },
    });
    expect(groups.length).toBe(3);
    const total = groups.reduce((s, g) => s + g.count, 0);
    expect(total).toBe(cases.length); // exactly-one membership
    // (-inf,50): only the 40yo
    expect(groups[0].count).toBe(1);
    // [50,70): 50yo + 60yo
    expect(groups[1].count).toBe(2);
    // [70,+inf): 70yo + 80yo
    expect(groups[2].count).toBe(2);
  });

  it('visus continuous cut point [0.5]: value exactly on cut lands in the UPPER bin', () => {
    const cases = [
      makeCase('lo', { visus: 0.3 }),
      makeCase('onCut', { visus: 0.5 }),
      makeCase('hi', { visus: 0.8 }),
    ];
    const groups = computeSplitGroups({
      parentCases: cases,
      parentFilter: {},
      spec: { kind: 'range', attribute: 'visus', mode: 'cutpoints', cutPoints: [0.5] },
    });
    expect(groups.length).toBe(2);
    expect(groups[0].count).toBe(1); // (-inf, 0.5): only 0.3
    expect(groups[1].count).toBe(2); // [0.5, +inf): 0.5 and 0.8
  });

  it('throws for an empty cut-point list', () => {
    expect(() =>
      computeSplitGroups({
        parentCases: [makeCase('a', { visus: 0.5 })],
        parentFilter: {},
        spec: { kind: 'range', attribute: 'visus', mode: 'cutpoints', cutPoints: [] },
      }),
    ).toThrow();
  });
});

// ---------------------------------------------------------------------------
// computeSplitGroups — range quantile
// ---------------------------------------------------------------------------

describe('computeSplitGroups — range quantile', () => {
  it('CRT tertiles split a spread cohort into 3 non-empty roughly-equal bins', () => {
    const cases = Array.from({ length: 9 }, (_, i) =>
      makeCase(`c${i}`, { crt: 200 + i * 30 }), // 200..440
    );
    const groups = computeSplitGroups({
      parentCases: cases,
      parentFilter: {},
      spec: { kind: 'range', attribute: 'crt', mode: 'quantile', groups: 3 },
    });
    expect(groups.length).toBe(3);
    const total = groups.reduce((s, g) => s + g.count, 0);
    expect(total).toBe(9); // exactly-one membership across quantile bins
    groups.forEach((g) => expect(g.count).toBeGreaterThan(0));
  });

  it('degenerate (all equal) quantile split collapses to a single non-empty bin', () => {
    // All CRT=300 → one interior cut at 300 → bins (-inf,300)=empty, [300,+inf)=all.
    // The engine returns the groups; only ONE is non-empty, so the dialog confirm
    // gate (>=2 non-empty) blocks creation. Membership is still exactly-one.
    const cases = Array.from({ length: 6 }, (_, i) => makeCase(`c${i}`, { crt: 300 }));
    const groups = computeSplitGroups({
      parentCases: cases,
      parentFilter: {},
      spec: { kind: 'range', attribute: 'crt', mode: 'quantile', groups: 3 },
    });
    const nonEmpty = groups.filter((g) => g.count > 0);
    expect(nonEmpty.length).toBe(1);
    expect(groups.reduce((s, g) => s + g.count, 0)).toBe(6);
  });

  it('quantile split with NO values for the variable throws (too few patients)', () => {
    // Cases have no CRT observation → no values → zero cuts → throw.
    const cases = Array.from({ length: 4 }, (_, i) => makeCase(`c${i}`, { visus: 0.5 }));
    expect(() =>
      computeSplitGroups({
        parentCases: cases,
        parentFilter: {},
        spec: { kind: 'range', attribute: 'crt', mode: 'quantile', groups: 3 },
      }),
    ).toThrow();
  });
});
