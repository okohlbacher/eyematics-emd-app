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
