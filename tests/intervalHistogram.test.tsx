// @vitest-environment jsdom
/** Phase 13 / METRIC-02 — IntervalHistogram component tests.
 *  Phase 42 / ANL-010 — cross-cohort labeled histogram tests.
 */
import { cleanup,fireEvent, render, screen } from '@testing-library/react';
import { afterEach,describe, expect, it } from 'vitest';

import IntervalHistogram from '../src/components/outcomes/IntervalHistogram';
import type { IntervalCohortSeries } from '../src/components/outcomes/IntervalHistogram';
import type { TranslationKey } from '../src/i18n/translations';
import { translations } from '../src/i18n/translations';
import type { PatientCase } from '../src/types/fhir';

const t = (key: TranslationKey) => (translations as any)[key]?.en ?? key;

function caseWithIvi(pseudonym: string, dates: Array<{ date: string; eye: 'od' | 'os' }>): PatientCase {
  const procedures = dates.map((d) => ({
    resourceType: 'Procedure' as const,
    code: { coding: [{ system: 'http://snomed.info/sct', code: '36189003' }] },
    bodySite: { coding: [{ code: d.eye === 'od' ? '24028007' : '8966001' }] },
    performedDateTime: d.date,
  }));
  return { pseudonym, observations: [], procedures } as unknown as PatientCase;
}

afterEach(() => cleanup());

describe('IntervalHistogram', () => {
  it('renders empty state when no intervals are calculable', () => {
    render(<IntervalHistogram cases={[]} t={t} locale="en" />);
    expect(screen.getByTestId('interval-empty')).toBeTruthy();
  });

  it('renders median annotation text with day value', () => {
    const cases = [caseWithIvi('P1', [
      { date: '2024-01-01', eye: 'od' },
      { date: '2024-02-15', eye: 'od' }, // 45-day gap
    ])];
    render(<IntervalHistogram cases={cases} t={t} locale="en" />);
    const median = screen.getByTestId('interval-median');
    expect(median.getAttribute('data-median-days')).toBe('45');
  });

  it('switches computation when eye toggle is clicked', () => {
    const cases = [caseWithIvi('P1', [
      { date: '2024-01-01', eye: 'od' },
      { date: '2024-02-15', eye: 'od' }, // 45-day OD gap
      { date: '2024-01-01', eye: 'os' },
      { date: '2024-07-01', eye: 'os' }, // 182-day OS gap (lands in 180+d bin)
    ])];
    render(<IntervalHistogram cases={cases} t={t} locale="en" />);
    // Default is combined — both gaps contribute; median of [45, 182] = 113
    let median = screen.getByTestId('interval-median');
    expect(median.getAttribute('data-median-days')).toBe('113');
    // Click OS toggle → only 182 remains → median 182
    fireEvent.click(screen.getByTestId('interval-eye-os'));
    median = screen.getByTestId('interval-median');
    expect(median.getAttribute('data-median-days')).toBe('182');
  });

  // ---- Phase 42 / ANL-010: cross-cohort legend tests ----

  describe('cross-cohort mode (cohortSeries)', () => {
    const cohortA = [caseWithIvi('P1', [
      { date: '2024-01-01', eye: 'combined' as unknown as 'od' },
      { date: '2024-02-15', eye: 'od' }, // 45-day gap
    ])];
    const cohortB = [caseWithIvi('P2', [
      { date: '2024-01-01', eye: 'od' },
      { date: '2024-04-20', eye: 'od' }, // 110-day gap
    ])];

    const cohortSeries: IntervalCohortSeries[] = [
      { cohortId: 'c1', cohortName: 'AMD Kohorte', patientCount: 10, color: '#047857', cases: cohortA },
      { cohortId: 'c2', cohortName: 'DR Kohorte', patientCount: 8, color: '#b45309', cases: cohortB },
    ];

    it('renders cohort legend with each cohort name', () => {
      render(<IntervalHistogram cases={cohortA} t={t} locale="en" cohortSeries={cohortSeries} />);
      // Each cohort name must appear in the legend region
      expect(screen.queryByText('AMD Kohorte')).not.toBeNull();
      expect(screen.queryByText('DR Kohorte')).not.toBeNull();
    });

    it('suppresses the single-eye median element in cross mode', () => {
      render(<IntervalHistogram cases={cohortA} t={t} locale="en" cohortSeries={cohortSeries} />);
      // Single-series median element should not be rendered in cross mode
      expect(screen.queryByTestId('interval-median')).toBeNull();
    });

    it('renders per-cohort median annotations in cross mode', () => {
      render(<IntervalHistogram cases={cohortA} t={t} locale="en" cohortSeries={cohortSeries} />);
      // Each cohort gets its own median annotation
      expect(screen.queryByTestId('interval-median-c1')).not.toBeNull();
      expect(screen.queryByTestId('interval-median-c2')).not.toBeNull();
    });

    it('single-cohort mode is unchanged when cohortSeries is absent', () => {
      const cases = [caseWithIvi('P1', [
        { date: '2024-01-01', eye: 'od' },
        { date: '2024-02-15', eye: 'od' },
      ])];
      render(<IntervalHistogram cases={cases} t={t} locale="en" />);
      // Eye toggle present (single-cohort feature)
      expect(screen.queryByTestId('interval-eye-combined')).not.toBeNull();
      // No cohort names rendered
      expect(screen.queryByText('AMD Kohorte')).toBeNull();
    });

    it('single-cohort mode is unchanged when cohortSeries has only 1 entry', () => {
      const singleSeries: IntervalCohortSeries[] = [
        { cohortId: 'c1', cohortName: 'Solo', patientCount: 5, color: '#047857', cases: cohortA },
      ];
      render(<IntervalHistogram cases={cohortA} t={t} locale="en" cohortSeries={singleSeries} />);
      // Eye toggle still present (not cross mode)
      expect(screen.queryByTestId('interval-eye-combined')).not.toBeNull();
    });
  });
});
