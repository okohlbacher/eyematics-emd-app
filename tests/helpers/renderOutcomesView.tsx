/**
 * Shared test helper for OutcomesView integration tests.
 *
 * This module exports:
 *  - vi.mock factory functions for 7 modules (consumed as the second argument
 *    to vi.mock() calls IN THE TEST FILE — vi.mock hoisting only applies to
 *    the test file being compiled, not imported helpers).
 *  - Shared mock fn references (loadSettingsMock, postAggregateMock, fetchSpy).
 *  - Stub builders (buildCase, buildCases).
 *  - renderOutcomesView(url, options) factory.
 *
 * NOTE: Do NOT add `// @vitest-environment jsdom` here — this is not a test file.
 */
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import OutcomesView from '../../src/components/outcomes/OutcomesView';
import { useData } from '../../src/context/DataContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { applyFilters } from '../../src/services/fhirLoader';
import { computeCohortTrajectory } from '../../src/utils/cohortTrajectory';
import type { PatientCase, SavedSearch } from '../../src/types/fhir';

// ---------------------------------------------------------------------------
// Shared mock fn references — imported by test files after vi.mock declarations
// ---------------------------------------------------------------------------

export const loadSettingsMock = vi.fn();
export const postAggregateMock = vi.fn();
export const fetchSpy = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));

// ---------------------------------------------------------------------------
// vi.mock factory functions — passed as second arg to vi.mock() in the test file
// ---------------------------------------------------------------------------

/**
 * Factory for `../src/services/settingsService`.
 * Partial mock: preserves real exports, overrides loadSettings to delegate to loadSettingsMock.
 */
export const settingsServiceFactory = async (importOriginal: <T = unknown>() => Promise<T>) => {
  const actual = await importOriginal<typeof import('../../src/services/settingsService')>();
  return { ...actual, loadSettings: (...args: unknown[]) => loadSettingsMock(...args) };
};

/**
 * Factory for `../src/services/outcomesAggregateService`.
 */
export const outcomesAggregateFactory = () => ({
  postAggregate: (...args: unknown[]) => postAggregateMock(...args),
});

/**
 * Factory for `../src/context/DataContext`.
 */
export const dataContextFactory = () => ({
  useData: vi.fn(),
});

/**
 * Factory for `../src/context/LanguageContext`.
 */
export const languageContextFactory = () => ({
  useLanguage: vi.fn(),
});

/**
 * Factory for `../src/services/fhirLoader`.
 */
export const fhirLoaderFactory = () => ({
  applyFilters: vi.fn((cases: unknown[]) => cases),
  LOINC_VISUS: '79880-1',
  SNOMED_IVI: '36189003',
  SNOMED_EYE_LEFT: '362502000',
  SNOMED_EYE_RIGHT: '362503005',
  getObservationsByCode: vi.fn(() => []),
});

/**
 * Factory for `../src/utils/cohortTrajectory`.
 * Partial mock: preserves real exports (defaultScatterOn, type aliases), overrides computeCohortTrajectory.
 */
export const cohortTrajectoryFactory = async (importOriginal: <T = unknown>() => Promise<T>) => {
  const real = await importOriginal<typeof import('../../src/utils/cohortTrajectory')>();
  return {
    ...real,
    computeCohortTrajectory: vi.fn(() => ({
      od: {
        patients: [],
        scatterPoints: [],
        medianGrid: [{ x: 0, y: 0.1, p25: 0.05, p75: 0.15, n: 1 }],
        summary: { patientCount: 1, measurementCount: 1, excludedCount: 0 },
      },
      os: {
        patients: [],
        scatterPoints: [],
        medianGrid: [{ x: 0, y: 0.1, p25: 0.05, p75: 0.15, n: 1 }],
        summary: { patientCount: 1, measurementCount: 1, excludedCount: 0 },
      },
      combined: {
        patients: [],
        scatterPoints: [],
        medianGrid: [{ x: 0, y: 0.1, p25: 0.05, p75: 0.15, n: 1 }],
        summary: { patientCount: 1, measurementCount: 1, excludedCount: 0 },
      },
    })),
  };
};

/**
 * Factory for `recharts`.
 * Partial mock: preserves real exports, stubs ResizeObserver-dependent components to avoid jsdom issues.
 */
export const rechartsFactory = async (importOriginal: <T = unknown>() => Promise<T>) => {
  const real = await importOriginal<typeof import('recharts')>();
  return {
    ...real,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ResponsiveContainer: ({ children }: { children: any }) => (
      <div data-testid="recharts-responsive-container">
        <svg>{children}</svg>
      </div>
    ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ComposedChart: ({ children }: { children: any }) => (
      <g data-testid="recharts-composed-chart">{children}</g>
    ),
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    ReferenceLine: () => null,
    Area: () => <g data-testid="recharts-area" />,
    Line: () => null,
    Scatter: () => null,
  };
};

// ---------------------------------------------------------------------------
// Stub builders
// ---------------------------------------------------------------------------

/** Build a minimal PatientCase stub with one visus observation */
export function buildCase(pseudo: string): PatientCase {
  const obs = {
    resourceType: 'Observation',
    id: `obs-${pseudo}`,
    code: { coding: [{ system: 'http://loinc.org', code: '79880-1' }] },
    valueQuantity: { value: 0.8, unit: 'decimal' },
    effectiveDateTime: '2024-01-15',
    bodySite: { coding: [{ system: 'http://snomed.info/sct', code: '362503005' }] },
  };
  return {
    id: pseudo,
    pseudonym: pseudo,
    gender: 'male',
    birthDate: '1960-01-01',
    centerId: 'org-uka',
    centerName: 'UKA',
    conditions: [],
    observations: [obs],
    procedures: [],
    imagingStudies: [],
    medications: [],
  } as unknown as PatientCase;
}

/** Build N cases */
export function buildCases(n: number): PatientCase[] {
  return Array.from({ length: n }, (_, i) => buildCase(`p${i + 1}`));
}

// ---------------------------------------------------------------------------
// renderOutcomesView options interface
// ---------------------------------------------------------------------------

export interface RenderOutcomesViewOptions {
  activeCases?: PatientCase[];
  savedSearches?: SavedSearch[];
  locale?: string;
  settings?: Partial<{
    twoFactorEnabled: boolean;
    therapyInterrupterDays: number;
    therapyBreakerDays: number;
    dataSource: { type: 'local'; blazeUrl: string };
    outcomes: { serverAggregationThresholdPatients: number; aggregateCacheTtlMs: number };
  }>;
  postAggregate?: (...args: unknown[]) => unknown;
  cohortTrajectoryResult?: unknown;
}

// ---------------------------------------------------------------------------
// renderOutcomesView factory
// ---------------------------------------------------------------------------

/**
 * Renders OutcomesView inside a MemoryRouter at `url` with mocked context hooks.
 *
 * Assumes the test file has already declared vi.mock() calls referencing the factory
 * functions exported from this helper, so that useData, useLanguage, applyFilters,
 * computeCohortTrajectory are all vi.fn() instances at this point.
 *
 * Default mock state (D-01):
 *  - activeCases: buildCases(5)
 *  - savedSearches: [{ id: 'test-cohort', name: 'Test Cohort', ... }]
 *  - locale: 'en'
 *  - settings: twoFactorEnabled=false, therapyInterrupterDays=120, therapyBreakerDays=365,
 *              dataSource={type:'local',blazeUrl:''}, outcomes threshold=1000, cacheTtl=1800000
 */
export function renderOutcomesView(
  url: string,
  options: RenderOutcomesViewOptions = {},
): ReturnType<typeof render> {
  const activeCases = options.activeCases ?? buildCases(5);
  const savedSearches: SavedSearch[] = options.savedSearches ?? [
    { id: 'test-cohort', name: 'Test Cohort', createdAt: '2024-01-01T00:00:00Z', filters: {} },
  ];
  const locale = options.locale ?? 'en';
  const settings = {
    twoFactorEnabled: false,
    therapyInterrupterDays: 120,
    therapyBreakerDays: 365,
    dataSource: { type: 'local' as const, blazeUrl: '' },
    outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 },
    ...(options.settings ?? {}),
  };

  loadSettingsMock.mockResolvedValue(settings);

  if (options.postAggregate) {
    postAggregateMock.mockImplementation(options.postAggregate);
  }

  // Configure hook mocks. At this point, useData / useLanguage / applyFilters are
  // already vi.fn() instances because the test file's vi.mock() calls resolved before
  // this function is called (vi.mock is hoisted to top of the test file).
  (useData as ReturnType<typeof vi.fn>).mockReturnValue({
    activeCases,
    savedSearches,
    centers: [],
    addSavedSearch: vi.fn(),
    removeSavedSearch: vi.fn(),
    qualityFlags: [],
    excludedCases: [],
    reviewedCases: [],
    loading: false,
    error: null,
    bundles: [],
    cases: [],
  });

  (useLanguage as ReturnType<typeof vi.fn>).mockReturnValue({
    locale,
    setLocale: vi.fn(),
    t: (k: string) => k,
  });

  (applyFilters as ReturnType<typeof vi.fn>).mockImplementation(
    (cases: PatientCase[]) => cases,
  );

  if (options.cohortTrajectoryResult !== undefined) {
    (computeCohortTrajectory as ReturnType<typeof vi.fn>).mockReturnValue(
      options.cohortTrajectoryResult,
    );
  }

  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/analysis" element={<OutcomesView />} />
      </Routes>
    </MemoryRouter>,
  );
}
