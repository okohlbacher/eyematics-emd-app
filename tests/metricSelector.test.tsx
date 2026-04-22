// @vitest-environment jsdom
/**
 * Phase 18 / MSEL-01..05 — ?metric= URL param round-trip, backward compat, and
 * keyboard navigation regression tests.
 * (Originally Phase 13 / METRIC-04 — migrated onto shared helper in Phase 18 Plan 02)
 *
 * Provider wiring mirrors tests/OutcomesViewRouting.test.tsx: vi.mock factory
 * bodies live in tests/helpers/renderOutcomesView.tsx; factories are loaded via
 * vi.hoisted() so they are available at vi.mock hoist time (before static imports).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';

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

import { fetchSpy, renderOutcomesView } from './helpers/renderOutcomesView';

// ---------------------------------------------------------------------------
// fetch spy + cleanup
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
// MSEL-01..04 — metric selector URL round-trip tests
// ---------------------------------------------------------------------------

describe('OutcomesView metric selector', () => {
  it('renders visus by default when no ?metric= param', async () => {
    await renderOutcomesView('/analysis?tab=trajectories');
    const tab = screen.getByTestId('metric-tab-visus');
    expect(tab.getAttribute('aria-selected')).toBe('true');
  });

  it('reads ?metric=crt on mount and preselects CRT tab', async () => {
    await renderOutcomesView('/analysis?tab=trajectories&metric=crt');
    const tab = screen.getByTestId('metric-tab-crt');
    expect(tab.getAttribute('aria-selected')).toBe('true');
  });

  it('writes ?metric=interval when Treatment Interval tab is clicked', async () => {
    await renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort');
    const tab = screen.getByTestId('metric-tab-interval');
    fireEvent.click(tab);
    expect(screen.getByTestId('metric-tab-interval').getAttribute('aria-selected')).toBe('true');
  });

  it('preserves ?cohort= when switching metric (does not clobber other params)', async () => {
    const { container } = await renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort');
    const tab = screen.getByTestId('metric-tab-crt');
    fireEvent.click(tab);
    expect(tab.getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('[role="tablist"]')).not.toBeNull();
  });

  it('defaults to visus when ?metric=invalidvalue (backward compat)', async () => {
    await renderOutcomesView('/analysis?tab=trajectories&metric=bogus');
    const tab = screen.getByTestId('metric-tab-visus');
    expect(tab.getAttribute('aria-selected')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// MSEL-05 — keyboard navigation regression tests
// ---------------------------------------------------------------------------

describe('OutcomesView metric selector — keyboard navigation (MSEL-05)', () => {
  it('ArrowRight advances metric and updates URL', async () => {
    await renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort&metric=visus');
    const tab = screen.getByTestId('metric-tab-visus');
    fireEvent.keyDown(tab, { key: 'ArrowRight' });
    expect(screen.getByTestId('metric-tab-crt').getAttribute('aria-selected')).toBe('true');
  });

  it('ArrowLeft retreats to previous metric', async () => {
    await renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort&metric=interval');
    const tab = screen.getByTestId('metric-tab-interval');
    fireEvent.keyDown(tab, { key: 'ArrowLeft' });
    expect(screen.getByTestId('metric-tab-crt').getAttribute('aria-selected')).toBe('true');
  });

  it('ArrowRight wraps from responder back to visus', async () => {
    await renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort&metric=responder');
    const tab = screen.getByTestId('metric-tab-responder');
    fireEvent.keyDown(tab, { key: 'ArrowRight' });
    expect(screen.getByTestId('metric-tab-visus').getAttribute('aria-selected')).toBe('true');
  });

  it('ArrowLeft wraps from visus back to responder', async () => {
    await renderOutcomesView('/analysis?tab=trajectories&cohort=test-cohort&metric=visus');
    const tab = screen.getByTestId('metric-tab-visus');
    fireEvent.keyDown(tab, { key: 'ArrowLeft' });
    expect(screen.getByTestId('metric-tab-responder').getAttribute('aria-selected')).toBe('true');
  });
});
