/**
 * Phase 12 Plan 03 / AGG-04 — server/outcomesAggregateCache.ts unit tests.
 * Covers: get miss, set+get, TTL expiry, TTL config parsing, invalidateByCohort
 * selectivity, _resetForTesting state reset.
 *
 * NOTE on TDD / Wave-2 parallelism: This test file is authored in Wave 2 PARALLEL
 * with Plan 12-02 which creates server/outcomesAggregateCache.ts. In the executor's
 * worktree (based on a3ba860 — BEFORE 12-02) the import target does not exist yet.
 * The `// @ts-expect-error` directive below allows the test FILE to typecheck
 * cleanly; the test will fail at `npm test` time with a module-not-found error
 * until 12-02's code is merged into the feature branch. This is the RED phase.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// @ts-expect-error — server/outcomesAggregateCache.ts is created in parallel by Plan 12-02 (wave 2)
import {
  _resetForTesting,
  aggregateCacheGet,
  aggregateCacheSet,
  initOutcomesAggregateCache,
  invalidateByCohort,
} from '../server/outcomesAggregateCache';

describe('outcomesAggregateCache (AGG-04)', () => {
  beforeEach(() => {
    _resetForTesting();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('aggregateCacheGet returns null for unknown key', () => {
    expect(aggregateCacheGet('nope')).toBeNull();
  });

  it('aggregateCacheSet then aggregateCacheGet returns stored value', () => {
    const payload = { median: [1, 2, 3], meta: { cacheHit: false } };
    aggregateCacheSet('k1', 'cohort-a', payload);
    expect(aggregateCacheGet('k1')).toBe(payload);
  });

  it('expires entries after configured TTL (D-10)', () => {
    initOutcomesAggregateCache({ outcomes: { aggregateCacheTtlMs: 1000 } });
    const fake = vi.useFakeTimers();
    fake.setSystemTime(new Date('2026-04-16T10:00:00Z'));
    aggregateCacheSet('k1', 'cohort-a', { v: 1 });
    expect(aggregateCacheGet('k1')).toEqual({ v: 1 });
    fake.advanceTimersByTime(1500);
    expect(aggregateCacheGet('k1')).toBeNull();
  });

  it('defaults TTL to 30 minutes when outcomes.aggregateCacheTtlMs is absent', () => {
    initOutcomesAggregateCache({});
    const fake = vi.useFakeTimers();
    fake.setSystemTime(new Date('2026-04-16T10:00:00Z'));
    aggregateCacheSet('k1', 'cohort-a', { v: 1 });
    fake.advanceTimersByTime(29 * 60 * 1000);
    expect(aggregateCacheGet('k1')).toEqual({ v: 1 });
    fake.advanceTimersByTime(2 * 60 * 1000);
    expect(aggregateCacheGet('k1')).toBeNull();
  });

  it.each([
    [{ outcomes: { aggregateCacheTtlMs: -1 } }, 'negative'],
    [{ outcomes: { aggregateCacheTtlMs: 0 } }, 'zero'],
    [{ outcomes: { aggregateCacheTtlMs: 'foo' } }, 'string'],
    [{ outcomes: { aggregateCacheTtlMs: NaN } }, 'NaN'],
  ])('falls back to 30-min default for invalid TTL (%s)', (settings) => {
    initOutcomesAggregateCache(settings as Record<string, unknown>);
    const fake = vi.useFakeTimers();
    fake.setSystemTime(new Date('2026-04-16T10:00:00Z'));
    aggregateCacheSet('k1', 'cohort-a', { v: 1 });
    fake.advanceTimersByTime(15 * 60 * 1000);
    expect(aggregateCacheGet('k1')).toEqual({ v: 1 }); // 15 min < 30 min default
  });

  it('invalidateByCohort drops matching entries only', () => {
    aggregateCacheSet('k-a-1', 'cohort-a', { v: 1 });
    aggregateCacheSet('k-a-2', 'cohort-a', { v: 2 });
    aggregateCacheSet('k-b-1', 'cohort-b', { v: 3 });
    invalidateByCohort('cohort-a');
    expect(aggregateCacheGet('k-a-1')).toBeNull();
    expect(aggregateCacheGet('k-a-2')).toBeNull();
    expect(aggregateCacheGet('k-b-1')).toEqual({ v: 3 });
  });

  it('invalidateByCohort is a no-op for unknown cohortId', () => {
    aggregateCacheSet('k-a-1', 'cohort-a', { v: 1 });
    invalidateByCohort('cohort-unknown');
    expect(aggregateCacheGet('k-a-1')).toEqual({ v: 1 });
  });

  it('_resetForTesting clears state and restores default TTL', () => {
    initOutcomesAggregateCache({ outcomes: { aggregateCacheTtlMs: 1000 } });
    aggregateCacheSet('k1', 'cohort-a', { v: 1 });
    _resetForTesting();
    expect(aggregateCacheGet('k1')).toBeNull();
    // After reset TTL is back to default 30 min — set again and check survival at 15 min
    const fake = vi.useFakeTimers();
    fake.setSystemTime(new Date('2026-04-16T10:00:00Z'));
    aggregateCacheSet('k1', 'cohort-a', { v: 2 });
    fake.advanceTimersByTime(15 * 60 * 1000);
    expect(aggregateCacheGet('k1')).toEqual({ v: 2 });
  });
});
