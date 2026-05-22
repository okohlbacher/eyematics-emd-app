/**
 * Phase 31 Plan 01 — Wave 0 RED targets for parseSubcohortName unit tests (SC4 / KOH-003).
 *
 * These tests are INTENTIONALLY RED until Plan 02 creates src/services/cohortNames.ts.
 * They define the contract for parseSubcohortName, isSubcohortName, and duplicate
 * normalization per 31-VALIDATION.md §"Wave 0 Requirements".
 */
import { describe, expect, it } from 'vitest';

import type { SavedSearch } from '../shared/types/fhir';
// RED: this import will fail until Plan 02 creates src/services/cohortNames.ts
import {
  groupByParent,
  isSubcohortName,
  parseSubcohortName,
} from '../src/services/cohortNames';

// ---------------------------------------------------------------------------
// parseSubcohortName — contract tests
// ---------------------------------------------------------------------------

describe('parseSubcohortName', () => {
  it('SC4: returns { parent, sub } for a valid name with exactly one colon', () => {
    expect(parseSubcohortName('C1:Male')).toEqual({ parent: 'C1', sub: 'Male' });
  });

  it('SC4: throws for a name with zero colons', () => {
    expect(() => parseSubcohortName('NoColon')).toThrow();
  });

  it('SC4: throws for a name with two or more colons', () => {
    expect(() => parseSubcohortName('A:B:C')).toThrow();
  });

  it('SC4: trims whitespace around the colon and within each segment', () => {
    expect(parseSubcohortName('C1 : Male ')).toEqual({ parent: 'C1', sub: 'Male' });
  });

  it('SC4: throws when the parent segment is empty (":Sub")', () => {
    expect(() => parseSubcohortName(':Sub')).toThrow();
  });

  it('SC4: throws when the sub segment is empty ("Parent:")', () => {
    expect(() => parseSubcohortName('Parent:')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// isSubcohortName — helper tests
// ---------------------------------------------------------------------------

describe('isSubcohortName', () => {
  it('returns true for a name with exactly one colon', () => {
    expect(isSubcohortName('C1:Male')).toBe(true);
  });

  it('returns false for a name with zero colons', () => {
    expect(isSubcohortName('FlatCohort')).toBe(false);
  });

  it('returns false for a name with two colons', () => {
    expect(isSubcohortName('A:B:C')).toBe(false);
  });

  it('CR-01: returns false for empty-segment names (":Male", "C1:")', () => {
    expect(isSubcohortName(':Male')).toBe(false);
    expect(isSubcohortName('C1:')).toBe(false);
    expect(isSubcohortName(' : ')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// groupByParent — must never throw on malformed server-loaded names (CR-01)
// ---------------------------------------------------------------------------

describe('groupByParent', () => {
  const mk = (id: string, name: string): SavedSearch => ({
    id,
    name,
    createdAt: '2026-05-21T00:00:00.000Z',
    filters: {},
  });

  it('CR-01: does not throw on empty-segment names and treats them as flat', () => {
    const searches = [mk('1', 'C1'), mk('2', ':Male'), mk('3', 'C1:'), mk('4', 'C1:Female')];
    let result!: ReturnType<typeof groupByParent>;
    expect(() => {
      result = groupByParent(searches);
    }).not.toThrow();
    // ":Male" and "C1:" are not valid subcohorts → flat; "C1:Female" links to parent "C1".
    expect(result.flat.map((s) => s.id).sort()).toEqual(['2', '3']);
    expect(result.parents.map((s) => s.id)).toEqual(['1']);
    expect(result.subcohorts.map((s) => s.id)).toEqual(['4']);
  });
});

// ---------------------------------------------------------------------------
// Duplicate normalization (D-04)
//
// The normalization function is not exported directly; its behaviour is
// observable through the duplicate-detection helper. We import a
// `normalizeCohortName` helper here — if the module exports it.
// If not exported, Plan 02 must export it so these tests can verify D-04.
// ---------------------------------------------------------------------------

// RED: normalizeCohortName will be exported from src/services/cohortNames.ts in Plan 02
import { normalizeCohortName } from '../src/services/cohortNames';

describe('normalizeCohortName (D-04 duplicate detection)', () => {
  it('normalizes to trimmed, whitespace-collapsed, lowercase string', () => {
    expect(normalizeCohortName('C1:Male')).toBe('c1:male');
  });

  it('treats "c1:male " as a duplicate of "C1:Male"', () => {
    expect(normalizeCohortName('c1:male ')).toBe(normalizeCohortName('C1:Male'));
  });

  it('treats "C1 : Male" as a duplicate of "C1:Male"', () => {
    expect(normalizeCohortName('C1 : Male')).toBe(normalizeCohortName('C1:Male'));
  });

  it('treats differently-named cohorts as non-duplicates', () => {
    expect(normalizeCohortName('C1:Male')).not.toBe(normalizeCohortName('C1:Female'));
  });
});
