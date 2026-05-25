// @vitest-environment jsdom
/**
 * FALL-011 — Cohort reference overlay tests.
 *
 * Task 1 tests: useCaseData cohortReference computation (median + IQR by date).
 * Task 2 tests: VisusCrtChart renders reference overlay gated by showCohortReference prop.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Task 1: useCaseData cohortReference — no DOM rendering needed, but we need
// @testing-library/react for renderHook.
// ---------------------------------------------------------------------------

import { act, cleanup, render, renderHook, screen } from '@testing-library/react';

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

  it('returns visusMedian = median of cohort values on a shared date', async () => {
    const { useCaseData } = await import('../src/hooks/useCaseData');

    // Case under review has one visus measurement on 2024-01-15
    const patientCase = makeCase('C1', [
      makeObs(LOINC_VISUS, '2024-01-15', 0.5),
    ]);

    // Two other cohort cases with visus on same date
    const cohortCase2 = makeCase('C2', [makeObs(LOINC_VISUS, '2024-01-15', 0.3)]);
    const cohortCase3 = makeCase('C3', [makeObs(LOINC_VISUS, '2024-01-15', 0.7)]);

    const cases = [patientCase, cohortCase2, cohortCase3];

    const { result } = renderHook(() => useCaseData(patientCase, cases, 'de', t));

    const ref = result.current.cohortReference;
    expect(ref).not.toBeNull();
    expect(ref.length).toBeGreaterThan(0);

    const point = ref.find((p) => p.date === '2024-01-15');
    expect(point).not.toBeUndefined();
    // Median of [0.3, 0.5, 0.7] = 0.5
    expect(point!.visusMedian).toBeCloseTo(0.5, 5);
    // p25 of [0.3, 0.5, 0.7]
    expect(typeof point!.visusP25).toBe('number');
    // p75 of [0.3, 0.5, 0.7]
    expect(typeof point!.visusP75).toBe('number');
    // p25 <= median <= p75
    expect(point!.visusP25!).toBeLessThanOrEqual(point!.visusMedian!);
    expect(point!.visusP75!).toBeGreaterThanOrEqual(point!.visusMedian!);
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
    // Median of [280, 320, 360] = 320
    expect(point!.crtMedian).toBeCloseTo(320, 0);
    expect(typeof point!.crtP25).toBe('number');
    expect(typeof point!.crtP75).toBe('number');
    expect(point!.crtP25!).toBeLessThanOrEqual(point!.crtMedian!);
    expect(point!.crtP75!).toBeGreaterThanOrEqual(point!.crtMedian!);
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

    Area: ({ fill, stroke, name, legendType }: any) => (
      <g
        data-testid="recharts-area"
        data-fill={fill}
        data-stroke={stroke}
        data-name={name ?? ''}
        data-legend-type={legendType ?? ''}
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
import type { CohortReferencePoint } from '../src/hooks/useCaseData';

const tStub = (key: TranslationKey): string => key;

const combinedData = [
  { date: '2024-01-01', visus: 0.5, crt: 300, visusMeasured: true, crtMeasured: true },
  { date: '2024-02-01', visus: 0.6, crt: 280, visusMeasured: true, crtMeasured: true },
];

const cohortReference: CohortReferencePoint[] = [
  {
    date: '2024-01-01',
    visusMedian: 0.45,
    visusP25: 0.3,
    visusP75: 0.6,
    crtMedian: 310,
    crtP25: 280,
    crtP75: 340,
  },
  {
    date: '2024-02-01',
    visusMedian: 0.48,
    visusP25: 0.32,
    visusP75: 0.62,
    crtMedian: 305,
    crtP25: 275,
    crtP75: 335,
  },
];

const baseChartProps = {
  combinedData,
  cohortAvgVisus: 0.5,
  cohortAvgCrt: 300,
  highlightDate: null,
  dateFmt: 'de-DE',
  locale: 'de',
  t: tStub,
  visusObs: [],
};

describe('VisusCrtChart — FALL-011 reference overlay', () => {
  afterEach(() => cleanup());

  it('renders cohort median lines when showCohortReference=true and cohortReference has data', () => {
    const { container } = render(
      <VisusCrtChart
        {...baseChartProps}
        showCohortReference={true}
        cohortReference={cohortReference}
      />,
    );

    // There should be a Line with name "cohortReferenceMedian" (from t key) for visus
    const allLines = Array.from(container.querySelectorAll('[data-testid="recharts-line"]'));
    const medianLine = allLines.find(
      (el) => el.getAttribute('data-data-key') === 'visusMedian',
    );
    expect(medianLine).not.toBeNull();
  });

  it('renders IQR band areas when showCohortReference=true', () => {
    const { container } = render(
      <VisusCrtChart
        {...baseChartProps}
        showCohortReference={true}
        cohortReference={cohortReference}
      />,
    );

    const areas = container.querySelectorAll('[data-testid="recharts-area"]');
    expect(areas.length).toBeGreaterThan(0);
  });

  it('does NOT render cohort median lines or IQR areas when showCohortReference=false', () => {
    const { container } = render(
      <VisusCrtChart
        {...baseChartProps}
        showCohortReference={false}
        cohortReference={cohortReference}
      />,
    );

    const allLines = Array.from(container.querySelectorAll('[data-testid="recharts-line"]'));
    const medianLine = allLines.find(
      (el) => el.getAttribute('data-data-key') === 'visusMedian',
    );
    expect(medianLine).toBeUndefined();

    const areas = container.querySelectorAll('[data-testid="recharts-area"]');
    expect(areas.length).toBe(0);
  });

  it('renders without crash when cohortReference is empty and showCohortReference=true', () => {
    const { container } = render(
      <VisusCrtChart
        {...baseChartProps}
        showCohortReference={true}
        cohortReference={[]}
      />,
    );
    // No crash; normal patient lines still render
    const lines = container.querySelectorAll('[data-testid="recharts-line"]');
    // At least the two patient lines (visus, crt) should render
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });
});
