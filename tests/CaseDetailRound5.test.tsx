// @vitest-environment jsdom
/**
 * v1.17 WS-3 — case-detail / cohort-overlay round-5 fixes.
 *
 * L5  — dynamic X-axis: relMonths when the cohort overlay is on, calendar date off.
 * L4c — unified tooltip never shows IQR band values.
 * L4d — IOD cohort overlay is a cohort-median LINE + IQR band (no Bar).
 * L6  — injections clickable in the top "Behandlungsverlauf" timeline strip.
 *
 * RTL without jest-dom — assertions use .not.toBeNull() / .toBeNull() /
 * .toBeUndefined() (no .toBeInTheDocument()).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('recharts', async (importOriginal) => {
  const real = await importOriginal<typeof import('recharts')>();
  return {
    ...real,
    ResponsiveContainer: ({ children }: { children: any }) => (
      <div data-testid="recharts-responsive-container"><svg>{children}</svg></div>
    ),
    ComposedChart: ({ children }: { children: any }) => (
      <div data-testid="recharts-composed-chart">{children}</div>
    ),
    LineChart: ({ children }: { children: any }) => <g>{children}</g>,
    BarChart: ({ children }: { children: any }) => <g>{children}</g>,
    CartesianGrid: () => null,
    XAxis: ({ dataKey, type }: any) => (
      <g data-testid="recharts-xaxis" data-data-key={dataKey ?? ''} data-type={type ?? ''} />
    ),
    YAxis: () => <g data-testid="recharts-yaxis" />,
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: ({ x }: any) => (
      <g data-testid="recharts-refline" data-x={x != null ? String(x) : ''} />
    ),
    Area: ({ dataKey, name }: any) => (
      <g data-testid="recharts-area" data-data-key={dataKey ?? ''} data-name={name ?? ''} />
    ),
    Line: ({ dataKey, name }: any) => (
      <g data-testid="recharts-line" data-data-key={dataKey ?? ''} data-name={name ?? ''} />
    ),
    Bar: ({ dataKey, name }: any) => (
      <g data-testid="recharts-bar" data-data-key={dataKey ?? ''} data-name={name ?? ''} />
    ),
  };
});

import { cleanup, fireEvent, render } from '@testing-library/react';

import ClinicalParametersRow from '../src/components/case-detail/ClinicalParametersRow';
import PatientHeader from '../src/components/case-detail/PatientHeader';
import VisusCrtChart from '../src/components/case-detail/VisusCrtChart';
import type { CombinedDataPoint, IopDataPoint } from '../src/hooks/useCaseData';
import type { TranslationKey } from '../src/i18n/translations';

afterEach(() => cleanup());

const t = (key: TranslationKey): string => key;

const refData: CombinedDataPoint[] = [
  { date: '2024-01-01', dateMs: Date.parse('2024-01-01'), relMonths: 0, visus: 0.5, crt: 300, visusMeasured: true, crtMeasured: true, visusMedian: 0.45, crtMedian: 310, visusBand: [0.3, 0.6], crtBand: [280, 340] },
  { date: '2024-04-01', dateMs: Date.parse('2024-04-01'), relMonths: 3, visus: 0.6, crt: 280, visusMeasured: true, crtMeasured: true, visusMedian: 0.48, crtMedian: 305, visusBand: [0.32, 0.62], crtBand: [275, 335] },
];

const baseChartProps = {
  cohortAvgVisus: 0.5,
  cohortAvgCrt: 300,
  highlightDate: null,
  dateFmt: 'de-DE',
  locale: 'de',
  t,
  visusObs: [],
};

describe('VisusCrtChart — L5 dynamic X axis tied to the cohort overlay', () => {
  it('keys the X axis on relMonths (numeric) when the overlay is ON', () => {
    const { container } = render(
      <VisusCrtChart {...baseChartProps} combinedData={refData} showCohortReference />,
    );
    const xAxis = container.querySelector('[data-testid="recharts-xaxis"]');
    expect(xAxis?.getAttribute('data-data-key')).toBe('relMonths');
    expect(xAxis?.getAttribute('data-type')).toBe('number');
  });

  it('M6: keys the X axis on the linear calendar-time axis (dateMs, numeric) when the overlay is OFF', () => {
    const { container } = render(
      <VisusCrtChart {...baseChartProps} combinedData={refData} showCohortReference={false} />,
    );
    const xAxis = container.querySelector('[data-testid="recharts-xaxis"]');
    // M6: the calendar axis is now a linear TIME axis keyed on epoch-ms.
    expect(xAxis?.getAttribute('data-data-key')).toBe('dateMs');
    expect(xAxis?.getAttribute('data-type')).toBe('number');
  });

  it('L5: IVI markers + highlight use relMonths values when the overlay is ON', () => {
    const injections = [
      { resourceType: 'Procedure', id: 'ivi-1', status: 'completed', code: { coding: [] }, performedDateTime: '2024-04-01T09:00:00Z' },
    ] as any;
    const { container } = render(
      <VisusCrtChart
        {...baseChartProps}
        combinedData={refData}
        showCohortReference
        injections={injections}
        highlightDate="2024-01-01"
      />,
    );
    const xs = Array.from(container.querySelectorAll('[data-testid="recharts-refline"]'))
      .map((el) => el.getAttribute('data-x'));
    // IVI on 2024-04-01 → relMonths 3; highlight on 2024-01-01 → relMonths 0.
    expect(xs).toContain('3');
    expect(xs).toContain('0');
    // No calendar-date string markers on the relative axis.
    expect(xs).not.toContain('2024-04-01');
  });

  it('L7/L8: renders no separate interpolated marker series (no open circles)', () => {
    const interpData: CombinedDataPoint[] = [
      { date: '2024-01-01', dateMs: Date.parse('2024-01-01'), relMonths: 0, visus: 0.4, visusMeasured: true },
      { date: '2024-02-01', dateMs: Date.parse('2024-02-01'), relMonths: 1, visusInterp: 0.6 },
      { date: '2024-03-01', dateMs: Date.parse('2024-03-01'), relMonths: 2, visus: 0.8, visusMeasured: true },
    ];
    const { container } = render(
      <VisusCrtChart {...baseChartProps} combinedData={interpData} />,
    );
    const lineKeys = Array.from(container.querySelectorAll('[data-testid="recharts-line"]'))
      .map((el) => el.getAttribute('data-data-key'));
    expect(lineKeys).not.toContain('visusInterp');
    expect(lineKeys).not.toContain('crtInterp');
  });
});

describe('ClinicalParametersRow — L4d IOD overlay is a LINE + band (not a bar)', () => {
  const iopData: IopDataPoint[] = [
    { date: '2024-01-01', dateMs: Date.parse('2024-01-01'), relMonths: 0, iop: 16, iopMedian: 13, iopBand: [12, 14] },
    { date: '2024-04-01', dateMs: Date.parse('2024-04-01'), relMonths: 3, iop: 18, iopMedian: 15, iopBand: [13, 17] },
  ];
  const baseProps = {
    iopObs: [],
    refractionObs: [],
    hba1cObs: [],
    eyeLaterality: 'OD',
    dateFmt: 'de-DE',
    locale: 'de',
    t,
  };

  it('renders the patient IOP as a Line (not a Bar)', () => {
    const { container } = render(
      <ClinicalParametersRow {...baseProps} iopData={iopData} showCohortReference />,
    );
    const lineKeys = Array.from(container.querySelectorAll('[data-testid="recharts-line"]'))
      .map((el) => el.getAttribute('data-data-key'));
    expect(lineKeys).toContain('iop');
    // No Bar at all — the bar plot was converted to a line plot.
    expect(container.querySelector('[data-testid="recharts-bar"]')).toBeNull();
  });

  it('renders the cohort median as a Line and the IQR as an Area band', () => {
    const { container } = render(
      <ClinicalParametersRow {...baseProps} iopData={iopData} showCohortReference />,
    );
    const lineKeys = Array.from(container.querySelectorAll('[data-testid="recharts-line"]'))
      .map((el) => el.getAttribute('data-data-key'));
    const areaKeys = Array.from(container.querySelectorAll('[data-testid="recharts-area"]'))
      .map((el) => el.getAttribute('data-data-key'));
    expect(lineKeys).toContain('iopMedian');
    expect(areaKeys).toContain('iopBand');
  });

  // M7 (v1.18): the IOD chart switches calendar ↔ relative with the overlay,
  // exactly like Visus/CRT (L5). Overlay ON → numeric relMonths axis.
  it('M7: keys the IOD X axis on relMonths (numeric) when the overlay is ON', () => {
    const { container } = render(
      <ClinicalParametersRow {...baseProps} iopData={iopData} showCohortReference />,
    );
    const xAxis = container.querySelector('[data-testid="recharts-xaxis"]');
    expect(xAxis?.getAttribute('data-data-key')).toBe('relMonths');
    expect(xAxis?.getAttribute('data-type')).toBe('number');
  });

  // M6 + M7: overlay OFF → linear calendar-TIME axis keyed on epoch-ms.
  it('M6/M7: keys the IOD X axis on the linear calendar-time axis (dateMs, numeric) when the overlay is OFF', () => {
    const { container } = render(
      <ClinicalParametersRow {...baseProps} iopData={iopData} showCohortReference={false} />,
    );
    const xAxis = container.querySelector('[data-testid="recharts-xaxis"]');
    expect(xAxis?.getAttribute('data-data-key')).toBe('dateMs');
    expect(xAxis?.getAttribute('data-type')).toBe('number');
  });
});

describe('PatientHeader — L6 injections clickable in the top timeline strip', () => {
  const baseProps = {
    pseudonym: 'P-1',
    birthDate: '1960-01-01',
    gender: 'male',
    centerName: 'Center A',
    eyeLaterality: 'OD',
    totalEncounters: 3,
    primaryDiagnoses: [],
    adverseEvents: [],
    hasCriticalValues: false,
    criticalCrtCount: 0,
    criticalVisusCount: 0,
    criticalIopCount: 0,
    dateFmt: 'de-DE',
    locale: 'de',
    t,
    highlightDate: null,
    onHighlightDate: () => {},
    onOctTimelineClick: () => {},
  };

  it('fires onInjectionClick when an injection-only timeline node is clicked', () => {
    const onInjectionClick = vi.fn();
    const timeline = [
      { date: '2024-02-15', events: [{ type: 'injection' as const, label: 'IVI' }] },
    ];
    const { getByTitle } = render(
      <PatientHeader
        {...baseProps}
        encounterTimeline={timeline}
        onInjectionClick={onInjectionClick}
      />,
    );
    fireEvent.click(getByTitle('IVI'));
    expect(onInjectionClick).toHaveBeenCalledWith('2024-02-15');
  });

  it('injection icon click does not also trigger the visit highlight on a mixed node', () => {
    const onInjectionClick = vi.fn();
    const onHighlightDate = vi.fn();
    const timeline = [
      {
        date: '2024-03-01',
        events: [
          { type: 'visus' as const, label: 'Visus: 0.5' },
          { type: 'injection' as const, label: 'IVI' },
        ],
      },
    ];
    const { getByTitle } = render(
      <PatientHeader
        {...baseProps}
        encounterTimeline={timeline}
        onHighlightDate={onHighlightDate}
        onInjectionClick={onInjectionClick}
      />,
    );
    fireEvent.click(getByTitle('IVI'));
    expect(onInjectionClick).toHaveBeenCalledWith('2024-03-01');
    // stopPropagation: the node-level visit highlight must NOT fire.
    expect(onHighlightDate).not.toHaveBeenCalled();
  });
});

describe('PatientHeader — M4 cohort-reference toggle in the header', () => {
  const baseProps = {
    pseudonym: 'P-1',
    birthDate: '1960-01-01',
    gender: 'male',
    centerName: 'Center A',
    eyeLaterality: 'OD',
    totalEncounters: 3,
    primaryDiagnoses: [],
    adverseEvents: [],
    hasCriticalValues: false,
    criticalCrtCount: 0,
    criticalVisusCount: 0,
    criticalIopCount: 0,
    encounterTimeline: [],
    dateFmt: 'de-DE',
    locale: 'de',
    t,
    highlightDate: null,
    onHighlightDate: () => {},
    onOctTimelineClick: () => {},
  };

  it('M4: renders the cohort-reference toggle when onToggleCohortReference is provided', () => {
    const { getByLabelText } = render(
      <PatientHeader
        {...baseProps}
        showCohortReference={false}
        onToggleCohortReference={() => {}}
      />,
    );
    // The toggle (aria-labelled via t('cohortReferenceToggle')) lives in the header.
    const checkbox = getByLabelText('cohortReferenceToggle') as HTMLInputElement;
    expect(checkbox).not.toBeNull();
    expect(checkbox.checked).toBe(false);
  });

  it('M4: fires onToggleCohortReference with the new value when toggled', () => {
    const onToggle = vi.fn();
    const { getByLabelText } = render(
      <PatientHeader
        {...baseProps}
        showCohortReference={false}
        onToggleCohortReference={onToggle}
      />,
    );
    fireEvent.click(getByLabelText('cohortReferenceToggle'));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('M4: omits the toggle entirely when no handler is provided', () => {
    const { queryByLabelText } = render(<PatientHeader {...baseProps} />);
    expect(queryByLabelText('cohortReferenceToggle')).toBeNull();
  });
});
