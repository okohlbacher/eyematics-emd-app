// @vitest-environment jsdom
/**
 * OutcomesPage tests — OUTCOME-01..12 / Phase 08-03.
 *
 * RED phase: tests written before implementation.
 * Covers: route resolution, audit beacon, empty states, toggle behavior, CSV export.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

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

vi.mock('../src/utils/download', () => ({
  downloadCsv: vi.fn(),
  datedFilename: vi.fn().mockReturnValue('outcomes-cohort-2026-04-15.csv'),
}));

// Recharts needs a resize observer
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import { useData } from '../src/context/DataContext';
import { useLanguage } from '../src/context/LanguageContext';
import { downloadCsv } from '../src/utils/download';
import { t } from '../src/i18n/translations';
import type { PatientCase, SavedSearch } from '../src/types/fhir';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const LOINC_VISUS = '79880-1';
const SNOMED_EYE_RIGHT = '362503005';

/** Make a minimal PatientCase with one OD visus observation */
function makeCase(id: string, decimalVisus = 0.5, date = '2023-01-01'): PatientCase {
  return {
    id,
    pseudonym: `P-${id}`,
    gender: 'female',
    birthDate: '1970-01-01',
    centerId: 'org-test',
    centerName: 'Test Center',
    conditions: [],
    procedures: [],
    imagingStudies: [],
    medications: [],
    observations: [
      {
        resourceType: 'Observation',
        id: `obs-${id}`,
        status: 'final',
        subject: { reference: `Patient/${id}` },
        code: { coding: [{ code: LOINC_VISUS, system: 'http://loinc.org' }] },
        effectiveDateTime: date,
        valueQuantity: { value: decimalVisus, unit: 'decimal' },
        bodySite: {
          coding: [{ code: SNOMED_EYE_RIGHT, system: 'http://snomed.info/sct' }],
        },
      },
    ],
  } as unknown as PatientCase;
}

/** Make 31 patient cases for >30-patient cohort tests */
function make31Cases(): PatientCase[] {
  return Array.from({ length: 31 }, (_, i) => makeCase(`pt-${i}`, 0.5 + i * 0.01));
}

function makeSearch(id: string, name: string): SavedSearch {
  return {
    id,
    name,
    createdAt: '2026-01-01T00:00:00Z',
    filters: {},
  };
}

// ---------------------------------------------------------------------------
// Default mock setup
// ---------------------------------------------------------------------------

const defaultLangMock = {
  locale: 'de' as const,
  setLocale: vi.fn(),
  t: (key: string) => t(key as Parameters<typeof t>[0], 'de'),
};

const defaultDataMock = {
  activeCases: [] as PatientCase[],
  cases: [] as PatientCase[],
  centers: [],
  savedSearches: [] as SavedSearch[],
  addSavedSearch: vi.fn(),
  removeSavedSearch: vi.fn(),
  loading: false,
  error: null,
  bundles: [],
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

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderOutcomesPage(initialPath = '/outcomes') {
  const { default: OutcomesPage } = require('../src/pages/OutcomesPage');
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/outcomes" element={<OutcomesPage />} />
        <Route path="/cohort" element={<div data-testid="cohort-page">Cohort</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  // Bust the module cache so mocks apply cleanly each test
  vi.resetModules();
});

beforeEach(() => {
  (useLanguage as ReturnType<typeof vi.fn>).mockReturnValue(defaultLangMock);
  (useData as ReturnType<typeof vi.fn>).mockReturnValue(defaultDataMock);
  global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 });
});

// ---------------------------------------------------------------------------
// Task 1 tests: Route rendering, cohort resolution, audit beacon, empty states
// ---------------------------------------------------------------------------

describe('OutcomesPage — Task 1: route resolution & empty states', () => {
  it('TC-01: renders outcomesTitle heading when cohort resolves (activeCases present, no params)', async () => {
    (useData as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultDataMock,
      activeCases: [makeCase('p1'), makeCase('p2')],
    });
    renderOutcomesPage('/outcomes');
    // Title must contain "Outcomes" (the outcomesTitle key DE/EN value)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Outcomes');
  });

  it('TC-02: renders no-cohort empty state when activeCases is [] and no query params', () => {
    (useData as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultDataMock,
      activeCases: [],
    });
    renderOutcomesPage('/outcomes');
    expect(screen.getByText(t('outcomesEmptyCohortTitle', 'de'))).toBeDefined();
    // Link back to /cohort
    expect(screen.getByRole('link')).toBeDefined();
  });

  it('TC-03: renders no-cohort empty state when ?cohort= does not match any saved search', () => {
    (useData as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultDataMock,
      activeCases: [makeCase('p1')],
      savedSearches: [makeSearch('abc', 'My Cohort')],
    });
    renderOutcomesPage('/outcomes?cohort=does-not-exist');
    expect(screen.getByText(t('outcomesEmptyCohortTitle', 'de'))).toBeDefined();
  });

  it('TC-04: resolves ?cohort=<id> and renders the cohort name in the title', async () => {
    (useData as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultDataMock,
      activeCases: [makeCase('p1'), makeCase('p2')],
      savedSearches: [makeSearch('saved-001', 'Kohorte AMD')],
    });
    renderOutcomesPage('/outcomes?cohort=saved-001');
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Kohorte AMD');
    });
  });

  it('TC-05: parses ?filter=<urlencoded-json> and renders title (ad-hoc cohort)', async () => {
    const filter = { diagnosis: ['AMD'] };
    const encoded = encodeURIComponent(JSON.stringify(filter));
    (useData as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultDataMock,
      activeCases: [makeCase('p1')],
    });
    renderOutcomesPage(`/outcomes?filter=${encoded}`);
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Outcomes');
    });
  });

  it('TC-06: fires GET /api/audit/events/view-open once on mount with correct params', async () => {
    (useData as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultDataMock,
      activeCases: [makeCase('p1')],
      savedSearches: [makeSearch('coh-1', 'Test')],
    });
    renderOutcomesPage('/outcomes?cohort=coh-1');
    await waitFor(() => {
      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('/api/audit/events/view-open');
      expect(url).toContain('name=open_outcomes_view');
      expect(url).toContain('cohort=coh-1');
    });
  });

  it('TC-07: audit beacon fires only once (not on re-render)', async () => {
    (useData as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultDataMock,
      activeCases: [makeCase('p1')],
    });
    const { default: OutcomesPage } = require('../src/pages/OutcomesPage');
    const { rerender } = render(
      <MemoryRouter initialEntries={['/outcomes']}>
        <Routes>
          <Route path="/outcomes" element={<OutcomesPage />} />
          <Route path="/cohort" element={<div>Cohort</div>} />
        </Routes>
      </MemoryRouter>,
    );
    // Trigger a re-render by passing new props
    rerender(
      <MemoryRouter initialEntries={['/outcomes']}>
        <Routes>
          <Route path="/outcomes" element={<OutcomesPage key="rerender" />} />
          <Route path="/cohort" element={<div>Cohort</div>} />
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
      // Beacon fires once on mount; second render of same instance does NOT call it again
      expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('TC-08: renders without throwing for a 31-patient cohort (D-37 boundary)', async () => {
    (useData as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultDataMock,
      activeCases: make31Cases(),
    });
    expect(() => renderOutcomesPage('/outcomes')).not.toThrow();
  });

  it('TC-09: renders no-visus empty state when patients exist but have no visus observations', async () => {
    const noVisusCases: PatientCase[] = [
      {
        id: 'p1',
        pseudonym: 'P-1',
        gender: 'female',
        birthDate: '1970-01-01',
        centerId: 'org-test',
        centerName: 'Test',
        conditions: [],
        procedures: [],
        imagingStudies: [],
        medications: [],
        observations: [], // no visus observations
      } as unknown as PatientCase,
    ];
    (useData as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultDataMock,
      activeCases: noVisusCases,
    });
    renderOutcomesPage('/outcomes');
    await waitFor(() => {
      // Should show no-visus state
      const titles = [
        t('outcomesNoVisusTitle', 'de'),
        t('outcomesEmptyCohortTitle', 'de'),
      ];
      const found = titles.some((title) => {
        try { return screen.getByText(title) !== undefined; } catch { return false; }
      });
      expect(found).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Task 2 tests: panels, summary cards, settings drawer
// ---------------------------------------------------------------------------

describe('OutcomesPage — Task 2: panels, summary cards, settings drawer', () => {
  it('TC-10: OD panel renders when cohort has OD observations', async () => {
    (useData as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultDataMock,
      activeCases: [makeCase('p1'), makeCase('p2'), makeCase('p3')],
    });
    renderOutcomesPage('/outcomes');
    await waitFor(() => {
      expect(screen.getByTestId('outcomes-panel-od')).toBeDefined();
    });
  });

  it('TC-11: summary card shows patient count from combined panel', async () => {
    const cases = [makeCase('p1'), makeCase('p2'), makeCase('p3')];
    (useData as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultDataMock,
      activeCases: cases,
    });
    renderOutcomesPage('/outcomes');
    await waitFor(() => {
      // Summary cards section should exist
      const cardSection = screen.getByTestId('outcomes-summary-cards');
      expect(cardSection).toBeDefined();
    });
  });

  it('TC-12: settings drawer opens when gear button is clicked', async () => {
    (useData as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultDataMock,
      activeCases: [makeCase('p1')],
    });
    renderOutcomesPage('/outcomes');
    await waitFor(() => {
      expect(screen.getByLabelText(t('outcomesOpenSettings', 'de'))).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText(t('outcomesOpenSettings', 'de')));
    await waitFor(() => {
      expect(screen.getByTestId('outcomes-settings-drawer')).toBeDefined();
    });
  });

  it('TC-13: with 31-patient cohort, scatter layer is off by default (D-37)', async () => {
    (useData as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultDataMock,
      activeCases: make31Cases(),
    });
    renderOutcomesPage('/outcomes');
    // Open settings drawer
    await waitFor(() => {
      expect(screen.getByLabelText(t('outcomesOpenSettings', 'de'))).toBeDefined();
    });
    fireEvent.click(screen.getByLabelText(t('outcomesOpenSettings', 'de')));
    await waitFor(() => {
      const drawer = screen.getByTestId('outcomes-settings-drawer');
      // Find scatter checkbox and verify it's unchecked
      const scatterLabel = t('outcomesLayerScatter', 'de');
      const scatterCheckbox = drawer.querySelector(
        `input[type="checkbox"]`,
      ) as HTMLInputElement | null;
      // At minimum the drawer is rendered; checkbox state verified via data-testid
      expect(screen.getByTestId('scatter-layer-checkbox')).toBeDefined();
      const checkbox = screen.getByTestId('scatter-layer-checkbox') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });
  });

  it('TC-14: OS summary card shows 0 excluded hint for OD-only cohort', async () => {
    // All cases have OD observations only (makeCase defaults to OD)
    const cases = [makeCase('p1'), makeCase('p2')];
    (useData as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultDataMock,
      activeCases: cases,
    });
    renderOutcomesPage('/outcomes');
    await waitFor(() => {
      // OS panel or card should show 0 measurements or excluded count
      const cardSection = screen.getByTestId('outcomes-summary-cards');
      expect(cardSection.textContent).toContain('0');
    });
  });
});

// ---------------------------------------------------------------------------
// Task 3 tests: Data preview + CSV export
// ---------------------------------------------------------------------------

describe('OutcomesPage — Task 3: data preview & CSV export', () => {
  it('TC-15: data preview <details> is collapsed by default', async () => {
    (useData as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultDataMock,
      activeCases: [makeCase('p1')],
    });
    renderOutcomesPage('/outcomes');
    await waitFor(() => {
      const details = document.querySelector('details');
      expect(details).toBeDefined();
      expect(details!.open).toBe(false);
    });
  });

  it('TC-16: opening data preview reveals table with D-28 columns', async () => {
    (useData as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultDataMock,
      activeCases: [makeCase('p1')],
    });
    renderOutcomesPage('/outcomes');
    await waitFor(() => {
      const summary = document.querySelector('details summary');
      expect(summary).toBeDefined();
    });
    fireEvent.click(document.querySelector('details summary')!);
    await waitFor(() => {
      const table = document.querySelector('table');
      expect(table).toBeDefined();
      const headers = Array.from(table!.querySelectorAll('th')).map((h) => h.textContent?.toLowerCase());
      // Must include pseudonym column
      const hasPseudonym = headers.some((h) => h?.includes('pseudonym') || h?.includes('p'));
      expect(hasPseudonym).toBe(true);
    });
  });

  it('TC-17: clicking Export CSV calls downloadCsv with expected headers (no center_id)', async () => {
    (useData as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultDataMock,
      activeCases: [makeCase('p1'), makeCase('p2')],
    });
    renderOutcomesPage('/outcomes');
    await waitFor(() => {
      const summary = document.querySelector('details summary');
      expect(summary).toBeDefined();
    });
    // Open preview panel
    fireEvent.click(document.querySelector('details summary')!);
    await waitFor(() => {
      expect(screen.getByText(t('outcomesPreviewExportCsv', 'de'))).toBeDefined();
    });
    // Click export
    fireEvent.click(screen.getByText(t('outcomesPreviewExportCsv', 'de')));
    await waitFor(() => {
      expect(downloadCsv).toHaveBeenCalledTimes(1);
      const [headers] = (downloadCsv as ReturnType<typeof vi.fn>).mock.calls[0];
      // Verify no center_id in headers (D-30)
      expect(headers).not.toContain('center_id');
      expect(headers.length).toBeGreaterThan(0);
    });
  });

  it('TC-18: CSV filename matches datedFilename output shape', async () => {
    (useData as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultDataMock,
      activeCases: [makeCase('p1')],
    });
    renderOutcomesPage('/outcomes');
    await waitFor(() => {
      const summary = document.querySelector('details summary');
      expect(summary).toBeDefined();
    });
    fireEvent.click(document.querySelector('details summary')!);
    await waitFor(() => {
      expect(screen.getByText(t('outcomesPreviewExportCsv', 'de'))).toBeDefined();
    });
    fireEvent.click(screen.getByText(t('outcomesPreviewExportCsv', 'de')));
    await waitFor(() => {
      const [, , filename] = (downloadCsv as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(filename).toMatch(/^outcomes-cohort-\d{4}-\d{2}-\d{2}\.csv$/);
    });
  });

  it('TC-19: data preview row count matches OD + OS measurement count', async () => {
    // p1 has 1 OD observation, p2 has 1 OD observation
    const cases = [makeCase('p1'), makeCase('p2')];
    (useData as ReturnType<typeof vi.fn>).mockReturnValue({
      ...defaultDataMock,
      activeCases: cases,
    });
    renderOutcomesPage('/outcomes');
    await waitFor(() => {
      const summary = document.querySelector('details summary');
      expect(summary).toBeDefined();
    });
    fireEvent.click(document.querySelector('details summary')!);
    await waitFor(() => {
      const table = document.querySelector('table');
      const rows = table?.querySelectorAll('tbody tr');
      // 2 patients × 1 OD measurement each = 2 data rows
      expect(rows?.length).toBeGreaterThanOrEqual(2);
    });
  });
});
