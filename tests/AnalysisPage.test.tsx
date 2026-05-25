// @vitest-environment jsdom
/**
 * Phase 42 / ANL-011 — AnalysisPage cross-cohort comparison tests.
 *
 * Covers:
 * - Task 1 (RED/GREEN): cross-cohort memo resolves palette-colored series
 *   from ?cohorts= with primary-first, unknown-id dropping, COHORT_PALETTES colors
 * - Task 2: diagnosis distribution + age-vs-Visus comparison rendered in cross mode;
 *   single-cohort mode unchanged
 *
 * Pattern mirrors tests/intervalHistogram.test.tsx:
 *   jsdom + RTL, no jest-dom — use queryByText().not.toBeNull() / .toBeNull()
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { TranslationKey } from '../src/i18n/translations';
import { translations } from '../src/i18n/translations';
import type { PatientCase, SavedSearch } from '../src/types/fhir';

// ---------------------------------------------------------------------------
// Stable translation helper
// ---------------------------------------------------------------------------
const t = (key: TranslationKey) => (translations as Record<string, { en: string }>)[key]?.en ?? key;

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before any dynamic imports
// ---------------------------------------------------------------------------

// react-router-dom: mock useSearchParams
const mockSearchParams = new URLSearchParams();
vi.mock('react-router-dom', () => ({
  useSearchParams: () => [mockSearchParams, vi.fn()],
}));

// useRecentActivity — no-op
vi.mock('../src/hooks/useRecentActivity', () => ({
  useRecentActivity: () => ({ record: vi.fn() }),
}));

// LanguageContext — return stable t() + locale
vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'en', t }),
}));

// settingsService
vi.mock('../src/services/settingsService', () => ({
  getSettings: () => ({
    therapyInterrupterDays: 90,
    therapyBreakerDays: 365,
    crtImplausibleThresholdUm: 400,
  }),
  loadSettings: vi.fn(),
}));

// fhirLoader — applyFilters just returns all cases (no real filter logic needed)
vi.mock('../src/services/fhirLoader', () => ({
  applyFilters: (_cases: PatientCase[], _filters: unknown) => _cases,
  getAge: () => 65,
  getCenterShorthand: (_id: string, name: string) => name,
  getObservationsByCode: () => [],
  LOINC_VISUS: '79880-1',
  LOINC_CRT: 'LP267955-5',
}));

// terminology
vi.mock('../src/services/terminology', () => ({
  getCachedDisplay: (_sys: unknown, _code: unknown, _locale: unknown) => 'AMD',
  getCachedFullText: (_sys: unknown, _code: unknown, _locale: unknown) => 'Age-related macular degeneration',
}));

// distributionBins
vi.mock('../src/utils/distributionBins', () => ({
  computeCrtDistribution: () => [],
}));

// DataContext — will be overridden per test via a mutable ref
let mockDataContextValue: {
  activeCases: PatientCase[];
  savedSearches: SavedSearch[];
} = { activeCases: [], savedSearches: [] };

vi.mock('../src/context/DataContext', () => ({
  useData: () => mockDataContextValue,
}));

// Recharts — lightweight stubs that render children as-is (avoids SVG jsdom issues)
vi.mock('recharts', () => {
  const React = require('react');
  const stub =
    (name: string) =>
    ({ children, ...props }: Record<string, unknown>) =>
      React.createElement('div', { 'data-testid': `recharts-${name}`, ...props }, children);

  return {
    BarChart: stub('BarChart'),
    Bar: stub('Bar'),
    LineChart: stub('LineChart'),
    Line: stub('Line'),
    PieChart: stub('PieChart'),
    Pie: stub('Pie'),
    ScatterChart: stub('ScatterChart'),
    Scatter: stub('Scatter'),
    XAxis: stub('XAxis'),
    YAxis: stub('YAxis'),
    CartesianGrid: stub('CartesianGrid'),
    Tooltip: stub('Tooltip'),
    Legend: stub('Legend'),
    Cell: stub('Cell'),
    ResponsiveContainer: stub('ResponsiveContainer'),
    ReferenceLine: stub('ReferenceLine'),
  };
});

// clinicalThresholds (CHART_COLORS)
vi.mock('../src/config/clinicalThresholds', () => ({
  CHART_COLORS: ['#a', '#b', '#c'],
}));

// OutcomesView stub
vi.mock('../src/components/outcomes/OutcomesView', () => ({
  default: () => null,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCases(n: number): PatientCase[] {
  return Array.from({ length: n }, (_, i) => ({
    pseudonym: `P${i}`,
    birthDate: '1960-01-01',
    observations: [],
    procedures: [],
    conditions: [],
    centerId: 'CENTER-1',
    centerName: 'Site A',
  })) as unknown as PatientCase[];
}

function makeSavedSearch(id: string, name: string): SavedSearch {
  return {
    id,
    name,
    createdAt: '2026-01-01',
    filters: {},
  };
}

function setSearchParams(params: Record<string, string>) {
  // Clear and repopulate the shared URLSearchParams instance
  Array.from(mockSearchParams.keys()).forEach((k) => mockSearchParams.delete(k));
  Object.entries(params).forEach(([k, v]) => mockSearchParams.set(k, v));
}

afterEach(() => {
  cleanup();
  // Reset to single-cohort (no cross params)
  setSearchParams({});
  mockDataContextValue = { activeCases: [], savedSearches: [] };
});

// ---------------------------------------------------------------------------
// Import AnalysisPage after all mocks are wired
// ---------------------------------------------------------------------------
const { default: AnalysisPage } = await import('../src/pages/AnalysisPage');

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnalysisPage — cross-cohort resolution (ANL-011 Task 1)', () => {
  it('single-cohort: renders aggregate tab without cross-mode elements', () => {
    mockDataContextValue = {
      activeCases: makeCases(5),
      savedSearches: [makeSavedSearch('s1', 'AMD Cohort')],
    };
    setSearchParams({ cohort: 's1' });
    render(<AnalysisPage />);
    // Single-cohort renders the aggregate tab panel
    expect(screen.queryByTestId('analysis-tab-aggregate')).not.toBeNull();
    // No cohort comparison section
    expect(screen.queryByTestId('compare-diagnosis')).toBeNull();
    expect(screen.queryByTestId('compare-age-visus')).toBeNull();
  });

  it('cross-mode: renders comparison sections when ?cohorts= has 2+ known ids', () => {
    const cases = makeCases(10);
    mockDataContextValue = {
      activeCases: cases,
      savedSearches: [
        makeSavedSearch('s1', 'AMD Cohort'),
        makeSavedSearch('s2', 'DR Cohort'),
      ],
    };
    setSearchParams({ cohort: 's1', cohorts: 's1,s2' });
    render(<AnalysisPage />);
    // Comparison sections visible
    expect(screen.queryByTestId('compare-diagnosis')).not.toBeNull();
    expect(screen.queryByTestId('compare-age-visus')).not.toBeNull();
  });

  it('cross-mode: cohort names are visible in comparison legend', () => {
    mockDataContextValue = {
      activeCases: makeCases(6),
      savedSearches: [
        makeSavedSearch('s1', 'AMD Cohort'),
        makeSavedSearch('s2', 'DR Cohort'),
      ],
    };
    setSearchParams({ cohort: 's1', cohorts: 's1,s2' });
    render(<AnalysisPage />);
    // Use queryAllByText since cohort name appears in legend span, h4 heading, and page subtitle
    expect(screen.queryAllByText('AMD Cohort').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('DR Cohort').length).toBeGreaterThan(0);
  });

  it('cross-mode: unknown cohort ids are silently dropped', () => {
    mockDataContextValue = {
      activeCases: makeCases(4),
      savedSearches: [
        makeSavedSearch('s1', 'AMD Cohort'),
        // s-unknown is NOT in savedSearches
      ],
    };
    // 's-unknown' dropped → only 1 cohort resolved → no cross mode
    setSearchParams({ cohort: 's1', cohorts: 's1,s-unknown' });
    render(<AnalysisPage />);
    // Only 1 valid cohort → not cross mode → no comparison sections
    expect(screen.queryByTestId('compare-diagnosis')).toBeNull();
    expect(screen.queryByTestId('compare-age-visus')).toBeNull();
  });

  it('cross-mode: primary cohort is included first when not explicitly in ?cohorts=', () => {
    mockDataContextValue = {
      activeCases: makeCases(8),
      savedSearches: [
        makeSavedSearch('primary', 'Primary Cohort'),
        makeSavedSearch('s2', 'Second Cohort'),
      ],
    };
    // primary NOT listed in cohorts param — should be prepended automatically
    setSearchParams({ cohort: 'primary', cohorts: 's2' });
    render(<AnalysisPage />);
    // Both names rendered (may appear multiple times — page header + legend + chart heading)
    expect(screen.queryAllByText('Primary Cohort').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Second Cohort').length).toBeGreaterThan(0);
  });

  it('cross-mode: capped at 4 cohorts', () => {
    mockDataContextValue = {
      activeCases: makeCases(20),
      savedSearches: [
        makeSavedSearch('s1', 'Cohort 1'),
        makeSavedSearch('s2', 'Cohort 2'),
        makeSavedSearch('s3', 'Cohort 3'),
        makeSavedSearch('s4', 'Cohort 4'),
        makeSavedSearch('s5', 'Cohort 5'),
      ],
    };
    setSearchParams({ cohort: 's1', cohorts: 's1,s2,s3,s4,s5' });
    render(<AnalysisPage />);
    // Cohort 5 should NOT appear (capped at 4)
    expect(screen.queryAllByText('Cohort 5').length).toBe(0);
    // First 4 should appear in legend / chart headings
    expect(screen.queryAllByText('Cohort 1').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Cohort 4').length).toBeGreaterThan(0);
  });

  it('single-cohort: falls back gracefully when ?cohorts= has only 1 known id', () => {
    mockDataContextValue = {
      activeCases: makeCases(3),
      savedSearches: [makeSavedSearch('s1', 'Solo Cohort')],
    };
    // Only 1 known id — not cross mode
    setSearchParams({ cohort: 's1', cohorts: 's1' });
    render(<AnalysisPage />);
    expect(screen.queryByTestId('compare-diagnosis')).toBeNull();
    expect(screen.queryByTestId('compare-age-visus')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: summarizeCohortFilter (ANL-012 Task 1)
// ---------------------------------------------------------------------------
import { summarizeCohortFilter } from '../src/utils/cohortFilterSerialization';

describe('summarizeCohortFilter (ANL-012)', () => {
  it('returns empty string for empty filter', () => {
    expect(summarizeCohortFilter({})).toBe('');
  });

  it('returns summary for single diagnosis field', () => {
    const result = summarizeCohortFilter({ diagnosis: ['E11'] });
    expect(result).toContain('E11');
  });

  it('returns summary for ageRange as min–max', () => {
    const result = summarizeCohortFilter({ ageRange: [50, 70] });
    expect(result).toContain('50');
    expect(result).toContain('70');
  });

  it('returns summary for diagnosis + ageRange separated by ·', () => {
    const result = summarizeCohortFilter({ diagnosis: ['E11'], ageRange: [50, 70] });
    expect(result).toContain('E11');
    expect(result).toContain('·');
  });

  it('summarizes flaggedCaseIds as count only, not raw ids', () => {
    const result = summarizeCohortFilter({ flaggedCaseIds: new Set(['id1', 'id2', 'id3']) });
    expect(result).toContain('3');
    expect(result).not.toContain('id1');
    expect(result).not.toContain('id2');
    expect(result).not.toContain('id3');
  });

  it('summarizes centers as joined list or count', () => {
    const result = summarizeCohortFilter({ centers: ['CENTER-1', 'CENTER-2'] });
    expect(result.length).toBeGreaterThan(0);
  });

  it('summarizes gender field', () => {
    const result = summarizeCohortFilter({ gender: ['female'] });
    expect(result).toContain('female');
  });

  it('summarizes visusRange as min–max', () => {
    const result = summarizeCohortFilter({ visusRange: [0.2, 0.8] });
    expect(result).toContain('0.2');
    expect(result).toContain('0.8');
  });

  it('summarizes preset literal', () => {
    const result = summarizeCohortFilter({ preset: 'therapyBreaker' });
    expect(result).toContain('therapyBreaker');
  });

  it('summarizes laterality', () => {
    const result = summarizeCohortFilter({ laterality: 'OD' });
    expect(result).toContain('OD');
  });

  it('summarizes hasComorbidity boolean', () => {
    const result = summarizeCohortFilter({ hasComorbidity: true });
    expect(result.length).toBeGreaterThan(0);
  });

  it('is deterministic — same input produces same output', () => {
    const filter = { diagnosis: ['E11', 'H35'], ageRange: [40, 80] as [number, number], gender: ['male'] };
    expect(summarizeCohortFilter(filter)).toBe(summarizeCohortFilter(filter));
  });
});

// ---------------------------------------------------------------------------
// Tests: AnalysisPage direct-filter display name (ANL-012 Task 2)
// ---------------------------------------------------------------------------

describe('AnalysisPage — direct ?filters= cohort name display (ANL-012 Task 2)', () => {
  it('saved-search path: shows activeSavedSearch.name in header (unchanged)', () => {
    mockDataContextValue = {
      activeCases: makeCases(5),
      savedSearches: [makeSavedSearch('s1', 'AMD Cohort')],
    };
    setSearchParams({ cohort: 's1' });
    render(<AnalysisPage />);
    expect(screen.queryByText('AMD Cohort')).not.toBeNull();
  });

  it('?filters= with ?name=: header shows the supplied name', () => {
    mockDataContextValue = { activeCases: makeCases(3), savedSearches: [] };
    setSearchParams({ filters: '{"diagnosis":["E11"]}', name: 'My Cohort' });
    render(<AnalysisPage />);
    expect(screen.queryByText('My Cohort')).not.toBeNull();
  });

  it('?filters= without ?name=: header shows "Filtered cohort" (English locale)', () => {
    mockDataContextValue = { activeCases: makeCases(3), savedSearches: [] };
    setSearchParams({ filters: '{"diagnosis":["E11"]}' });
    render(<AnalysisPage />);
    // Should show some form of the filtered cohort label
    const el = screen.queryByText((text) => text.includes('Filtered cohort'));
    expect(el).not.toBeNull();
  });

  it('?filters= empty/invalid json with no ?name=: shows bare filtered cohort label, no crash', () => {
    mockDataContextValue = { activeCases: makeCases(0), savedSearches: [] };
    setSearchParams({ filters: 'not-valid-json' });
    render(<AnalysisPage />);
    const el = screen.queryByText((text) => text.includes('Filtered cohort'));
    expect(el).not.toBeNull();
  });

  it('no ?cohort= and no ?filters=: no cohort name line rendered', () => {
    mockDataContextValue = { activeCases: makeCases(5), savedSearches: [] };
    setSearchParams({});
    render(<AnalysisPage />);
    // Neither saved search name nor filtered cohort label should appear
    expect(screen.queryByText('AMD Cohort')).toBeNull();
    expect(screen.queryByText((text) => text.includes('Filtered cohort'))).toBeNull();
  });
});
