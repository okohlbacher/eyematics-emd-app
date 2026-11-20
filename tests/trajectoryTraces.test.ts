/**
 * Z0-P23 — library-neutral series builders of the Verläufe panels (replace plotlyTracesHover.test.ts and
 * plotlyDrillDownGate.test.ts after the Recharts migration, C8 a/c).
 */
import { describe, expect, it } from 'vitest';

import {
  buildCrossCohortTraces,
  buildSingleCohortTraces,
  type LayerState,
  mergeSeriesRows,
  perPatientSeriesOf,
  resolveDrillDownId,
  xExtent,
} from '../src/components/outcomes/trajectoryTraces';
import type { PanelResult } from '../src/utils/cohortTrajectory';

const ALL_ON: LayerState = { median: true, perPatient: true, scatter: true, spreadBand: true };
const ALL_OFF: LayerState = { median: false, perPatient: false, scatter: false, spreadBand: false };

function panel(): PanelResult {
  return {
    patients: [
      { id: 'p1', pseudonym: 'PSN-1', excluded: false, sparse: false, measurements: [{ x: 0, y: 0.3 }, { x: 30, y: 0.4 }] },
      { id: 'p2', pseudonym: 'PSN-2', excluded: true, sparse: false, measurements: [{ x: 0, y: 0.3 }, { x: 30, y: 0.4 }] },
      { id: 'p3', pseudonym: 'PSN-3', excluded: false, sparse: true, measurements: [{ x: 0, y: 0.5 }] },
    ],
    scatterPoints: [{ x: 0, y: 0.3, patientId: 'PSN-1' }, { x: 30, y: 0.4, patientId: 'PSN-1' }],
    medianGrid: [{ x: 0, y: 0.3, p25: 0.2, p75: 0.4, n: 2 }, { x: 30, y: 0.4, p25: 0.3, p75: 0.5, n: 2 }],
    summary: { patientCount: 2, measurementCount: 4, excludedCount: 1 },
  } as unknown as PanelResult;
}

describe('buildSingleCohortTraces', () => {
  it('emits the layers in z-order: IQR → per-patient → scatter → median', () => {
    const p = panel();
    const traces = buildSingleCohortTraces({
      panel: p,
      layers: ALL_ON,
      scatterPoints: p.scatterPoints,
      colors: { series: '#10b981', perPatient: '#9ca3af' },
      medianName: 'Kohorten-Median Visus',
      perPatientSeries: perPatientSeriesOf(p),
    });
    expect(traces.map((tr) => tr.kind)).toEqual(['iqr', 'perpatient', 'scatter', 'median']);
    const median = traces.find((tr) => tr.kind === 'median');
    expect(median).toMatchObject({ name: 'Kohorten-Median Visus', color: '#10b981' });
  });

  it('per-patient lines skip excluded patients and patients with fewer than two measurements', () => {
    expect(perPatientSeriesOf(panel()).map((s) => s.id)).toEqual(['PSN-1']);
  });

  it('emits nothing when every layer is off', () => {
    const p = panel();
    expect(
      buildSingleCohortTraces({
        panel: p, layers: ALL_OFF, scatterPoints: p.scatterPoints, colors: { series: '#000000', perPatient: '#000000' },
        medianName: 'm', perPatientSeries: perPatientSeriesOf(p),
      }),
    ).toEqual([]);
  });
});

describe('buildCrossCohortTraces', () => {
  const series = [
    { cohortId: 'a', cohortName: 'A', patientCount: 2, color: '#047857', medianGrid: panel().medianGrid, scatterPoints: panel().scatterPoints, perPatientSeries: perPatientSeriesOf(panel()) },
    { cohortId: 'b', cohortName: 'B', patientCount: 3, color: '#b45309', medianGrid: panel().medianGrid, scatterPoints: panel().scatterPoints, perPatientSeries: perPatientSeriesOf(panel()) },
  ];

  it('emits scatter + per-patient series per cohort in the cohort colour when both toggles are on', () => {
    const traces = buildCrossCohortTraces({ series, layers: ALL_ON, legendName: (s) => s.cohortName });
    const scatter = traces.filter((tr) => tr.kind === 'scatter');
    const lines = traces.filter((tr) => tr.kind === 'perpatient');
    expect(scatter.map((tr) => [tr.cohortId, tr.color])).toEqual([['a', '#047857'], ['b', '#b45309']]);
    expect(lines.map((tr) => [tr.cohortId, tr.color])).toEqual([['a', '#047857'], ['b', '#b45309']]);
    // Medians on top, named by the caller (legend name).
    expect(traces.slice(-2).map((tr) => (tr.kind === 'median' ? tr.name : tr.kind))).toEqual(['A', 'B']);
  });

  it('emits no scatter / per-patient series when the toggles are off', () => {
    const traces = buildCrossCohortTraces({ series, layers: { ...ALL_OFF, median: true }, legendName: (s) => s.cohortName });
    expect(traces.map((tr) => tr.kind)).toEqual(['median', 'median']);
  });
});

describe('mergeSeriesRows / xExtent', () => {
  it('merges medians and IQR bands into one row per x', () => {
    const traces = buildCrossCohortTraces({
      series: [
        { cohortId: 'a', cohortName: 'A', patientCount: 1, color: '#047857', medianGrid: [{ x: 0, y: 1, p25: 0, p75: 2, n: 1 }] },
        { cohortId: 'b', cohortName: 'B', patientCount: 1, color: '#b45309', medianGrid: [{ x: 10, y: 3, p25: 2, p75: 4, n: 1 }] },
      ] as never,
      layers: { ...ALL_OFF, median: true, spreadBand: true },
      legendName: (s) => s.cohortName,
    });
    expect(mergeSeriesRows(traces)).toEqual([
      { x: 0, m_s0: 1, iqr_s0: [0, 2] },
      { x: 10, m_s1: 3, iqr_s1: [2, 4] },
    ]);
    expect(xExtent(traces)).toEqual([0, 10]);
  });
});

describe('resolveDrillDownId (IDOR gate)', () => {
  const known = new Set(['PSN-1', 'PSN-2']);
  it('returns the id for a known pseudonym', () => {
    expect(resolveDrillDownId('PSN-1', known)).toBe('PSN-1');
  });
  it('returns null for an UNKNOWN pseudonym (crafted id)', () => {
    expect(resolveDrillDownId('PSN-999', known)).toBeNull();
    expect(resolveDrillDownId('../admin', known)).toBeNull();
  });
  it('returns null for a non-string id', () => {
    expect(resolveDrillDownId(42, known)).toBeNull();
    expect(resolveDrillDownId({ toString: () => 'PSN-1' }, known)).toBeNull();
    expect(resolveDrillDownId(undefined, known)).toBeNull();
  });
  it('returns null when the known set is empty (nothing is navigable)', () => {
    expect(resolveDrillDownId('PSN-1', new Set())).toBeNull();
  });
});
