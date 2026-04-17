// @vitest-environment jsdom
/**
 * A11Y-01: aria-label on OutcomesPanel chart container div.
 *
 * Tests:
 * 1. role="img" element with aria-label containing patientCount is present for eye="od"
 * 2. data-testid="outcomes-panel-od" is on the same element
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock Recharts so ResponsiveContainer works in jsdom (no ResizeObserver).
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
    Area: () => <g data-testid="recharts-area" />,
    Line: () => null,
    Scatter: () => null,
  };
});

import { cleanup, render, screen } from '@testing-library/react';
import OutcomesPanel from '../src/components/outcomes/OutcomesPanel';
import type { PanelResult } from '../src/utils/cohortTrajectory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildPanel(patientCount: number): PanelResult {
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
// Tests
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
