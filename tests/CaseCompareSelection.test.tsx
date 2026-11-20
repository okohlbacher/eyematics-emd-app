// @vitest-environment jsdom
/**
 * Z0-P23 — case-view comparison selection (C11, Q22, Q32; replaces the two N11 selector tests of
 * CaseDetailRound7.test.tsx) and the generalised compare drawer (PLAN Z0-P23 §5: maxSelections = 1).
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import PatientHeader from '../src/components/case-detail/PatientHeader';
import CohortCompareDrawer from '../src/components/outcomes/CohortCompareDrawer';
import type { TranslationKey } from '../src/i18n/translations';

afterEach(() => cleanup());

const DE: Partial<Record<string, string>> = {
  outcomesCompareOpenDrawer: 'Kohorten vergleichen',
  outcomesCompareDrawerTitle: 'Kohorten vergleichen',
  overlayCohortSelectorLabel: 'Vergleichskohorte wählen',
  outcomesComparePatientsUnit: 'Patient:innen',
  outcomesComparePrimaryLabel: 'Basis-Kohorte (fest)',
};
const t = (k: string) => DE[k] ?? k;

const headerBase = {
  pseudonym: 'PSN-1',
  birthDate: '1950-01-01',
  gender: 'female',
  centerName: 'UKA',
  eyeLaterality: 'OD',
  totalEncounters: 1,
  primaryDiagnoses: [],
  treatmentIndication: '',
  adverseEvents: [],
  hasCriticalValues: false,
  criticalCrtCount: 0,
  criticalVisusCount: 0,
  criticalIopCount: 0,
  encounterTimeline: [],
  dateFmt: 'de-DE',
  locale: 'de',
  t: t as (k: TranslationKey) => string,
  highlightDate: null,
  onHighlightDate: () => {},
  showCohortReference: true,
  onToggleCohortReference: () => {},
};

const options = [
  { id: '__all_patients__', label: 'Alle Patienten', patientCount: 120 },
  { id: 'coh-z', label: 'Zeta', patientCount: 3 },
  { id: 'coh-1', label: 'AMD Tübingen', patientCount: 42 },
];

function panel() {
  return screen.getByRole('complementary', { name: 'Vergleichskohorte wählen' });
}

describe('PatientHeader — comparison panel (Z0-P23)', () => {
  it('opens the panel with the button "Kohorten vergleichen"; radios, "Alle Patienten" first, then by name', () => {
    render(
      <PatientHeader {...(headerBase as never)} overlayCohortOptions={options} overlayCohortId="coh-1" onSelectOverlayCohort={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Kohorten vergleichen' }));
    const p = panel();
    expect(within(p).getByRole('heading', { name: 'Vergleichskohorte wählen' })).not.toBeNull();
    expect(within(p).queryAllByRole('checkbox')).toEqual([]);
    const radios = within(p).getAllByRole('radio') as HTMLInputElement[];
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Alle Patienten (N=120 Patient:innen)',
      'AMD Tübingen (N=42 Patient:innen)',
      'Zeta (N=3 Patient:innen)',
    ]);
    expect(radios.filter((r) => r.checked).map((r) => r.getAttribute('aria-label'))).toEqual(['AMD Tübingen (N=42 Patient:innen)']);
  });

  it('selecting another option reports exactly that one cohort', () => {
    const onSelect = vi.fn();
    render(
      <PatientHeader {...(headerBase as never)} overlayCohortOptions={options} overlayCohortId="coh-1" onSelectOverlayCohort={onSelect} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Kohorten vergleichen' }));
    fireEvent.click(within(panel()).getByRole('radio', { name: /^Zeta/ }));
    expect(onSelect).toHaveBeenCalledWith('coh-z');
  });

  it('is shown even when only "Alle Patienten" is available', () => {
    render(
      <PatientHeader
        {...(headerBase as never)}
        overlayCohortOptions={[options[0]]}
        overlayCohortId="__all_patients__"
        onSelectOverlayCohort={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Kohorten vergleichen' }));
    expect(within(panel()).getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual([
      'Alle Patienten (N=120 Patient:innen)',
    ]);
  });
});

describe('CohortCompareDrawer — options and swatches (Z0-P23)', () => {
  const searches = [
    { id: '__all_patients__', name: 'Alle Patienten', createdAt: '', filters: {} },
    { id: 'v', name: 'Vergleichskohorte', createdAt: '', filters: {} },
    { id: 'base', name: 'Testkohorte', createdAt: '', filters: {} },
  ];
  const counts = { __all_patients__: 100, v: 20, base: 30 };

  it('lists "Alle Patienten" first, then by name; label "<Name> (N=<n> Patient:innen)" with the primary badge apart', () => {
    const { container } = render(
      <CohortCompareDrawer
        open
        onClose={() => {}}
        savedSearches={searches}
        patientCounts={counts}
        primaryCohortId="base"
        selectedIds={['base', 'v']}
        onChange={() => {}}
        onReset={() => {}}
        t={t}
      />,
    );
    const labels = Array.from(container.querySelectorAll('[data-compare-option-label]')).map((el) => el.textContent);
    expect(labels).toEqual([
      'Alle Patienten (N=100 Patient:innen)',
      'Testkohorte (N=30 Patient:innen)',
      'Vergleichskohorte (N=20 Patient:innen)',
    ]);
    expect(screen.getByRole('checkbox', { name: 'Testkohorte (N=30 Patient:innen) · Basis-Kohorte (fest)' })).not.toBeNull();
    const swatches = Array.from(container.querySelectorAll('[data-compare-swatch]')) as HTMLElement[];
    expect(swatches.length).toBe(3);
    // Swatch colour = comparison order (base first → palette 0, v → palette 1); unselected: none.
    expect(swatches[0].style.backgroundColor).toBe('');
    expect(swatches[1].style.backgroundColor).toBe('rgb(4, 120, 87)');
    expect(swatches[2].style.backgroundColor).toBe('rgb(180, 83, 9)');
  });

  it('with maxSelections=1 renders radios and no reset button', () => {
    const onChange = vi.fn();
    render(
      <CohortCompareDrawer
        open
        onClose={() => {}}
        savedSearches={searches}
        patientCounts={counts}
        primaryCohortId={null}
        selectedIds={['v']}
        onChange={onChange}
        t={t}
        title="Vergleichskohorte wählen"
        maxSelections={1}
      />,
    );
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
    expect(screen.queryByText('outcomesCompareReset')).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /^Testkohorte/ }));
    expect(onChange).toHaveBeenCalledWith(['base']);
  });
});
