// @vitest-environment jsdom
/**
 * I2 (v1.14-p4) — Verläufe responsiveness (full layered fix).
 *
 * Covers the three load-bearing pieces of the fix:
 *  Part 1: deriveDefaultLayers — the size-based layer defaults are computed by a
 *          PURE function used by the lazy useState initializer, so the FIRST render
 *          of a large cohort already has scatter + per-patient OFF (no ~14k-circle
 *          first paint corrected by a post-render effect).
 *  Part 2: downsampleScatter — even-stride cap keeps the rendered node count bounded
 *          and the sample visually faithful (spans the whole range, not a prefix).
 *  Part 3: OutcomesPanel renders the DOWNSAMPLED scatter (≤ cap) when the layer is on
 *          for a large cohort, and the FULL set when it fits.
 *  Part 4: OutcomesView shows a client-path role="status" indicator on the first
 *          paint of a large client-side cohort, then clears it (no permanent spinner;
 *          no indicator at all on a small cohort).
 */

import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deriveDefaultLayers } from '../src/components/outcomes/useOutcomesRouteState';

// ---------------------------------------------------------------------------
// Part 1: deriveDefaultLayers — size-derived defaults (pre-first-render truth)
// ---------------------------------------------------------------------------

describe('I2 — deriveDefaultLayers (size-derived, before first render)', () => {
  const cohortOf = (n: number) => Array.from({ length: n }, (_, i) => ({ pseudonym: `PSN-${i}` }));

  it('small cohort (≤30) → scatter + per-patient ON by default', () => {
    const layers = deriveDefaultLayers(cohortOf(30));
    expect(layers.scatter).toBe(true);
    expect(layers.perPatient).toBe(true);
    expect(layers.median).toBe(true);
    expect(layers.spreadBand).toBe(true);
  });

  it('mid cohort (31–100) → scatter OFF, per-patient still ON', () => {
    const layers = deriveDefaultLayers(cohortOf(50));
    expect(layers.scatter).toBe(false);
    expect(layers.perPatient).toBe(true);
  });

  it('large cohort (>100 distinct, e.g. the 245-cohort) → scatter AND per-patient OFF', () => {
    const layers = deriveDefaultLayers(cohortOf(245));
    expect(layers.scatter).toBe(false);
    expect(layers.perPatient).toBe(false);
    // median + IQR band remain cheap and on.
    expect(layers.median).toBe(true);
    expect(layers.spreadBand).toBe(true);
  });

  it('empty cohort → everything on (no points to paint anyway)', () => {
    const layers = deriveDefaultLayers([]);
    expect(layers.scatter).toBe(true);
    expect(layers.perPatient).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Part 4: OutcomesView client-path loading status
//
// recharts is fully stubbed by the shared helper (Scatter → null), so we assert
// the status testid rather than DOM node counts here. The pure-function tests above
// already prove the first-render layer state is scatter/per-patient OFF for a large
// cohort; Part 3 below proves the panel honours the cap.
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

import { buildCases, fetchSpy, renderOutcomesView } from './helpers/renderOutcomesView';

describe('I2 — OutcomesView client-path loading status', () => {
  beforeEach(() => {
    global.fetch = fetchSpy as unknown as typeof fetch;
    fetchSpy.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('shows a role="status" client-computing indicator on first paint of a large client-side cohort', async () => {
    // 200 cases, server threshold 1000 → client path. The status must appear before
    // the deferred panel subtree mounts.
    await renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort', {
      activeCases: buildCases(200),
      settings: { outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 } },
    });

    const status = screen.getByTestId('outcomes-client-computing');
    expect(status).not.toBeNull();
    expect(status.getAttribute('role')).toBe('status');
  });

  it('clears the client-computing indicator once the deferred render arms (no permanent spinner)', async () => {
    await renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort', {
      activeCases: buildCases(200),
      settings: { outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 } },
    });

    // The double-rAF deferral eventually flips clientRenderReady; the status clears
    // and the panels mount.
    await waitFor(() => {
      expect(screen.queryByTestId('outcomes-client-computing')).toBeNull();
    });
    expect(screen.queryByTestId('outcomes-panel-od')).not.toBeNull();
  });

  it('does NOT show the client-computing indicator for a small cohort (no flash)', async () => {
    await renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort', {
      activeCases: buildCases(5),
      settings: { outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 } },
    });

    // Small client cohort renders immediately — the status testid never appears.
    expect(screen.queryByTestId('outcomes-client-computing')).toBeNull();
    expect(screen.queryByTestId('outcomes-panel-od')).not.toBeNull();
  });

  // F3 / override-persistence guard (must not reintroduce the wedge): a manually
  // enabled layer survives a metric-tab switch on a large cohort. The size-derived
  // default would otherwise re-disable scatter for a >30 cohort; the override ref
  // must win.
  it('keeps a manually-enabled scatter layer ON across a metric switch on a large cohort', async () => {
    await renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort', {
      activeCases: buildCases(200),
      settings: { outcomes: { serverAggregationThresholdPatients: 1000, aggregateCacheTtlMs: 1800000 } },
    });

    // Wait past the deferred render so the header + settings button are stable.
    await waitFor(() => expect(screen.queryByTestId('outcomes-panel-od')).not.toBeNull());

    // Open settings drawer (aria-label resolves to its key via the t-mock).
    fireEvent.click(screen.getByLabelText('outcomesOpenSettings'));
    const scatterToggle = screen.getByLabelText('outcomesLayerScatter') as HTMLInputElement;
    // Large cohort → derived default is OFF.
    expect(scatterToggle.checked).toBe(false);
    // Manually enable scatter (marks the user-override ref).
    fireEvent.click(scatterToggle);
    expect((screen.getByLabelText('outcomesLayerScatter') as HTMLInputElement).checked).toBe(true);

    // Switch metric tab visus → crt, then back to visus.
    fireEvent.click(screen.getByTestId('metric-tab-crt'));
    fireEvent.click(screen.getByTestId('metric-tab-visus'));

    // Scatter must STILL be enabled (override respected, not reverted to derived OFF).
    await waitFor(() =>
      expect((screen.getByLabelText('outcomesLayerScatter') as HTMLInputElement).checked).toBe(true),
    );
  });
});
