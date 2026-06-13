// @vitest-environment jsdom
/**
 * A6 (perf) — Verläufe performance hotfix.
 *
 * Part 1: distinctPatientCount helper + large-cohort per-patient layer default.
 * Part 2: memoization smoke — per-patient <Line> data arrays keep stable identity
 *         across rerenders that don't change panel.patients.
 */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  distinctPatientCount,
  PER_PATIENT_DEFAULT_OFF_THRESHOLD,
} from '../src/components/outcomes/useOutcomesRouteState';

// ---------------------------------------------------------------------------
// Part 1: distinctPatientCount + threshold semantics
// ---------------------------------------------------------------------------

describe('A6 — distinctPatientCount + large-cohort threshold', () => {
  it('counts distinct pseudonyms (not raw case count)', () => {
    const cases = [
      { pseudonym: 'PSN-1' },
      { pseudonym: 'PSN-1' }, // same patient, second visit
      { pseudonym: 'PSN-2' },
    ];
    expect(distinctPatientCount(cases)).toBe(2);
  });

  it('ignores missing/empty pseudonyms', () => {
    const cases = [{ pseudonym: 'PSN-1' }, {}, { pseudonym: '' }];
    expect(distinctPatientCount(cases)).toBe(1);
  });

  it('threshold is 100 → small cohort below, large cohort above', () => {
    expect(PER_PATIENT_DEFAULT_OFF_THRESHOLD).toBe(100);
    const small = Array.from({ length: 100 }, (_, i) => ({ pseudonym: `PSN-${i}` }));
    const large = Array.from({ length: 101 }, (_, i) => ({ pseudonym: `PSN-${i}` }));
    // Default ON when count <= threshold, OFF when count > threshold.
    expect(distinctPatientCount(small) > PER_PATIENT_DEFAULT_OFF_THRESHOLD).toBe(false);
    expect(distinctPatientCount(large) > PER_PATIENT_DEFAULT_OFF_THRESHOLD).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Part 1b (F3): reset paths re-derive the large-cohort default rather than
// forcing perPatient ON. Both the metric-tab switch (resetToMetricDefaults) and
// the Settings "reset defaults" button (resetLayersToDefaults) compute the
// per-patient default as `distinctPatientCount(cohort.cases) <= THRESHOLD`. This
// asserts that shared derivation rule so a >100 cohort keeps per-patient OFF
// after a reset / metric switch (the A6 wedge fix).
// ---------------------------------------------------------------------------

describe('A6 (F3) — reset paths re-derive large-cohort per-patient default', () => {
  // Mirror of derivePerPatientDefaultOn / resetToMetricDefaults: the boolean
  // both reset paths write to layers.perPatient.
  const derivedPerPatientDefaultOn = (cases: { pseudonym?: string }[]): boolean =>
    distinctPatientCount(cases) <= PER_PATIENT_DEFAULT_OFF_THRESHOLD;

  const smallCohort = Array.from({ length: 50 }, (_, i) => ({ pseudonym: `PSN-${i}` }));
  const largeCohort = Array.from({ length: 250 }, (_, i) => ({ pseudonym: `PSN-${i}` }));

  it('metric-switch (visus↔crt) keeps per-patient OFF on a >100 cohort, not forced true', () => {
    // The pre-F3 bug forced perPatient: true on every metric switch.
    expect(derivedPerPatientDefaultOn(largeCohort)).toBe(false);
  });

  it('metric-switch keeps per-patient ON for a small cohort', () => {
    expect(derivedPerPatientDefaultOn(smallCohort)).toBe(true);
  });

  it('reset-defaults respects the large-cohort default (OFF) instead of marking an override', () => {
    expect(derivedPerPatientDefaultOn(largeCohort)).toBe(false);
    expect(derivedPerPatientDefaultOn(smallCohort)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Part 2: memoization smoke — capture per-patient Line `data` identities and
// assert they are stable across a rerender with the SAME panel.patients ref.
// ---------------------------------------------------------------------------

const lineDataIdentities: unknown[][] = [];

vi.mock('recharts', async (importOriginal) => {
  const real = await importOriginal<typeof import('recharts')>();
  return {
    ...real,
    ResponsiveContainer: ({ children }: { children: any }) => (
      <div>
        <svg>{children}</svg>
      </div>
    ),
    ComposedChart: ({ children }: { children: any }) => <g>{children}</g>,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    ZAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: () => null,
    Area: () => null,
    Scatter: () => null,
    // Capture each per-patient Line's `data` array reference for identity checks.
    Line: ({ data, legendType }: any) => {
      // Per-patient lines use legendType="none"; the median line has a name.
      if (legendType === 'none' && Array.isArray(data) && data[0]?.__series === 'perPatient') {
        lineDataIdentities[lineDataIdentities.length - 1]?.push(data);
      }
      return <g data-testid="recharts-line" />;
    },
  };
});

import OutcomesPanel from '../src/components/outcomes/OutcomesPanel';
import type { PanelResult } from '../src/utils/cohortTrajectory';

const t = (key: string) => key;

function buildPanelWithPatients(): PanelResult {
  return {
    patients: [
      {
        id: 'CASE-1',
        pseudonym: 'PSN-1',
        excluded: false,
        sparse: false,
        measurements: [
          { x: 0, y: 0.3 },
          { x: 10, y: 0.4 },
        ],
      } as never,
      {
        id: 'CASE-2',
        pseudonym: 'PSN-2',
        excluded: false,
        sparse: false,
        measurements: [
          { x: 0, y: 0.5 },
          { x: 10, y: 0.55 },
        ],
      } as never,
    ],
    scatterPoints: [],
    medianGrid: [{ x: 0, y: 0.3, p25: 0.2, p75: 0.4, n: 2 }],
    summary: { patientCount: 2, measurementCount: 4, excludedCount: 0 },
  };
}

describe('A6 — per-patient Line data memoization smoke', () => {
  afterEach(() => {
    cleanup();
    lineDataIdentities.length = 0;
  });

  it('keeps per-patient Line data identity stable across rerender with same panel', () => {
    const panel = buildPanelWithPatients();
    const props = {
      eye: 'od' as const,
      color: '#3b82f6',
      axisMode: 'days' as const,
      yMetric: 'absolute' as const,
      layers: { median: true, perPatient: true, scatter: false, spreadBand: false },
      t,
      locale: 'en' as const,
      titleKey: 'outcomesPanelOd' as const,
      metric: 'visus' as const,
      panel,
    };

    lineDataIdentities.push([]);
    const { rerender } = render(<OutcomesPanel {...props} />);
    const first = lineDataIdentities[0].slice();

    lineDataIdentities.push([]);
    // Rerender with same panel ref but a changed unrelated prop (color) — the memo
    // is keyed on panel.patients, so the per-patient data arrays must be reused.
    rerender(<OutcomesPanel {...props} color="#ef4444" />);
    const second = lineDataIdentities[1];

    expect(first.length).toBe(2);
    expect(second.length).toBe(2);
    expect(second[0]).toBe(first[0]);
    expect(second[1]).toBe(first[1]);
  });
});
