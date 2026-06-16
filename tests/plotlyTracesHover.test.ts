/**
 * v1.18 WS-A trace-shape tests for the cohort Verläufe Plotly traces.
 *
 * M2: scatter + per-patient traces must NOT carry a native `hovertemplate` (which
 *     double-stacked with the custom imperative tooltip). They use `hoverinfo:'none'`
 *     — suppresses the native label while STILL firing `plotly_hover` (the event that
 *     drives the single detailed tooltip). 'skip' is wrong (kills the event); assert
 *     it is not used.
 * M3: cross-cohort traces emit per-cohort scattergl + per-patient lines ONLY when the
 *     matching layer toggle is on, each in that cohort's colour, with customdata so
 *     hover works.
 */
import { describe, expect, it } from 'vitest';

import {
  buildCrossCohortTraces,
  buildSingleCohortTraces,
  type LayerState,
} from '../src/components/outcomes/plotlyTraces';
import type { GridPoint, PanelResult } from '../src/utils/cohortTrajectory';

const allLayers: LayerState = { median: true, perPatient: true, scatter: true, spreadBand: true };

const medianGrid: GridPoint[] = [
  { x: 0, y: 0.3, p25: 0.2, p75: 0.4, n: 5 } as unknown as GridPoint,
  { x: 30, y: 0.35, p25: 0.25, p75: 0.45, n: 5 } as unknown as GridPoint,
];

function singleTraces() {
  return buildSingleCohortTraces({
    panel: { medianGrid } as unknown as PanelResult,
    layers: allLayers,
    scatterPoints: [{ x: 0, y: 0.3, patientId: 'PSN-1' }],
    colors: { series: '#1d4ed8', perPatient: '#9ca3af' },
    medianName: 'Median',
    hovertemplate: (n) => `${n}<extra></extra>`,
    perPatientSeries: [{ id: 'PSN-1', sparse: false, x: [0, 30], y: [0.3, 0.35] }],
  });
}

describe('M2 — single tooltip (no native hover label double-stack)', () => {
  it('scattergl trace uses hoverinfo:"none" and no hovertemplate', () => {
    const scatter = singleTraces().find((t) => t.type === 'scattergl');
    expect(scatter).toBeDefined();
    expect(scatter!.hoverinfo).toBe('none');
    expect(scatter!.hovertemplate).toBeUndefined();
    // 'none' (not 'skip') so plotly_hover still fires for the custom tooltip.
    expect(scatter!.hoverinfo).not.toBe('skip');
    // customdata retained so the hover handler resolves the pseudonym.
    expect(scatter!.customdata).toEqual(['PSN-1']);
  });

  it('per-patient line uses hoverinfo:"none" and no hovertemplate', () => {
    const line = singleTraces().find((t) => String(t.name).startsWith('perpatient-'));
    expect(line).toBeDefined();
    expect(line!.hoverinfo).toBe('none');
    expect(line!.hovertemplate).toBeUndefined();
    expect(line!.customdata).toEqual(['PSN-1', 'PSN-1']);
  });
});

describe('M3 — cross-cohort scatter + per-patient layers', () => {
  const series = [
    {
      cohortId: 'a',
      cohortName: 'Cohort A',
      patientCount: 5,
      color: '#047857',
      medianGrid,
      scatterPoints: [{ x: 0, y: 0.3, patientId: 'A-1' }],
      perPatientSeries: [{ id: 'A-1', sparse: false, x: [0, 30], y: [0.3, 0.35] as Array<number | null> }],
    },
  ];

  it('emits scattergl + per-patient line per cohort when both toggles are on', () => {
    const traces = buildCrossCohortTraces({ series, layers: allLayers });
    const scatter = traces.find((t) => t.type === 'scattergl');
    const line = traces.find((t) => String(t.name).startsWith('perpatient-'));
    expect(scatter).toBeDefined();
    expect(line).toBeDefined();
    // Drawn in the cohort colour; hover works (hoverinfo none + customdata).
    expect((scatter!.marker as { color?: string }).color).toContain('4, 120, 87');
    expect(scatter!.hoverinfo).toBe('none');
    expect(scatter!.customdata).toEqual(['A-1']);
    expect((line!.line as { color?: string }).color).toBe('#047857');
    expect(line!.hoverinfo).toBe('none');
  });

  it('emits NO scatter / per-patient traces when the toggles are off', () => {
    const traces = buildCrossCohortTraces({
      series,
      layers: { median: true, perPatient: false, scatter: false, spreadBand: true },
    });
    expect(traces.some((t) => t.type === 'scattergl')).toBe(false);
    expect(traces.some((t) => String(t.name).startsWith('perpatient-'))).toBe(false);
    // Median still present.
    expect(traces.some((t) => String(t.name).includes('Cohort A'))).toBe(true);
  });
});
