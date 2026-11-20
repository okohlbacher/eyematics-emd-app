// @vitest-environment jsdom
/**
 * Z0-P23 — review finding (severity 3, Q21 a): a Brush zoom must not outlive "Zoom zurücksetzen" or a change of the
 * x-axis, the y-mode or the compared series. Recharts keeps the Brush range in its chart state
 * (dataStartIndex/dataEndIndex); if it survives, the median line and the IQR band stay limited to the old index range.
 *
 * Observable: number of points of the median line (`.series-median .recharts-line-curve`, linear "M…L…" path) and of
 * the IQR band (distinct x positions) equals the number of median rows after reset / scope change. The Brush is moved with its
 * keyboard handler (focused traveller + ArrowRight), as a user can.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { cloneElement, type ReactElement } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('recharts', async (importOriginal) => {
  const real = await importOriginal<typeof import('recharts')>();
  return {
    ...real,
    ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number; height?: number }> }) =>
      cloneElement(children, { width: 600, height: 320 }),
  };
});

import OutcomesPanel from '../../../src/components/outcomes/OutcomesPanel';
import type { PanelResult } from '../../../src/utils/cohortTrajectory';

const t = (k: string) => k;

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
});
afterAll(() => {
  delete (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver;
});
afterEach(() => cleanup());

/** Synthetic panel with `nRows` median rows at x = 0, 30, 60, … */
function panel(nRows: number): PanelResult {
  const xs = Array.from({ length: nRows }, (_, i) => i * 30);
  const patients = Array.from({ length: 4 }, (_, i) => ({
    id: `p${i}`,
    pseudonym: `PSN-${i}`,
    excluded: false,
    sparse: false,
    measurements: xs.map((x) => ({ x, y: 0.3 + i * 0.01 })),
  }));
  return {
    patients,
    scatterPoints: [],
    medianGrid: xs.map((x, i) => ({ x, y: 0.3 + i * 0.01, p25: 0.2 + i * 0.01, p75: 0.4 + i * 0.01, n: 4 })),
    summary: { patientCount: 4, measurementCount: 4 * nRows, excludedCount: 0 },
  } as unknown as PanelResult;
}

const base = {
  eye: 'od' as const,
  axisMode: 'days' as const,
  yMetric: 'absolute' as const,
  layers: { median: true, perPatient: false, scatter: false, spreadBand: true },
  t,
  locale: 'de' as const,
  titleKey: 'outcomesPanelOd' as const,
};

/** Number of distinct x positions in a linear SVG path ("M x,y L x,y …"), i.e. the rows a curve or band covers. */
const pointsOf = (d: string | null | undefined) =>
  new Set([...(d ?? '').matchAll(/[ML]\s*(-?[\d.]+)/g)].map((m) => Number(m[1]).toFixed(3))).size;
const medianPoints = (c: HTMLElement) => pointsOf(c.querySelector('.series-median .recharts-line-curve')?.getAttribute('d'));
// The IQR band is one closed `.recharts-area-area` path (upper edge, then lower edge; same x positions).
const iqrPoints = (c: HTMLElement) => pointsOf(c.querySelector('.series-iqr .recharts-area-area')?.getAttribute('d'));

/** Move the Brush's start handle `steps` rows to the right with the keyboard. */
function brushStartRight(c: HTMLElement, steps: number) {
  const start = c.querySelectorAll<SVGGElement>('.recharts-brush-traveller')[0];
  expect(start).not.toBeUndefined();
  for (let i = 0; i < steps; i++) {
    act(() => {
      fireEvent.keyDown(start, { key: 'ArrowRight' });
    });
  }
}

describe('[Z0-P23] Brush zoom does not outlive reset or a scope change (Q21 a)', () => {
  it('Brush zoom narrows the median; "Zoom zurücksetzen" restores median and IQR band to all rows', () => {
    const { container, getByText } = render(<OutcomesPanel {...base} panel={panel(9)} />);
    expect(medianPoints(container)).toBe(9);
    expect(iqrPoints(container)).toBe(9);
    brushStartRight(container, 4);
    expect(medianPoints(container)).toBe(5);
    act(() => {
      fireEvent.click(getByText('outcomesZoomReset'));
    });
    expect(medianPoints(container)).toBe(9);
    expect(iqrPoints(container)).toBe(9);
  });

  it('a change of the x-axis after a Brush zoom shows median and IQR band over all rows', () => {
    // Same panel object: only the scope prop changes (the strictest case for stale chart state).
    const p = panel(9);
    const { container, rerender } = render(<OutcomesPanel {...base} panel={p} />);
    brushStartRight(container, 4);
    expect(medianPoints(container)).toBe(5);
    rerender(<OutcomesPanel {...base} axisMode="treatments" panel={p} />);
    expect(medianPoints(container)).toBe(9);
    expect(iqrPoints(container)).toBe(9);
  });

  it('a change of the y-mode after a Brush zoom shows median and IQR band over all rows', () => {
    // Same panel object: only the scope prop changes (the strictest case for stale chart state).
    const p = panel(9);
    const { container, rerender } = render(<OutcomesPanel {...base} panel={p} />);
    brushStartRight(container, 4);
    expect(medianPoints(container)).toBe(5);
    rerender(<OutcomesPanel {...base} yMetric="delta" panel={p} />);
    expect(medianPoints(container)).toBe(9);
    expect(iqrPoints(container)).toBe(9);
  });

  it('new series data (other cohort) after a Brush zoom shows median and IQR band over all rows', () => {
    const { container, rerender } = render(<OutcomesPanel {...base} panel={panel(9)} />);
    brushStartRight(container, 4);
    expect(medianPoints(container)).toBe(5);
    rerender(<OutcomesPanel {...base} panel={panel(7)} />);
    expect(medianPoints(container)).toBe(7);
    expect(iqrPoints(container)).toBe(7);
  });
});
