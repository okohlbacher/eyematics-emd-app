// @vitest-environment jsdom
// Z0-P06 — session-wide chart settings: store semantics behind the acceptance scenarios (PLAN Z0 § Z0-P06, C7, Q24).
// Synthetic values only.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  clearPersistedViewState,
  readPersistedViewState,
  writePersistedViewState,
} from '../../../src/components/outcomes/outcomesViewStatePersist';

describe('[Z0-P06] session-wide view state store', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('[Z0-P06] all settings (axis, y-mode, grid, layers, centres) are shared by every cohort', () => {
    writePersistedViewState('cohort-a', {
      axisMode: 'treatments',
      yMetric: 'absolute',
      gridPoints: 60,
      layers: { spreadBand: false },
    });
    writePersistedViewState(null, { centers: ['Zentrum A'] });
    const got = readPersistedViewState('cohort-b');
    expect(got?.axisMode).toBe('treatments');
    expect(got?.yMetric).toBe('absolute');
    expect(got?.gridPoints).toBe(60);
    expect(got?.layers?.spreadBand).toBe(false);
    expect(got?.centers).toEqual(['Zentrum A']);
  });

  it('[Z0-P06] a reset (empty layers patch) clears earlier layer choices instead of merging', () => {
    writePersistedViewState('cohort-a', { layers: { scatter: true, spreadBand: false } });
    writePersistedViewState('cohort-a', { layers: {} });
    expect(readPersistedViewState('cohort-a')?.layers).toEqual({});
  });

  it('[Z0-P06] clearing at session end removes the settings', () => {
    writePersistedViewState('cohort-a', { axisMode: 'treatments', centers: ['Zentrum A'] });
    clearPersistedViewState();
    expect(readPersistedViewState('cohort-a')).toBeNull();
  });
});
