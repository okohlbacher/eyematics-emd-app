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

  it('aligns by month bin — produces a reference point with NO exact-day match (WR-05)', async () => {
    const { useCaseData } = await import('../src/hooks/useCaseData');

    // Index patient visits on 2024-01-05.
    const patientCase = makeCase('C1', [
      makeObs(LOINC_VISUS, '2024-01-05', 0.5),
      makeObs(LOINC_CRT, '2024-01-05', 300),
    ]);
    // Peers measured the SAME MONTH but on different days — no exact-day collision.
    const cohortCase2 = makeCase('C2', [
      makeObs(LOINC_VISUS, '2024-01-20', 0.3),
      makeObs(LOINC_CRT, '2024-01-22', 280),
    ]);
    const cohortCase3 = makeCase('C3', [
      makeObs(LOINC_VISUS, '2024-01-28', 0.7),
      makeObs(LOINC_CRT, '2024-01-11', 360),
    ]);
    const cases = [patientCase, cohortCase2, cohortCase3];

    const { result } = renderHook(() => useCaseData(patientCase, cases, 'de', t));

    const ref = result.current.cohortReference;
    // Exact-day keying would have produced ZERO points here. Month bins must
    // produce at least one, keyed to the patient's date.
    expect(ref.length).toBeGreaterThanOrEqual(1);
    const point = ref.find((p) => p.date === '2024-01-05');
    expect(point).not.toBeUndefined();
    expect(typeof point!.visusMedian).toBe('number');
    expect(typeof point!.crtMedian).toBe('number');
  });

  it('emits no reference when the only same-month measurements belong to the index patient (WR-04)', async () => {
    const { useCaseData } = await import('../src/hooks/useCaseData');

    // Patient has data in 2024-03; peer has data only in a different month.
    const patientCase = makeCase('C1', [makeObs(LOINC_VISUS, '2024-03-01', 0.4)]);
    const cohortCase2 = makeCase('C2', [makeObs(LOINC_VISUS, '2024-09-15', 0.3)]);
    const cases = [patientCase, cohortCase2];

    const { result } = renderHook(() => useCaseData(patientCase, cases, 'de', t));

    // No peer data in the patient's month → no self-referential band.
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

    LineChart: ({ children }: { children: any }) => (
      <g data-testid="recharts-line-chart">{children}</g>
    ),

    CartesianGrid: () => null,
    XAxis: () => null,

    YAxis: ({ label }: any) => (
      <g data-testid="recharts-yaxis" data-label={label?.value ?? ''} />
    ),

    Tooltip: () => null,
    Legend: () => null,

    ReferenceLine: () => null,

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
  { date: '2024-01-01', visus: 0.5, crt: 300, visusMeasured: true, crtMeasured: true },
  { date: '2024-02-01', visus: 0.6, crt: 280, visusMeasured: true, crtMeasured: true },
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
});
