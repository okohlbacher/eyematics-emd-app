// Z0-P07 — the IQR toggle governs the cross-cohort bands (PLAN Z0 § Z0-P07 §5, trace builder). Synthetic values only.
import { describe, expect, it } from 'vitest';

import { buildCrossCohortTraces, type LayerState } from '../../../src/components/outcomes/trajectoryTraces';

const grid = [
  { x: 0, y: 300, p25: 280, p75: 320, n: 5 },
  { x: 30, y: 290, p25: 270, p75: 310, n: 5 },
];
const series = [
  { cohortId: 'a', cohortName: 'Testkohorte', patientCount: 5, color: '#1f77b4', medianGrid: grid },
  { cohortId: 'b', cohortName: 'Vergleichskohorte', patientCount: 5, color: '#ff7f0e', medianGrid: grid },
];
const layers = (spreadBand: boolean): LayerState => ({ median: true, perPatient: false, scatter: false, spreadBand });
const bands = (spreadBand: boolean) =>
  buildCrossCohortTraces({ series, layers: layers(spreadBand), legendName: (s) => s.cohortName }).filter(
    (tr) => tr.kind === 'iqr',
  );

describe('[Z0-P07] cross-cohort IQR bands follow the spreadBand toggle', () => {
  it('draws no band when the toggle is off', () => {
    expect(bands(false)).toHaveLength(0);
  });

  it('draws one band per cohort in its cohort colour when the toggle is on', () => {
    expect(bands(true).map((b) => [b.cohortId, b.color])).toEqual([
      ['a', '#1f77b4'],
      ['b', '#ff7f0e'],
    ]);
  });
});
