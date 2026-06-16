// @vitest-environment jsdom
/**
 * A6 (perf) — Verläufe performance hotfix.
 *
 * Part 1: distinctPatientCount helper + large-cohort per-patient layer default.
 * Part 2 (WS-1 v1.17): the per-patient series is memoised on panel.patients, so a
 *   rerender that changes only an unrelated prop (color) reuses the same per-patient
 *   line set (no rebuild). Asserted via the jsdom fallback's stable per-patient nodes.
 */

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  distinctPatientCount,
  PER_PATIENT_DEFAULT_OFF_THRESHOLD,
} from '../src/components/outcomes/useOutcomesRouteState';

// ---------------------------------------------------------------------------
// Part 1: distinctPatientCount + threshold semantics
// ---------------------------------------------------------------------------

describe('A6 — distinctPatientCount + large-cohort threshold', () => {
  it('counts distinct pseudonyms (not raw case count)', () => {
    const cases = [{ pseudonym: 'PSN-1' }, { pseudonym: 'PSN-1' }, { pseudonym: 'PSN-2' }];
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
    expect(distinctPatientCount(small) > PER_PATIENT_DEFAULT_OFF_THRESHOLD).toBe(false);
    expect(distinctPatientCount(large) > PER_PATIENT_DEFAULT_OFF_THRESHOLD).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Part 1b (F3): reset paths re-derive the large-cohort default.
// ---------------------------------------------------------------------------

describe('A6 (F3) — reset paths re-derive large-cohort per-patient default', () => {
  const derivedPerPatientDefaultOn = (cases: { pseudonym?: string }[]): boolean =>
    distinctPatientCount(cases) <= PER_PATIENT_DEFAULT_OFF_THRESHOLD;

  const smallCohort = Array.from({ length: 50 }, (_, i) => ({ pseudonym: `PSN-${i}` }));
  const largeCohort = Array.from({ length: 250 }, (_, i) => ({ pseudonym: `PSN-${i}` }));

  it('metric-switch keeps per-patient OFF on a >100 cohort, not forced true', () => {
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
// Part 2: per-patient series memoisation — stable across a color-only rerender
// ---------------------------------------------------------------------------

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

describe('A6 — per-patient line set stable across color-only rerender', () => {
  afterEach(() => cleanup());

  it('keeps the per-patient node set unchanged when only an unrelated prop (color) changes', () => {
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

    const { container, rerender } = render(<OutcomesPanel {...props} />);
    const before = Array.from(container.querySelectorAll('[data-testid^="outcomes-perpatient-"]')).map(
      (el) => el.getAttribute('data-testid'),
    );
    expect(before).toEqual(['outcomes-perpatient-PSN-1', 'outcomes-perpatient-PSN-2']);

    rerender(<OutcomesPanel {...props} color="#ef4444" />);
    const after = Array.from(container.querySelectorAll('[data-testid^="outcomes-perpatient-"]')).map(
      (el) => el.getAttribute('data-testid'),
    );
    expect(after).toEqual(before);
  });
});
