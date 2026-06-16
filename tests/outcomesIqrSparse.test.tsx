// @vitest-environment jsdom
/**
 * VQA-03 / D-04: Two-layer regression guard for the IQR band's n<2 edge case.
 *
 *   1. Math  — computeCohortTrajectory must never emit GridPoint with n<2.
 *   2. DOM   — OutcomesPanel renders the IQR band marker when the band layer is on
 *              and a non-degenerate medianGrid is present, and the empty-state
 *              short-circuit (patientCount=0) renders no chart at all.
 *
 * WS-1 (v1.17): the chart is Plotly (no SVG <path> to inspect); the DOM assertions
 * now target the panel's IQR marker + the empty-state short-circuit instead.
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import OutcomesPanel from '../src/components/outcomes/OutcomesPanel';
import { LOINC_VISUS, SNOMED_EYE_RIGHT } from '../src/services/fhirLoader';
import type { PatientCase } from '../src/types/fhir';
import {
  computeCohortTrajectory,
  type PanelResult,
} from '../src/utils/cohortTrajectory';

afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeVisusObs(date: string, decimal: number, id = 'obs-' + date + '-od') {
  return {
    resourceType: 'Observation' as const,
    id,
    status: 'final',
    subject: { reference: 'Patient/p1' },
    code: { coding: [{ code: LOINC_VISUS, system: 'http://loinc.org' }] },
    effectiveDateTime: date,
    valueQuantity: { value: decimal, unit: 'decimal' },
    bodySite: { coding: [{ code: SNOMED_EYE_RIGHT }] },

  } as any;
}

function makeCase(pseudonym: string, obs: Array<{ date: string; decimal: number }>): PatientCase {
  return {
    id: pseudonym,
    pseudonym,
    gender: 'unknown',
    birthDate: '1960-01-01',
    centerId: 'org-test',
    centerName: 'Test Center',
    conditions: [],
    observations: obs.map((o, i) => makeVisusObs(o.date, o.decimal, `obs-${pseudonym}-${i}`)),
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
    const cases: PatientCase[] = [
      makeCase('p1', [
        { date: '2024-01-01', decimal: 0.5 },
        { date: '2024-04-10', decimal: 0.6 },
      ]),
      makeCase('p2', [{ date: '2024-07-19', decimal: 0.7 }]),
    ];
    const result = computeCohortTrajectory({
      cases,
      axisMode: 'days',
      yMetric: 'absolute',
      gridPoints: 11,
      spreadMode: 'iqr',
    });
    const offenders = result.od.medianGrid.filter((gp) => gp.n < 2);
    expect(offenders, `GridPoints with n<2 present: ${JSON.stringify(offenders)}`).toEqual([]);
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
// DOM invariant: IQR band marker present on a dense grid; no chart when empty
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

describe('OutcomesPanel — IQR band marker (VQA-03)', () => {
  const t = (k: string) => k;
  const layers = { median: true, perPatient: false, scatter: false, spreadBand: true };

  it('renders the IQR band marker + an IQR trace when medianGrid is dense (p25<p75)', () => {
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
    expect(container.querySelector('[data-testid="outcomes-panel-od-iqr"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="outcomes-trace-iqr"]')).not.toBeNull();
  });

  it('renders the empty-state (no chart) when patientCount is 0', () => {
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
    // Empty-state branch — no chart fallback, no IQR trace.
    expect(container.querySelector('[data-testid="outcomes-fallback-od"]')).toBeNull();
    expect(container.querySelector('[data-testid="outcomes-trace-iqr"]')).toBeNull();
  });
});
