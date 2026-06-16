// @vitest-environment jsdom
/**
 * J1a (v1.15-p4) — the hover tooltip follows the HOVERED scatter point, not the
 * axis-tooltip's nearest-x point, and does so WITHOUT re-rendering the scatter
 * (the highlight + tooltip are driven imperatively from the same hover handlers).
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Recharts mock: renders the Scatter custom shape per datum (tagged by patientId)
// so a test can drive hover on a specific point, and renders the Tooltip content
// function so its nearest-x suppression branch runs.
vi.mock('recharts', async (importOriginal) => {
  const real = await importOriginal<typeof import('recharts')>();
  return {
    ...real,
    ResponsiveContainer: ({ children }: { children: any }) => (
      <div data-testid="recharts-responsive-container"><svg>{children}</svg></div>
    ),
    ComposedChart: ({ children }: { children: any }) => (
      <g data-testid="recharts-composed-chart">{children}</g>
    ),
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: ({ content }: { content?: any }) => {
      if (typeof content !== 'function') return null;
      const state = (globalThis as any).__tooltipState ?? { active: false, payload: [] };
      return <div data-testid="recharts-tooltip">{content(state)}</div>;
    },
    Legend: () => null,
    ReferenceLine: () => null,
    Area: () => <g data-testid="recharts-area" />,
    Line: () => null,
    Scatter: ({ shape, data }: any) => (
      <g data-testid="recharts-scatter">
        {typeof shape === 'function' && Array.isArray(data)
          ? data.map((d: any, i: number) => (
              <g key={i} data-testid={`scatter-shape-${d.patientId}`}>
                {shape({ cx: 5, cy: 5, payload: d })}
              </g>
            ))
          : null}
      </g>
    ),
  };
});

import OutcomesPanel from '../src/components/outcomes/OutcomesPanel';
import type { PanelResult } from '../src/utils/cohortTrajectory';

function panel(): PanelResult {
  return {
    patients: [],
    scatterPoints: [
      { x: 10, y: 0.5, patientId: 'PSN-1' },
      { x: 12, y: 0.9, patientId: 'PSN-2' },
    ],
    medianGrid: [{ x: 0, y: 0.3, p25: 0.2, p75: 0.4, n: 2 }],
    summary: { patientCount: 2, measurementCount: 6, excludedCount: 0 },
  };
}

const props = {
  eye: 'od' as const,
  color: '#3b82f6',
  axisMode: 'days' as const,
  yMetric: 'absolute' as const,
  layers: { median: false, perPatient: false, scatter: true, spreadBand: false },
  t: (k: string) => k,
  locale: 'en' as const,
  titleKey: 'outcomesPanelOd' as const,
  metric: 'visus' as const,
};

describe('OutcomesPanel — hover tooltip follows the hovered point (J1a)', () => {
  afterEach(() => {
    cleanup();
    delete (globalThis as any).__tooltipState;
  });

  it('shows the HOVERED point in the tooltip, not the nearest-x axis tooltip point', () => {
    // The axis tooltip would report PSN-1 (nearest-x)...
    (globalThis as any).__tooltipState = {
      active: true,
      payload: [{ payload: { x: 10, y: 0.5, patientId: 'PSN-1' } }],
    };
    const { container } = render(<OutcomesPanel {...props} panel={panel()} />);

    const tooltip = container.querySelector(
      '[data-testid="outcomes-hover-tooltip-od"]',
    ) as HTMLElement;
    expect(tooltip).not.toBeNull();
    // Hidden until a point is hovered.
    expect(tooltip.style.display).toBe('none');

    // ...but the cursor is over PSN-2's halo.
    const halo = container.querySelector(
      '[data-testid="scatter-shape-PSN-2"] circle',
    ) as Element;
    fireEvent.mouseEnter(halo, { clientX: 100, clientY: 100 });

    // The imperative tooltip reflects PSN-2 (the hovered point), shown.
    expect(tooltip.style.display).toBe('block');
    expect(tooltip.textContent).toContain('PSN-2');
    expect(tooltip.textContent).not.toContain('PSN-1');
  });

  it('hides the hover tooltip on mouse leave', () => {
    const { container } = render(<OutcomesPanel {...props} panel={panel()} />);
    const tooltip = container.querySelector(
      '[data-testid="outcomes-hover-tooltip-od"]',
    ) as HTMLElement;
    const halo = container.querySelector(
      '[data-testid="scatter-shape-PSN-2"] circle',
    ) as Element;
    fireEvent.mouseEnter(halo, { clientX: 100, clientY: 100 });
    expect(tooltip.style.display).toBe('block');
    fireEvent.mouseLeave(halo);
    expect(tooltip.style.display).toBe('none');
  });

  it('K1a: the axis Tooltip is removed entirely (no nearest-x pop-up renders)', () => {
    // K1a (v1.16-A): the Recharts axis <Tooltip> is gone — it produced the tester's
    // "TWO tooltips" (a nearest-x pop-up alongside the hovered-point one). With it
    // removed the panel renders NO recharts-tooltip node; only the single imperative
    // hover tooltip element remains.
    (globalThis as any).__tooltipState = {
      active: true,
      payload: [{ payload: { x: 10, y: 0.5, patientId: 'PSN-1' } }],
    };
    const { container } = render(<OutcomesPanel {...props} panel={panel()} />);
    expect(container.querySelector('[data-testid="recharts-tooltip"]')).toBeNull();
  });
});
