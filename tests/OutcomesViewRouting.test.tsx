// @vitest-environment jsdom
/**
 * Phase 12 Plan 04 / AGG-03 — OutcomesView size-based routing tests.
 * Verifies: below-threshold does NOT call server; above-threshold calls server
 * 3x (one per eye); loading indicator visible during fetch; server error falls
 * back to client compute path.
 *
 * Provider wiring mirrors tests/OutcomesPage.test.tsx (vi.mock useData + useLanguage
 * hooks directly — OutcomesView does not use a React context provider tree, it reads
 * from hooks that are mocked at the module boundary).
 *
 * Saved-search seeding: OutcomesView resolves cohortId via
 * `savedSearches.find(s => s.id === cohortId)`. Above-threshold tests must seed
 * a matching entry so the cohort resolves (otherwise routeServerSide stays false).
 *
 * Phase 18 / Plan 01 (D-06 Commit 1): vi.mock factory bodies extracted to
 * tests/helpers/renderOutcomesView.tsx. Factories are loaded via vi.hoisted() to
 * make them available at vi.mock hoist time (before import statements run).
 * renderOutcomesView, buildCases, loadSettingsMock, postAggregateMock, fetchSpy
 * all imported from the helper. Settings (including threshold) are passed via the
 * renderOutcomesView options.settings field rather than configuring loadSettingsMock
 * directly.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Hoist factory functions — must be available before vi.mock calls execute.
// The helper is loaded here without triggering circular initialization because
// the helper does NOT import OutcomesView at module level — renderOutcomesView
// uses a dynamic import at call time (after mocks are registered).
// ---------------------------------------------------------------------------

const {
  settingsServiceFactory,
  outcomesAggregateFactory,
  dataContextFactory,
  languageContextFactory,
  fhirLoaderFactory,
  cohortTrajectoryFactory,
  rechartsFactory,
} = await vi.hoisted(async () => {
  const m = await import('./helpers/renderOutcomesView');
  return {
    settingsServiceFactory: m.settingsServiceFactory,
    outcomesAggregateFactory: m.outcomesAggregateFactory,
    dataContextFactory: m.dataContextFactory,
    languageContextFactory: m.languageContextFactory,
    fhirLoaderFactory: m.fhirLoaderFactory,
    cohortTrajectoryFactory: m.cohortTrajectoryFactory,
    rechartsFactory: m.rechartsFactory,
  };
});

// ---------------------------------------------------------------------------
// Module mocks — factory bodies live in the helper; vi.mock calls stay here.
// ---------------------------------------------------------------------------

vi.mock('../src/services/settingsService', settingsServiceFactory);
vi.mock('../src/services/outcomesAggregateService', outcomesAggregateFactory);
vi.mock('../src/context/DataContext', dataContextFactory);
vi.mock('../src/context/LanguageContext', languageContextFactory);
vi.mock('../src/services/fhirLoader', fhirLoaderFactory);
vi.mock('../src/utils/cohortTrajectory', cohortTrajectoryFactory);
vi.mock('recharts', rechartsFactory);

// ---------------------------------------------------------------------------
// Imports from shared helper (after vi.mock blocks)
// ---------------------------------------------------------------------------

import {
  loadSettingsMock,
  postAggregateMock,
  fetchSpy,
  buildCases,
  renderOutcomesView,
} from './helpers/renderOutcomesView';
import type { SavedSearch } from '../src/types/fhir';

// ---------------------------------------------------------------------------
// fetch spy — keeps audit beacon from causing issues
// ---------------------------------------------------------------------------

beforeEach(() => {
  global.fetch = fetchSpy as unknown as typeof fetch;
  fetchSpy.mockClear();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// AGG-03 tests
// ---------------------------------------------------------------------------

describe('AGG-03 — size-based routing in OutcomesView', () => {
  it('does NOT call /api/outcomes/aggregate when cohort.cases.length <= threshold', async () => {
    // threshold = 1000; 5 cases → below threshold → no server call
    await renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort', {
      activeCases: buildCases(5),
      settings: { outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 } },
    });

    // Allow loadSettings effect to complete
    await waitFor(() => expect(loadSettingsMock).toHaveBeenCalled());

    expect(postAggregateMock).not.toHaveBeenCalled();
  });

  it('calls postAggregate 3x (one per eye) when cohort.cases.length > threshold', async () => {
    // threshold = 5; 10 cases → above threshold → 3 server calls
    postAggregateMock.mockResolvedValue({
      median: [],
      iqrLow: [],
      iqrHigh: [],
      meta: { patientCount: 10, excludedCount: 0, measurementCount: 0, cacheHit: false },
    });

    await renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort', {
      activeCases: buildCases(10),
      settings: { outcomes: { serverAggregationThresholdPatients: 5, aggregateCacheTtlMs: 1800000 } },
    });

    await waitFor(() => expect(postAggregateMock).toHaveBeenCalledTimes(3));

    const eyes = postAggregateMock.mock.calls
      .map((c) => (c[0] as { eye: string }).eye)
      .sort();
    expect(eyes).toEqual(['combined', 'od', 'os']);
  });

  it('renders the "Computing on server…" indicator while fetches are in flight', async () => {
    // threshold = 5; 10 cases → above threshold; never-resolving promise
    // Never resolves → loading state stays true
    postAggregateMock.mockImplementation(() => new Promise(() => {}));

    await renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort', {
      activeCases: buildCases(10),
      settings: { outcomes: { serverAggregationThresholdPatients: 5, aggregateCacheTtlMs: 1800000 } },
    });

    await waitFor(() =>
      expect(screen.getByTestId('outcomes-server-computing')).toBeDefined(),
    );
  });

  it('falls back to client compute path on server error', async () => {
    // threshold = 5; 10 cases → above threshold; postAggregate rejects
    postAggregateMock.mockRejectedValue(new Error('Server aggregate failed: 500'));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort', {
      activeCases: buildCases(10),
      settings: { outcomes: { serverAggregationThresholdPatients: 5, aggregateCacheTtlMs: 1800000 } },
    });

    await waitFor(() =>
      expect(warnSpy).toHaveBeenCalledWith(
        '[OutcomesView] Server aggregate failed — falling back to client compute',
        expect.any(Error),
      ),
    );

    // After fallback, the client-side panels should render (no blocking error).
    await waitFor(() => {
      // The scatter marker confirms the cohort rendered past the early-return guards
      expect(screen.queryByText('outcomesEmptyCohortTitle')).toBeNull();
    });

    warnSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// XCOHORT-04 — cross-cohort deep-link restoration (Phase 16)
// ---------------------------------------------------------------------------

const CROSS_COHORT_SAVED_SEARCHES: SavedSearch[] = [
  { id: 'p1', name: 'Cohort A', createdAt: '2026-01-01', filters: {} },
  { id: 'p2', name: 'Cohort B', createdAt: '2026-01-02', filters: {} },
  { id: 'p3', name: 'Cohort C', createdAt: '2026-01-03', filters: {} },
  { id: 'p4', name: 'Cohort D', createdAt: '2026-01-04', filters: {} },
  { id: 'p5', name: 'Cohort E', createdAt: '2026-01-05', filters: {} },
];

describe('OutcomesView — cross-cohort routing (Phase 16)', () => {
  it('XCOHORT-04: ?cohorts=p1,p2 enters cross-cohort mode without user interaction', async () => {
    await renderOutcomesView('/analysis?cohort=p1&cohorts=p1,p2', {
      savedSearches: CROSS_COHORT_SAVED_SEARCHES,
      activeCases: buildCases(5),
    });

    // Subtitle reflects cross mode via the outcomesCrossMode key.
    // The t() mock returns the key, so the subtitle will contain 'outcomesCrossMode'.
    await waitFor(() =>
      expect(screen.getByText(/outcomesCrossMode/i)).toBeDefined(),
    );
  });

  it('XCOHORT-04: ?cohorts= caps at 4 cohorts (fifth id dropped)', async () => {
    await renderOutcomesView('/analysis?cohort=p1&cohorts=p1,p2,p3,p4,p5', {
      savedSearches: CROSS_COHORT_SAVED_SEARCHES,
      activeCases: buildCases(5),
    });

    // The subtitle is built from crossCohortAggregates.combined which has at most 4 entries.
    // With t() returning the key, the text will be "outcomesCrossMode · Cohort A, Cohort B, Cohort C, Cohort D"
    // (4 cohorts, not 5). Check that 5 cohorts are not all shown.
    await waitFor(() => {
      const subtitle = screen.getByText(/outcomesCrossMode/i);
      // Cohort E should be absent (5th cohort dropped)
      expect(subtitle.textContent).not.toContain('Cohort E');
    });
  });

  it('XCOHORT-04: unknown cohort ids in ?cohorts= are silently dropped', async () => {
    await renderOutcomesView('/analysis?cohort=p1&cohorts=p1,pUNKNOWN', {
      savedSearches: CROSS_COHORT_SAVED_SEARCHES,
      activeCases: buildCases(5),
    });

    // Unknown id pUNKNOWN is filtered out; only p1 remains.
    // With 1 entry crossCohortAggregates still resolves (1 valid cohort).
    // Panels must render without crashing.
    await waitFor(() => {
      const panel = screen.getByTestId('outcomes-panel-od');
      expect(panel).toBeDefined();
    });
  });
});
