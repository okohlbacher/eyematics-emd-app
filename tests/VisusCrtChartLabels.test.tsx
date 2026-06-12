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

    // Expose Line name as data-name attr for assertion.
    Line: ({ name }: any) => (
      <g
        data-testid="recharts-line"
        data-name={name ?? ''}
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
};

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

  it('uses the SHORT Visus Y-axis label (A4: full text moved to caption)', () => {
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

  it('renders the full Visus description in the caption line', () => {
    render(<VisusCrtChart {...minimalProps} />);
    const el = screen.queryByText(/Visus \(Dezimal, bestkorrigiert\)/);
    expect(el).not.toBeNull();
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
