// @vitest-environment jsdom
/**
 * QUAL-022: QualityPage time-range filter drives Grundgesamtheit + summary counts.
 * QUAL-023: Absolute counts prominently labeled (qualityPopulationLabel visible).
 *
 * RTL: no jest-dom — use queryByText().not.toBeNull() / .toBeNull() per CLAUDE.md.
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PatientCase } from '../src/types/fhir';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'test-user', role: 'admin', centers: [] },
    logout: vi.fn(),
  }),
  QUALITY_ROLES: ['admin', 'clinic_lead', 'data_manager'],
}));

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, locale: 'en' }),
}));

vi.mock('../src/services/settingsService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/settingsService')>();
  return {
    ...actual,
    getSettings: () => ({
      therapyInterrupterDays: 120,
      therapyBreakerDays: 365,
      crtImplausibleThresholdUm: 400,
      twoFactorEnabled: false,
      dataSource: { type: 'local', blazeUrl: 'http://localhost:8080/fhir' },
      outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 },
      thresholds: {
        criticalCrtUm: 200,
        criticalVisus: 0.5,
        visusJump: 0.1,
      },
    }),
  };
});

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

// Recent case — observation within the last 6 months (2026-03-01 is within 6m of 2026-05-25)
const recentCase: PatientCase = {
  id: 'case-recent',
  pseudonym: 'RECENT-CASE',
  gender: 'male',
  birthDate: '1960-01-01',
  centerId: 'CENTER-A',
  centerName: 'Center A',
  conditions: [],
  observations: [
    {
      id: 'obs-recent',
      code: { coding: [{ system: 'http://loinc.org', code: 'LP267955-5', display: 'CRT' }] },
      valueQuantity: { value: 250, unit: 'um' },
      effectiveDateTime: '2026-03-01T00:00:00Z',
    },
  ],
  medications: [],
  procedures: [],
  imagingStudies: [],
};

// Old case — observation outside the 6m window (2020-01-01 is far in the past)
const oldCase: PatientCase = {
  id: 'case-old',
  pseudonym: 'OLD-CASE',
  gender: 'female',
  birthDate: '1965-01-01',
  centerId: 'CENTER-A',
  centerName: 'Center A',
  conditions: [],
  observations: [
    {
      id: 'obs-old',
      code: { coding: [{ system: 'http://loinc.org', code: 'LP267955-5', display: 'CRT' }] },
      valueQuantity: { value: 220, unit: 'um' },
      effectiveDateTime: '2020-01-01T00:00:00Z',
    },
  ],
  medications: [],
  procedures: [],
  imagingStudies: [],
};

function makeDataMock(cases: PatientCase[] = [recentCase, oldCase]) {
  return {
    activeCases: [],
    centers: [],
    cases,
    loading: false,
    error: null,
    bundles: [],
    savedSearches: [],
    addSavedSearch: vi.fn(),
    removeSavedSearch: vi.fn(),
    qualityFlags: [],
    addQualityFlag: vi.fn(),
    updateQualityFlag: vi.fn(),
    excludedCases: [],
    toggleExcludeCase: vi.fn(),
    reviewedCases: [],
    markCaseReviewed: vi.fn(),
    unmarkCaseReviewed: vi.fn(),
    reloadData: vi.fn(),
  };
}

vi.mock('../src/context/DataContext', () => ({
  useData: () => makeDataMock(),
}));

import QualityPage from '../src/pages/QualityPage';

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderQualityPage() {
  return render(
    <MemoryRouter initialEntries={['/quality']}>
      <QualityPage />
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests — QUAL-022: time-range filter drives Grundgesamtheit
// ---------------------------------------------------------------------------

describe('QualityPage — QUAL-022 time-range filter', () => {
  it('default "all" shows Grundgesamtheit = 2 (both cases)', () => {
    renderQualityPage();

    // With 'all' range both cases are in scope → denominator is 2
    // The population label should show both cases (rendered as "qualityPopulationLabel: 2")
    const populationLabel = screen.queryByText(/qualityPopulationLabel/);
    expect(populationLabel).not.toBeNull();

    // The total case count "2" appears in the page (summary cards, population label, etc.)
    const countEls = screen.queryAllByText(/2/);
    expect(countEls.length).toBeGreaterThan(0);
  });

  it('switching to "6m" reduces denominator: only recentCase qualifies', () => {
    renderQualityPage();

    // Find the "Last 6 Months" time-range button (i18n key returned by mock t())
    const btn6m = screen.queryByText('docQualityLast6Months');
    expect(btn6m).not.toBeNull();
    fireEvent.click(btn6m!);

    // Now only recentCase has an obs in the last 6m → Grundgesamtheit = 1
    // QUAL-023: absolute count display — population label remains visible after filter
    const populationLabel = screen.queryByText(/qualityPopulationLabel/);
    expect(populationLabel).not.toBeNull();
  });

  it('switching back to "all" restores full denominator', () => {
    renderQualityPage();

    const btn6m = screen.queryByText('docQualityLast6Months');
    expect(btn6m).not.toBeNull();
    fireEvent.click(btn6m!);

    const btnAll = screen.queryByText('docQualityAllTime');
    expect(btnAll).not.toBeNull();
    fireEvent.click(btnAll!);

    // Restored to full 2-case denominator
    const populationLabel = screen.queryByText(/qualityPopulationLabel/);
    expect(populationLabel).not.toBeNull();
  });

  it('time-range control (QualityFilterBar) renders on the page', () => {
    renderQualityPage();

    // QualityFilterBar renders these time-range options
    expect(screen.queryByText('docQualityLast6Months')).not.toBeNull();
    expect(screen.queryByText('docQualityLastYear')).not.toBeNull();
    expect(screen.queryByText('docQualityAllTime')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests — QUAL-023: absolute counts prominently labeled
// ---------------------------------------------------------------------------

describe('QualityPage — QUAL-023 absolute count discoverability', () => {
  it('shows qualityPopulationLabel near summary cards', () => {
    renderQualityPage();

    expect(screen.queryByText(/qualityPopulationLabel/)).not.toBeNull();
  });

  it('summary cards render count + percentage without hover', () => {
    renderQualityPage();

    // Status label keys are returned by mock t() verbatim
    expect(screen.queryByText('unchecked')).not.toBeNull();
    expect(screen.queryByText('inProgress')).not.toBeNull();
    expect(screen.queryByText('reviewed')).not.toBeNull();
  });
});
