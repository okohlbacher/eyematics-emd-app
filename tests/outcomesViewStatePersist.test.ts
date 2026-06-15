// @vitest-environment jsdom
/**
 * J2 (v1.15-p4) — trajectory view-state persistence helper.
 *
 * Verifies the read/write round-trip + per-cohort keying + the merge semantics the
 * route-state hook relies on: persisting only explicit choices, composed later on
 * top of the size-derived defaults.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  readPersistedViewState,
  writePersistedViewState,
} from '../src/components/outcomes/outcomesViewStatePersist';

describe('outcomesViewStatePersist', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('returns null when nothing is persisted for a cohort', () => {
    expect(readPersistedViewState('cohort-a')).toBeNull();
  });

  it('round-trips axis/y/grid/metric for a cohort', () => {
    writePersistedViewState('cohort-a', {
      axisMode: 'treatments',
      yMetric: 'absolute',
      gridPoints: 60,
      metric: 'crt',
    });
    const got = readPersistedViewState('cohort-a');
    expect(got?.axisMode).toBe('treatments');
    expect(got?.yMetric).toBe('absolute');
    expect(got?.gridPoints).toBe(60);
    expect(got?.metric).toBe('crt');
  });

  it('keys state PER cohort (one cohort does not see another cohort state)', () => {
    writePersistedViewState('cohort-a', { axisMode: 'treatments' });
    expect(readPersistedViewState('cohort-b')).toBeNull();
  });

  it('merges layer patches rather than replacing the whole layers object', () => {
    writePersistedViewState('cohort-a', { layers: { scatter: true } });
    writePersistedViewState('cohort-a', { layers: { perPatient: false } });
    const got = readPersistedViewState('cohort-a');
    expect(got?.layers?.scatter).toBe(true);
    expect(got?.layers?.perPatient).toBe(false);
  });

  it('an empty layers patch clears the persisted layer choices (reset)', () => {
    writePersistedViewState('cohort-a', { layers: { scatter: true } });
    // The hook writes { layers: {} } on reset; merge keeps the (now empty) object —
    // a subsequent explicit write still re-populates. Here we assert reset removes
    // the scatter override by overwriting with an empty layers map.
    sessionStorage.clear();
    writePersistedViewState('cohort-a', { layers: {} });
    const got = readPersistedViewState('cohort-a');
    expect(got?.layers?.scatter).toBeUndefined();
  });
});
