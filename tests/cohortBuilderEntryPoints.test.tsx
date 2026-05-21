// @vitest-environment jsdom
/**
 * D-02: CohortBuilderPage entry points for OutcomesPage navigation.
 * Tests: header filter button and per-row saved-search button.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { t } from '../src/i18n/translations';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../src/services/authHeaders', () => ({
  authFetch: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
  getAuthHeaders: vi.fn().mockReturnValue({}),
}));

vi.mock('../src/context/DataContext', () => ({
  useData: vi.fn(),
}));

vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: vi.fn(),
}));

import { useData } from '../src/context/DataContext';
import { useLanguage } from '../src/context/LanguageContext';
import CohortBuilderPage from '../src/pages/CohortBuilderPage';
import type { PatientCase, SavedSearch } from '../src/types/fhir';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Spy on the location when /analysis is reached (where trajectories now live) */
function SpyLocation({ onMatch }: { onMatch: (loc: ReturnType<typeof useLocation>) => void }) {
  const loc = useLocation();
  useEffect(() => {
    if (loc.pathname === '/analysis') onMatch(loc);
  });
  return <div data-testid="outcomes-page" />;
}

function makeSearch(id: string, name: string): SavedSearch {
  return {
    id,
    name,
    createdAt: new Date().toISOString(),
    filters: {},
  };
}

/** Default mock returns */
const defaultDataMock = {
  activeCases: [] as PatientCase[],
  centers: [],
  savedSearches: [] as SavedSearch[],
  addSavedSearch: vi.fn(),
  removeSavedSearch: vi.fn(),
  qualityFlags: [],
  excludedCases: [],
  reviewedCases: [],
  loading: false,
  error: null,
  bundles: [],
  cases: [],
};

function setupMocks(overrides: Partial<typeof defaultDataMock> = {}) {
  (useData as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    ...defaultDataMock,
    ...overrides,
  });
  (useLanguage as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    locale: 'en',
    setLocale: vi.fn(),
    t: (key: string) => t(key as any, 'en'),
  });
}

function renderWithRouter(onMatch: (loc: ReturnType<typeof useLocation>) => void) {
  return render(
    <MemoryRouter initialEntries={['/cohort']}>
      <Routes>
        <Route path="/cohort" element={<CohortBuilderPage />} />
        <Route path="/analysis" element={<SpyLocation onMatch={onMatch} />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Wave 0 RED: subcohort save validation (SC1, SC5)
//
// These tests are INTENTIONALLY RED until Plan 02 wires validation +
// the Split button into CohortBuilderPage. They define the contract per
// 31-VALIDATION.md §"Wave 0 Requirements".
// ---------------------------------------------------------------------------

describe('subcohort save validation (SC1, SC5)', () => {
  /** Helper: open the saved searches panel by clicking the "(N)" toggle */
  function openSavedPanel(count = 0) {
    // The saved-searches toggle shows the count in parentheses, e.g. "(1)"
    if (count > 0) {
      const toggle = screen.getByText((_content, el) => {
        return el?.tagName === 'BUTTON' && (el.textContent ?? '').includes(`(${count})`);
      });
      fireEvent.click(toggle);
    }
  }

  /** Helper: type a value into the save-name input */
  function typeInNameInput(value: string) {
    // The name input has placeholder matching t('searchNamePlaceholder','en')
    const input = screen.getByPlaceholderText(
      t('searchNamePlaceholder', 'en'),
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value } });
    return input;
  }

  it('SC1 (too many colons): shows cohortNameTooManyColons error and disables Save cohort button', () => {
    setupMocks({ savedSearches: [] });
    renderWithRouter(() => {});

    typeInNameInput('Parent:Sub:Extra');

    // Hard error message must appear
    expect(
      screen.queryByText(t('cohortNameTooManyColons', 'en')),
    ).not.toBeNull();

    // Save cohort button must be disabled
    const saveBtn = screen.queryByText(t('cohortSaveSearch', 'en'))
      ?.closest('button') as HTMLButtonElement | null;
    expect(saveBtn).not.toBeNull();
    expect(saveBtn!.disabled).toBe(true);
  });

  it('SC1 (empty parent): shows cohortNameEmptyParent error and disables Save cohort button', () => {
    setupMocks({ savedSearches: [] });
    renderWithRouter(() => {});

    typeInNameInput(':Sub');

    expect(
      screen.queryByText(t('cohortNameEmptyParent', 'en')),
    ).not.toBeNull();

    const saveBtn = screen.queryByText(t('cohortSaveSearch', 'en'))
      ?.closest('button') as HTMLButtonElement | null;
    expect(saveBtn).not.toBeNull();
    expect(saveBtn!.disabled).toBe(true);
  });

  it('SC1 (empty sub): shows cohortNameEmptySub error and disables Save cohort button', () => {
    setupMocks({ savedSearches: [] });
    renderWithRouter(() => {});

    typeInNameInput('Parent:');

    expect(
      screen.queryByText(t('cohortNameEmptySub', 'en')),
    ).not.toBeNull();

    const saveBtn = screen.queryByText(t('cohortSaveSearch', 'en'))
      ?.closest('button') as HTMLButtonElement | null;
    expect(saveBtn).not.toBeNull();
    expect(saveBtn!.disabled).toBe(true);
  });

  it('SC1 (duplicate name): shows cohortNameDuplicate error and disables Save cohort button', () => {
    const existing = makeSearch('existing-1', 'C1:Male');
    setupMocks({ savedSearches: [existing] });
    renderWithRouter(() => {});

    // Type the same name (normalized duplicate)
    typeInNameInput('C1:Male');

    expect(
      screen.queryByText(t('cohortNameDuplicate', 'en')),
    ).not.toBeNull();

    const saveBtn = screen.queryByText(t('cohortSaveSearch', 'en'))
      ?.closest('button') as HTMLButtonElement | null;
    expect(saveBtn).not.toBeNull();
    expect(saveBtn!.disabled).toBe(true);
  });

  it('SC5 (orphan warning): shows cohortNameOrphanWarning but Save cohort button stays ENABLED', () => {
    // No existing savedSearch named "Ghost"
    setupMocks({ savedSearches: [] });
    renderWithRouter(() => {});

    typeInNameInput('Ghost:Sub');

    expect(
      screen.queryByText(t('cohortNameOrphanWarning', 'en')),
    ).not.toBeNull();

    // Save button must remain enabled (soft warning, not a hard error)
    const saveBtn = screen.queryByText(t('cohortSaveSearch', 'en'))
      ?.closest('button') as HTMLButtonElement | null;
    expect(saveBtn).not.toBeNull();
    expect(saveBtn!.disabled).toBe(false);
  });

  it('SC5 (Split pre-fill): clicking Split button pre-fills name input with "ParentName:"', async () => {
    const saved = makeSearch('s1', 'Cohort1');
    setupMocks({ savedSearches: [saved] });
    renderWithRouter(() => {});

    // Open the saved searches panel (1 item)
    openSavedPanel(1);

    // Find the Split button by its aria-label
    const splitBtn = screen.queryByTitle(t('cohortSplitIntoSubcohort', 'en'))
      ?? screen.queryByLabelText(t('cohortSplitIntoSubcohort', 'en'));
    expect(splitBtn).not.toBeNull();
    fireEvent.click(splitBtn!);

    // The name input should now have "Cohort1:"
    const nameInput = screen.getByPlaceholderText(
      t('searchNamePlaceholder', 'en'),
    ) as HTMLInputElement;
    expect(nameInput.value).toBe('Cohort1:');
  });
});

describe('CohortBuilderPage entry points (D-02)', () => {
  it('per-row LineChart button navigates to /analysis?tab=trajectories&cohort=<id>', async () => {
    const savedSearch = makeSearch('search-abc-123', 'Test Cohort');
    setupMocks({ activeCases: [], savedSearches: [savedSearch] });

    let capturedLoc: ReturnType<typeof useLocation> | null = null;
    renderWithRouter((loc) => { capturedLoc = loc; });

    // Open saved searches panel — find the button that contains the count "(1)"
    const savedSearchesToggle = screen.getByText((_content, element) => {
      return element?.tagName === 'BUTTON' && (element.textContent ?? '').includes('(1)');
    });
    fireEvent.click(savedSearchesToggle);

    // "Test Cohort" name should now be visible in the panel
    expect(screen.getByText('Test Cohort')).toBeDefined();

    // The per-row outcomes button should now be visible
    const outcomesBtn = screen.getByTitle(t('outcomesOpenForCohort', 'en'));
    expect(outcomesBtn).toBeDefined();
    fireEvent.click(outcomesBtn);

    await waitFor(() => {
      expect(screen.getByTestId('outcomes-page')).toBeDefined();
    });
    expect(capturedLoc).not.toBeNull();
    expect(capturedLoc!.pathname).toBe('/analysis');
    expect(capturedLoc!.search).toContain('tab=trajectories');
    expect(capturedLoc!.search).toContain('cohort=');
    expect(capturedLoc!.search).toContain('search-abc-123');
  });
});
