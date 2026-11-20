// @vitest-environment jsdom
/**
 * Z0-P23 (Q31) — the case-view Visus/CRT chart shows Visus in logMAR (axis values, tooltip, "Visus Ø", legend) and
 * the axis titles of Verläufe. Counterpart of VisusCrtChartLabels.test.tsx "renders the full Visus description as the
 * measured-Visus legend name (I4)" (UIR-CASE-022/-023 superseded).
 */
import { cleanup, render } from '@testing-library/react';
import { cloneElement, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('recharts', async (importOriginal) => {
  const real = await importOriginal<typeof import('recharts')>();
  return {
    ...real,
    ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number; height?: number }> }) =>
      cloneElement(children, { width: 600, height: 300 }),
  };
});

import VisusCrtChart from '../src/components/case-detail/VisusCrtChart';
import type { TranslationKey } from '../src/i18n/translations';

afterEach(() => cleanup());

const DE: Partial<Record<TranslationKey, string>> = {
  outcomesYAxisVisusAbsolute: 'Visus (logMAR)',
  outcomesYAxisCrtAbsolute: 'Netzhautdicke (µm)',
  visusLogmarLegendLabel: 'Visus (logMAR, bestkorrigiert)',
  crtLegendLabel: 'CRT (µm)',
  cohortReferenceMedianVisus: 'Kohorten-Median Visus',
  cohortReferenceMedianCrt: 'Kohorten-Median CRT',
};
const t = (k: TranslationKey) => DE[k] ?? k;

const props = {
  combinedData: [
    { date: '2024-01-01', dateMs: Date.parse('2024-01-01'), relMonths: 0, visus: 0.5, crt: 300, visusMedian: 0.5, crtMedian: 300, visusBand: [0.4, 0.8] as [number, number], crtBand: [280, 320] as [number, number] },
    { date: '2024-02-01', dateMs: Date.parse('2024-02-01'), relMonths: 1, visus: 1, crt: 290, visusMedian: 0.5, crtMedian: 295, visusBand: [0.4, 0.8] as [number, number], crtBand: [275, 315] as [number, number] },
  ],
  cohortAvgVisus: 0.5,
  cohortAvgVisusLogmar: 0.4,
  cohortAvgCrt: 290,
  highlightDate: null,
  dateFmt: 'de-DE',
  locale: 'de',
  t,
  visusObs: [],
};

describe('VisusCrtChart — logMAR (Z0-P23, Q31)', () => {
  it('titles the axes "Visus (logMAR)" and "Netzhautdicke (µm)"', () => {
    const { container } = render(<VisusCrtChart {...props} />);
    const labels = Array.from(container.querySelectorAll('.recharts-label')).map((el) => el.textContent);
    expect(labels).toContain('Visus (logMAR)');
    expect(labels).toContain('Netzhautdicke (µm)');
    expect(labels).not.toContain('Visus');
    // Same quantity colours as Verläufe/Aggregiert (Q18).
    expect(container.querySelector('.series-visus .recharts-line-curve')?.getAttribute('stroke')).toBe('#10b981');
    expect(container.querySelector('.series-crt .recharts-line-curve')?.getAttribute('stroke')).toBe('#8b5cf6');
  });

  it('names the measured Visus series in logMAR in the legend', () => {
    const { container } = render(<VisusCrtChart {...props} showCohortReference />);
    const legend = container.textContent ?? '';
    expect(legend).toContain('Visus (logMAR, bestkorrigiert)');
    expect(legend).not.toContain('Dezimal');
    expect(legend).toContain('Kohorten-Median CRT');
  });

  it('shows "Visus Ø" as the mean logMAR value', () => {
    const { container } = render(<VisusCrtChart {...props} />);
    expect(container.textContent).toContain('Visus Ø 0.40');
  });

  it('plots logMAR values: decimal 1.0 → 0.0 lies below decimal 0.5 → 0.30 on a rising axis', () => {
    const { container } = render(<VisusCrtChart {...props} />);
    const dots = Array.from(container.querySelectorAll('circle[r="4"][fill="#10b981"]')) as SVGCircleElement[];
    expect(dots.length).toBe(2);
    const y0 = Number(dots[0].getAttribute('cy'));
    const y1 = Number(dots[1].getAttribute('cy'));
    // logMAR 0.30 (decimal 0.5) is drawn higher on the screen (smaller cy) than logMAR 0.0 (decimal 1.0).
    expect(y0).toBeLessThan(y1);
  });
});
