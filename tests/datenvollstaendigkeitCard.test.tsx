// @vitest-environment jsdom
/**
 * Phase 34 Plan 01 / Wave 0 scaffold: Datenvollzähligkeit card rendering.
 *
 * Non-skipped tests: basic render smoke test (wiring validation) and
 * countRawPatients mock assertion that runs now.
 *
 * Skipped tests: card-presence and percentage assertions that depend on the
 * card not yet existing in LandingPage.tsx (Plan 04 will land it).
 */
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { t as translate } from '../src/i18n/translations';

// ---------- Mocks ----------
vi.mock('../src/context/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../src/context/AuthContext')>(
    '../src/context/AuthContext',
  );
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

vi.mock('../src/context/DataContext', () => ({
  useData: vi.fn(),
}));

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: vi.fn(),
}));

// useRecentActivity: stub so LandingPage renders without real localStorage/AuthContext wiring
vi.mock('../src/hooks/useRecentActivity', () => ({
  useRecentActivity: () => ({ entries: [], record: vi.fn(), clear: vi.fn() }),
}));

// countRawPatients mock: returns total raw patients (10 = 8 full + 2 stub equivalent)
vi.mock('../src/services/fhirLoader', async () => {
  const actual = await vi.importActual('../src/services/fhirLoader');
  return {
    ...(actual as object),
    countRawPatients: vi.fn(() => 10),
    getCenterShorthand: vi.fn((id: string) => id),
  };
});

import { useAuth } from '../src/context/AuthContext';
import { useData } from '../src/context/DataContext';
import { useLanguage } from '../src/context/LanguageContext';
import LandingPage from '../src/pages/LandingPage';

// ---------- Setup helpers ----------

/** Minimal PatientCase shape sufficient for LandingPage rendering */
const _MOCK_CASES = [
  { id: 'pat-full-001', centerId: 'org-test', pseudonym: 'FULL-001', age: 75, gender: 'female' },
  { id: 'pat-full-002', centerId: 'org-test', pseudonym: 'FULL-002', age: 68, gender: 'male' },
];

function setupMocks(caseCount = 7) {
  (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    user: { username: 'tester', role: 'admin' },
    displayName: 'Tester',
    login: vi.fn(),
    logout: vi.fn(),
    inactivityWarning: false,
    hasRole: vi.fn(() => true),
    token: null,
  });
  (useData as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    loading: false,
    bundles: [
      {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          { resource: { resourceType: 'Organization', id: 'org-test', name: 'Test Org', address: [] } },
          { resource: { resourceType: 'Patient', id: 'pat-full-001', meta: { source: 'org-test' }, gender: 'female', birthDate: '1950-01-01', identifier: [{ system: 'urn:emd:pseudonym', value: 'FULL-001' }] } },
          { resource: { resourceType: 'Patient', id: 'pat-stub-001', meta: { source: 'org-test' }, gender: 'male', birthDate: '1960-01-01' } },
        ],
      },
    ],
    centers: [],
    // caseCount controls how many cases the mock returns (affects completeness fraction).
    // Must provide full PatientCase shape (observations + imagingStudies) to avoid
    // LandingPage crashing at reduce calls.
    cases: Array.from({ length: caseCount }, (_, i) => ({
      id: `pat-full-${String(i + 1).padStart(3, '0')}`,
      centerId: 'org-test',
      pseudonym: `FULL-${String(i + 1).padStart(3, '0')}`,
      age: 60 + i,
      gender: i % 2 === 0 ? 'female' : 'male',
      observations: [],
      imagingStudies: [],
      conditions: [],
      procedures: [],
      medications: [],
      primaryDiagnosisCode: undefined,
      primaryDiagnosisDisplay: undefined,
      cohort: undefined,
      baselineDate: undefined,
    })),
  });
  (useLanguage as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    locale: 'en',
    setLocale: vi.fn(),
    t: (key: string) => translate(key as Parameters<typeof translate>[0], 'en'),
  });
}

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/cohort" element={<div data-testid="cohort-page" />} />
        <Route path="/doc-quality" element={<div data-testid="doc-quality-page" />} />
        <Route path="/quality" element={<div data-testid="quality-page" />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------- Tests ----------

describe('Datenvollzähligkeit card — mock wiring smoke test', () => {
  it('renders LandingPage without throwing when bundles and cases are mocked', () => {
    setupMocks();
    // This test is NOT skipped: it verifies that mock wiring is correct and
    // the page does not crash. No card-specific assertions — those are in Plan 04.
    expect(() => renderLanding()).not.toThrow();
  });

  it('useData mock includes bundles field (wiring validation)', () => {
    setupMocks();
    // Verify the mock is wired correctly before Plan 04 adds the card.
    // LandingPage must render without error with bundles in useData.
    const { container } = renderLanding();
    expect(container).not.toBeNull();
  });
});

describe('Datenvollzähligkeit card — card presence and percentage (Plan 04)', () => {
  // SKIP_REASON: card does not exist in LandingPage.tsx until Plan 04 adds it.
  it('renders the DATENVOLLZÄHLIGKEIT caption', () => {
    setupMocks(7);
    renderLanding();
    // Plan 04 adds datenvollstaendigkeitCaption i18n key and the card heading.
    const caption = screen.queryByText(translate('datenvollstaendigkeitCaption', 'en'));
    expect(caption).not.toBeNull();
  });

  // SKIP_REASON: card does not exist in LandingPage.tsx until Plan 04 adds it.
  it('renders the completeness percentage (70 % for 7 of 10 patients)', () => {
    setupMocks(7);
    renderLanding();
    // countRawPatients is mocked to return 10; cases.length = 7 → 70 %
    const pct = screen.queryByText('70 %');
    expect(pct).not.toBeNull();
  });

  // SKIP_REASON: card does not exist in LandingPage.tsx until Plan 04 adds it.
  it('renders the n / m patients sub-label', () => {
    setupMocks(7);
    renderLanding();
    // datenvollstaendigkeitPatients key: "{n} / {m} patients"
    const label = screen.queryByText('7 / 10 patients');
    expect(label).not.toBeNull();
  });

  // SKIP_REASON: card does not exist in LandingPage.tsx until Plan 04 adds it.
  it('renders the ShieldCheck icon container (aria-hidden)', () => {
    setupMocks();
    const { container } = renderLanding();
    // The ShieldCheck icon in the card has aria-hidden="true"
    const icon = container.querySelector('[aria-hidden="true"]');
    expect(icon).not.toBeNull();
  });

  // SKIP_REASON: card does not exist in LandingPage.tsx until Plan 04 adds it.
  it('renders progressbar with correct aria-valuenow (70 for 70%)', () => {
    setupMocks(7);
    renderLanding();
    const progressbar = screen.queryByRole('progressbar');
    expect(progressbar).not.toBeNull();
    expect(progressbar?.getAttribute('aria-valuenow')).toBe('70');
  });
});

describe('I5 (v1.14) — Vollzähligkeit label reverted + definition tooltip', () => {
  it('renders the DATA COMPLETENESS caption (reverted from CONSENT RATE)', () => {
    setupMocks(7);
    renderLanding();
    expect(translate('datenvollstaendigkeitCaption', 'en')).toBe('DATA COMPLETENESS');
    expect(screen.queryByText('DATA COMPLETENESS')).not.toBeNull();
  });

  it('no longer renders the v1.13 CONSENT RATE caption on the landing card', () => {
    setupMocks(7);
    renderLanding();
    expect(screen.queryByText('CONSENT RATE')).toBeNull();
  });

  it('renders the definition tooltip as an accessible info icon', () => {
    setupMocks(7);
    renderLanding();
    const tip = screen.queryByLabelText(translate('datenvollstaendigkeitTooltip', 'en'));
    expect(tip).not.toBeNull();
    expect(tip?.getAttribute('title')).toBe(translate('datenvollstaendigkeitTooltip', 'en'));
  });
});
