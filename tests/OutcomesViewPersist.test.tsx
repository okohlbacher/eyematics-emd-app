// @vitest-environment jsdom
/**
 * J2 (v1.15-p4) — view-state persistence restore on (re)mount.
 *
 * A persisted EXPLICIT layer choice must WIN over the size-derived default on a
 * fresh mount (the tester's "view is reset when leaving to another view"), and the
 * override ref must be re-armed so the size-derived auto-off effect does NOT clobber
 * the restored choice — no F3 wedge. A never-toggled cohort keeps deriving from size.
 */
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('../src/services/settingsService', settingsServiceFactory);
vi.mock('../src/services/outcomesAggregateService', outcomesAggregateFactory);
vi.mock('../src/context/DataContext', dataContextFactory);
vi.mock('../src/context/LanguageContext', languageContextFactory);
vi.mock('../src/services/fhirLoader', fhirLoaderFactory);
vi.mock('../src/utils/cohortTrajectory', cohortTrajectoryFactory);
vi.mock('recharts', rechartsFactory);
vi.mock('../src/hooks/useRecentActivity', () => ({
  useRecentActivity: () => ({ entries: [], record: vi.fn(), clear: vi.fn() }),
}));

import { writePersistedViewState } from '../src/components/outcomes/outcomesViewStatePersist';
import { buildCases, fetchSpy, renderOutcomesView } from './helpers/renderOutcomesView';

describe('J2 — OutcomesView view-state persistence restore', () => {
  beforeEach(() => {
    global.fetch = fetchSpy as unknown as typeof fetch;
    fetchSpy.mockClear();
    sessionStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('restores a persisted explicit scatter=ON on a large cohort (wins over size-derived OFF)', async () => {
    // Pre-seed an explicit scatter override for this cohort (as a prior session would).
    writePersistedViewState('test-cohort', { layers: { scatter: true } });

    await renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort', {
      activeCases: buildCases(200),
      settings: { outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 } },
    });

    await waitFor(() => expect(screen.queryByTestId('outcomes-panel-od')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /outcomesSettingsButton/ }));
    // Size-derived default for a 200-cohort is scatter OFF; the persisted choice wins.
    const scatterToggle = screen.getByLabelText('outcomesLayerScatter') as HTMLInputElement;
    expect(scatterToggle.checked).toBe(true);
  });

  it('a cohort with NO persisted choice keeps the size-derived default (scatter OFF on large)', async () => {
    await renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort', {
      activeCases: buildCases(200),
      settings: { outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 } },
    });

    await waitFor(() => expect(screen.queryByTestId('outcomes-panel-od')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /outcomesSettingsButton/ }));
    const scatterToggle = screen.getByLabelText('outcomesLayerScatter') as HTMLInputElement;
    expect(scatterToggle.checked).toBe(false);
  });

  it('persists an explicit toggle so a fresh remount restores it', async () => {
    const r1 = await renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort', {
      activeCases: buildCases(200),
      settings: { outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 } },
    });
    await waitFor(() => expect(screen.queryByTestId('outcomes-panel-od')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /outcomesSettingsButton/ }));
    const toggle = screen.getByLabelText('outcomesLayerScatter') as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle); // enable scatter (explicit override → persisted)
    expect((screen.getByLabelText('outcomesLayerScatter') as HTMLInputElement).checked).toBe(true);

    // Unmount (leave the view) and remount (return) — the choice must survive.
    r1.unmount();
    cleanup();

    await renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort', {
      activeCases: buildCases(200),
      settings: { outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 } },
    });
    await waitFor(() => expect(screen.queryByTestId('outcomes-panel-od')).not.toBeNull());
    fireEvent.click(screen.getByRole('button', { name: /outcomesSettingsButton/ }));
    expect((screen.getByLabelText('outcomesLayerScatter') as HTMLInputElement).checked).toBe(true);
  });
});
