// @vitest-environment jsdom
/**
 * Phase 13 Plan 02 — OutcomesPanel CRT y-domain regression guard.
 *
 * Asserts that:
 *   1. metric='crt' + yMetric='absolute' → y-domain [0, 800]
 *   2. metric='visus' (default) + yMetric='absolute' → y-domain [0, 1]
 *      (logMAR 0–1.0 per admin Apr-17, v1.6 commit 668bfaf — source is authoritative)
 *   3. metric='crt' + yMetric='delta' → data-driven symmetric domain (not the absolute range)
 *   4. No metric prop (backward compat) → identical to metric='visus'
 *
 * Uses the hidden `data-testid="outcomes-panel-ydomain"` div added to OutcomesPanel
 * to read the computed domain without parsing SVG axis ticks.
 */
import { cleanup,render } from '@testing-library/react';
import { afterEach,describe, expect, it, vi } from 'vitest';

// Deterministic Recharts mock — same pattern as outcomesIqrSparse.test.tsx
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
import type { PanelResult } from '../src/utils/cohortTrajectory';

afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePanel(opts: {
  patientCount?: number;
  medianGrid?: Array<{ x: number; y: number; p25: number; p75: number; n: number }>;
}): PanelResult {
  const { patientCount = 2, medianGrid = [] } = opts;
  return {
    patients: [],
    scatterPoints: [],
    medianGrid,
    summary: { patientCount, excludedCount: 0, measurementCount: patientCount * 3 },
  };
}

const t = (k: string) => k;
const layers = { median: true, perPatient: false, scatter: false, spreadBand: false };

// Dense medianGrid with 2 patients for domain derivation in delta mode
const DELTA_GRID = [
  { x: 0, y: 0, p25: -5, p75: 5, n: 2 },
  { x: 30, y: -30, p25: -40, p75: -20, n: 2 },
  { x: 60, y: -60, p25: -70, p75: -50, n: 2 },
];

// ---------------------------------------------------------------------------
// CRT y-domain assertions
// ---------------------------------------------------------------------------

describe('OutcomesPanel — CRT y-domain branching', () => {
  it('CRT absolute mode: y-domain is [0, 800] (data-min="0" data-max="800")', () => {
    const { container } = render(
      <OutcomesPanel
        panel={makePanel({ patientCount: 2, medianGrid: [{ x: 0, y: 300, p25: 250, p75: 350, n: 2 }] })}
        eye="od"
        color="#7c3aed"
        axisMode="days"
        yMetric="absolute"
        metric="crt"
        layers={layers}
        t={t}
        locale="en"
        titleKey="metricsCrtPanelOd"
      />,
    );
    const marker = container.querySelector('[data-testid="outcomes-panel-ydomain"]');
    expect(marker, 'y-domain marker div not found').not.toBeNull();
    expect(marker!.getAttribute('data-min')).toBe('0');
    expect(marker!.getAttribute('data-max')).toBe('800');
    expect(marker!.getAttribute('data-metric')).toBe('crt');
  });

  // Phase 13 Plan 02 guard, updated v1.9 Phase 21: source emits [0, 1] per admin Apr-17 (commit 668bfaf)
  it('visus absolute mode: y-domain is [0, 1] (data-min="0" data-max="1")', () => {
    const { container } = render(
      <OutcomesPanel
        panel={makePanel({ patientCount: 2, medianGrid: [{ x: 0, y: 0.5, p25: 0.4, p75: 0.6, n: 2 }] })}
        eye="od"
        color="#1d4ed8"
        axisMode="days"
        yMetric="absolute"
        metric="visus"
        layers={layers}
        t={t}
        locale="en"
        titleKey="outcomesPanelOd"
      />,
    );
    const marker = container.querySelector('[data-testid="outcomes-panel-ydomain"]');
    expect(marker, 'y-domain marker div not found').not.toBeNull();
    expect(marker!.getAttribute('data-min')).toBe('0');
    expect(marker!.getAttribute('data-max')).toBe('1');
  });

  // Phase 13 Plan 02 guard, updated v1.9 Phase 21: source emits [0, 1] per admin Apr-17 (commit 668bfaf)
  it('backward compat: no metric prop defaults to visus absolute [0, 1]', () => {
    const { container } = render(
      <OutcomesPanel
        panel={makePanel({ patientCount: 2, medianGrid: [{ x: 0, y: 0.5, p25: 0.4, p75: 0.6, n: 2 }] })}
        eye="od"
        color="#1d4ed8"
        axisMode="days"
        yMetric="absolute"
        // metric prop intentionally omitted
        layers={layers}
        t={t}
        locale="en"
        titleKey="outcomesPanelOd"
      />,
    );
    const marker = container.querySelector('[data-testid="outcomes-panel-ydomain"]');
    expect(marker, 'y-domain marker div not found').not.toBeNull();
    expect(marker!.getAttribute('data-min')).toBe('0');
    expect(marker!.getAttribute('data-max')).toBe('1');
  });

  it('CRT delta mode: y-domain is symmetric data-driven (not [0, 800])', () => {
    const { container } = render(
      <OutcomesPanel
        panel={makePanel({ patientCount: 2, medianGrid: DELTA_GRID })}
        eye="od"
        color="#7c3aed"
        axisMode="days"
        yMetric="delta"
        metric="crt"
        layers={layers}
        t={t}
        locale="en"
        titleKey="metricsCrtPanelOd"
      />,
    );
    const marker = container.querySelector('[data-testid="outcomes-panel-ydomain"]');
    expect(marker, 'y-domain marker div not found').not.toBeNull();
    // Domain should be symmetric (data-min is negative, data-max is positive)
    const dMin = Number(marker!.getAttribute('data-min'));
    const dMax = Number(marker!.getAttribute('data-max'));
    expect(dMin).toBeLessThan(0);
    expect(dMax).toBeGreaterThan(0);
    // Not the CRT absolute domain
    expect(dMax).not.toBe(800);
  });
});
