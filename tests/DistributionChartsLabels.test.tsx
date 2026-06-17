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
    Legend: () => null,
    ReferenceLine: () => null,
    Cell: () => null,
    Bar: ({ dataKey, name }: any) => (
      <g data-testid="recharts-bar" data-data-key={dataKey ?? ''} data-name={name ?? ''} />
    ),
    Scatter: ({ name, data }: any) => (
      <g data-testid="recharts-scatter" data-name={name ?? ''} data-len={String(data?.length ?? 0)} />
    ),
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
  cohortReferenceDistribution: 'Kohorten-Verteilung',
  cohortReferenceScatter: 'Kohorte',
  measurements: 'Messungen',
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

// ---------------------------------------------------------------------------
// J3d: cohort overlay on the distributions + scatter, gated on the toggle.
// ---------------------------------------------------------------------------

// N5 (v1.19 WS-B): overlay-on histograms are grouped %-bars — patientPct +
// cohortMedianPct — on a single percentage axis (was count + pooled cohortPct).
const cohortProps = {
  visusDistribution: [
    { range: '0–0.2', count: 0, patientPct: 0, cohortMedianPct: 30, cohortMedianCount: 1 },
    { range: '0.2–0.4', count: 1, patientPct: 100, cohortMedianPct: 70, cohortMedianCount: 2 },
  ],
  crtDistribution: [
    { range: '<200', count: 0, patientPct: 0, cohortMedianPct: 20, cohortMedianCount: 1 },
    { range: '200–250', count: 2, patientPct: 100, cohortMedianPct: 80, cohortMedianCount: 3 },
  ],
  visusCrtScatter: [
    { visus: 0.5, crt: 300, date: '2024-01-01' },
    { visus: 0.6, crt: 280, date: '2024-02-01' },
  ],
  cohortVisusCrtScatter: [
    { visus: 0.4, crt: 320 },
    { visus: 0.45, crt: 310 },
  ],
  t: tDE,
};

describe('DistributionCharts — N5 grouped %-bars + cohort overlay', () => {
  it('renders grouped patientPct + cohortMedianPct bars + the cloud when the overlay is on', () => {
    const { container } = render(<DistributionCharts {...cohortProps} showCohortReference />);
    const bars = Array.from(container.querySelectorAll('[data-testid="recharts-bar"]'));
    const patientBars = bars.filter((el) => el.getAttribute('data-data-key') === 'patientPct');
    const cohortBars = bars.filter((el) => el.getAttribute('data-data-key') === 'cohortMedianPct');
    // One patient %-bar AND one cohort-median %-bar per histogram (visus + crt).
    expect(patientBars.length).toBe(2);
    expect(cohortBars.length).toBe(2);
    // N5: the count bar is gone on the overlay axis — both series are percentages.
    expect(bars.filter((el) => el.getAttribute('data-data-key') === 'count').length).toBe(0);
    const cohortCloud = Array.from(container.querySelectorAll('[data-testid="recharts-scatter"]')).find(
      (el) => el.getAttribute('data-name') === 'Kohorte',
    );
    expect(cohortCloud).not.toBeUndefined();
    expect(cohortCloud!.getAttribute('data-len')).toBe('2');
  });

  it('falls back to the single count bar (no %-bars / cloud) when the overlay is off', () => {
    const { container } = render(<DistributionCharts {...cohortProps} showCohortReference={false} />);
    const bars = Array.from(container.querySelectorAll('[data-testid="recharts-bar"]'));
    expect(bars.filter((el) => el.getAttribute('data-data-key') === 'cohortMedianPct').length).toBe(0);
    expect(bars.filter((el) => el.getAttribute('data-data-key') === 'patientPct').length).toBe(0);
    // Overlay off → the original count bars (one per histogram).
    expect(bars.filter((el) => el.getAttribute('data-data-key') === 'count').length).toBe(2);
    const cohortCloud = Array.from(container.querySelectorAll('[data-testid="recharts-scatter"]')).find(
      (el) => el.getAttribute('data-name') === 'Kohorte',
    );
    expect(cohortCloud).toBeUndefined();
  });
});
