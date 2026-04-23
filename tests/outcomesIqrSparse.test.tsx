// @vitest-environment jsdom
/**
 * VQA-03 / D-04: Two-layer regression guard for the IQR band's n<2 edge case.
 *
 *   1. Math  — computeCohortTrajectory must never emit GridPoint with n<2.
 *   2. DOM   — OutcomesPanel must not render <path> elements with empty `d` attr
 *              (the symptom of a 0-height IQR band).
 */
import { cleanup,render } from '@testing-library/react';
import { afterEach,describe, expect, it, vi } from 'vitest';

// Deterministic Recharts mock (same pattern as tests/OutcomesPage.test.tsx).
// Emit <path d="M0,0 L10,10"> so the DOM has a non-empty `d` to assert on.
vi.mock('recharts', async (importOriginal) => {
  const real = await importOriginal<typeof import('recharts')>();
  return {
    ...real,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ResponsiveContainer: ({ children }: { children: any }) => (
      <div data-testid="recharts-responsive-container">
        <svg>{children}</svg>
      </div>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ComposedChart: ({ children }: { children: any }) => (
      <g data-testid="recharts-composed-chart">{children}</g>
    ),
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: () => null,
    Area: () => <path data-testid="area-path" d="M0,0 L10,10" />,
    Line: () => <path data-testid="line-path" d="M0,0 L10,10" />,
    Scatter: () => null,
  };
});

import OutcomesPanel from '../src/components/outcomes/OutcomesPanel';
import { LOINC_VISUS, SNOMED_EYE_RIGHT } from '../src/services/fhirLoader';
import type { PatientCase } from '../src/types/fhir';
import {
  computeCohortTrajectory,
  type PanelResult,
} from '../src/utils/cohortTrajectory';

afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// Fixture helpers (shape matches tests/cohortTrajectory.test.ts:makeObs)
// ---------------------------------------------------------------------------

function makeVisusObs(
  date: string,
  decimal: number,
  id = 'obs-' + date + '-od',
) {
  return {
    resourceType: 'Observation' as const,
    id,
    status: 'final',
    subject: { reference: 'Patient/p1' },
    code: { coding: [{ code: LOINC_VISUS, system: 'http://loinc.org' }] },
    effectiveDateTime: date,
    valueQuantity: { value: decimal, unit: 'decimal' },
    bodySite: { coding: [{ code: SNOMED_EYE_RIGHT }] },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

function makeCase(
  pseudonym: string,
  obs: Array<{ date: string; decimal: number }>,
): PatientCase {
  return {
    id: pseudonym,
    pseudonym,
    gender: 'unknown',
    birthDate: '1960-01-01',
    centerId: 'org-test',
    centerName: 'Test Center',
    conditions: [],
    observations: obs.map((o, i) =>
      makeVisusObs(o.date, o.decimal, `obs-${pseudonym}-${i}`),
    ),
    procedures: [],
    imagingStudies: [],
    medications: [],
  };
}

// ---------------------------------------------------------------------------
// Math invariant: medianGrid never emits a GridPoint with n<2 (D-04 / VQA-03)
// ---------------------------------------------------------------------------

describe('cohortTrajectory — medianGrid n>=2 invariant (VQA-03 / D-04)', () => {
  it('omits grid points where fewer than 2 patients contribute (n<2)', () => {
    // Patient 1: 2 obs spanning days 0..100. Patient 2: 1 obs at day 200 — never interpolates.
    // Grid extends to ~day 200 but only patient 1 can contribute to any interpolation;
    // patients with <2 measurements are pruned earlier (D-18), so ys.length at every gx is
    // at most 1. New guard (D-04) must skip every such point — medianGrid must be empty.
    const cases: PatientCase[] = [
      makeCase('p1', [
        { date: '2024-01-01', decimal: 0.5 },
        { date: '2024-04-10', decimal: 0.6 }, // ~day 100
      ]),
      makeCase('p2', [
        { date: '2024-07-19', decimal: 0.7 }, // ~day 200 (single obs — pruned)
      ]),
    ];
    const result = computeCohortTrajectory({
      cases,
      axisMode: 'days',
      yMetric: 'absolute',
      gridPoints: 11,
      spreadMode: 'iqr',
    });
    const offenders = result.od.medianGrid.filter((gp) => gp.n < 2);
    expect(
      offenders,
      `GridPoints with n<2 present: ${JSON.stringify(offenders)}`,
    ).toEqual([]);
  });

  it('emits n>=2 on a dense two-patient grid', () => {
    const cases: PatientCase[] = [
      makeCase('a', [
        { date: '2024-01-01', decimal: 0.5 },
        { date: '2024-04-10', decimal: 0.55 },
        { date: '2024-07-19', decimal: 0.6 },
      ]),
      makeCase('b', [
        { date: '2024-01-01', decimal: 0.4 },
        { date: '2024-04-10', decimal: 0.45 },
        { date: '2024-07-19', decimal: 0.5 },
      ]),
    ];
    const result = computeCohortTrajectory({
      cases,
      axisMode: 'days',
      yMetric: 'absolute',
      gridPoints: 5,
      spreadMode: 'iqr',
    });
    expect(result.od.medianGrid.length).toBeGreaterThan(0);
    expect(result.od.medianGrid.every((gp) => gp.n >= 2)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DOM invariant: OutcomesPanel never renders <path> with empty `d` (VQA-03)
// ---------------------------------------------------------------------------

function makePanel(
  medianGrid: Array<{ x: number; y: number; p25: number; p75: number; n: number }>,
  measurementCount = medianGrid.length * 2,
): PanelResult {
  return {
    patients: [],
    scatterPoints: [],
    medianGrid,
    summary: {
      patientCount: medianGrid.length > 0 ? 2 : 0,
      excludedCount: 0,
      measurementCount,
    },
  };
}

describe('OutcomesPanel — IQR Area DOM has no degenerate geometry (VQA-03)', () => {
  const t = (k: string) => k;
  const layers = {
    median: true,
    perPatient: false,
    scatter: false,
    spreadBand: true,
  };

  it('renders no <path> with empty d attribute when medianGrid is dense (p25<p75)', () => {
    const dense = [
      { x: 0, y: 0.5, p25: 0.4, p75: 0.6, n: 3 },
      { x: 50, y: 0.5, p25: 0.42, p75: 0.58, n: 3 },
      { x: 100, y: 0.5, p25: 0.44, p75: 0.56, n: 3 },
    ];
    const { container } = render(
      <OutcomesPanel
        panel={makePanel(dense)}
        eye="od"
        color="#1d4ed8"
        axisMode="days"
        yMetric="absolute"
        layers={layers}
        t={t}
        locale="en"
        titleKey="outcomesPanelOd"
      />,
    );
    const paths = Array.from(container.querySelectorAll('path'));
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) {
      const d = p.getAttribute('d') ?? '';
      expect(d, 'path with empty d attribute found').not.toBe('');
    }
  });

  it('renders no chart <path> when patientCount is 0 (empty medianGrid short-circuit)', () => {
    const { container } = render(
      <OutcomesPanel
        panel={makePanel([], 0)}
        eye="od"
        color="#1d4ed8"
        axisMode="days"
        yMetric="absolute"
        layers={layers}
        t={t}
        locale="en"
        titleKey="outcomesPanelOd"
      />,
    );
    // The patientCount=0 branch (OutcomesPanel.tsx:60-73) renders the empty-state div,
    // NOT the ResponsiveContainer. Assert the chart short-circuit.
    expect(
      container.querySelector('[data-testid="recharts-responsive-container"]'),
    ).toBeNull();
    expect(container.querySelectorAll('path').length).toBe(0);
  });
});
