// @vitest-environment jsdom
/**
 * QUAL-020: QualityPage cohort scope + qualityParams gating behavior tests.
 *
 * Assertions:
 * (a) A cohort with qualityParams=['missingVisus'] → only the missing-Visus anomaly shows;
 *     CRT-critical and visus-jump anomaly reasons are absent.
 * (b) A cohort with qualityParams=undefined → all applicable anomaly checks run (fallback).
 * (c) Cohort scope restricts the visible case list to cohort members.
 * (d) "All cases" restores the unscoped global behavior.
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

// Settings mock: ensure critical-CRT threshold fires for our test case.
// criticalCrtUm=200 so a 500 µm CRT obs trips the threshold.
// criticalVisus=0.5 so a 0.1 visus obs trips the threshold.
// visusJump=0.1 so the 0→0.9 jump in our fixture trips the jump check.
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
        criticalCrtUm: 200,   // any CRT > 200 is critical
        criticalVisus: 0.5,   // any Visus < 0.5 is critical
        visusJump: 0.1,       // any jump > 0.1 is flagged
      },
    }),
  };
});

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

// LOINC codes matching the app's constants (shared/fhirCodes.ts)
const LOINC_CRT = 'LP267955-5';

// A case designed to trip multiple anomaly branches simultaneously:
//   - has NO Visus obs → missingVisus fires
//   - has a CRT obs > criticalCrtUm (500 > 200) → crtCritical fires
//   - has NO CRT obs missing (missingCrt does NOT fire — CRT IS present)
//   - has NO IVOM procedures → missingInjections fires
// This lets us assert that qualityParams=['missingVisus'] suppresses crtCritical and
// missingInjections while allowing missingVisus to show.
const multiAnomalyCase: PatientCase = {
  id: 'case-multi',
  pseudonym: 'MULTI-ANOMALY',
  gender: 'male',
  birthDate: '1960-01-01',
  centerId: 'CENTER-A',
  centerName: 'Center A',
  conditions: [],
  observations: [
    // CRT: critical (500 > 200 threshold)
    {
      id: 'obs-crt',
      code: { coding: [{ system: 'http://loinc.org', code: LOINC_CRT, display: 'CRT' }] },
      valueQuantity: { value: 500, unit: 'um' },
      effectiveDateTime: '2024-01-01T00:00:00Z',
    },
    // No Visus observations → missingVisus fires
  ],
  medications: [],
  procedures: [], // no IVOM → missingInjections fires
  imagingStudies: [],
};

// A second case that is NOT in the cohort (used for scope restriction assertions)
const outsiderCase: PatientCase = {
  id: 'case-outsider',
  pseudonym: 'OUTSIDER',
  gender: 'female',
  birthDate: '1970-01-01',
  centerId: 'CENTER-B',
  centerName: 'Center B',
  conditions: [],
  observations: [],
  medications: [],
  procedures: [],
  imagingStudies: [],
};

// Saved searches:
// - cohort-vis-only: filters select multiAnomalyCase (center CENTER-A); qualityParams=['missingVisus']
// - cohort-no-params: filters select multiAnomalyCase; qualityParams=undefined (all checks fallback)
const savedSearches = [
  {
    id: 'cohort-vis-only',
    name: 'Visus Only Cohort',
    filters: { centers: ['CENTER-A'] },
    qualityParams: ['missingVisus'],
  },
  {
    id: 'cohort-no-params',
    name: 'No Params Cohort',
    filters: { centers: ['CENTER-A'] },
    qualityParams: undefined,
  },
];

// C2: stable spy so the edit-persist test can assert what QualityPage forwarded.
const updateSavedSearchQualityParamsSpy = vi.fn();

// DataContext mock factory
function makeDataMock() {
  return {
    activeCases: [],
    centers: [],
    cases: [multiAnomalyCase, outsiderCase],
    loading: false,
    error: null,
    bundles: [],
    savedSearches,
    addSavedSearch: vi.fn(),
    updateSavedSearchQualityParams: updateSavedSearchQualityParamsSpy,
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

import QualityCaseDetail from '../src/components/quality/QualityCaseDetail';
import QualityPage from '../src/pages/QualityPage';

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderQualityPage(path = '/quality') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QualityPage />
    </MemoryRouter>,
  );
}

function renderCaseDetail(activeQualityParams?: string[]) {
  return render(
    <QualityCaseDetail
      selectedCase={multiAnomalyCase}
      caseFlags={[]}
      therapyStatus={undefined}
      isExcluded={false}
      isReviewed={false}
      dateFmt="en-GB"
      activeQualityParams={activeQualityParams}
      onMarkReviewed={vi.fn()}
      onExclude={vi.fn()}
      onNavigateToCase={vi.fn()}
      onOpenFlagDialog={vi.fn()}
      onConfirmRow={vi.fn()}
      onResetRow={vi.fn()}
    />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Helper: the anomaly reason is rendered as `(a.reason)` inside a <span> by the component.
// Since t() is mocked to return the key, we search for the reason key using regex (partial match).
function queryAnomalyReason(key: string) {
  return screen.queryByText(new RegExp(key));
}

describe('QualityCaseDetail — activeQualityParams gating', () => {
  it('(a) qualityParams=["missingVisus"] shows only the missingVisus anomaly reason', () => {
    renderCaseDetail(['missingVisus']);

    // missingVisus key is included → its i18n reason text appears in the anomaly span
    expect(queryAnomalyReason('missingVisus')).not.toBeNull();

    // crtCritical and visusJump keys not included → their reasons must be absent
    expect(queryAnomalyReason('crtAnomaly')).toBeNull();
    expect(queryAnomalyReason('visusAnomaly')).toBeNull();
    expect(queryAnomalyReason('visusJump')).toBeNull();
  });

  it('(a) qualityParams=["missingVisus"] also suppresses missingCrt and missingInjections', () => {
    renderCaseDetail(['missingVisus']);

    // CRT obs IS present → missingCrt wouldn't fire anyway, but injections ARE missing.
    // missingInjections key not in ['missingVisus'] → must be suppressed.
    expect(queryAnomalyReason('missingInjections')).toBeNull();
    expect(queryAnomalyReason('missingCrt')).toBeNull();
  });

  it('(b) qualityParams=undefined → all applicable anomaly checks run (fallback)', () => {
    // multiAnomalyCase has CRT obs but no Visus obs and no IVOM:
    //   - missingVisus fires (no Visus)
    //   - crtCritical fires (CRT 500 > 200 threshold)
    //   - missingInjections fires (no IVOM)
    // missingCrt does NOT fire (CRT obs IS present); visusCritical/visusJump do NOT fire (no Visus)
    renderCaseDetail(undefined);

    expect(queryAnomalyReason('missingVisus')).not.toBeNull();
    expect(queryAnomalyReason('crtAnomaly')).not.toBeNull();
    expect(queryAnomalyReason('missingInjections')).not.toBeNull();
  });

  it('(b) qualityParams=[] suppresses all checks (explicit empty selection)', () => {
    renderCaseDetail([]);

    // No checks should run at all
    expect(queryAnomalyReason('missingVisus')).toBeNull();
    expect(queryAnomalyReason('missingCrt')).toBeNull();
    expect(queryAnomalyReason('missingInjections')).toBeNull();
    expect(queryAnomalyReason('crtAnomaly')).toBeNull();
    expect(queryAnomalyReason('visusAnomaly')).toBeNull();
    expect(queryAnomalyReason('visusJump')).toBeNull();
  });

  it('qualityParams=["crtCritical","missingVisus"] shows only those two checks', () => {
    // crtCritical fires (CRT 500 > 200 threshold); missingVisus fires (no Visus obs).
    // missingInjections is suppressed (not in the key set).
    renderCaseDetail(['crtCritical', 'missingVisus']);

    expect(queryAnomalyReason('crtAnomaly')).not.toBeNull();
    expect(queryAnomalyReason('missingVisus')).not.toBeNull();

    // Other checks suppressed
    expect(queryAnomalyReason('missingCrt')).toBeNull();
    expect(queryAnomalyReason('missingInjections')).toBeNull();
    expect(queryAnomalyReason('visusAnomaly')).toBeNull();
    expect(queryAnomalyReason('visusJump')).toBeNull();
  });
});

describe('QualityPage — cohort scope restricts case list', () => {
  it('(d) "All cases" scope shows both cases in the list', () => {
    renderQualityPage();

    // Both cases should appear in the list
    expect(screen.queryByText('MULTI-ANOMALY')).not.toBeNull();
    expect(screen.queryByText('OUTSIDER')).not.toBeNull();
  });

  it('(c) Selecting a cohort filtered to CENTER-A shows only MULTI-ANOMALY, hides OUTSIDER', () => {
    renderQualityPage();

    // The cohort selector is on the page; find it by its current value ('all')
    const selects = screen.queryAllByRole('combobox');
    // The cohort scope select is the first select (before the filter panel selects)
    const cohortSelect = selects[0] as HTMLSelectElement;
    expect(cohortSelect).toBeTruthy();

    // Select the 'Visus Only Cohort' which filters to CENTER-A
    fireEvent.change(cohortSelect, { target: { value: 'cohort-vis-only' } });

    // MULTI-ANOMALY (CENTER-A) should be visible
    expect(screen.queryByText('MULTI-ANOMALY')).not.toBeNull();
    // OUTSIDER (CENTER-B) should be hidden
    expect(screen.queryByText('OUTSIDER')).toBeNull();
  });

  it('(c) Switching back to "All cases" restores both cases', () => {
    renderQualityPage();

    const selects = screen.queryAllByRole('combobox');
    const cohortSelect = selects[0] as HTMLSelectElement;

    // Scope to cohort first
    fireEvent.change(cohortSelect, { target: { value: 'cohort-vis-only' } });
    expect(screen.queryByText('OUTSIDER')).toBeNull();

    // Restore to 'all'
    fireEvent.change(cohortSelect, { target: { value: 'all' } });
    expect(screen.queryByText('MULTI-ANOMALY')).not.toBeNull();
    expect(screen.queryByText('OUTSIDER')).not.toBeNull();
  });

  it('cohort selector shows saved search names as options', () => {
    renderQualityPage();

    // Both saved search names should be available as options
    expect(screen.queryByText('Visus Only Cohort')).not.toBeNull();
    expect(screen.queryByText('No Params Cohort')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// C2 — quality-check checklist relocated to the Datenqualität tab (edit-in-place)
// (LanguageContext mock returns the i18n key as the label text)
// ---------------------------------------------------------------------------
describe('C2 — qualityParams checklist on QualityPage', () => {
  it('shows a select-a-cohort hint and no checkboxes in the "all cases" scope', () => {
    renderQualityPage();
    expect(screen.queryByText('qualityParamsSelectCohortHint')).not.toBeNull();
    expect(screen.queryByLabelText('missingVisus')).toBeNull();
  });

  it('renders the explanatory description label', () => {
    renderQualityPage();
    expect(screen.queryByText('qualityParamsDescription')).not.toBeNull();
  });

  it('reflects the SELECTED cohort\'s params (only missingVisus checked)', () => {
    renderQualityPage();
    const cohortSelect = screen.queryAllByRole('combobox')[0] as HTMLSelectElement;
    fireEvent.change(cohortSelect, { target: { value: 'cohort-vis-only' } });

    const visus = screen.getByLabelText('missingVisus') as HTMLInputElement;
    const crt = screen.getByLabelText('missingCrt') as HTMLInputElement;
    expect(visus.checked).toBe(true);
    expect(crt.checked).toBe(false);
  });

  it('toggling a check calls updateSavedSearchQualityParams with the canonical subset', () => {
    updateSavedSearchQualityParamsSpy.mockClear();
    renderQualityPage();
    const cohortSelect = screen.queryAllByRole('combobox')[0] as HTMLSelectElement;
    fireEvent.change(cohortSelect, { target: { value: 'cohort-vis-only' } });

    // Turn ON missingCrt → new selection is [missingVisus, missingCrt] (canonical order)
    fireEvent.click(screen.getByLabelText('missingCrt'));

    expect(updateSavedSearchQualityParamsSpy).toHaveBeenCalledWith(
      'cohort-vis-only',
      ['missingVisus', 'missingCrt'],
    );
  });
});
