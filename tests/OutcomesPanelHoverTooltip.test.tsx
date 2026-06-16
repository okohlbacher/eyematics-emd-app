// @vitest-environment jsdom
/**
 * Hover tooltip — follows the HOVERED scatter point (single, scatter-priority).
 *
 * WS-1 (v1.17): the chart is Plotly; in jsdom the testable fallback renders each
 * scatter point as a node whose mouseenter drives the same imperative tooltip that
 * plotly_hover drives in the browser. There is exactly ONE tooltip element
 * (outcomes-hover-tooltip-${eye}); no second nearest-x pop-up.
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

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

describe('OutcomesPanel — hover tooltip follows the hovered point', () => {
  afterEach(() => cleanup());

  it('shows the HOVERED point in the tooltip', () => {
    const { container } = render(<OutcomesPanel {...props} panel={panel()} />);
    const tooltip = container.querySelector('[data-testid="outcomes-hover-tooltip-od"]') as HTMLElement;
    expect(tooltip).not.toBeNull();
    expect(tooltip.style.display).toBe('none');

    const point = container.querySelector('[data-testid="outcomes-scatter-point-PSN-2"]') as Element;
    fireEvent.mouseEnter(point, { clientX: 100, clientY: 100 });

    expect(tooltip.style.display).toBe('block');
    expect(tooltip.textContent).toContain('PSN-2');
    expect(tooltip.textContent).not.toContain('PSN-1');
  });

  it('hides the hover tooltip on mouse leave', () => {
    const { container } = render(<OutcomesPanel {...props} panel={panel()} />);
    const tooltip = container.querySelector('[data-testid="outcomes-hover-tooltip-od"]') as HTMLElement;
    const point = container.querySelector('[data-testid="outcomes-scatter-point-PSN-2"]') as Element;
    fireEvent.mouseEnter(point, { clientX: 100, clientY: 100 });
    expect(tooltip.style.display).toBe('block');
    fireEvent.mouseLeave(point);
    expect(tooltip.style.display).toBe('none');
  });

  it('renders exactly ONE tooltip element (no second nearest-x pop-up)', () => {
    const { container } = render(<OutcomesPanel {...props} panel={panel()} />);
    expect(container.querySelectorAll('[data-testid="outcomes-hover-tooltip-od"]').length).toBe(1);
  });
});
