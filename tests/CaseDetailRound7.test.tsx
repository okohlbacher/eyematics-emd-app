// @vitest-environment jsdom
/**
 * v1.19 WS-B — per-patient case-detail view (UAT round 7).
 *
 * N3  — header layout: cohort-ref toggle is the RIGHTMOST control.
 * N4  — IOD relative axis fully replaces dates (keyed on relMonths, no
 *       duplicate / out-of-order rows) for patients with many IOP dates.
 * N5  — distribution histograms become grouped %-bars (patient % +
 *       cohort-median %) with an info tooltip when the overlay is on; the
 *       comparable-distribution helper computes per-bin medians + counts.
 * N10 — the active overlay cohort's label + N is surfaced near the toggle.
 * N11 — a selector lists the cohorts that CONTAIN this patient.
 *
 * RTL without jest-dom — assertions use .not.toBeNull() / .toBeNull() /
 * .toBeUndefined().
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('recharts', async (importOriginal) => {
  const real = await importOriginal<typeof import('recharts')>();
  return {
    ...real,
    ResponsiveContainer: ({ children }: { children: any }) => (
      <div data-testid="recharts-responsive-container"><svg>{children}</svg></div>
    ),
    ComposedChart: ({ children, data }: { children: any; data?: any[] }) => (
      <div data-testid="recharts-composed-chart" data-len={String(data?.length ?? 0)}>{children}</div>
    ),
    BarChart: ({ children }: { children: any }) => <g>{children}</g>,
    CartesianGrid: () => null,
    XAxis: ({ dataKey, type, ticks }: any) => (
      <g
        data-testid="recharts-xaxis"
        data-data-key={dataKey ?? ''}
        data-type={type ?? ''}
        data-ticks={Array.isArray(ticks) ? ticks.join(',') : ''}
      />
    ),
    YAxis: ({ unit }: any) => <g data-testid="recharts-yaxis" data-unit={unit ?? ''} />,
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: () => null,
    Cell: () => null,
    Area: ({ dataKey }: any) => <g data-testid="recharts-area" data-data-key={dataKey ?? ''} />,
    Line: ({ dataKey }: any) => <g data-testid="recharts-line" data-data-key={dataKey ?? ''} />,
    Bar: ({ dataKey }: any) => <g data-testid="recharts-bar" data-data-key={dataKey ?? ''} />,
  };
});

import { cleanup, render } from '@testing-library/react';

import ClinicalParametersRow from '../src/components/case-detail/ClinicalParametersRow';
import PatientHeader from '../src/components/case-detail/PatientHeader';
import type { IopDataPoint } from '../src/hooks/useCaseData';
import type { TranslationKey } from '../src/i18n/translations';
import type { Observation } from '../src/types/fhir';
import { computeComparableDistribution, computeVisusDistribution } from '../src/utils/distributionBins';

afterEach(() => cleanup());

const t = (key: TranslationKey): string => key;

// ---------------------------------------------------------------------------
// N4 — IOD relative axis fully replaces calendar dates.
// ---------------------------------------------------------------------------

describe('ClinicalParametersRow — N4 relative IOD axis fully replaces dates', () => {
  const baseProps = {
    iopObs: [],
    refractionObs: [],
    hba1cObs: [],
    eyeLaterality: 'OD',
    dateFmt: 'de-DE',
    locale: 'de',
    t,
  };

  // A patient (EM-UKT-0027-style) with many IOP dates, including two visits
  // that collide on the SAME relMonths bucket and arrive OUT of relMonths order.
  const iopData: IopDataPoint[] = [
    { date: '2024-01-01', dateMs: Date.parse('2024-01-01'), relMonths: 0, iop: 16, iopMedian: 13, iopBand: [12, 14] },
    { date: '2024-03-01', dateMs: Date.parse('2024-03-01'), relMonths: 2, iop: 18, iopMedian: 15, iopBand: [13, 17] },
    // duplicate relMonths bucket (collides with the 2024-03-01 row):
    { date: '2024-03-05', dateMs: Date.parse('2024-03-05'), relMonths: 2, iop: 19, iopMedian: 15, iopBand: [13, 17] },
    // out-of-order row (earlier relMonths than its predecessor):
    { date: '2024-02-01', dateMs: Date.parse('2024-02-01'), relMonths: 1, iop: 17, iopMedian: 14, iopBand: [12, 16] },
  ];

  it('keys the X axis purely on relMonths (numeric) — no date-keyed axis remains', () => {
    const { container } = render(
      <ClinicalParametersRow {...baseProps} iopData={iopData} showCohortReference />,
    );
    const xAxis = container.querySelector('[data-testid="recharts-xaxis"]');
    expect(xAxis?.getAttribute('data-data-key')).toBe('relMonths');
    expect(xAxis?.getAttribute('data-type')).toBe('number');
    // The explicit ticks are numeric relMonths only — never calendar dates.
    const ticks = xAxis?.getAttribute('data-ticks') ?? '';
    expect(ticks.includes('2024')).toBe(false);
  });

  it('collapses duplicate relMonths buckets and sorts ascending (no leftover rows)', () => {
    const { container } = render(
      <ClinicalParametersRow {...baseProps} iopData={iopData} showCohortReference />,
    );
    const chart = container.querySelector('[data-testid="recharts-composed-chart"]');
    // 4 input rows → relMonths {0,2,2,1} → 3 unique buckets after collapse.
    expect(chart?.getAttribute('data-len')).toBe('3');
    const ticks = (container.querySelector('[data-testid="recharts-xaxis"]')?.getAttribute('data-ticks') ?? '')
      .split(',')
      .map(Number);
    // Ascending + de-duplicated.
    expect(ticks).toEqual([0, 1, 2]);
  });

  it('leaves the calendar axis (overlay OFF) keyed on dateMs with date-ordered rows', () => {
    const { container } = render(
      <ClinicalParametersRow {...baseProps} iopData={iopData} showCohortReference={false} />,
    );
    const xAxis = container.querySelector('[data-testid="recharts-xaxis"]');
    expect(xAxis?.getAttribute('data-data-key')).toBe('dateMs');
    // No collapse on the calendar axis — all 4 rows retained.
    expect(container.querySelector('[data-testid="recharts-composed-chart"]')?.getAttribute('data-len')).toBe('4');
  });
});

// ---------------------------------------------------------------------------
// N5 — comparable-distribution helper (per-bin patient % + cohort median % / count).
// ---------------------------------------------------------------------------

function visusObs(values: number[]): Observation[] {
  return values.map((v, i) => ({
    resourceType: 'Observation',
    id: `o-${i}`,
    status: 'final',
    code: { coding: [{ system: 'http://loinc.org', code: '79893-4' }] },
    valueQuantity: { value: v },
  })) as unknown as Observation[];
}

describe('computeComparableDistribution — N5 per-bin patient % + cohort median', () => {
  it('computes patient %, cohort median %, and cohort median count per bin', () => {
    // Patient: 2 measurements, both in the 0.8–1.0 bin → 100% in that bin.
    const patient = visusObs([0.9, 0.95]);
    // Cohort patient A: 0.1, 0.3 → 50% in bin0 (0–0.2), 50% in bin1 (0.2–0.4).
    // Cohort patient B: 0.1, 0.1 → 100% in bin0.
    const cohort = [visusObs([0.1, 0.3]), visusObs([0.1, 0.1])];
    const bins = computeComparableDistribution(patient, cohort, computeVisusDistribution);

    const bin0 = bins[0]; // 0–0.2
    // patient: 0 of 2 → 0%
    expect(bin0.patientPct).toBe(0);
    // cohort per-patient bin0 %: A=50, B=100 → median 75
    expect(bin0.cohortMedianPct).toBe(75);
    // cohort per-patient bin0 count: A=1, B=2 → median 1.5
    expect(bin0.cohortMedianCount).toBe(1.5);

    const lastBin = bins[bins.length - 1]; // 0.8–1.0
    expect(lastBin.patientPct).toBe(100);
    expect(lastBin.count).toBe(2);
    // No cohort patient has values here → median 0.
    expect(lastBin.cohortMedianPct).toBe(0);
  });

  it('excludes cohort patients with no measurements from the medians', () => {
    const patient = visusObs([0.9]);
    const cohort = [visusObs([]), visusObs([0.1, 0.3])]; // first patient empty
    const bins = computeComparableDistribution(patient, cohort, computeVisusDistribution);
    // Only the non-empty cohort patient contributes → bin0 % = 50 (single value).
    expect(bins[0].cohortMedianPct).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// N3 / N10 / N11 — header layout, overlay-cohort label + selector.
// ---------------------------------------------------------------------------

const headerBase = {
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

describe('PatientHeader — N3 toggle is the rightmost control', () => {
  it('orders the cluster [adverse events] → [critical warnings] → [cohort toggle]', () => {
    const adverseEvents = [{ id: 'ae-1', code: { coding: [{ code: 'x' }] } }] as any;
    const { container } = render(
      <PatientHeader
        {...headerBase}
        adverseEvents={adverseEvents}
        hasCriticalValues
        criticalVisusCount={1}
        showCohortReference={false}
        onToggleCohortReference={() => {}}
      />,
    );
    // The control cluster is the second flex child of the top row.
    const cluster = container.querySelector('.justify-end');
    expect(cluster).not.toBeNull();
    const toggleInput = cluster!.querySelector('input[type="checkbox"]');
    expect(toggleInput).not.toBeNull();
    // The toggle's enclosing wrapper is the LAST element child of the cluster.
    const last = cluster!.children[cluster!.children.length - 1];
    expect(last.contains(toggleInput)).toBe(true);
  });
});

describe('PatientHeader — N10/N11 overlay-cohort label + selector', () => {
  const overlayProps = {
    overlayCohortOptions: [
      { id: '__all_patients__', label: 'overlayCohortAllPatients', patientCount: 120 },
      { id: 'coh-1', label: 'AMD Tübingen', patientCount: 42 },
    ],
    onSelectOverlayCohort: () => {},
  };

  it('N11: renders a selector listing the patient-containing cohorts', () => {
    const { getByLabelText } = render(
      <PatientHeader
        {...headerBase}
        {...overlayProps}
        overlayCohortId="coh-1"
        showCohortReference
        onToggleCohortReference={() => {}}
      />,
    );
    const select = getByLabelText('overlayCohortSelectorLabel') as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.value).toBe('coh-1');
    expect(select.querySelectorAll('option').length).toBe(2);
  });

  it('N11: omits the selector when there is no real choice (single cohort)', () => {
    const { queryByLabelText } = render(
      <PatientHeader
        {...headerBase}
        overlayCohortOptions={[{ id: '__all_patients__', label: 'overlayCohortAllPatients', patientCount: 120 }]}
        onSelectOverlayCohort={() => {}}
        overlayCohortId="__all_patients__"
        showCohortReference
        onToggleCohortReference={() => {}}
      />,
    );
    expect(queryByLabelText('overlayCohortSelectorLabel')).toBeNull();
  });

  it('N10: shows the active cohort label + N only when the overlay is ON', () => {
    // The N10 badge is a <span> (not an <option>) whose combined text reads
    // "overlayCohortActiveLabel: AMD Tübingen (N=42)".
    const badgeMatcher = (_content: string, el: Element | null) =>
      el != null &&
      el.tagName === 'SPAN' &&
      /overlayCohortActiveLabel:\s*AMD Tübingen\s*\(N=42\)/.test(el.textContent ?? '');
    const { queryByText, rerender } = render(
      <PatientHeader
        {...headerBase}
        {...overlayProps}
        overlayCohortId="coh-1"
        activeOverlayCohortLabel="AMD Tübingen"
        activeOverlayCohortCount={42}
        showCohortReference={false}
        onToggleCohortReference={() => {}}
      />,
    );
    // Overlay off → no active-cohort badge.
    expect(queryByText(badgeMatcher)).toBeNull();
    rerender(
      <PatientHeader
        {...headerBase}
        {...overlayProps}
        overlayCohortId="coh-1"
        activeOverlayCohortLabel="AMD Tübingen"
        activeOverlayCohortCount={42}
        showCohortReference
        onToggleCohortReference={() => {}}
      />,
    );
    expect(queryByText(badgeMatcher)).not.toBeNull();
  });
});
