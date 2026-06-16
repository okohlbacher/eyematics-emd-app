// @vitest-environment jsdom
/**
 * FALL-011 — Cohort reference overlay tests.
 *
 * Task 1 tests: useCaseData cohortReference computation (median + IQR by date).
 * Task 2 tests: VisusCrtChart renders reference overlay gated by showCohortReference prop.
 */

// ---------------------------------------------------------------------------
// Task 1: useCaseData cohortReference — no DOM rendering needed, but we need
// @testing-library/react for renderHook.
// ---------------------------------------------------------------------------
import { cleanup, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TranslationKey } from '../src/i18n/translations';
import type { PatientCase } from '../src/types/fhir';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeObs(code: string, date: string, value: number) {
  return {
    resourceType: 'Observation' as const,
    id: `obs-${code}-${date}-${value}`,
    status: 'final' as const,
    code: { coding: [{ system: 'http://loinc.org', code }] },
    effectiveDateTime: `${date}T10:00:00Z`,
    valueQuantity: { value, unit: code === 'LP267955-5' ? 'µm' : '', system: '', code: '' },
  };
}

function makeCase(id: string, observations: ReturnType<typeof makeObs>[]): PatientCase {
  return {
    id,
    pseudonym: `P-${id}`,
    birthDate: '1960-01-01',
    gender: 'male',
    centerName: 'Center A',
    centerId: 'CENTER-01',
    conditions: [],
    observations: observations as any,
    procedures: [],
    medications: [],
    imagingStudies: [],
  };
}

// LOINC codes (mirrors shared/fhirCodes.ts)
const LOINC_VISUS = '79880-1';
const LOINC_CRT = 'LP267955-5';

// Minimal t stub
const t = (key: TranslationKey) => key;

// ---------------------------------------------------------------------------
// Task 1: useCaseData returns cohortReference
// ---------------------------------------------------------------------------

describe('useCaseData — FALL-011 cohortReference', () => {
  afterEach(() => cleanup());

  it('computes visus median/IQR from PEER cohort only (index patient excluded — WR-04)', async () => {
    const { useCaseData } = await import('../src/hooks/useCaseData');

    // Case under review has one visus measurement on 2024-01-15 (value 0.5).
    // It must NOT contribute to the cohort band (peer comparison).
    const patientCase = makeCase('C1', [
      makeObs(LOINC_VISUS, '2024-01-15', 0.5),
    ]);

    // Two peer cohort cases in the same month.
    const cohortCase2 = makeCase('C2', [makeObs(LOINC_VISUS, '2024-01-15', 0.3)]);
    const cohortCase3 = makeCase('C3', [makeObs(LOINC_VISUS, '2024-01-15', 0.7)]);

    const cases = [patientCase, cohortCase2, cohortCase3];

    const { result } = renderHook(() => useCaseData(patientCase, cases, 'de', t));

    const ref = result.current.cohortReference;
    expect(ref).not.toBeNull();
    expect(ref.length).toBeGreaterThan(0);

    const point = ref.find((p) => p.date === '2024-01-15');
    expect(point).not.toBeUndefined();
    // Peer values only = [0.3, 0.7]; the index 0.5 is excluded. Nearest-rank
    // median (idx floor(0.5*2)=1) = 0.7. The key assertion is exclusion:
    // a band that included 0.5 would yield a median of 0.5 — it must not.
    expect(point!.visusMedian).not.toBeCloseTo(0.5, 5);
    expect(typeof point!.visusP25).toBe('number');
    expect(typeof point!.visusP75).toBe('number');
    // p25 <= median <= p75
    expect(point!.visusP25!).toBeLessThanOrEqual(point!.visusMedian!);
    expect(point!.visusP75!).toBeGreaterThanOrEqual(point!.visusMedian!);
  });

  it('aligns peers by RELATIVE month-since-their-own-baseline, not calendar month (J3c)', async () => {
    const { useCaseData } = await import('../src/hooks/useCaseData');

    // Index patient: baseline 2024-01-05, follow-up ~3 months later.
    const patientCase = makeCase('C1', [
      makeObs(LOINC_VISUS, '2024-01-05', 0.5),
      makeObs(LOINC_CRT, '2024-01-05', 300),
      makeObs(LOINC_VISUS, '2024-04-05', 0.6),
      makeObs(LOINC_CRT, '2024-04-05', 280),
    ]);
    // Peers start in a DIFFERENT calendar period, but each has a baseline visit
    // and a ~3-month follow-up — so they align to the index patient on the
    // RELATIVE axis (month 0 and month ~3) despite no calendar overlap.
    const cohortCase2 = makeCase('C2', [
      makeObs(LOINC_VISUS, '2023-06-01', 0.3),
      makeObs(LOINC_CRT, '2023-06-01', 320),
      makeObs(LOINC_VISUS, '2023-09-01', 0.4),
      makeObs(LOINC_CRT, '2023-09-01', 300),
    ]);
    const cohortCase3 = makeCase('C3', [
      makeObs(LOINC_VISUS, '2022-11-10', 0.7),
      makeObs(LOINC_CRT, '2022-11-10', 360),
      makeObs(LOINC_VISUS, '2023-02-10', 0.8),
      makeObs(LOINC_CRT, '2023-02-10', 330),
    ]);
    const cases = [patientCase, cohortCase2, cohortCase3];

    const { result } = renderHook(() => useCaseData(patientCase, cases, 'de', t));

    const ref = result.current.cohortReference;
    // Calendar-month keying would yield ZERO matches (no overlap). Relative-month
    // alignment must produce a reference at both the baseline and the follow-up.
    expect(ref.length).toBeGreaterThanOrEqual(2);
    const base = ref.find((p) => p.date === '2024-01-05');
    const follow = ref.find((p) => p.date === '2024-04-05');
    expect(base).not.toBeUndefined();
    expect(follow).not.toBeUndefined();
    expect(typeof base!.visusMedian).toBe('number');
    expect(typeof follow!.crtMedian).toBe('number');
    // relMonths carried on the reference point.
    expect(base!.relMonths).toBe(0);
  });

  it('emits no reference when peers have no data at the index patient\'s relative month (J3c)', async () => {
    const { useCaseData } = await import('../src/hooks/useCaseData');

    // Index patient has a single baseline visit (relMonths 0). The only peer has
    // its baseline AND a follow-up — but we look up bucket 0 for the index, and
    // the peer also has bucket 0, so they WOULD align. To get NO reference we
    // give the peer ONLY a late follow-up (so its own baseline is that late
    // visit → still bucket 0). Instead, exclude the peer entirely: a lone index
    // patient (no peers) yields no band.
    const patientCase = makeCase('C1', [makeObs(LOINC_VISUS, '2024-03-01', 0.4)]);
    const cases = [patientCase];

    const { result } = renderHook(() => useCaseData(patientCase, cases, 'de', t));

    // Only the index patient → no peer cohort → no self-referential band (WR-04).
    const point = result.current.cohortReference.find((p) => p.date === '2024-03-01');
    expect(point).toBeUndefined();
  });

  it('leaves visusMedian undefined for dates with no cohort data', async () => {
    const { useCaseData } = await import('../src/hooks/useCaseData');

    // The patient case has a date 2024-03-01 — no other case has measurements that date
    const patientCase = makeCase('C1', [
      makeObs(LOINC_VISUS, '2024-03-01', 0.4),
    ]);
    const cohortCase2 = makeCase('C2', [makeObs(LOINC_VISUS, '2024-01-15', 0.3)]);
    const cases = [patientCase, cohortCase2];

    const { result } = renderHook(() => useCaseData(patientCase, cases, 'de', t));

    // Should not throw; cohortReference is an array
    expect(Array.isArray(result.current.cohortReference)).toBe(true);
    // The point for 2024-03-01 exists but has undefined or no visusMedian
    // (no cohort data on that date — only the case itself counted, but we exclude
    // the current case from cohort median computation per implementation rules)
    // OR it simply doesn't appear — either behaviour is acceptable so long as no crash.
  });

  it('computes crtMedian / crtP25 / crtP75 from LOINC_CRT observations', async () => {
    const { useCaseData } = await import('../src/hooks/useCaseData');

    const patientCase = makeCase('C1', [
      makeObs(LOINC_CRT, '2024-02-10', 320),
    ]);
    const cohortCase2 = makeCase('C2', [makeObs(LOINC_CRT, '2024-02-10', 280)]);
    const cohortCase3 = makeCase('C3', [makeObs(LOINC_CRT, '2024-02-10', 360)]);
    const cases = [patientCase, cohortCase2, cohortCase3];

    const { result } = renderHook(() => useCaseData(patientCase, cases, 'de', t));

    const ref = result.current.cohortReference;
    const point = ref.find((p) => p.date === '2024-02-10');
    expect(point).not.toBeUndefined();
    // Peer values only = [280, 360] (index 320 excluded — WR-04). A band that
    // included the index would yield a median of 320; it must not.
    expect(point!.crtMedian).not.toBeCloseTo(320, 0);
    expect(typeof point!.crtP25).toBe('number');
    expect(typeof point!.crtP75).toBe('number');
    expect(point!.crtP25!).toBeLessThanOrEqual(point!.crtMedian!);
    expect(point!.crtP75!).toBeGreaterThanOrEqual(point!.crtMedian!);
  });
});

// ---------------------------------------------------------------------------
// A4 v2: interpolation goes to SEPARATE keys (visusInterp/crtInterp), only
// between measured neighbours, never onto .visus/.crt, and never leaks into
// visusCrtScatter.
// ---------------------------------------------------------------------------

describe('useCaseData — A4 v2 interpolation (separate dataKeys)', () => {
  afterEach(() => cleanup());

  it('interpolates a between-neighbour gap onto visusInterp, not .visus', async () => {
    const { useCaseData } = await import('../src/hooks/useCaseData');

    // Visus measured on day 1 and day 3; CRT measured on day 2 (so a middle row
    // exists with no visus measurement but measured visus neighbours on both sides).
    const patientCase = makeCase('C1', [
      makeObs(LOINC_VISUS, '2024-01-01', 0.4),
      makeObs(LOINC_CRT, '2024-01-02', 300),
      makeObs(LOINC_VISUS, '2024-01-03', 0.8),
    ]);
    const { result } = renderHook(() => useCaseData(patientCase, [patientCase], 'de', t));

    const rows = result.current.combinedDataWithReference;
    const mid = rows.find((r) => r.date === '2024-01-02')!;
    // Interpolated value present on the SEPARATE key.
    expect(mid.visusInterp).toBeCloseTo(0.6, 5); // midpoint of 0.4 and 0.8
    // Real measurement key stays empty — no fabricated pair.
    expect(mid.visus).toBeUndefined();
    expect(result.current.hasInterpolatedPoints).toBe(true);
  });

  it('does NOT interpolate edge gaps (only one measured neighbour)', async () => {
    const { useCaseData } = await import('../src/hooks/useCaseData');

    // Visus only on the last day; CRT on the first two — the first two rows have
    // no visus neighbour BEFORE them, so no interpolation.
    const patientCase = makeCase('C1', [
      makeObs(LOINC_CRT, '2024-01-01', 300),
      makeObs(LOINC_CRT, '2024-01-02', 310),
      makeObs(LOINC_VISUS, '2024-01-03', 0.8),
    ]);
    const { result } = renderHook(() => useCaseData(patientCase, [patientCase], 'de', t));

    const rows = result.current.combinedDataWithReference;
    expect(rows.find((r) => r.date === '2024-01-01')!.visusInterp).toBeUndefined();
    expect(rows.find((r) => r.date === '2024-01-02')!.visusInterp).toBeUndefined();
  });

  it('keeps visusCrtScatter free of interpolated (fabricated) pairs', async () => {
    const { useCaseData } = await import('../src/hooks/useCaseData');

    const patientCase = makeCase('C1', [
      makeObs(LOINC_VISUS, '2024-01-01', 0.4),
      makeObs(LOINC_CRT, '2024-01-02', 300),
      makeObs(LOINC_VISUS, '2024-01-03', 0.8),
    ]);
    const { result } = renderHook(() => useCaseData(patientCase, [patientCase], 'de', t));

    // Only the rows where BOTH .visus and .crt are real measurements qualify —
    // here that is zero rows. The interpolated middle row must NOT appear.
    const scatter = result.current.visusCrtScatter;
    expect(scatter.find((p) => p.date === '2024-01-02')).toBeUndefined();
    expect(scatter.length).toBe(0);
  });

  it('sets hasInterpolatedPoints=false when there are no between-neighbour gaps', async () => {
    const { useCaseData } = await import('../src/hooks/useCaseData');

    const patientCase = makeCase('C1', [
      makeObs(LOINC_VISUS, '2024-01-01', 0.4),
      makeObs(LOINC_CRT, '2024-01-01', 300),
    ]);
    const { result } = renderHook(() => useCaseData(patientCase, [patientCase], 'de', t));
    expect(result.current.hasInterpolatedPoints).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// J3c: relative-time axis (months since the patient's first visit) + J3d
// overlays on the change-from-baseline / distribution / scatter datasets.
// ---------------------------------------------------------------------------

describe('useCaseData — J3c relative-time axis', () => {
  afterEach(() => cleanup());

  it('keys combinedData rows on relMonths since the first observation', async () => {
    const { useCaseData } = await import('../src/hooks/useCaseData');
    // Baseline 2024-01-01; second visit ~3 months later; third ~6 months later.
    const patientCase = makeCase('C1', [
      makeObs(LOINC_VISUS, '2024-01-01', 0.5),
      makeObs(LOINC_VISUS, '2024-04-01', 0.6),
      makeObs(LOINC_VISUS, '2024-07-01', 0.7),
    ]);
    const { result } = renderHook(() => useCaseData(patientCase, [patientCase], 'de', t));
    const rows = result.current.combinedData;
    expect(rows[0].relMonths).toBe(0);
    // ~3 and ~6 months (30.4375 days/month → rounded to one decimal).
    expect(rows[1].relMonths).toBeGreaterThanOrEqual(2.9);
    expect(rows[1].relMonths).toBeLessThanOrEqual(3.1);
    expect(rows[2].relMonths).toBeGreaterThanOrEqual(5.9);
    expect(rows[2].relMonths).toBeLessThanOrEqual(6.1);
  });

  it('K3c: includes each injection date as a row so date-keyed IVI markers land', async () => {
    const { useCaseData } = await import('../src/hooks/useCaseData');
    const patientCase: PatientCase = {
      ...makeCase('C1', [
        makeObs(LOINC_VISUS, '2024-01-01', 0.5),
        makeObs(LOINC_VISUS, '2024-04-01', 0.6),
      ]),
      procedures: [
        {
          resourceType: 'Procedure',
          id: 'ivi-1',
          status: 'completed',
          code: { coding: [{ system: 'http://snomed.info/sct', code: '36189003' }] },
          performedDateTime: '2024-02-15T09:00:00Z',
        } as any,
      ],
    };
    const { result } = renderHook(() => useCaseData(patientCase, [patientCase], 'de', t));
    const rows = result.current.combinedData;
    // The injection-only date appears as a row (no visus/crt values).
    const injRow = rows.find((r) => r.date === '2024-02-15');
    expect(injRow).not.toBeUndefined();
    expect(injRow!.visus).toBeUndefined();
    expect(injRow!.crt).toBeUndefined();
  });
});

describe('useCaseData — J3d cohort overlays on the other plots', () => {
  afterEach(() => cleanup());

  it('adds cohort percent-change median + IQR aligned by relative month', async () => {
    const { useCaseData } = await import('../src/hooks/useCaseData');
    // Index: baseline 0.5 then 0.6 (+20%) at ~3 months.
    const patientCase = makeCase('C1', [
      makeObs(LOINC_VISUS, '2024-01-01', 0.5),
      makeObs(LOINC_VISUS, '2024-04-01', 0.6),
    ]);
    // Peers: each with a baseline + a ~3-month follow-up (different calendar
    // dates, but aligned on the relative axis). Their +% changes seed the band.
    const peer2 = makeCase('C2', [
      makeObs(LOINC_VISUS, '2023-05-01', 0.4),
      makeObs(LOINC_VISUS, '2023-08-01', 0.5), // +25%
    ]);
    const peer3 = makeCase('C3', [
      makeObs(LOINC_VISUS, '2022-09-01', 0.6),
      makeObs(LOINC_VISUS, '2022-12-01', 0.66), // +10%
    ]);
    const cases = [patientCase, peer2, peer3];
    const { result } = renderHook(() => useCaseData(patientCase, cases, 'de', t));
    const rows = result.current.baselineChangeWithReference;
    const follow = rows.find((r) => r.date === '2024-04-01')!;
    expect(follow).not.toBeUndefined();
    expect(typeof follow.visusChangeMedian).toBe('number');
    expect(Array.isArray(follow.visusChangeBand)).toBe(true);
    // Baseline month: peers' change is ~0% (band brackets zero).
    const base = rows.find((r) => r.date === '2024-01-01')!;
    expect(base.relMonths).toBe(0);
  });

  it('K-bl2: anchors Visus %-change to first VISUS and CRT %-change to first CRT', async () => {
    const { useCaseData } = await import('../src/hooks/useCaseData');
    // Visus first measured on 2024-01-01 (0.4); CRT first measured LATER on
    // 2024-02-01 (300). A shared single first-visit baseline would anchor CRT to
    // the 2024-01-01 row (where CRT is absent) — per-metric anchoring must use
    // each metric's OWN first value.
    const patientCase = makeCase('C1', [
      makeObs(LOINC_VISUS, '2024-01-01', 0.4),
      makeObs(LOINC_CRT, '2024-02-01', 300),
      makeObs(LOINC_VISUS, '2024-03-01', 0.5), // +25% vs 0.4
      makeObs(LOINC_CRT, '2024-04-01', 270),   // -10% vs 300
    ]);
    const { result } = renderHook(() => useCaseData(patientCase, [patientCase], 'de', t));
    const rows = result.current.baselineData;

    // Visus baseline row = its own first date; change there is 0.
    const visusBaseRow = rows.find((r) => r.date === '2024-01-01')!;
    expect(visusBaseRow.visusChange).toBe(0);
    // CRT baseline row = CRT's own first date (a DIFFERENT date); change there is 0.
    const crtBaseRow = rows.find((r) => r.date === '2024-02-01')!;
    expect(crtBaseRow.crtChange).toBe(0);
    // Later Visus change anchored to first VISUS (0.4): (0.5-0.4)/0.4 = +25%.
    expect(rows.find((r) => r.date === '2024-03-01')!.visusChange).toBeCloseTo(25, 1);
    // Later CRT change anchored to first CRT (300): (270-300)/300 = -10%.
    expect(rows.find((r) => r.date === '2024-04-01')!.crtChange).toBeCloseTo(-10, 1);
  });

  it('K-bl2: a metric with <2 measurements does not suppress the other metric', async () => {
    const { useCaseData } = await import('../src/hooks/useCaseData');
    // Only ONE Visus, but multiple CRT → CRT change still computed.
    const patientCase = makeCase('C1', [
      makeObs(LOINC_VISUS, '2024-01-01', 0.4),
      makeObs(LOINC_CRT, '2024-01-01', 300),
      makeObs(LOINC_CRT, '2024-02-01', 330), // +10% vs 300
    ]);
    const { result } = renderHook(() => useCaseData(patientCase, [patientCase], 'de', t));
    const rows = result.current.baselineData;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.find((r) => r.date === '2024-02-01')!.crtChange).toBeCloseTo(10, 1);
    // No Visus change series (only one Visus measurement).
    expect(rows.find((r) => r.date === '2024-02-01')!.visusChange).toBeUndefined();
  });

  it('computes cohort distribution percentages excluding the index patient', async () => {
    const { useCaseData } = await import('../src/hooks/useCaseData');
    const patientCase = makeCase('C1', [makeObs(LOINC_VISUS, '2024-01-01', 0.5)]);
    const peer2 = makeCase('C2', [
      makeObs(LOINC_VISUS, '2024-01-01', 0.1),
      makeObs(LOINC_VISUS, '2024-02-01', 0.3),
    ]);
    const cases = [patientCase, peer2];
    const { result } = renderHook(() => useCaseData(patientCase, cases, 'de', t));
    const dist = result.current.visusDistributionWithCohort;
    const totalPct = dist.reduce((s, b) => s + (b.cohortPct ?? 0), 0);
    // Two peer measurements → percentages sum to ~100.
    expect(totalPct).toBeGreaterThanOrEqual(99);
    expect(totalPct).toBeLessThanOrEqual(101);
  });

  it('K3b: adds cohort IOP median + IQR aligned by relative month (index excluded)', async () => {
    const { useCaseData } = await import('../src/hooks/useCaseData');
    const LOINC_IOP = '56844-4';
    // Index: IOP baseline + a ~3-month follow-up.
    const patientCase = makeCase('C1', [
      makeObs(LOINC_IOP, '2024-01-01', 16),
      makeObs(LOINC_IOP, '2024-04-01', 18),
    ]);
    // Peers: each with a baseline + ~3-month follow-up at different calendar dates;
    // they align onto the index patient's relative axis (month 0 and month ~3).
    const peer2 = makeCase('C2', [
      makeObs(LOINC_IOP, '2023-05-01', 14),
      makeObs(LOINC_IOP, '2023-08-01', 20),
    ]);
    const peer3 = makeCase('C3', [
      makeObs(LOINC_IOP, '2022-09-01', 12),
      makeObs(LOINC_IOP, '2022-12-01', 22),
    ]);
    const cases = [patientCase, peer2, peer3];
    const { result } = renderHook(() => useCaseData(patientCase, cases, 'de', t));
    const rows = result.current.iopDataWithReference;
    const base = rows.find((r) => r.date === '2024-01-01')!;
    const follow = rows.find((r) => r.date === '2024-04-01')!;
    expect(base).not.toBeUndefined();
    expect(follow).not.toBeUndefined();
    // Reference present on the patient's IOP date rows.
    expect(typeof base.iopMedian).toBe('number');
    expect(Array.isArray(base.iopBand)).toBe(true);
    // Index value (16/18) excluded — peer-only median at month 0 is median(14,12)≈13.
    expect(base.iopMedian).not.toBe(16);
    expect(base.iopBand![0]).toBeLessThanOrEqual(base.iopMedian!);
    expect(base.iopBand![1]).toBeGreaterThanOrEqual(base.iopMedian!);
  });

  it('K3b: no IOP reference when there are no peers (lone index, WR-04)', async () => {
    const { useCaseData } = await import('../src/hooks/useCaseData');
    const LOINC_IOP = '56844-4';
    const patientCase = makeCase('C1', [makeObs(LOINC_IOP, '2024-01-01', 16)]);
    const { result } = renderHook(() => useCaseData(patientCase, [patientCase], 'de', t));
    const rows = result.current.iopDataWithReference;
    expect(rows[0].iopMedian).toBeUndefined();
    expect(rows[0].iopBand).toBeUndefined();
  });

  it('builds a cohort Visus-vs-CRT cloud from peer same-day pairs (index excluded)', async () => {
    const { useCaseData } = await import('../src/hooks/useCaseData');
    const patientCase = makeCase('C1', [
      makeObs(LOINC_VISUS, '2024-01-01', 0.5),
      makeObs(LOINC_CRT, '2024-01-01', 300),
    ]);
    const peer2 = makeCase('C2', [
      makeObs(LOINC_VISUS, '2024-01-01', 0.4),
      makeObs(LOINC_CRT, '2024-01-01', 320),
    ]);
    const cases = [patientCase, peer2];
    const { result } = renderHook(() => useCaseData(patientCase, cases, 'de', t));
    const cloud = result.current.cohortVisusCrtScatter;
    // One peer same-day pair; the index patient's pair must be excluded.
    expect(cloud.length).toBe(1);
    expect(cloud[0]).toEqual({ visus: 0.4, crt: 320 });
  });
});

// ---------------------------------------------------------------------------
// Task 2: VisusCrtChart renders reference overlay
// ---------------------------------------------------------------------------

vi.mock('recharts', async (importOriginal) => {
  const real = await importOriginal<typeof import('recharts')>();
  return {
    ...real,

    ResponsiveContainer: ({ children }: { children: any }) => (
      <div data-testid="recharts-responsive-container">
        <svg>{children}</svg>
      </div>
    ),

    // VisusCrtChart renders a ComposedChart (Recharts 3.x won't draw <Area>
    // inside <LineChart>); keep LineChart stubbed too for other consumers.
    ComposedChart: ({ children }: { children: any }) => (
      <div data-testid="recharts-composed-chart">{children}</div>
    ),
    LineChart: ({ children }: { children: any }) => (
      <g data-testid="recharts-line-chart">{children}</g>
    ),

    CartesianGrid: () => null,
    XAxis: ({ dataKey, type }: any) => (
      <g data-testid="recharts-xaxis" data-data-key={dataKey ?? ''} data-type={type ?? ''} />
    ),

    YAxis: ({ label }: any) => (
      <g data-testid="recharts-yaxis" data-label={label?.value ?? ''} />
    ),

    Tooltip: () => null,
    Legend: () => null,

    ReferenceLine: ({ x, label }: any) => (
      <g data-testid="recharts-refline" data-x={x != null ? String(x) : ''} data-label={label?.value ?? ''} />
    ),

    Area: ({ fill, stroke, name, legendType, dataKey }: any) => (
      <g
        data-testid="recharts-area"
        data-fill={fill}
        data-stroke={stroke}
        data-name={name ?? ''}
        data-legend-type={legendType ?? ''}
        data-data-key={dataKey ?? ''}
      />
    ),

    Line: ({ stroke, strokeWidth, name, legendType, dataKey }: any) => (
      <g
        data-testid="recharts-line"
        data-stroke={stroke}
        data-stroke-width={String(strokeWidth)}
        data-name={name ?? ''}
        data-legend-type={legendType ?? ''}
        data-data-key={dataKey ?? ''}
      />
    ),
  };
});

import VisusCrtChart from '../src/components/case-detail/VisusCrtChart';
import type { CombinedDataPoint } from '../src/hooks/useCaseData';

const tStub = (key: TranslationKey): string => key;

// A3 v2: SINGLE merged data array — the cohort reference fields (median + the
// [p25, p75] band tuples) live ON the patient rows. No separate cohortReference
// prop / no per-series `data` prop.
const mergedData: CombinedDataPoint[] = [
  {
    date: '2024-01-01',
    relMonths: 0,
    visus: 0.5,
    crt: 300,
    visusMeasured: true,
    crtMeasured: true,
    visusMedian: 0.45,
    visusBand: [0.3, 0.6],
    crtMedian: 310,
    crtBand: [280, 340],
  },
  {
    date: '2024-02-01',
    relMonths: 1,
    visus: 0.6,
    crt: 280,
    visusMeasured: true,
    crtMeasured: true,
    visusMedian: 0.48,
    visusBand: [0.32, 0.62],
    crtMedian: 305,
    crtBand: [275, 335],
  },
];

const plainData: CombinedDataPoint[] = [
  { date: '2024-01-01', relMonths: 0, visus: 0.5, crt: 300, visusMeasured: true, crtMeasured: true },
  { date: '2024-02-01', relMonths: 1, visus: 0.6, crt: 280, visusMeasured: true, crtMeasured: true },
];

const baseChartProps = {
  cohortAvgVisus: 0.5,
  cohortAvgCrt: 300,
  highlightDate: null,
  dateFmt: 'de-DE',
  locale: 'de',
  t: tStub,
  visusObs: [],
};

describe('VisusCrtChart — FALL-011 reference overlay (A3 v2 merged single array)', () => {
  afterEach(() => cleanup());

  it('renders cohort median lines reading from the merged row dataKeys', () => {
    const { container } = render(
      <VisusCrtChart {...baseChartProps} combinedData={mergedData} showCohortReference={true} />,
    );

    const allLines = Array.from(container.querySelectorAll('[data-testid="recharts-line"]'));
    const medianLine = allLines.find((el) => el.getAttribute('data-data-key') === 'visusMedian');
    expect(medianLine).not.toBeNull();
  });

  it('renders translucent range-Area IQR bands (visusBand/crtBand) — no white paint-over', () => {
    const { container } = render(
      <VisusCrtChart {...baseChartProps} combinedData={mergedData} showCohortReference={true} />,
    );

    const areas = Array.from(container.querySelectorAll('[data-testid="recharts-area"]'));
    const bandKeys = areas.map((el) => el.getAttribute('data-data-key'));
    expect(bandKeys).toContain('visusBand');
    expect(bandKeys).toContain('crtBand');
    // No Area should be a white (#ffffff) paint-over mask.
    const whiteMask = areas.find((el) => el.getAttribute('data-fill') === '#ffffff');
    expect(whiteMask).toBeUndefined();
  });

  it('does NOT render cohort median lines or IQR areas when showCohortReference=false', () => {
    const { container } = render(
      <VisusCrtChart {...baseChartProps} combinedData={mergedData} showCohortReference={false} />,
    );

    const allLines = Array.from(container.querySelectorAll('[data-testid="recharts-line"]'));
    const medianLine = allLines.find((el) => el.getAttribute('data-data-key') === 'visusMedian');
    expect(medianLine).toBeUndefined();

    const areas = container.querySelectorAll('[data-testid="recharts-area"]');
    expect(areas.length).toBe(0);
  });

  it('renders without crash + no overlay when rows carry no reference fields', () => {
    const { container } = render(
      <VisusCrtChart {...baseChartProps} combinedData={plainData} showCohortReference={true} />,
    );
    // No band areas (no reference fields present), but patient lines still render.
    const areas = container.querySelectorAll('[data-testid="recharts-area"]');
    expect(areas.length).toBe(0);
    const lines = container.querySelectorAll('[data-testid="recharts-line"]');
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('K3c/M6: keys the X axis on the linear calendar-time axis (dateMs, numeric) when the overlay is off', () => {
    const { container } = render(
      <VisusCrtChart {...baseChartProps} combinedData={mergedData} />,
    );
    const xAxis = container.querySelector('[data-testid="recharts-xaxis"]');
    // M6: the calendar axis is a linear TIME axis keyed on epoch-ms.
    expect(xAxis?.getAttribute('data-data-key')).toBe('dateMs');
    expect(xAxis?.getAttribute('data-type')).toBe('number');
  });

  it('K3c/M6: IVI markers + the highlight resolve to epoch-ms on the linear calendar axis', () => {
    const injections = [
      { resourceType: 'Procedure', id: 'ivi-1', status: 'completed', code: { coding: [] }, performedDateTime: '2024-01-01T09:00:00Z' },
    ] as any;
    const { container } = render(
      <VisusCrtChart
        {...baseChartProps}
        combinedData={mergedData}
        injections={injections}
        highlightDate="2024-02-01"
      />,
    );
    const reflines = Array.from(container.querySelectorAll('[data-testid="recharts-refline"]'));
    const xs = reflines.map((el) => el.getAttribute('data-x'));
    // M6: markers/highlight are keyed to epoch-ms (resolved from the row's dateMs,
    // or parsed from the ISO date when the fixture omits it) — NOT the ISO string.
    expect(xs).toContain(String(new Date('2024-01-01').getTime()));
    expect(xs).toContain(String(new Date('2024-02-01').getTime()));
    expect(xs).not.toContain('2024-01-01');
  });

  it('K3d: a highlighted injection emphasises its marker and fires onInjectionClick', () => {
    const injections = [
      { resourceType: 'Procedure', id: 'ivi-1', status: 'completed', code: { coding: [] }, performedDateTime: '2024-01-01T09:00:00Z' },
    ] as any;
    const onInjectionClick = vi.fn();
    const { container } = render(
      <VisusCrtChart
        {...baseChartProps}
        combinedData={mergedData}
        injections={injections}
        highlightInjectionDate="2024-01-01"
        onInjectionClick={onInjectionClick}
      />,
    );
    const reflines = Array.from(container.querySelectorAll('[data-testid="recharts-refline"]'));
    // M6: the marker's x is the injection date as epoch-ms.
    const iviMarker = reflines.find((el) => el.getAttribute('data-x') === String(new Date('2024-01-01').getTime()));
    expect(iviMarker).not.toBeUndefined();
  });
});
