/**
 * Phase 12 / AGG-04 / D-07..D-10 — in-memory aggregate response cache.
 *
 * Map<cacheKey, { result, expires, cohortId }>. cacheKey is a JSON.stringify
 * of a user-scoped request shape built by the handler (D-08). TTL defaults
 * to 30 minutes, overridable via settings.outcomes.aggregateCacheTtlMs (D-10).
 * Explicit invalidation via invalidateByCohort(cohortId) is called by
 * server/dataApi.ts saved-search POST / DELETE handlers (D-09).
 *
 * Pure in-memory — survives until process restart. No disk fallback.
 */

interface CacheEntry {
  result: unknown;
  expires: number;
  cohortId: string;
}

const DEFAULT_TTL_MS = 30 * 60 * 1000;

let _cache: Map<string, CacheEntry> = new Map();
let _ttlMs: number = DEFAULT_TTL_MS;

export function initOutcomesAggregateCache(settings: Record<string, unknown>): void {
  const outcomes = (settings.outcomes ?? {}) as Record<string, unknown>;
  if (typeof outcomes.aggregateCacheTtlMs === 'number' && Number.isFinite(outcomes.aggregateCacheTtlMs) && outcomes.aggregateCacheTtlMs > 0) {
    _ttlMs = outcomes.aggregateCacheTtlMs;
  } else {
    _ttlMs = DEFAULT_TTL_MS;
  }
}

export function aggregateCacheGet(key: string): unknown | null {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (entry.expires < Date.now()) {
    _cache.delete(key);
    return null;
  }
  return entry.result;
}

export function aggregateCacheSet(key: string, cohortId: string, result: unknown): void {
  _cache.set(key, { result, expires: Date.now() + _ttlMs, cohortId });
}

export function invalidateByCohort(cohortId: string): void {
  for (const [key, entry] of _cache) {
    if (entry.cohortId === cohortId) _cache.delete(key);
  }
}

/** Test-only reset. */
export function _resetForTesting(): void {
  _cache = new Map();
  _ttlMs = DEFAULT_TTL_MS;
}
