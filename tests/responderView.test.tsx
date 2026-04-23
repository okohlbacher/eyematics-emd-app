// @vitest-environment jsdom
/** Phase 13 / METRIC-03 — ResponderView component tests. */
import { cleanup,render, screen } from '@testing-library/react';
import { afterEach,describe, expect, it } from 'vitest';

import ResponderView from '../src/components/outcomes/ResponderView';
import type { TranslationKey } from '../src/i18n/translations';
import { translations } from '../src/i18n/translations';
import type { PatientCase } from '../src/types/fhir';

afterEach(() => cleanup());

const t = (key: TranslationKey) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entry = (translations as any)[key];
  return entry?.en ?? key;
};

function makeCase(pseudonym: string, byEye: Record<'od' | 'os', Array<{ daysOffset: number; decimal: number }>>): PatientCase {
  const baseline = new Date('2024-01-01');
  const observations = (['od', 'os'] as const).flatMap((eye) =>
    byEye[eye].map((m) => ({
      resourceType: 'Observation' as const,
      code: { coding: [{ system: 'http://loinc.org', code: '79880-1' }] },
      bodySite: { coding: [{ code: eye === 'od' ? '24028007' : '8966001' }] },
      effectiveDateTime: new Date(baseline.getTime() + m.daysOffset * 86400000).toISOString().slice(0, 10),
      valueQuantity: { value: m.decimal, unit: '1' },
    })),
  );
  return { pseudonym, observations, procedures: [] } as unknown as PatientCase;
}

describe('ResponderView', () => {
  it('renders empty state when no patients can be classified', () => {
    render(<ResponderView cases={[]} thresholdLetters={5} t={t} locale="en" />);
    expect(screen.getByTestId('responder-empty')).toBeTruthy();
  });

  it('renders both chart sections when classifications exist', () => {
    const cases = [
      makeCase('P1', { od: [{ daysOffset: 0, decimal: 0.5 }, { daysOffset: 365, decimal: 0.79 }], os: [] }),
      makeCase('P2', { od: [{ daysOffset: 0, decimal: 0.79 }, { daysOffset: 365, decimal: 0.5 }], os: [] }),
    ];
    render(<ResponderView cases={cases} thresholdLetters={5} t={t} locale="en" />);
    expect(screen.getByTestId('responder-bar-section')).toBeTruthy();
    expect(screen.getByTestId('responder-trajectory-section')).toBeTruthy();
  });

  it('exposes bucket counts as data attrs (combined eye)', () => {
    // P1 = responder on OD (+10 letters), P2 = non-responder on OD (-10 letters)
    // Combined eye: OD-only data → each patient classified by OD
    const cases = [
      makeCase('P1', { od: [{ daysOffset: 0, decimal: 0.5 }, { daysOffset: 365, decimal: 0.79 }], os: [] }),
      makeCase('P2', { od: [{ daysOffset: 0, decimal: 0.79 }, { daysOffset: 365, decimal: 0.5 }], os: [] }),
    ];
    render(<ResponderView cases={cases} thresholdLetters={5} t={t} locale="en" />);
    const counts = screen.getByTestId('responder-counts');
    expect(counts.getAttribute('data-combined-responder')).toBe('1');
    expect(counts.getAttribute('data-combined-non-responder')).toBe('1');
  });
});
