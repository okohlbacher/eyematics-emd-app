// @vitest-environment jsdom
/**
 * VQA-04 / D-05 / D-06: OutcomesTooltip field order + per-patient suppression.
 */
import { cleanup,render } from '@testing-library/react';
import { afterEach,describe, expect, it } from 'vitest';

import OutcomesTooltip from '../src/components/outcomes/OutcomesTooltip';

afterEach(() => cleanup());

const t = (k: string) => {
  const map: Record<string, string> = {
    outcomesTooltipDay: 'Day',
    outcomesTooltipTreatmentIndex: 'Treatment',
    outcomesTooltipEye: 'Eye',
    outcomesTooltipLogmar: 'logMAR',
    outcomesTooltipMedian: 'Median (n={n})',
    outcomesTooltipSnellen: 'Snellen',
    outcomesTooltipIqr: 'IQR [{p25}, {p75}]',
    outcomesTooltipClipped: 'clipped',
    outcomesTooltipSparse: 'sparse',
  };
  return map[k] ?? k;
};

const allLayersOn = { median: true, perPatient: true, scatter: true, spreadBand: true };
const perPatientOff = { median: true, perPatient: false, scatter: true, spreadBand: true };

describe('OutcomesTooltip — D-05 field order + units', () => {
  it('absolute / days: pseudonym, eye OD, "42 d", "0.12", "logMAR"', () => {
    const { container } = render(
      <OutcomesTooltip
        active
        payload={[
          {
            dataKey: 'y',
            value: 0.12,
            payload: {
              pseudonym: 'P001',
              eye: 'od',
              x: 42,
              y: 0.12,
              logmar: 0.12,
              __series: 'perPatient',
            },
          } as any,
        ]}
        yMetric="absolute"
        axisMode="days"
        layers={allLayersOn}
        t={t}
        locale="en"
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('P001');
    expect(text.toUpperCase()).toContain('OD');
    expect(text).toMatch(/42\s*d/);
    expect(text).toContain('0.12');
    expect(text).toContain('logMAR');
  });

  it('delta_percent / treatments: shows "#3" and "%"', () => {
    const { container } = render(
      <OutcomesTooltip
        active
        payload={[
          {
            dataKey: 'y',
            value: -15.5,
            payload: {
              pseudonym: 'P002',
              eye: 'os',
              x: 3,
              y: -15.5,
              logmar: -15.5,
              __series: 'perPatient',
            },
          } as any,
        ]}
        yMetric="delta_percent"
        axisMode="treatments"
        layers={allLayersOn}
        t={t}
        locale="en"
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('#3');
    expect(text).toContain('%');
  });

  it('delta / days: y-unit is "Δ logMAR"', () => {
    const { container } = render(
      <OutcomesTooltip
        active
        payload={[
          {
            dataKey: 'y',
            value: -0.2,
            payload: {
              pseudonym: 'P003',
              eye: 'od',
              x: 60,
              y: -0.2,
              logmar: -0.2,
              __series: 'perPatient',
            },
          } as any,
        ]}
        yMetric="delta"
        axisMode="days"
        layers={allLayersOn}
        t={t}
        locale="en"
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Δ logMAR');
  });
});

describe('OutcomesTooltip — D-06 per-patient suppression', () => {
  it('renders null when layers.perPatient=false and payload has only per-patient entries', () => {
    const { container } = render(
      <OutcomesTooltip
        active
        payload={[
          {
            dataKey: 'y',
            value: 0.12,
            payload: {
              pseudonym: 'P001',
              eye: 'od',
              x: 42,
              y: 0.12,
              logmar: 0.12,
              __series: 'perPatient',
            },
          } as any,
        ]}
        yMetric="absolute"
        axisMode="days"
        layers={perPatientOff}
        t={t}
        locale="en"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('still shows median tooltip when layers.perPatient=false and payload contains a median entry', () => {
    const { container } = render(
      <OutcomesTooltip
        active
        payload={[
          {
            dataKey: 'y',
            value: 0.2,
            payload: { x: 60, y: 0.2, p25: 0.1, p75: 0.3, n: 5 },
          } as any,
        ]}
        yMetric="absolute"
        axisMode="days"
        layers={perPatientOff}
        t={t}
        locale="en"
      />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Median');
  });
});
