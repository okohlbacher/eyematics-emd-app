// @vitest-environment jsdom
/**
 * tests/advancedFilterDialog.test.tsx — COH-04 advanced filter modal tests.
 *
 * Covers:
 *   - AdvancedFilterDialog render + field interactions (Task 1)
 *   - CohortBuilderPage preset button toggle, clear-on-manual-edit,
 *     and flaggedQuality Set-building (Task 2)
 *
 * No jest-dom. Assertions use queryByText().not.toBeNull() / .toBeNull() style.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { t } from '../src/i18n/translations';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: vi.fn(),
}));

vi.mock('../src/services/authHeaders', () => ({
  authFetch: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
  getAuthHeaders: vi.fn().mockReturnValue({}),
}));

vi.mock('../src/context/DataContext', () => ({
  useData: vi.fn(),
}));

vi.mock('../src/services/settingsService', () => ({
  getSettings: vi.fn().mockReturnValue({
    therapyInterrupterDays: 120,
    therapyBreakerDays: 365,
    crtImplausibleThresholdUm: 400,
  }),
  loadSettings: vi.fn().mockResolvedValue({
    therapyInterrupterDays: 120,
    therapyBreakerDays: 365,
    crtImplausibleThresholdUm: 400,
  }),
}));

import { useData } from '../src/context/DataContext';
import { useLanguage } from '../src/context/LanguageContext';
import AdvancedFilterDialog from '../src/pages/AdvancedFilterDialog';
import CohortBuilderPage from '../src/pages/CohortBuilderPage';
import type { CohortFilter, PatientCase, QualityFlag, SavedSearch } from '../src/types/fhir';

// ---------------------------------------------------------------------------
// Helper: set up language mock
// ---------------------------------------------------------------------------

function setupLanguageMock() {
  (useLanguage as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    locale: 'en',
    setLocale: vi.fn(),
    t: (key: string) => t(key as Parameters<typeof t>[0], 'en'),
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// AdvancedFilterDialog — Task 1
// ---------------------------------------------------------------------------

const MED_OPTIONS = [
  { code: 'S01LA05', label: 'Aflibercept' },
  { code: 'L01XC07', label: 'Bevacizumab' },
];

const EMPTY_FILTERS: CohortFilter = {};

describe('AdvancedFilterDialog', () => {
  beforeEach(() => {
    setupLanguageMock();
  });

  it('renders nothing when open=false', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    const { container } = render(
      <AdvancedFilterDialog
        open={false}
        filters={EMPTY_FILTERS}
        medicationOptions={MED_OPTIONS}
        onApply={onApply}
        onClose={onClose}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders advancedFiltersTitle when open=true', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <AdvancedFilterDialog
        open={true}
        filters={EMPTY_FILTERS}
        medicationOptions={MED_OPTIONS}
        onApply={onApply}
        onClose={onClose}
      />,
    );
    expect(screen.queryByText(t('advancedFiltersTitle', 'en'))).not.toBeNull();
  });

  it('renders one checkbox per medicationOptions entry', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <AdvancedFilterDialog
        open={true}
        filters={EMPTY_FILTERS}
        medicationOptions={MED_OPTIONS}
        onApply={onApply}
        onClose={onClose}
      />,
    );
    expect(screen.queryByText('Aflibercept')).not.toBeNull();
    expect(screen.queryByText('Bevacizumab')).not.toBeNull();
  });

  it('clicking Apply with hasComorbidity checked calls onApply with hasComorbidity=true', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <AdvancedFilterDialog
        open={true}
        filters={EMPTY_FILTERS}
        medicationOptions={MED_OPTIONS}
        onApply={onApply}
        onClose={onClose}
      />,
    );
    // Toggle the "Has comorbidities" checkbox
    const comorbiditiesLabel = t('advancedFiltersComorbiditiesAny', 'en');
    const checkbox = screen.getByLabelText(comorbiditiesLabel) as HTMLInputElement;
    fireEvent.click(checkbox);

    const applyBtn = screen.getByText(t('advancedFiltersApply', 'en'));
    fireEvent.click(applyBtn);

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ hasComorbidity: true }),
    );
  });

  it('clicking Apply with HbA1c min/max calls onApply with hba1cRange', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <AdvancedFilterDialog
        open={true}
        filters={EMPTY_FILTERS}
        medicationOptions={MED_OPTIONS}
        onApply={onApply}
        onClose={onClose}
      />,
    );
    const inputs = screen.getAllByPlaceholderText('Min');
    const hba1cMin = inputs[0] as HTMLInputElement;
    fireEvent.change(hba1cMin, { target: { value: '6' } });

    const maxInputs = screen.getAllByPlaceholderText('Max');
    const hba1cMax = maxInputs[0] as HTMLInputElement;
    fireEvent.change(hba1cMax, { target: { value: '9' } });

    const applyBtn = screen.getByText(t('advancedFiltersApply', 'en'));
    fireEvent.click(applyBtn);

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ hba1cRange: [6, 9] }),
    );
  });

  it('clicking Apply with a medication checkbox selected calls onApply with medicationCodes', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <AdvancedFilterDialog
        open={true}
        filters={EMPTY_FILTERS}
        medicationOptions={MED_OPTIONS}
        onApply={onApply}
        onClose={onClose}
      />,
    );
    // Check Aflibercept
    const checkbox = screen.getByLabelText('Aflibercept') as HTMLInputElement;
    fireEvent.click(checkbox);

    const applyBtn = screen.getByText(t('advancedFiltersApply', 'en'));
    fireEvent.click(applyBtn);

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ medicationCodes: ['S01LA05'] }),
    );
  });

  it('clicking Apply with laterality OD calls onApply with laterality=OD', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <AdvancedFilterDialog
        open={true}
        filters={EMPTY_FILTERS}
        medicationOptions={MED_OPTIONS}
        onApply={onApply}
        onClose={onClose}
      />,
    );
    const odRadio = screen.getByLabelText(t('advancedFiltersLateralityOD', 'en')) as HTMLInputElement;
    fireEvent.click(odRadio);

    const applyBtn = screen.getByText(t('advancedFiltersApply', 'en'));
    fireEvent.click(applyBtn);

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ laterality: 'OD' }),
    );
  });

  it('clicking Clear resets fields without closing (onApply/onClose not fired)', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <AdvancedFilterDialog
        open={true}
        filters={EMPTY_FILTERS}
        medicationOptions={MED_OPTIONS}
        onApply={onApply}
        onClose={onClose}
      />,
    );
    // Set comorbidity
    const checkbox = screen.getByLabelText(t('advancedFiltersComorbiditiesAny', 'en')) as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    // Click Clear
    const clearBtn = screen.getByText(t('advancedFiltersClear', 'en'));
    fireEvent.click(clearBtn);

    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    // Checkbox should now be unchecked
    expect(checkbox.checked).toBe(false);
  });

  it('clicking Discard calls onClose without onApply', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <AdvancedFilterDialog
        open={true}
        filters={EMPTY_FILTERS}
        medicationOptions={MED_OPTIONS}
        onApply={onApply}
        onClose={onClose}
      />,
    );
    const discardBtn = screen.getByText(t('advancedFiltersDiscard', 'en'));
    fireEvent.click(discardBtn);

    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('clicking the X close button calls onClose', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <AdvancedFilterDialog
        open={true}
        filters={EMPTY_FILTERS}
        medicationOptions={MED_OPTIONS}
        onApply={onApply}
        onClose={onClose}
      />,
    );
    const xBtn = screen.getByLabelText(t('advancedFiltersDiscard', 'en'));
    fireEvent.click(xBtn);

    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('pressing Escape calls onClose', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <AdvancedFilterDialog
        open={true}
        filters={EMPTY_FILTERS}
        medicationOptions={MED_OPTIONS}
        onApply={onApply}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// CohortBuilderPage — Task 2: preset toggle, clear-on-manual-edit, flaggedQuality
// ---------------------------------------------------------------------------

const makePatientCase = (id: string): PatientCase => ({
  id,
  pseudonym: id,
  gender: 'male',
  birthDate: '1960-01-01',
  centerId: 'CENTER-A',
  centerName: 'Test Center A',
  conditions: [],
  observations: [],
  procedures: [],
  imagingStudies: [],
  medications: [],
});

const defaultDataMock = {
  activeCases: [] as PatientCase[],
  centers: [],
  savedSearches: [] as SavedSearch[],
  addSavedSearch: vi.fn(),
  removeSavedSearch: vi.fn(),
  qualityFlags: [] as QualityFlag[],
  excludedCases: [],
  reviewedCases: [],
  loading: false,
  error: null,
  bundles: [],
  cases: [],
};

function setupDataMock(overrides: Partial<typeof defaultDataMock> = {}) {
  (useData as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    ...defaultDataMock,
    ...overrides,
  });
}

function renderCohortBuilder() {
  return render(
    <MemoryRouter initialEntries={['/cohort']}>
      <CohortBuilderPage />
    </MemoryRouter>,
  );
}

describe('CohortBuilderPage — preset buttons (Task 2)', () => {
  beforeEach(() => {
    setupLanguageMock();
    setupDataMock();
    // Clear any sessionStorage between tests
    try { sessionStorage.removeItem('emd-cohort-filters'); } catch { /* ignore */ }
  });

  it('renders all four preset buttons', () => {
    renderCohortBuilder();
    expect(screen.queryByText(t('presetTherapyBreaker', 'en'))).not.toBeNull();
    expect(screen.queryByText(t('presetImplausibleCrt', 'en'))).not.toBeNull();
    expect(screen.queryByText(t('presetFlaggedQuality', 'en'))).not.toBeNull();
    expect(screen.queryByText(t('presetImplausibleVisus', 'en'))).not.toBeNull();
  });

  it('clicking a preset sets aria-pressed=true on that button', () => {
    renderCohortBuilder();
    const btn = screen.getByText(t('presetTherapyBreaker', 'en')).closest('button');
    expect(btn?.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(btn!);
    expect(btn?.getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking the active preset again clears it (toggle off)', () => {
    renderCohortBuilder();
    const btn = screen.getByText(t('presetTherapyBreaker', 'en')).closest('button');
    fireEvent.click(btn!); // activate
    expect(btn?.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(btn!); // deactivate
    expect(btn?.getAttribute('aria-pressed')).toBe('false');
  });

  it('editing a manual filter field (diagnosis checkbox) clears the active preset', () => {
    renderCohortBuilder();
    // Activate a preset
    const presetBtn = screen.getByText(t('presetTherapyBreaker', 'en')).closest('button');
    fireEvent.click(presetBtn!);
    expect(presetBtn?.getAttribute('aria-pressed')).toBe('true');

    // Edit a manual filter — click a diagnosis checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    // First checkbox should be a diagnosis checkbox (AMD or DR)
    fireEvent.click(checkboxes[0]);

    // Preset should now be cleared
    expect(presetBtn?.getAttribute('aria-pressed')).toBe('false');
  });

  it('flaggedQuality preset builds flaggedCaseIds from open qualityFlags', () => {
    const caseA = makePatientCase('case-A');
    const caseB = makePatientCase('case-B');
    const caseC = makePatientCase('case-C');

    const flags: QualityFlag[] = [
      {
        caseId: 'case-A',
        parameter: 'CRT',
        errorType: 'Unplausibel',
        flaggedAt: '2024-01-01T00:00:00Z',
        flaggedBy: 'user1',
        status: 'open',
      },
      {
        caseId: 'case-B',
        parameter: 'Visus',
        errorType: 'Fehlend',
        flaggedAt: '2024-01-02T00:00:00Z',
        flaggedBy: 'user1',
        status: 'acknowledged', // NOT open — should not be included
      },
      {
        caseId: 'case-C',
        parameter: 'CRT',
        errorType: 'Unplausibel',
        flaggedAt: '2024-01-03T00:00:00Z',
        flaggedBy: 'user1',
        status: 'open',
      },
    ];

    setupDataMock({ activeCases: [caseA, caseB, caseC], qualityFlags: flags });
    renderCohortBuilder();

    // Click flaggedQuality preset
    const presetBtn = screen.getByText(t('presetFlaggedQuality', 'en')).closest('button');
    fireEvent.click(presetBtn!);

    // After clicking, the preset should be active
    expect(presetBtn?.getAttribute('aria-pressed')).toBe('true');

    // The result count should reflect only the 2 flagged-open cases (case-A and case-C)
    // With applyFilters using the flaggedCaseIds set:
    // case-A (open) + case-C (open) = 2 cases matching
    // We verify by checking the result count text showing 2 cases
    expect(screen.queryByText(/\b2\b/)).not.toBeNull();
  });
});
