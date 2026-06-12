// @vitest-environment jsdom
/**
 * A4 v2 — DistributionCharts "Visus vs CRT" scatter axis labels.
 *
 * The scatter previously had hardcoded axis labels; they must now come from
 * i18n keys (scatterVisusAxisLabel / scatterCrtAxisLabel). Pattern: recharts
 * mock exposing axis label values + no jest-dom RTL assertions.
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
    ScatterChart: ({ children }: { children: any }) => (
      <g data-testid="recharts-scatter-chart">{children}</g>
    ),
    BarChart: ({ children }: { children: any }) => <g>{children}</g>,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ReferenceLine: () => null,
    Cell: () => null,
    Bar: () => null,
    Scatter: () => null,
    XAxis: ({ label, dataKey }: any) => (
      <g data-testid="recharts-xaxis" data-label={label?.value ?? ''} data-data-key={dataKey ?? ''} />
    ),
    YAxis: ({ label, dataKey }: any) => (
      <g data-testid="recharts-yaxis" data-label={label?.value ?? ''} data-data-key={dataKey ?? ''} />
    ),
  };
});

import { cleanup, render } from '@testing-library/react';

import DistributionCharts from '../src/components/case-detail/DistributionCharts';
import type { TranslationKey } from '../src/i18n/translations';

afterEach(() => cleanup());

const deStrings: Partial<Record<TranslationKey, string>> = {
  scatterVisusAxisLabel: 'Visus (dezimal)',
  scatterCrtAxisLabel: 'CRT (µm)',
};
const tDE = (key: TranslationKey): string => deStrings[key] ?? key;

const props = {
  visusDistribution: [],
  crtDistribution: [],
  visusCrtScatter: [
    { visus: 0.5, crt: 300, date: '2024-01-01' },
    { visus: 0.6, crt: 280, date: '2024-02-01' },
  ],
  t: tDE,
};

describe('DistributionCharts — A4 scatter axis labels', () => {
  it('labels the scatter X axis from t("scatterVisusAxisLabel")', () => {
    const { container } = render(<DistributionCharts {...props} />);
    const xAxis = Array.from(container.querySelectorAll('[data-testid="recharts-xaxis"]')).find(
      (el) => el.getAttribute('data-data-key') === 'visus',
    );
    expect(xAxis).not.toBeNull();
    expect(xAxis!.getAttribute('data-label')).toBe('Visus (dezimal)');
  });

  it('labels the scatter Y axis from t("scatterCrtAxisLabel")', () => {
    const { container } = render(<DistributionCharts {...props} />);
    const yAxis = Array.from(container.querySelectorAll('[data-testid="recharts-yaxis"]')).find(
      (el) => el.getAttribute('data-data-key') === 'crt',
    );
    expect(yAxis).not.toBeNull();
    expect(yAxis!.getAttribute('data-label')).toBe('CRT (µm)');
  });
});
