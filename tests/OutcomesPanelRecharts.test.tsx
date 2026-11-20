// @vitest-environment jsdom
/**
 * Z0-P23 — Recharts Verläufe panel (replaces the Plotly-specific tests; C8 a/c, C15, Q21).
 *
 * Rendered with a layout (ResizeObserver stub + fixed-size ResponsiveContainer) so the real Recharts SVG is drawn:
 * median line, IQR band, the per-patient/scatter SVG layer, axis titles, legend and the cross-cohort legend names.
 * Counterparts:
 * - plotlyRenderable.test.ts → "renders the Recharts chart when a layout is available; marker DOM without one"
 * - OutcomesPanelScatterCap.test.tsx → "draws EVERY scatter point (no cap, C8 b)" / "no scatter when the layer is off"
 * - OutcomesPanel.test.tsx XCOHORT-03 → "cross-cohort legend names the cohort with (N=<n> Patient:innen)" (C15)
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
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

import type { CohortSeriesEntry } from '../src/components/outcomes/OutcomesPanel';
import OutcomesPanel from '../src/components/outcomes/OutcomesPanel';
import type { PanelResult } from '../src/utils/cohortTrajectory';

const DE: Record<string, string> = {
  cohortReferenceMedianVisus: 'Kohorten-Median Visus',
  cohortReferenceMedianCrt: 'Kohorten-Median CRT',
  outcomesYAxisVisusAbsolute: 'Visus (logMAR)',
  outcomesYAxisCrtAbsolute: 'Netzhautdicke (µm)',
  outcomesComparePatientsUnit: 'Patient:innen',
  outcomesTooltipDay: 'Tag',
  outcomesTooltipPatient: 'Patient',
};
const t = (k: string) => DE[k] ?? k;

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

function panel(nPatients: number, scatterPerPatient = 0): PanelResult {
  const patients = Array.from({ length: nPatients }, (_, i) => ({
    id: `p${i}`,
    pseudonym: `PSN-${i}`,
    excluded: false,
    sparse: false,
    measurements: [
      { x: 0, y: 0.3 + i * 0.001 },
      { x: 60, y: 0.35 },
      { x: 120, y: 0.4 },
    ],
  }));
  const scatterPoints = patients.flatMap((p, i) =>
    Array.from({ length: scatterPerPatient }, (_, j) => ({ x: j * 10, y: 0.2 + (i % 10) * 0.01, patientId: p.pseudonym })),
  );
  return {
    patients,
    scatterPoints,
    medianGrid: [
      { x: 0, y: 0.3, p25: 0.2, p75: 0.4, n: nPatients },
      { x: 60, y: 0.35, p25: 0.25, p75: 0.45, n: nPatients },
      { x: 120, y: 0.4, p25: 0.3, p75: 0.5, n: nPatients },
    ],
    summary: { patientCount: nPatients, measurementCount: nPatients * 3, excludedCount: 0 },
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

describe('Z0-P23 OutcomesPanel (Recharts)', () => {
  it('renders the Recharts chart when a layout is available (median line, IQR band, no marker DOM)', () => {
    const { container } = render(<OutcomesPanel {...base} panel={panel(3)} />);
    expect(container.querySelector('.recharts-surface')).not.toBeNull();
    expect(container.querySelector('.series-median .recharts-line-curve')?.getAttribute('stroke')).toBe('#10b981');
    expect(container.querySelector('.recharts-area')).not.toBeNull();
    expect(container.querySelector('[data-testid="outcomes-fallback-od"]')).toBeNull();
  });

  it('renders the marker DOM (no SVG) without a layout (jsdom without ResizeObserver)', () => {
    const saved = (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver;
    delete (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver;
    try {
      const { container } = render(<OutcomesPanel {...base} panel={panel(3)} />);
      expect(container.querySelector('.recharts-surface')).toBeNull();
      expect(container.querySelector('[data-testid="outcomes-fallback-od"]')).not.toBeNull();
    } finally {
      (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver = saved;
    }
  });

  it('removes the IQR band when the layer is switched off and keeps the per-patient layer', () => {
    const layers = { median: true, perPatient: true, scatter: false, spreadBand: true };
    const { container, rerender } = render(<OutcomesPanel {...base} layers={layers} panel={panel(5)} />);
    expect(container.querySelector('.recharts-area')).not.toBeNull();
    expect(container.querySelectorAll('[data-perpatient-layer] path').length).toBe(5);
    rerender(<OutcomesPanel {...base} layers={{ ...layers, spreadBand: false }} panel={panel(5)} />);
    expect(container.querySelector('.recharts-area')).toBeNull();
    expect(container.querySelectorAll('[data-perpatient-layer] path').length).toBe(5);
  });

  it('draws EVERY scatter point — no cap (C8 b)', () => {
    const layers = { median: true, perPatient: false, scatter: true, spreadBand: false };
    const { container } = render(<OutcomesPanel {...base} layers={layers} panel={panel(400, 20)} />);
    expect(container.querySelectorAll('[data-perpatient-layer] circle').length).toBe(8000);
  });

  it('renders no scatter when the layer is off', () => {
    const { container } = render(<OutcomesPanel {...base} panel={panel(10, 3)} />);
    expect(container.querySelectorAll('[data-perpatient-layer] circle').length).toBe(0);
  });

  it('labels the axes and names the single-cohort median like the case view (C15)', () => {
    const { container } = render(<OutcomesPanel {...base} panel={panel(3)} />);
    const labels = Array.from(container.querySelectorAll('.recharts-label')).map((el) => el.textContent);
    expect(labels).toContain('Visus (logMAR)');
    expect(labels).toContain('Tag');
    const legend = Array.from(container.querySelectorAll('.legend .legendtext')).map((el) => el.textContent);
    expect(legend).toEqual(['Kohorten-Median Visus']);
  });

  it('names the CRT median "Kohorten-Median CRT" and the CRT axis "Netzhautdicke (µm)"', () => {
    const { container } = render(<OutcomesPanel {...base} metric="crt" titleKey="metricsCrtPanelOd" panel={panel(3)} />);
    const labels = Array.from(container.querySelectorAll('.recharts-label')).map((el) => el.textContent);
    expect(labels).toContain('Netzhautdicke (µm)');
    expect(container.querySelector('.legend .legendtext')?.textContent).toBe('Kohorten-Median CRT');
  });

  it('cross-cohort legend names each cohort with (N=<n> Patient:innen) and its colour (C15)', () => {
    const a: CohortSeriesEntry = { cohortId: 'a', cohortName: 'Cohort A', patientCount: 42, color: '#047857', panel: panel(2) };
    const b: CohortSeriesEntry = { cohortId: 'b', cohortName: 'Cohort B', patientCount: 7, color: '#b45309', panel: panel(2) };
    const { container } = render(<OutcomesPanel {...base} panel={panel(0)} cohortSeries={[a, b]} />);
    const items = Array.from(container.querySelectorAll('.legend li'));
    expect(items.map((li) => li.querySelector('.legendtext')?.textContent)).toEqual([
      'Cohort A (N=42 Patient:innen)',
      'Cohort B (N=7 Patient:innen)',
    ]);
    const swatch = items[0].querySelector('[data-legend-swatch]') as HTMLElement;
    expect(swatch.style.backgroundColor).toBe('rgb(4, 120, 87)');
  });

  it('a hovered scatter point shows one tooltip box: heading with the x value, rows "<Bezeichnung>: <Wert>"', () => {
    const layers = { median: false, perPatient: false, scatter: true, spreadBand: false };
    const { container } = render(<OutcomesPanel {...base} layers={layers} panel={panel(2, 2)} />);
    const point = container.querySelectorAll('[data-perpatient-layer] circle')[1];
    fireEvent.mouseEnter(point, { clientX: 10, clientY: 10 });
    const box = container.querySelector('[data-testid="outcomes-hover-tooltip-od"] [data-testid="chart-tooltip"]');
    expect(box).not.toBeNull();
    expect(box!.querySelectorAll('[data-tooltip-heading]').length).toBe(1);
    expect(box!.querySelector('[data-tooltip-heading]')!.textContent).toBe('Tag 10');
    const rows = Array.from(box!.querySelectorAll('[data-tooltip-row]')).map((r) => r.textContent);
    expect(rows[0]).toBe('Patient: PSN-0');
    for (const r of rows) expect(r).toMatch(/^[^:]+: \S/);
  });

  it('a click on a patient line drills down only for a known pseudonym (IDOR gate)', () => {
    const onPointClick = vi.fn();
    const layers = { median: true, perPatient: true, scatter: false, spreadBand: false };
    const { container } = render(<OutcomesPanel {...base} layers={layers} panel={panel(2)} onPointClick={onPointClick} />);
    fireEvent.click(container.querySelectorAll('[data-perpatient-layer] path')[1]);
    expect(onPointClick).toHaveBeenCalledWith('PSN-1');
  });

  it('no drill-down in compare mode', () => {
    const onPointClick = vi.fn();
    const a: CohortSeriesEntry = { cohortId: 'a', cohortName: 'A', patientCount: 2, color: '#047857', panel: panel(2) };
    const b: CohortSeriesEntry = { cohortId: 'b', cohortName: 'B', patientCount: 2, color: '#b45309', panel: panel(2) };
    const layers = { median: true, perPatient: true, scatter: false, spreadBand: false };
    const { container } = render(
      <OutcomesPanel {...base} layers={layers} panel={panel(0)} cohortSeries={[a, b]} onPointClick={onPointClick} />,
    );
    const paths = container.querySelectorAll('[data-perpatient-layer] path');
    expect(paths.length).toBe(4);
    fireEvent.click(paths[0]);
    expect(onPointClick).not.toHaveBeenCalled();
  });
});
