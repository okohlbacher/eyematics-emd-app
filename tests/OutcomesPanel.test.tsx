// @vitest-environment jsdom
/**
 * A11Y-01: aria-label on OutcomesPanel chart container div.
 *
 * Tests:
 * 1. role="img" element with aria-label containing patientCount is present for eye="od"
 * 2. data-testid="outcomes-panel-od" is on the same element
 *
 * Phase 16: Cross-cohort overlay + VIS-04 assertions (XCOHORT-02, XCOHORT-03, VIS-04).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock Recharts so ResponsiveContainer works in jsdom (no ResizeObserver).
// Extended in Phase 16 to expose stroke / strokeWidth / name as data-* attributes
// so test assertions can inspect rendered Line/Area props.
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Area: ({ fill, stroke, legendType }: any) => (
      <g
        data-testid="recharts-area"
        data-fill={fill}
        data-stroke={stroke}
        data-legend-type={legendType}
      />
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Line: ({ stroke, strokeWidth, name, legendType }: any) => (
      <g
        data-testid="recharts-line"
        data-stroke={stroke}
        data-stroke-width={String(strokeWidth)}
        data-name={name}
        data-legend-type={legendType}
      />
    ),
    Scatter: () => <g data-testid="recharts-scatter" />,
  };
});

import { cleanup, render, screen } from '@testing-library/react';
import OutcomesPanel from '../src/components/outcomes/OutcomesPanel';
import type { CohortSeriesEntry } from '../src/components/outcomes/OutcomesPanel';
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
  };
}

function buildPanelNoPatients(patientCount: number): PanelResult {
  return {
    patients: [],
    scatterPoints: [],
    medianGrid: [{ x: 0, y: 0.3, p25: 0.2, p75: 0.4, n: patientCount }],
    summary: { patientCount, measurementCount: patientCount * 3, excludedCount: 0 },
  };
}

/** Simple translation stub: returns key as-is (consistent with other test files) */
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

// ---------------------------------------------------------------------------
// Cross-cohort fixtures
// ---------------------------------------------------------------------------

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
// A11Y-01 Tests (existing)
// ---------------------------------------------------------------------------

describe('OutcomesPanel — ARIA label (A11Y-01)', () => {
  afterEach(() => cleanup());
  it('renders role="img" element with aria-label containing patientCount for eye="od"', () => {
    const panel = buildPanel(42);
    render(<OutcomesPanel {...defaultProps} panel={panel} eye="od" />);

    // RTL ARIA query: find the element by role "img" with label containing "42"
    const el = screen.getByRole('img', { name: /42/ });
    expect(el).toBeTruthy();
    // Confirm it is the correct outer panel div
    expect(el.getAttribute('data-testid')).toBe('outcomes-panel-od');
  });

  it('aria-label includes the titleKey and patient count', () => {
    const panel = buildPanel(42);
    render(<OutcomesPanel {...defaultProps} panel={panel} eye="od" />);

    const el = screen.getByRole('img', { name: /42/ });
    const label = el.getAttribute('aria-label') ?? '';
    // titleKey stub returns the key string: 'outcomesPanelOd'
    expect(label).toContain('outcomesPanelOd');
    // patient count from summary
    expect(label).toContain('42');
    // outcomesCardPatients key stub
    expect(label).toContain('outcomesCardPatients');
  });

  it('renders role="img" element for eye="os"', () => {
    const panel = buildPanel(17);
    render(
      <OutcomesPanel
        {...defaultProps}
        panel={panel}
        eye="os"
        titleKey="outcomesPanelOs"
      />,
    );

    const el = screen.getByRole('img', { name: /17/ });
    expect(el.getAttribute('data-testid')).toBe('outcomes-panel-os');
  });
});

// ---------------------------------------------------------------------------
// Cross-cohort mode (Phase 16) — XCOHORT-02, XCOHORT-03, VIS-04
// ---------------------------------------------------------------------------

describe('OutcomesPanel — cross-cohort mode (Phase 16)', () => {
  afterEach(() => cleanup());

  it('XCOHORT-02: renders one median Line per cohortSeries entry', () => {
    const { container } = render(
      <OutcomesPanel
        {...defaultProps}
        panel={buildPanelNoPatients(0)}
        cohortSeries={[seriesA, seriesB]}
      />,
    );
    const lines = container.querySelectorAll('[data-testid="recharts-line"]');
    expect(lines.length).toBe(2);
  });

  it('XCOHORT-03: median Line name prop uses "(N=X patients)" format', () => {
    const { container } = render(
      <OutcomesPanel
        {...defaultProps}
        panel={buildPanelNoPatients(0)}
        cohortSeries={[seriesA]}
      />,
    );
    const line = container.querySelector('[data-testid="recharts-line"]');
    expect(line).not.toBeNull();
    const nameAttr = line!.getAttribute('data-name') ?? '';
    expect(nameAttr).toMatch(/Cohort A \(N=42 patients\)/);
  });

  it('XCOHORT-02: per-patient lines are suppressed in cross-cohort mode even when layers.perPatient is true', () => {
    const { container } = render(
      <OutcomesPanel
        {...defaultProps}
        panel={buildPanel(10)}
        layers={{ ...defaultProps.layers, perPatient: true }}
        cohortSeries={[seriesA, seriesB]}
      />,
    );
    // In cross mode only 2 cohort median Lines render (no per-patient lines)
    const lines = container.querySelectorAll('[data-testid="recharts-line"]');
    expect(lines.length).toBe(2);
  });

  it('XCOHORT-02: scatter is suppressed in cross-cohort mode even when layers.scatter is true', () => {
    const { container } = render(
      <OutcomesPanel
        {...defaultProps}
        panel={buildPanel(10)}
        layers={{ ...defaultProps.layers, scatter: true }}
        cohortSeries={[seriesA, seriesB]}
      />,
    );
    const scatters = container.querySelectorAll('[data-testid="recharts-scatter"]');
    expect(scatters.length).toBe(0);
  });

  it('VIS-04: single-cohort per-patient Line stroke is #9ca3af', () => {
    const { container } = render(
      <OutcomesPanel
        {...defaultProps}
        panel={buildPanel(10)}
        layers={{ ...defaultProps.layers, perPatient: true }}
      />,
    );
    // per-patient lines should have data-stroke="#9ca3af"
    const perPatientLine = container.querySelector('[data-testid="recharts-line"][data-stroke="#9ca3af"]');
    expect(perPatientLine).not.toBeNull();
  });

  it('VIS-04: single-cohort median Line has strokeWidth 4', () => {
    const { container } = render(
      <OutcomesPanel
        {...defaultProps}
        panel={buildPanelNoPatients(10)}
        layers={{ ...defaultProps.layers, median: true }}
      />,
    );
    const medianLine = container.querySelector('[data-testid="recharts-line"][data-stroke-width="4"]');
    expect(medianLine).not.toBeNull();
  });
});
