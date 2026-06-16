// @vitest-environment jsdom
/**
 * J1b (v1.15-p4) — clickable per-patient trajectory lines.
 *
 * Clicking a patient's <Line> drills to that patient's case via the SAME
 * onPointClick → handlePointDrillDown path as the scatter click (IDOR gate reused).
 * Gated: only wired in single-cohort mode (onPointClick provided) AND while the
 * per-patient layer is shown. Cursor affordance on the line.
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Recharts mock: Line exposes onClick + cursor as data-* and, for per-patient
// lines, tags itself by the patient's pseudonym (read from the first datum's
// `pseudonym`) so a test can click a specific patient's line.
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
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: () => null,
    Area: () => <g data-testid="recharts-area" />,
    Line: ({ onClick, cursor, data, onMouseEnter, onMouseLeave }: any) => {
      const pseudonym = Array.isArray(data) && data[0]?.pseudonym ? data[0].pseudonym : undefined;
      return (
        <g
          data-testid={pseudonym ? `perpatient-line-${pseudonym}` : 'recharts-line'}
          data-has-onclick={onClick ? 'true' : 'false'}
          data-has-mouseenter={onMouseEnter ? 'true' : 'false'}
          data-cursor={cursor ?? ''}
          onClick={() => onClick && onClick({})}
          // Recharts passes (lineProps, index, domEvent) — forward a synthetic event
          // carrying clientX/Y + a target so the K1c handler can position the tooltip.
          onMouseEnter={(e: any) =>
            onMouseEnter && onMouseEnter({}, 0, { clientX: 50, clientY: 60, target: e.target })}
          onMouseLeave={() => onMouseLeave && onMouseLeave({}, 0, {})}
        />
      );
    },
    Scatter: () => <g data-testid="recharts-scatter" />,
  };
});

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
    const line = container.querySelector('[data-testid="perpatient-line-PSN-2"]');
    expect(line).not.toBeNull();
    expect(line!.getAttribute('data-has-onclick')).toBe('true');
    expect(line!.getAttribute('data-cursor')).toBe('pointer');
    line!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onPointClick).toHaveBeenCalledWith('PSN-2');
  });

  it('does NOT wire line onClick when onPointClick is absent (e.g. cross-mode)', () => {
    const { container } = render(<OutcomesPanel {...base} panel={panelWithPerPatient()} />);
    const line = container.querySelector('[data-testid="perpatient-line-PSN-1"]');
    expect(line).not.toBeNull();
    expect(line!.getAttribute('data-has-onclick')).toBe('false');
    expect(line!.getAttribute('data-cursor')).toBe('');
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
    expect(container.querySelector('[data-testid="perpatient-line-PSN-1"]')).toBeNull();
    expect(container.querySelector('[data-testid="perpatient-line-PSN-2"]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// K1c (v1.16-A): per-patient line hover — highlight + tooltip when scatter is OFF
// ---------------------------------------------------------------------------
describe('OutcomesPanel — per-patient line hover (K1c)', () => {
  afterEach(() => cleanup());

  it('wires line hover handlers when scatter is OFF and per-patient is ON', () => {
    const { container } = render(<OutcomesPanel {...base} panel={panelWithPerPatient()} />);
    const line = container.querySelector('[data-testid="perpatient-line-PSN-1"]');
    expect(line).not.toBeNull();
    expect(line!.getAttribute('data-has-mouseenter')).toBe('true');
  });

  it('does NOT wire line hover when scatter is ON (scatter takes precedence)', () => {
    const { container } = render(
      <OutcomesPanel
        {...base}
        layers={{ median: false, perPatient: true, scatter: true, spreadBand: false }}
        panel={panelWithPerPatient()}
      />,
    );
    const line = container.querySelector('[data-testid="perpatient-line-PSN-1"]');
    expect(line).not.toBeNull();
    expect(line!.getAttribute('data-has-mouseenter')).toBe('false');
  });

  it('hovering a line shows that patient tooltip; leaving hides it', () => {
    const { container } = render(<OutcomesPanel {...base} panel={panelWithPerPatient()} />);
    const tooltip = container.querySelector(
      '[data-testid="outcomes-hover-tooltip-od"]',
    ) as HTMLElement;
    expect(tooltip.style.display).toBe('none');

    const line = container.querySelector('[data-testid="perpatient-line-PSN-2"]') as Element;
    fireEvent.mouseEnter(line);
    expect(tooltip.style.display).toBe('block');
    expect(tooltip.textContent).toContain('PSN-2');

    fireEvent.mouseLeave(line);
    expect(tooltip.style.display).toBe('none');
  });
});
