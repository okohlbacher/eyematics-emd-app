// @vitest-environment jsdom
/**
 * I2 (v1.14-p4) — scatter cap/downsample in OutcomesPanel.
 *
 * When the scatter layer is ON for a large cohort, the panel renders at most
 * SCATTER_RENDER_CAP points (even-stride downsample) instead of the full cloud —
 * bounding the SVG node count so enabling scatter stays responsive. The drop is
 * logged (console.info), never silent. Drill-down/hover machinery is unchanged and
 * operates on every RENDERED point (asserted indirectly: the rendered Scatter still
 * receives the downsampled data with patientId payloads intact).
 *
 * A recharts mock captures the `data` array handed to <Scatter>.
 */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Capture every <Scatter data> the panel renders.
const scatterDataCaptures: unknown[][] = [];

vi.mock('recharts', async (importOriginal) => {
  const real = await importOriginal<typeof import('recharts')>();
  return {
    ...real,
    ResponsiveContainer: ({ children }: { children: any }) => (
      <div><svg>{children}</svg></div>
    ),
    ComposedChart: ({ children }: { children: any }) => <g>{children}</g>,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: () => null,
    Area: () => null,
    Line: () => null,
    Scatter: ({ data }: { data: unknown[] }) => {
      scatterDataCaptures.push(data);
      return <g data-testid="recharts-scatter" />;
    },
  };
});

import OutcomesPanel from '../src/components/outcomes/OutcomesPanel';
import type { PanelResult } from '../src/utils/cohortTrajectory';

const t = (key: string) => key;

function buildPanelWithScatter(nPoints: number): PanelResult {
  const scatterPoints = Array.from({ length: nPoints }, (_, i) => ({
    x: i,
    y: (i % 100) / 100,
    patientId: `PSN-${i}`,
  }));
  return {
    patients: [],
    scatterPoints: scatterPoints as never,
    medianGrid: [{ x: 0, y: 0.3, p25: 0.2, p75: 0.4, n: 1 }],
    summary: { patientCount: nPoints, measurementCount: nPoints, excludedCount: 0 },
  };
}

const baseProps = {
  eye: 'od' as const,
  color: '#3b82f6',
  axisMode: 'days' as const,
  yMetric: 'absolute' as const,
  layers: { median: false, perPatient: false, scatter: true, spreadBand: false },
  t,
  locale: 'en' as const,
  titleKey: 'outcomesPanelOd' as const,
  metric: 'visus' as const,
  onPointClick: vi.fn(),
};

describe('I2 — OutcomesPanel scatter cap/downsample', () => {
  beforeEach(() => {
    scatterDataCaptures.length = 0;
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders ALL points unchanged when below the cap', () => {
    const panel = buildPanelWithScatter(200);
    render(<OutcomesPanel {...baseProps} panel={panel} />);
    expect(scatterDataCaptures.length).toBe(1);
    expect((scatterDataCaptures[0] as unknown[]).length).toBe(200);
  });

  it('downsamples to at most the cap for a large cohort (and logs, never silent)', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const panel = buildPanelWithScatter(7130); // ~the 245-cohort point count
    render(<OutcomesPanel {...baseProps} panel={panel} />);

    const rendered = scatterDataCaptures[0] as unknown[];
    expect(rendered.length).toBeLessThanOrEqual(1500);
    expect(rendered.length).toBeLessThan(7130);
    // Drop is logged with both counts — no silent truncation.
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const msg = String(infoSpy.mock.calls[0][0]);
    expect(msg).toContain('7130');
    expect(msg).toContain(String(rendered.length));
  });

  it('downsample is even-stride (spans the range), not a truncated prefix', () => {
    const panel = buildPanelWithScatter(7130);
    vi.spyOn(console, 'info').mockImplementation(() => {});
    render(<OutcomesPanel {...baseProps} panel={panel} />);

    const rendered = scatterDataCaptures[0] as { x: number; patientId: string }[];
    // First point is the original first; last rendered point is near the original
    // tail (even stride), proving uniform coverage rather than a head slice.
    expect(rendered[0].x).toBe(0);
    expect(rendered[rendered.length - 1].x).toBeGreaterThan(7000);
    // Payloads (patientId) are preserved so drill-down/hover still resolves a patient.
    expect(typeof rendered[0].patientId).toBe('string');
  });

  it('renders no Scatter when the layer is off', () => {
    const panel = buildPanelWithScatter(7130);
    render(
      <OutcomesPanel
        {...baseProps}
        panel={panel}
        layers={{ median: false, perPatient: false, scatter: false, spreadBand: false }}
      />,
    );
    expect(scatterDataCaptures.length).toBe(0);
  });
});
