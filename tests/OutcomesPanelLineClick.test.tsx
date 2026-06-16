// @vitest-environment jsdom
/**
 * J1b / K1c — clickable + hoverable per-patient trajectory lines.
 *
 * WS-1 (v1.17): the chart is Plotly; in jsdom the testable fallback renders each
 * per-patient line as a node (outcomes-perpatient-${pseudonym}). Clicking it drills
 * to that patient via the same onPointClick → drill-down path as a scatter click
 * (IDOR gate reused); hovering it shows that patient's tooltip — but only when the
 * scatter layer is OFF (scatter takes precedence). Both are gated to single-cohort
 * mode + the per-patient layer being shown.
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import OutcomesPanel from '../src/components/outcomes/OutcomesPanel';
import type { PanelResult } from '../src/utils/cohortTrajectory';

function panelWithPerPatient(): PanelResult {
  return {
    patients: [
      {
        id: 'PSN-1',
        pseudonym: 'PSN-1',
        excluded: false,
        sparse: false,
        baseline: 0.3,
        measurements: [
          { x: 0, y: 0.3, date: '2024-01-01', decimal: 0.5, logmar: 0.3, snellenNum: 20, snellenDen: 40, eye: 'od' },
          { x: 30, y: 0.5, date: '2024-02-01', decimal: 0.3, logmar: 0.5, snellenNum: 20, snellenDen: 63, eye: 'od' },
        ],
      },
      {
        id: 'PSN-2',
        pseudonym: 'PSN-2',
        excluded: false,
        sparse: false,
        baseline: 0.2,
        measurements: [
          { x: 0, y: 0.2, date: '2024-01-01', decimal: 0.6, logmar: 0.2, snellenNum: 20, snellenDen: 32, eye: 'od' },
          { x: 30, y: 0.4, date: '2024-02-01', decimal: 0.4, logmar: 0.4, snellenNum: 20, snellenDen: 50, eye: 'od' },
        ],
      },
    ] as PanelResult['patients'],
    scatterPoints: [],
    medianGrid: [{ x: 0, y: 0.25, p25: 0.2, p75: 0.3, n: 2 }],
    summary: { patientCount: 2, measurementCount: 4, excludedCount: 0 },
  };
}

const base = {
  eye: 'od' as const,
  color: '#3b82f6',
  axisMode: 'days' as const,
  yMetric: 'absolute' as const,
  layers: { median: false, perPatient: true, scatter: false, spreadBand: false },
  t: (k: string) => k,
  locale: 'en' as const,
  titleKey: 'outcomesPanelOd' as const,
  metric: 'visus' as const,
};

describe('OutcomesPanel — per-patient line click (J1b)', () => {
  afterEach(() => cleanup());

  it('clicking a patient line calls onPointClick with that patient pseudonym', () => {
    const onPointClick = vi.fn();
    const { container } = render(
      <OutcomesPanel {...base} panel={panelWithPerPatient()} onPointClick={onPointClick} />,
    );
    const line = container.querySelector('[data-testid="outcomes-perpatient-PSN-2"]');
    expect(line).not.toBeNull();
    expect(line!.getAttribute('data-has-onclick')).toBe('true');
    fireEvent.click(line!);
    expect(onPointClick).toHaveBeenCalledWith('PSN-2');
  });

  it('does NOT wire line onClick when onPointClick is absent (e.g. cross-mode)', () => {
    const { container } = render(<OutcomesPanel {...base} panel={panelWithPerPatient()} />);
    const line = container.querySelector('[data-testid="outcomes-perpatient-PSN-1"]');
    expect(line).not.toBeNull();
    expect(line!.getAttribute('data-has-onclick')).toBe('false');
  });

  it('does NOT render per-patient lines when the layer is hidden (gate)', () => {
    const onPointClick = vi.fn();
    const { container } = render(
      <OutcomesPanel
        {...base}
        layers={{ median: true, perPatient: false, scatter: false, spreadBand: false }}
        panel={panelWithPerPatient()}
        onPointClick={onPointClick}
      />,
    );
    expect(container.querySelector('[data-testid="outcomes-perpatient-PSN-1"]')).toBeNull();
    expect(container.querySelector('[data-testid="outcomes-perpatient-PSN-2"]')).toBeNull();
  });
});

describe('OutcomesPanel — per-patient line hover (K1c)', () => {
  afterEach(() => cleanup());

  it('wires line hover when scatter is OFF and per-patient is ON', () => {
    const { container } = render(<OutcomesPanel {...base} panel={panelWithPerPatient()} />);
    const line = container.querySelector('[data-testid="outcomes-perpatient-PSN-1"]');
    expect(line).not.toBeNull();
    expect(line!.getAttribute('data-has-hover')).toBe('true');
  });

  it('does NOT wire line hover when scatter is ON (scatter takes precedence)', () => {
    const { container } = render(
      <OutcomesPanel
        {...base}
        layers={{ median: false, perPatient: true, scatter: true, spreadBand: false }}
        panel={panelWithPerPatient()}
      />,
    );
    const line = container.querySelector('[data-testid="outcomes-perpatient-PSN-1"]');
    expect(line).not.toBeNull();
    expect(line!.getAttribute('data-has-hover')).toBe('false');
  });

  it('hovering a line shows that patient tooltip; leaving hides it', () => {
    const { container } = render(<OutcomesPanel {...base} panel={panelWithPerPatient()} />);
    const tooltip = container.querySelector('[data-testid="outcomes-hover-tooltip-od"]') as HTMLElement;
    expect(tooltip.style.display).toBe('none');

    const line = container.querySelector('[data-testid="outcomes-perpatient-PSN-2"]') as Element;
    fireEvent.mouseEnter(line, { clientX: 50, clientY: 60 });
    expect(tooltip.style.display).toBe('block');
    expect(tooltip.textContent).toContain('PSN-2');

    fireEvent.mouseLeave(line);
    expect(tooltip.style.display).toBe('none');
  });
});
