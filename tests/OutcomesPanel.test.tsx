// @vitest-environment jsdom
/**
 * A11Y-01 + cross-cohort overlay tests for OutcomesPanel.
 *
 * WS-1 (v1.17): the panel chart is now Plotly. In jsdom Plotly cannot render, so
 * PlotlyChart renders a testable fallback whose semantic markers
 * (outcomes-trace-median, outcomes-scatter-${eye}, …) we assert against instead of
 * the former Recharts-mock DOM.
 */

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { CohortSeriesEntry } from '../src/components/outcomes/OutcomesPanel';
import OutcomesPanel from '../src/components/outcomes/OutcomesPanel';
import type { PanelResult } from '../src/utils/cohortTrajectory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPanel(patientCount: number): PanelResult {
  return {
    patients: [
      {
        id: 'p1',
        pseudonym: 'P-001',
        excluded: false,
        sparse: false,
        measurements: [
          { x: 0, y: 0.3 },
          { x: 30, y: 0.35 },
        ],
      },
    ],
    scatterPoints: [],
    medianGrid: [{ x: 0, y: 0.3, p25: 0.2, p75: 0.4, n: patientCount }],
    summary: { patientCount, measurementCount: patientCount * 3, excludedCount: 0 },
  } as unknown as PanelResult;
}

function buildPanelNoPatients(patientCount: number): PanelResult {
  return {
    patients: [],
    scatterPoints: [],
    medianGrid: [{ x: 0, y: 0.3, p25: 0.2, p75: 0.4, n: patientCount }],
    summary: { patientCount, measurementCount: patientCount * 3, excludedCount: 0 },
  };
}

const t = (key: string) => key;

const defaultProps = {
  eye: 'od' as const,
  color: '#3b82f6',
  axisMode: 'days' as const,
  yMetric: 'absolute' as const,
  layers: { median: true, perPatient: false, scatter: false, spreadBand: false },
  t,
  locale: 'en' as const,
  titleKey: 'outcomesPanelOd' as const,
  metric: 'visus' as const,
};

const seriesA: CohortSeriesEntry = {
  cohortId: 'a',
  cohortName: 'Cohort A',
  patientCount: 42,
  color: '#047857',
  panel: buildPanelNoPatients(42),
};

const seriesB: CohortSeriesEntry = {
  cohortId: 'b',
  cohortName: 'Cohort B',
  patientCount: 17,
  color: '#b45309',
  panel: buildPanelNoPatients(17),
};

// ---------------------------------------------------------------------------
// A11Y-01
// ---------------------------------------------------------------------------

describe('OutcomesPanel — ARIA label (A11Y-01)', () => {
  afterEach(() => cleanup());

  it('renders role="img" element with aria-label containing patientCount for eye="od"', () => {
    render(<OutcomesPanel {...defaultProps} panel={buildPanel(42)} eye="od" />);
    const el = screen.getByRole('img', { name: /42/ });
    expect(el.getAttribute('data-testid')).toBe('outcomes-panel-od');
  });

  it('aria-label includes the titleKey and patient count', () => {
    render(<OutcomesPanel {...defaultProps} panel={buildPanel(42)} eye="od" />);
    const label = screen.getByRole('img', { name: /42/ }).getAttribute('aria-label') ?? '';
    expect(label).toContain('outcomesPanelOd');
    expect(label).toContain('42');
    expect(label).toContain('outcomesCardPatients');
  });

  it('renders role="img" element for eye="os"', () => {
    render(
      <OutcomesPanel {...defaultProps} panel={buildPanel(17)} eye="os" titleKey="outcomesPanelOs" />,
    );
    expect(screen.getByRole('img', { name: /17/ }).getAttribute('data-testid')).toBe('outcomes-panel-os');
  });
});

// ---------------------------------------------------------------------------
// Cross-cohort mode (Phase 16) — XCOHORT-02, XCOHORT-03, VIS-04
// ---------------------------------------------------------------------------

describe('OutcomesPanel — cross-cohort mode (Phase 16)', () => {
  afterEach(() => cleanup());

  it('XCOHORT-02: renders one median trace per cohortSeries entry', () => {
    const { container } = render(
      <OutcomesPanel {...defaultProps} panel={buildPanelNoPatients(0)} cohortSeries={[seriesA, seriesB]} />,
    );
    const medians = container.querySelectorAll('[data-testid="outcomes-trace-median"]');
    expect(medians.length).toBe(2);
  });

  it('XCOHORT-03: median trace name uses "(N=X patients)" format', () => {
    const { container } = render(
      <OutcomesPanel {...defaultProps} panel={buildPanelNoPatients(0)} cohortSeries={[seriesA]} />,
    );
    const median = container.querySelector('[data-testid="outcomes-trace-median"]');
    expect(median).not.toBeNull();
    expect(median!.getAttribute('data-name') ?? '').toMatch(/Cohort A \(N=42 patients\)/);
  });

  it('M3: single-cohort per-patient markers are never emitted in cross mode (cross uses its own testids)', () => {
    const { container } = render(
      <OutcomesPanel
        {...defaultProps}
        panel={buildPanel(10)}
        layers={{ ...defaultProps.layers, perPatient: true }}
        cohortSeries={[seriesA, seriesB]}
      />,
    );
    // The single-cohort `outcomes-perpatient-${id}` markers must not appear in cross mode.
    expect(container.querySelectorAll('[data-testid^="outcomes-perpatient-"]').length).toBe(0);
    expect(container.querySelectorAll('[data-testid="outcomes-trace-median"]').length).toBe(2);
  });

  it('M3: scatter toggle ON renders one cross-cohort scatter cloud per cohort (in cohort colour)', () => {
    // Cohort series WITH scatter points so the opt-in layer has something to draw.
    const a: CohortSeriesEntry = {
      ...seriesA,
      panel: {
        patients: [],
        scatterPoints: [{ x: 0, y: 0.3, patientId: 'A-1' }, { x: 30, y: 0.35, patientId: 'A-2' }],
        medianGrid: [{ x: 0, y: 0.3, p25: 0.2, p75: 0.4, n: 42 }],
        summary: { patientCount: 42, measurementCount: 84, excludedCount: 0 },
      } as unknown as PanelResult,
    };
    const b: CohortSeriesEntry = {
      ...seriesB,
      panel: {
        patients: [],
        scatterPoints: [{ x: 0, y: 0.5, patientId: 'B-1' }],
        medianGrid: [{ x: 0, y: 0.5, p25: 0.4, p75: 0.6, n: 17 }],
        summary: { patientCount: 17, measurementCount: 17, excludedCount: 0 },
      } as unknown as PanelResult,
    };
    const { container } = render(
      <OutcomesPanel
        {...defaultProps}
        panel={buildPanelNoPatients(0)}
        layers={{ ...defaultProps.layers, scatter: true }}
        cohortSeries={[a, b]}
      />,
    );
    const aMarker = container.querySelector('[data-testid="outcomes-cross-scatter-a"]');
    const bMarker = container.querySelector('[data-testid="outcomes-cross-scatter-b"]');
    expect(aMarker).not.toBeNull();
    expect(bMarker).not.toBeNull();
    expect(aMarker!.getAttribute('data-count')).toBe('2');
    expect(bMarker!.getAttribute('data-count')).toBe('1');
    // Each cohort's scatter is drawn in its own colour.
    expect(aMarker!.getAttribute('data-color')).toContain('4, 120, 87'); // #047857 → rgba
  });

  it('M3: scatter toggle OFF emits no cross-cohort scatter clouds', () => {
    const a: CohortSeriesEntry = {
      ...seriesA,
      panel: {
        patients: [],
        scatterPoints: [{ x: 0, y: 0.3, patientId: 'A-1' }],
        medianGrid: [{ x: 0, y: 0.3, p25: 0.2, p75: 0.4, n: 42 }],
        summary: { patientCount: 42, measurementCount: 42, excludedCount: 0 },
      } as unknown as PanelResult,
    };
    const { container } = render(
      <OutcomesPanel
        {...defaultProps}
        panel={buildPanelNoPatients(0)}
        layers={{ ...defaultProps.layers, scatter: false }}
        cohortSeries={[a, seriesB]}
      />,
    );
    expect(container.querySelectorAll('[data-testid^="outcomes-cross-scatter-"]').length).toBe(0);
  });

  it('M3: per-patient toggle ON renders cross-cohort per-patient lines per cohort (in cohort colour)', () => {
    const a: CohortSeriesEntry = {
      ...seriesA,
      panel: {
        patients: [
          { id: 'pa', pseudonym: 'A-PSN', excluded: false, sparse: false, measurements: [{ x: 0, y: 0.3 }, { x: 30, y: 0.4 }] },
        ],
        scatterPoints: [],
        medianGrid: [{ x: 0, y: 0.3, p25: 0.2, p75: 0.4, n: 42 }],
        summary: { patientCount: 42, measurementCount: 84, excludedCount: 0 },
      } as unknown as PanelResult,
    };
    const { container } = render(
      <OutcomesPanel
        {...defaultProps}
        panel={buildPanelNoPatients(0)}
        layers={{ ...defaultProps.layers, perPatient: true }}
        cohortSeries={[a, seriesB]}
      />,
    );
    const line = container.querySelector('[data-testid="outcomes-cross-perpatient-a-A-PSN"]');
    expect(line).not.toBeNull();
    expect(line!.getAttribute('data-color')).toBe('#047857');
  });

  it('VIS-04: single-cohort per-patient line color is #9ca3af', () => {
    const { container } = render(
      <OutcomesPanel
        {...defaultProps}
        panel={buildPanel(10)}
        layers={{ ...defaultProps.layers, perPatient: true }}
      />,
    );
    const perPatient = container.querySelector('[data-testid="outcomes-perpatient-P-001"]');
    expect(perPatient).not.toBeNull();
    expect(perPatient!.getAttribute('data-color')).toBe('#9ca3af');
  });

  it('VIS-04: single-cohort median trace has strokeWidth 4', () => {
    const { container } = render(
      <OutcomesPanel
        {...defaultProps}
        panel={buildPanelNoPatients(10)}
        layers={{ ...defaultProps.layers, median: true }}
      />,
    );
    const median = container.querySelector('[data-testid="outcomes-trace-median"]');
    expect(median).not.toBeNull();
    expect(median!.getAttribute('data-stroke-width')).toBe('4');
  });
});
