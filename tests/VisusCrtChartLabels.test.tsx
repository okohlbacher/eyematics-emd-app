// @vitest-environment jsdom
/**
 * FALL-012 / CHART-01 — VisusCrtChart label tests.
 *
 * Tests:
 * 1. CRT legend label reads "CRT (µm)" from t('crtLegendLabel').
 * 2. Visus Y-axis label reads "Visus (Dezimal, bestkorrigiert)" from t('visusYAxisLabel').
 * 3. Interpolation note reads "Offener Kreis = interpolierter Wert (keine Messung)" from t('interpolatedHint').
 *
 * Pattern: recharts mock (expose label/name as data-* attrs) + no jest-dom RTL assertions.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('recharts', async (importOriginal) => {
  const real = await importOriginal<typeof import('recharts')>();
  return {
    ...real,

    ResponsiveContainer: ({ children }: { children: any }) => (
      <div data-testid="recharts-responsive-container">
        <svg>{children}</svg>
      </div>
    ),

    // VisusCrtChart renders a ComposedChart (Recharts 3.x won't draw <Area>
    // inside <LineChart>); keep LineChart stubbed too for other consumers.
    ComposedChart: ({ children }: { children: any }) => (
      <div data-testid="recharts-composed-chart">{children}</div>
    ),
    LineChart: ({ children }: { children: any }) => (
      <g data-testid="recharts-line-chart">{children}</g>
    ),

    CartesianGrid: () => null,

    XAxis: () => null,

    // Expose YAxis label value as data-label attr for assertion.
    YAxis: ({ label }: any) => (
      <g
        data-testid="recharts-yaxis"
        data-label={label?.value ?? ''}
      />
    ),

    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: () => null,

    // Expose Line name + legendType as data-* attrs for assertion.
    Line: ({ name, legendType }: any) => (
      <g
        data-testid="recharts-line"
        data-name={name ?? ''}
        data-legendtype={legendType ?? ''}
      />
    ),

    // Expose Area name + legendType for the cohort IQR band assertions (I3b).
    Area: ({ name, legendType }: any) => (
      <g
        data-testid="recharts-area"
        data-name={name ?? ''}
        data-legendtype={legendType ?? ''}
      />
    ),
  };
});

import { cleanup, render, screen } from '@testing-library/react';

import VisusCrtChart from '../src/components/case-detail/VisusCrtChart';
import type { TranslationKey } from '../src/i18n/translations';

afterEach(() => cleanup());

// Minimal DE locale translation stub returning the locked FALL-012 wording.
const deStrings: Partial<Record<TranslationKey, string>> = {
  crtLegendLabel: 'CRT (µm)',
  visusYAxisLabel: 'Visus (Dezimal, bestkorrigiert)',
  visusShortLabel: 'Visus',
  interpolatedHint: 'Offener Kreis = interpolierter Wert (keine Messung)',
  visusAndCrt: 'Visusverlauf und Netzhautdicke (CRT)',
  critical: 'Kritisch',
  cohortReferenceMedianVisus: 'Kohorten-Median Visus',
  cohortReferenceMedianCrt: 'Kohorten-Median CRT',
  cohortReferenceBand: 'Kohorten-IQR (25.–75. Perzentil)',
};

// Data with cohort-reference fields so the overlay renders (I3a/I3b).
const refData = [
  { date: '2024-01-01', visus: 0.5, crt: 300, visusMedian: 0.5, crtMedian: 300, visusBand: [0.4, 0.6], crtBand: [280, 320] },
  { date: '2024-02-01', visus: 0.6, crt: 290, visusMedian: 0.55, crtMedian: 295, visusBand: [0.45, 0.65], crtBand: [275, 315] },
];

const dataName = (els: Element[], name: string) =>
  els.find((el) => el.getAttribute('data-name') === name);

const tDE = (key: TranslationKey): string => deStrings[key] ?? key;

const minimalProps = {
  combinedData: [
    { date: '2024-01-01', visus: 0.5, crt: 300, visusMeasured: true, crtMeasured: true },
    { date: '2024-02-01', visus: 0.6, crt: undefined, visusMeasured: false, crtMeasured: false },
  ],
  cohortAvgVisus: 0.55,
  cohortAvgCrt: 290,
  highlightDate: null,
  dateFmt: 'de-DE',
  locale: 'de',
  t: tDE,
  visusObs: [],
};

describe('VisusCrtChart — FALL-012 / A4 i18n labels', () => {
  it('renders CRT legend label from t("crtLegendLabel")', () => {
    const { container } = render(<VisusCrtChart {...minimalProps} />);
    // The CRT Line exposes its `name` prop as data-name.
    const crtLine = Array.from(
      container.querySelectorAll('[data-testid="recharts-line"]'),
    ).find((el) => el.getAttribute('data-name') === 'CRT (µm)');
    expect(crtLine).not.toBeNull();
  });

  it('uses the SHORT Visus Y-axis label (A4/I4: full text lives in the legend)', () => {
    const { container } = render(<VisusCrtChart {...minimalProps} />);
    const yaxes = container.querySelectorAll('[data-testid="recharts-yaxis"]');
    const visusAxis = Array.from(yaxes).find(
      (el) => el.getAttribute('data-label') === 'Visus',
    );
    expect(visusAxis).not.toBeNull();
    // The long wording must NOT be the axis label anymore.
    const longAxis = Array.from(yaxes).find(
      (el) => el.getAttribute('data-label') === 'Visus (Dezimal, bestkorrigiert)',
    );
    expect(longAxis).toBeUndefined();
  });

  it('renders the full Visus description as the measured-Visus legend name (I4)', () => {
    const { container } = render(<VisusCrtChart {...minimalProps} />);
    // I4: the full "Visus (Dezimal, bestkorrigiert)" label moved from the
    // under-title caption into the chart legend (measured-Visus Line `name`).
    const visusLine = Array.from(
      container.querySelectorAll('[data-testid="recharts-line"]'),
    ).find((el) => el.getAttribute('data-name') === 'Visus (Dezimal, bestkorrigiert)');
    expect(visusLine).not.toBeUndefined();
    // The redundant caption text must no longer render outside the legend.
    expect(screen.queryByText(/Visus \(Dezimal, bestkorrigiert\)/)).toBeNull();
  });

  it('shows BOTH cohort median lines in the legend with distinct names (I3a)', () => {
    const { container } = render(
      <VisusCrtChart {...minimalProps} combinedData={refData} showCohortReference />,
    );
    const lines = Array.from(container.querySelectorAll('[data-testid="recharts-line"]'));
    const visusMedian = dataName(lines, 'Kohorten-Median Visus');
    const crtMedian = dataName(lines, 'Kohorten-Median CRT');
    expect(visusMedian).not.toBeUndefined();
    expect(crtMedian).not.toBeUndefined();
    // Both medians are legend-visible (no legendType="none").
    expect(visusMedian?.getAttribute('data-legendtype')).not.toBe('none');
    expect(crtMedian?.getAttribute('data-legendtype')).not.toBe('none');
  });

  it('labels the cohort reference band as IQR in the legend (I3b)', () => {
    const { container } = render(
      <VisusCrtChart {...minimalProps} combinedData={refData} showCohortReference />,
    );
    const areas = Array.from(container.querySelectorAll('[data-testid="recharts-area"]'));
    const iqrBand = dataName(areas, 'Kohorten-IQR (25.–75. Perzentil)');
    expect(iqrBand).not.toBeUndefined();
    expect(iqrBand?.getAttribute('data-legendtype')).not.toBe('none');
  });

  it('does NOT show cohort median/band legend entries when overlay is off (I3a)', () => {
    const { container } = render(
      <VisusCrtChart {...minimalProps} combinedData={refData} showCohortReference={false} />,
    );
    const lines = Array.from(container.querySelectorAll('[data-testid="recharts-line"]'));
    const areas = Array.from(container.querySelectorAll('[data-testid="recharts-area"]'));
    expect(dataName(lines, 'Kohorten-Median Visus')).toBeUndefined();
    expect(dataName(lines, 'Kohorten-Median CRT')).toBeUndefined();
    expect(dataName(areas, 'Kohorten-IQR (25.–75. Perzentil)')).toBeUndefined();
  });

  it('shows the interpolation hint only when interpolated points exist', () => {
    const { rerender } = render(
      <VisusCrtChart {...minimalProps} hasInterpolatedPoints={false} />,
    );
    expect(
      screen.queryByText(/Offener Kreis = interpolierter Wert/),
    ).toBeNull();

    rerender(<VisusCrtChart {...minimalProps} hasInterpolatedPoints={true} />);
    expect(
      screen.queryByText(/Offener Kreis = interpolierter Wert/),
    ).not.toBeNull();
  });
});
