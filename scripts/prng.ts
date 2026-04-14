/**
 * Mulberry32 — hand-rolled seeded PRNG. Zero dependencies.
 *
 * Used by scripts/generate-center-bundle.ts so that the same `seed` always
 * produces the same FHIR Bundle output (byte-identical regeneration is part
 * of the threat model: see T-07-06 in 07-02-PLAN.md).
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inclusive integer in [min, max]. */
export function seededRandInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

/** Pick one element from a non-empty array using the given rand source. */
export function seededPick<T>(rand: () => number, arr: readonly T[]): T {
  if (arr.length === 0) throw new Error('seededPick: empty array');
  return arr[Math.floor(rand() * arr.length)]!;
}

/** ISO date (YYYY-MM-DD) offset by `days` from the given anchor. */
export function addDays(isoAnchor: string, days: number): string {
  const d = new Date(isoAnchor);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
