// @vitest-environment jsdom
/** Phase 13 / METRIC-02 — IntervalHistogram component tests. */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import IntervalHistogram from '../src/components/outcomes/IntervalHistogram';
import type { PatientCase } from '../src/types/fhir';
import type { TranslationKey } from '../src/i18n/translations';
import { translations } from '../src/i18n/translations';

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
});
