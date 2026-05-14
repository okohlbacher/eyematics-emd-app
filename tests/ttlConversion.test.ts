/**
 * Wave 0 RED scaffold — Plan 28-01, Task 2
 *
 * Unit tests for TTL hours<->ms conversion and client-side validation.
 * The module under test (src/services/ttlConversion.ts) does NOT EXIST YET.
 * These tests will FAIL with "Cannot find module" until Plan 28-03 implements it.
 *
 * Contract for src/services/ttlConversion.ts (to be implemented in Plan 28-03):
 *   export function hoursToMs(hours: number): number;      // hours * 3_600_000
 *   export function msToHours(ms: number): number;          // Math.round(ms / 3_600_000)
 *   export function validateTtl(refreshHours: number, capHours: number): 'ok' | 'refreshMin' | 'capMin';
 *
 * Requirement: SESSUI-03 (D-07 hours↔ms conversion, D-08 client-side validation)
 */

import { describe, expect, it } from 'vitest';

// This import fails until Plan 28-03 creates the module — expected RED state.
import { hoursToMs, msToHours, validateTtl } from '../src/services/ttlConversion';

// ---------------------------------------------------------------------------
// hoursToMs / msToHours round-trip
// ---------------------------------------------------------------------------

describe('hoursToMs / msToHours round-trip', () => {
  it('hoursToMs(8) === 28_800_000', () => {
    expect(hoursToMs(8)).toBe(28_800_000);
  });

  it('hoursToMs(12) === 43_200_000', () => {
    expect(hoursToMs(12)).toBe(43_200_000);
  });

  it('msToHours(28_800_000) === 8', () => {
    expect(msToHours(28_800_000)).toBe(8);
  });

  it('msToHours round-trips hoursToMs for 1..48 hours', () => {
    for (let h = 1; h <= 48; h++) {
      expect(msToHours(hoursToMs(h))).toBe(h);
    }
  });

  it('msToHours rounds fractional hours (1.5h → 2)', () => {
    // 1.5 hours = 5_400_000 ms — Math.round(1.5) === 2
    expect(msToHours(5_400_000)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// validateTtl (D-08 client-side validation)
// ---------------------------------------------------------------------------

describe('validateTtl (D-08)', () => {
  it("returns 'ok' for refresh=8, cap=12", () => {
    expect(validateTtl(8, 12)).toBe('ok');
  });

  it("returns 'refreshMin' when refresh < 1", () => {
    expect(validateTtl(0, 12)).toBe('refreshMin');
  });

  it("returns 'refreshMin' when refresh is not an integer", () => {
    expect(validateTtl(1.5, 12)).toBe('refreshMin');
  });

  it("returns 'capMin' when cap < refresh", () => {
    expect(validateTtl(8, 4)).toBe('capMin');
  });

  it("returns 'ok' when cap === refresh (boundary)", () => {
    expect(validateTtl(8, 8)).toBe('ok');
  });

  it("returns 'capMin' when cap is not an integer", () => {
    expect(validateTtl(8, 12.5)).toBe('capMin');
  });

  it("returns 'capMax' when cap exceeds 720 hours (30 days)", () => {
    expect(validateTtl(8, 721)).toBe('capMax');
  });

  it("returns 'capMax' at the boundary: cap === 720 is ok, 721 is not", () => {
    expect(validateTtl(1, 720)).toBe('ok');
    expect(validateTtl(1, 721)).toBe('capMax');
  });
});
