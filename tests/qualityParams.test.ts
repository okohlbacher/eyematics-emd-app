/**
 * Tests for shared/qualityParams.ts — canonical quality-check parameter keys.
 *
 * TDD RED phase: written before production code (40-02-PLAN.md Task 1).
 *
 * Covers:
 * - QUALITY_PARAM_KEYS contains all six canonical keys
 * - sanitizeQualityParams: undefined → undefined (back-compat ⇒ all checks)
 * - sanitizeQualityParams: [] → [] (explicit empty, distinct from undefined)
 * - sanitizeQualityParams: strips unknown values, keeps valid ones, deduplicates
 * - sanitizeQualityParams: non-array input (object, number, string) → undefined
 * - resolveQualityParams: returns selection when defined; falls back to all keys
 */

import { describe, expect, it } from 'vitest';

import {
  canonicalizeQualityParams,
  QUALITY_PARAM_KEYS,
  resolveQualityParams,
  sanitizeQualityParams,
} from '../shared/qualityParams.js';

describe('QUALITY_PARAM_KEYS', () => {
  it('contains exactly the six canonical check keys in documented order', () => {
    expect(QUALITY_PARAM_KEYS).toEqual([
      'missingVisus',
      'missingCrt',
      'missingInjections',
      'crtCritical',
      'visusCritical',
      'visusJump',
    ]);
  });

  it('is a readonly array (frozen / as const)', () => {
    // Object.isFrozen passes for readonly tuples defined with as const
    expect(Object.isFrozen(QUALITY_PARAM_KEYS)).toBe(true);
  });
});

describe('sanitizeQualityParams', () => {
  it('returns undefined for undefined input (back-compat: ⇒ all checks)', () => {
    expect(sanitizeQualityParams(undefined)).toBeUndefined();
  });

  it('returns [] for explicit empty array input (distinct from undefined)', () => {
    expect(sanitizeQualityParams([])).toEqual([]);
  });

  it('returns the full list when all six valid keys are passed', () => {
    const all = [...QUALITY_PARAM_KEYS];
    expect(sanitizeQualityParams(all)).toEqual(all);
  });

  it('strips unknown values, keeps valid keys', () => {
    const input = ['missingVisus', 'bogus', 'crtCritical', '__proto__'];
    expect(sanitizeQualityParams(input)).toEqual(['missingVisus', 'crtCritical']);
  });

  it('de-duplicates — returns each key at most once, preserving first occurrence order', () => {
    const input = ['visusJump', 'missingVisus', 'visusJump', 'missingVisus'];
    expect(sanitizeQualityParams(input)).toEqual(['visusJump', 'missingVisus']);
  });

  it('returns undefined for a plain object (non-array) input', () => {
    expect(sanitizeQualityParams({ missingVisus: true })).toBeUndefined();
  });

  it('returns undefined for a number input', () => {
    expect(sanitizeQualityParams(42)).toBeUndefined();
  });

  it('returns undefined for a string input', () => {
    expect(sanitizeQualityParams('missingVisus')).toBeUndefined();
  });

  it('returns undefined for null input', () => {
    expect(sanitizeQualityParams(null)).toBeUndefined();
  });

  it('handles a subset of known keys', () => {
    const input = ['missingCrt', 'visusJump'];
    expect(sanitizeQualityParams(input)).toEqual(['missingCrt', 'visusJump']);
  });

  it('returns [] when all input values are unknown keys', () => {
    expect(sanitizeQualityParams(['evil', 'hack'])).toEqual([]);
  });

  it('coerces non-string array entries by ignoring them (they will never match a key)', () => {
    // Numbers in the array cannot match string keys — should be stripped
    expect(sanitizeQualityParams([1, 2, 'missingVisus'])).toEqual(['missingVisus']);
  });
});

describe('resolveQualityParams', () => {
  it('returns all keys when selection is undefined', () => {
    expect(resolveQualityParams(undefined)).toEqual([...QUALITY_PARAM_KEYS]);
  });

  it('returns [] when selection is [] (explicit none)', () => {
    expect(resolveQualityParams([])).toEqual([]);
  });

  it('returns the provided subset when defined', () => {
    const subset = ['missingVisus', 'crtCritical'];
    expect(resolveQualityParams(subset)).toEqual(subset);
  });

  it('returns all keys when selection is the full list', () => {
    expect(resolveQualityParams([...QUALITY_PARAM_KEYS])).toEqual([...QUALITY_PARAM_KEYS]);
  });
});

describe('canonicalizeQualityParams', () => {
  it('passes undefined through unchanged (back-compat unset)', () => {
    expect(canonicalizeQualityParams(undefined)).toBeUndefined();
  });

  it('collapses a full selection (all keys) to undefined', () => {
    expect(canonicalizeQualityParams([...QUALITY_PARAM_KEYS])).toBeUndefined();
  });

  it('preserves a proper subset', () => {
    const subset = ['missingVisus', 'crtCritical'];
    expect(canonicalizeQualityParams(subset)).toEqual(subset);
  });

  it('preserves the explicit-empty selection [] (distinct from undefined)', () => {
    expect(canonicalizeQualityParams([])).toEqual([]);
  });

  it('round-trips with resolveQualityParams: all-checked ⇒ undefined ⇒ all-checked', () => {
    const canonical = canonicalizeQualityParams([...QUALITY_PARAM_KEYS]);
    expect(resolveQualityParams(canonical)).toEqual([...QUALITY_PARAM_KEYS]);
  });
});
