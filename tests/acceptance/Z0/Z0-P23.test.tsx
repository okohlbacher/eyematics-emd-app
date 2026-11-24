// @vitest-environment jsdom
/**
 * Z0-P23 — review finding (severity 3, Q21 a): a Brush zoom must not outlive "Zoom zurücksetzen" or a change of the
 * x-axis, the y-mode or the compared series. Recharts keeps the Brush range in its chart state
 * (dataStartIndex/dataEndIndex); if it survives, the median line and the IQR band stay limited to the old index range.
 *
 * Observable: number of points of the median line (`.series-median .recharts-line-curve`, linear "M…L…" path) and of
 * the IQR band (distinct x positions) equals the number of median rows after reset / scope change. The Brush is moved with its
 * keyboard handler (focused traveller + ArrowRight), as a user can.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { cloneElement, type ReactElement } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('recharts', async (importOriginal) => {
  const real = await importOriginal<typeof import('recharts')>();
  return {
    ...real,
    ResponsiveContainer: ({ children }: { children: ReactElement<{ width?: number; height?: number }> }) =>
      cloneElement(children, { width: 600, height: 320 }),
  };
});

// Q49 a / Q51 a: AnalysisPage wiring of "Kohorte wählen" (selectCohort). Only page-level context is mocked; the
// panel tests above take `t` as a prop and use none of these modules.
vi.mock('../../../src/context/DataContext', () => ({
  useData: () => mockData,
}));
vi.mock('../../../src/context/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'de', t: (k: string) => deText(k) }),
}));
vi.mock('../../../src/hooks/useRecentActivity', () => ({
  useRecentActivity: () => ({ record: () => {} }),
}));
vi.mock('../../../src/services/settingsService', () => ({
  getSettings: () => ({ therapyInterrupterDays: 90, therapyBreakerDays: 365, crtImplausibleThresholdUm: 400 }),
  loadSettings: () => {},
}));
vi.mock('../../../src/services/fhirLoader', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../src/services/fhirLoader')>()),
  applyFilters: <T,>(cases: T[]) => cases,
}));
vi.mock('../../../src/components/outcomes/OutcomesView', () => ({ default: () => null }));

import { MemoryRouter, useLocation } from 'react-router-dom';

import OutcomesPanel from '../../../src/components/outcomes/OutcomesPanel';
import { translations } from '../../../src/i18n/translations';
import AnalysisPage from '../../../src/pages/AnalysisPage';
import { ALL_PATIENTS_COHORT_ID } from '../../../src/services/allPatientsCohort';
import { FILTERED_COHORT_ID } from '../../../src/services/filteredCompareCohort';
import type { SavedSearch } from '../../../src/types/fhir';
import type { PanelResult } from '../../../src/utils/cohortTrajectory';

const deText = (k: string) => (translations as Record<string, { de: string }>)[k]?.de ?? k;
const mockData: { activeCases: never[]; savedSearches: SavedSearch[]; loading: boolean } = {
  activeCases: [],
  savedSearches: [{ id: 's-test', name: 'Testkohorte', createdAt: '2026-01-01', filters: { ageRange: [70, null] } }],
  loading: false,
};

const t = (k: string) => k;

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;
});
afterAll(() => {
  delete (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver;
});
afterEach(() => cleanup());

/** Synthetic panel with `nRows` median rows at x = 0, 30, 60, … */
function panel(nRows: number): PanelResult {
  const xs = Array.from({ length: nRows }, (_, i) => i * 30);
  const patients = Array.from({ length: 4 }, (_, i) => ({
    id: `p${i}`,
    pseudonym: `PSN-${i}`,
    excluded: false,
    sparse: false,
    measurements: xs.map((x) => ({ x, y: 0.3 + i * 0.01 })),
  }));
  return {
    patients,
    scatterPoints: [],
    medianGrid: xs.map((x, i) => ({ x, y: 0.3 + i * 0.01, p25: 0.2 + i * 0.01, p75: 0.4 + i * 0.01, n: 4 })),
    summary: { patientCount: 4, measurementCount: 4 * nRows, excludedCount: 0 },
  } as unknown as PanelResult;
}

const base = {
  eye: 'od' as const,
  axisMode: 'days' as const,
  yMetric: 'absolute' as const,
  layers: { median: true, perPatient: false, scatter: false, spreadBand: true },
  t,
  locale: 'de' as const,
  titleKey: 'outcomesPanelOd' as const,
};

/** Number of distinct x positions in a linear SVG path ("M x,y L x,y …"), i.e. the rows a curve or band covers. */
const pointsOf = (d: string | null | undefined) =>
  new Set([...(d ?? '').matchAll(/[ML]\s*(-?[\d.]+)/g)].map((m) => Number(m[1]).toFixed(3))).size;
const medianPoints = (c: HTMLElement) => pointsOf(c.querySelector('.series-median .recharts-line-curve')?.getAttribute('d'));
// The IQR band is one closed `.recharts-area-area` path (upper edge, then lower edge; same x positions).
const iqrPoints = (c: HTMLElement) => pointsOf(c.querySelector('.series-iqr .recharts-area-area')?.getAttribute('d'));

/** Move the Brush's start handle `steps` rows to the right with the keyboard. */
function brushStartRight(c: HTMLElement, steps: number) {
  const start = c.querySelectorAll<SVGGElement>('.recharts-brush-traveller')[0];
  expect(start).not.toBeUndefined();
  for (let i = 0; i < steps; i++) {
    act(() => {
      fireEvent.keyDown(start, { key: 'ArrowRight' });
    });
  }
}

describe('[Z0-P23] Brush zoom does not outlive reset or a scope change (Q21 a)', () => {
  it('Brush zoom narrows the median; "Zoom zurücksetzen" restores median and IQR band to all rows', () => {
    const { container, getByText } = render(<OutcomesPanel {...base} panel={panel(9)} />);
    expect(medianPoints(container)).toBe(9);
    expect(iqrPoints(container)).toBe(9);
    brushStartRight(container, 4);
    expect(medianPoints(container)).toBe(5);
    act(() => {
      fireEvent.click(getByText('outcomesZoomReset'));
    });
    expect(medianPoints(container)).toBe(9);
    expect(iqrPoints(container)).toBe(9);
  });

  it('a change of the x-axis after a Brush zoom shows median and IQR band over all rows', () => {
    // Same panel object: only the scope prop changes (the strictest case for stale chart state).
    const p = panel(9);
    const { container, rerender } = render(<OutcomesPanel {...base} panel={p} />);
    brushStartRight(container, 4);
    expect(medianPoints(container)).toBe(5);
    rerender(<OutcomesPanel {...base} axisMode="treatments" panel={p} />);
    expect(medianPoints(container)).toBe(9);
    expect(iqrPoints(container)).toBe(9);
  });

  it('a change of the y-mode after a Brush zoom shows median and IQR band over all rows', () => {
    // Same panel object: only the scope prop changes (the strictest case for stale chart state).
    const p = panel(9);
    const { container, rerender } = render(<OutcomesPanel {...base} panel={p} />);
    brushStartRight(container, 4);
    expect(medianPoints(container)).toBe(5);
    rerender(<OutcomesPanel {...base} yMetric="delta" panel={p} />);
    expect(medianPoints(container)).toBe(9);
    expect(iqrPoints(container)).toBe(9);
  });

  it('new series data (other cohort) after a Brush zoom shows median and IQR band over all rows', () => {
    const { container, rerender } = render(<OutcomesPanel {...base} panel={panel(9)} />);
    brushStartRight(container, 4);
    expect(medianPoints(container)).toBe(5);
    rerender(<OutcomesPanel {...base} panel={panel(7)} />);
    expect(medianPoints(container)).toBe(7);
    expect(iqrPoints(container)).toBe(7);
  });
});

describe('[Z0-P23] "Kohorte wählen" wiring of the filtered cohort during a comparison (Q49 a, Q51 a)', () => {
  let search = '';
  function LocationProbe() {
    search = useLocation().search;
    return null;
  }

  it('choosing the filtered cohort puts its reserved id first in ?cohorts= and drops ?cohort=', () => {
    const filters = encodeURIComponent(JSON.stringify({ ageRange: [70, null] }));
    const start = `/analysis?tab=aggregate&filters=${filters}&cohorts=${FILTERED_COHORT_ID},${ALL_PATIENTS_COHORT_ID}`;
    const { container } = render(
      <MemoryRouter initialEntries={[start]}>
        <AnalysisPage />
        <LocationProbe />
      </MemoryRouter>,
    );
    const select = container.querySelector<HTMLSelectElement>('#analysis-cohort-select');
    expect(select).not.toBeNull();
    const options = [...select!.options].map((o) => o.textContent ?? '');
    const filteredOption = [...select!.options].find((o) => (o.textContent ?? '').startsWith('Gefilterte Kohorte'));
    expect(filteredOption).not.toBeUndefined();

    act(() => {
      fireEvent.change(select!, { target: { value: 's-test' } });
    });
    let p = new URLSearchParams(search);
    expect(p.get('cohort')).toBe('s-test');
    expect(p.get('cohorts')?.split(',')).toEqual(['s-test', ALL_PATIENTS_COHORT_ID]);

    act(() => {
      fireEvent.change(select!, { target: { value: filteredOption!.value } });
    });
    p = new URLSearchParams(search);
    expect(p.get('cohort')).toBeNull();
    expect(p.get('cohorts')?.split(',')).toEqual([FILTERED_COHORT_ID, ALL_PATIENTS_COHORT_ID]);
    expect(p.get('filters')).not.toBeNull();
    expect(options.indexOf(filteredOption!.textContent ?? '')).toBe(1);
  });
});
