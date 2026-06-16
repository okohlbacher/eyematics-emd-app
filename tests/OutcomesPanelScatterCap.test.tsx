// @vitest-environment jsdom
/**
 * Scatter cap / downsample — OutcomesPanel.
 *
 * WS-1 (v1.17): scattergl draws to WebGL so the cap rose from the v1.16 SVG cap to
 * SCATTER_RENDER_CAP. When the scatter layer is on for a very large cohort the panel
 * renders at most SCATTER_RENDER_CAP points (even-stride downsample) and logs the
 * drop (console.info), never silently. Below the cap, every point renders. We assert
 * via the jsdom fallback's per-point nodes (outcomes-scatter-point-${id}).
 */

import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import OutcomesPanel from '../src/components/outcomes/OutcomesPanel';
import { SCATTER_RENDER_CAP } from '../src/components/outcomes/plotlyTraces';
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

function renderedCount(container: HTMLElement): number {
  return container.querySelector('[data-testid="outcomes-scatter-od"]')
    ? Number(container.querySelector('[data-testid="outcomes-scatter-od"]')!.getAttribute('data-count'))
    : 0;
}

describe('OutcomesPanel scatter cap/downsample', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders ALL points unchanged when below the cap', () => {
    const { container } = render(<OutcomesPanel {...baseProps} panel={buildPanelWithScatter(200)} />);
    expect(renderedCount(container)).toBe(200);
  });

  it('downsamples to at most the cap for a very large cohort (and logs, never silent)', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const n = SCATTER_RENDER_CAP * 2 + 130;
    const { container } = render(<OutcomesPanel {...baseProps} panel={buildPanelWithScatter(n)} />);
    const rendered = renderedCount(container);
    expect(rendered).toBeLessThanOrEqual(SCATTER_RENDER_CAP);
    expect(rendered).toBeLessThan(n);
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const msg = String(infoSpy.mock.calls[0][0]);
    expect(msg).toContain(String(n));
    expect(msg).toContain(String(rendered));
  });

  it('downsample is even-stride (spans the range), not a truncated prefix', () => {
    const n = SCATTER_RENDER_CAP * 2 + 130;
    const { container } = render(<OutcomesPanel {...baseProps} panel={buildPanelWithScatter(n)} />);
    // First original point is retained; a high-index point is also retained (even
    // stride covers the whole range, not just a head slice).
    expect(container.querySelector('[data-testid="outcomes-scatter-point-PSN-0"]')).not.toBeNull();
    const lastIdx = n - 1;
    const nearTail = Array.from({ length: 200 }, (_, k) => lastIdx - k).some(
      (i) => container.querySelector(`[data-testid="outcomes-scatter-point-PSN-${i}"]`) != null,
    );
    expect(nearTail).toBe(true);
  });

  it('renders no scatter when the layer is off', () => {
    const { container } = render(
      <OutcomesPanel
        {...baseProps}
        panel={buildPanelWithScatter(200)}
        layers={{ median: false, perPatient: false, scatter: false, spreadBand: false }}
      />,
    );
    expect(container.querySelector('[data-testid="outcomes-scatter-od"]')).toBeNull();
  });
});
