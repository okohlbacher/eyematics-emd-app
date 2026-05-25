/**
 * Tests for shared/savedSearchSanitize.ts — server-safe CohortFilter whitelist.
 *
 * TDD RED phase: written before implementation.
 * Covers all behavior bullets from 40-01-PLAN.md Task 1.
 */

import { describe, expect, it } from 'vitest';

import { sanitizeSavedSearchFilters } from '../shared/savedSearchSanitize.js';

describe('sanitizeSavedSearchFilters', () => {
  // Non-object inputs return {}
  it('returns {} for null input', () => {
    expect(sanitizeSavedSearchFilters(null)).toEqual({});
  });

  it('returns {} for undefined input', () => {
    expect(sanitizeSavedSearchFilters(undefined)).toEqual({});
  });

  it('returns {} for string input', () => {
    expect(sanitizeSavedSearchFilters('evil')).toEqual({});
  });

  it('returns {} for number input', () => {
    expect(sanitizeSavedSearchFilters(42)).toEqual({});
  });

  it('returns {} for array input', () => {
    expect(sanitizeSavedSearchFilters(['a', 'b'])).toEqual({});
  });

  it('returns {} for empty object', () => {
    expect(sanitizeSavedSearchFilters({})).toEqual({});
  });

  // Unknown keys are stripped
  it('strips unknown keys', () => {
    const result = sanitizeSavedSearchFilters({ evil: 'x', __proto__: {}, randomBlob: [1, 2, 3] });
    expect(result).not.toHaveProperty('evil');
    expect(result).not.toHaveProperty('__proto__');
    expect(result).not.toHaveProperty('randomBlob');
    expect(result).toEqual({});
  });

  it('strips prototype pollution attempt keys', () => {
    const raw = Object.create(null) as Record<string, unknown>;
    raw['__proto__'] = { isAdmin: true };
    raw['constructor'] = { name: 'evil' };
    raw['diagnosis'] = ['AMD'];
    const result = sanitizeSavedSearchFilters(raw);
    expect(result).not.toHaveProperty('__proto__');
    expect(result).not.toHaveProperty('constructor');
    expect(result).toHaveProperty('diagnosis', ['AMD']);
  });

  it('strips all keys when all are unknown', () => {
    const result = sanitizeSavedSearchFilters({ a: 1, b: 2, c: 3 });
    expect(result).toEqual({});
  });

  // Known string[] keys
  it('preserves diagnosis as string[]', () => {
    const result = sanitizeSavedSearchFilters({ diagnosis: ['AMD', 'DR'] });
    expect(result).toHaveProperty('diagnosis', ['AMD', 'DR']);
  });

  it('preserves gender as string[]', () => {
    const result = sanitizeSavedSearchFilters({ gender: ['male'] });
    expect(result).toHaveProperty('gender', ['male']);
  });

  it('preserves centers as string[]', () => {
    const result = sanitizeSavedSearchFilters({ centers: ['org-uka', 'org-ukc'] });
    expect(result).toHaveProperty('centers', ['org-uka', 'org-ukc']);
  });

  it('preserves diagnosisSubtype as string[]', () => {
    const result = sanitizeSavedSearchFilters({ diagnosisSubtype: ['nAMD', 'GA'] });
    expect(result).toHaveProperty('diagnosisSubtype', ['nAMD', 'GA']);
  });

  it('preserves medicationCodes as string[]', () => {
    const result = sanitizeSavedSearchFilters({ medicationCodes: ['ATC-S01LA'] });
    expect(result).toHaveProperty('medicationCodes', ['ATC-S01LA']);
  });

  // flaggedCaseIds stays as string[] (wire form — NOT reconstructed as Set)
  it('preserves flaggedCaseIds as string[] (wire form, no Set)', () => {
    const result = sanitizeSavedSearchFilters({ flaggedCaseIds: ['case-001', 'case-002'] });
    expect(result).toHaveProperty('flaggedCaseIds');
    const ids = (result as { flaggedCaseIds: unknown }).flaggedCaseIds;
    expect(Array.isArray(ids)).toBe(true);
    expect(ids).toEqual(['case-001', 'case-002']);
    // Must NOT be a Set
    expect(ids instanceof Set).toBe(false);
  });

  // Numeric range tuples — only kept when length === 2
  it('preserves ageRange when length is 2', () => {
    const result = sanitizeSavedSearchFilters({ ageRange: [20, 80] });
    expect(result).toHaveProperty('ageRange', [20, 80]);
  });

  it('drops ageRange when length is not 2', () => {
    const result = sanitizeSavedSearchFilters({ ageRange: [20] });
    expect(result).not.toHaveProperty('ageRange');
  });

  it('drops ageRange when length is 3', () => {
    const result = sanitizeSavedSearchFilters({ ageRange: [20, 40, 80] });
    expect(result).not.toHaveProperty('ageRange');
  });

  it('preserves visusRange when length is 2', () => {
    const result = sanitizeSavedSearchFilters({ visusRange: [0.1, 1.0] });
    expect(result).toHaveProperty('visusRange', [0.1, 1.0]);
  });

  it('drops visusRange when not length 2', () => {
    const result = sanitizeSavedSearchFilters({ visusRange: [0.1] });
    expect(result).not.toHaveProperty('visusRange');
  });

  it('preserves crtRange when length is 2', () => {
    const result = sanitizeSavedSearchFilters({ crtRange: [100, 500] });
    expect(result).toHaveProperty('crtRange', [100, 500]);
  });

  it('preserves hba1cRange when length is 2', () => {
    const result = sanitizeSavedSearchFilters({ hba1cRange: [5.0, 10.0] });
    expect(result).toHaveProperty('hba1cRange', [5.0, 10.0]);
  });

  // preset — restricted to four literals
  it('preserves valid preset literal', () => {
    const result = sanitizeSavedSearchFilters({ preset: 'therapyBreaker' });
    expect(result).toHaveProperty('preset', 'therapyBreaker');
  });

  it('preserves all valid preset literals', () => {
    for (const preset of ['therapyBreaker', 'implausibleCrt', 'flaggedQuality', 'implausibleVisus']) {
      const result = sanitizeSavedSearchFilters({ preset });
      expect(result).toHaveProperty('preset', preset);
    }
  });

  it('drops invalid preset value', () => {
    const result = sanitizeSavedSearchFilters({ preset: 'hackerPreset' });
    expect(result).not.toHaveProperty('preset');
  });

  // laterality — restricted to OD/OS/OU
  it('preserves valid laterality OD', () => {
    const result = sanitizeSavedSearchFilters({ laterality: 'OD' });
    expect(result).toHaveProperty('laterality', 'OD');
  });

  it('preserves valid laterality OS', () => {
    const result = sanitizeSavedSearchFilters({ laterality: 'OS' });
    expect(result).toHaveProperty('laterality', 'OS');
  });

  it('preserves valid laterality OU', () => {
    const result = sanitizeSavedSearchFilters({ laterality: 'OU' });
    expect(result).toHaveProperty('laterality', 'OU');
  });

  it('drops invalid laterality', () => {
    const result = sanitizeSavedSearchFilters({ laterality: 'BOTH' });
    expect(result).not.toHaveProperty('laterality');
  });

  // hasComorbidity boolean
  it('preserves hasComorbidity true', () => {
    const result = sanitizeSavedSearchFilters({ hasComorbidity: true });
    expect(result).toHaveProperty('hasComorbidity', true);
  });

  it('preserves hasComorbidity false', () => {
    const result = sanitizeSavedSearchFilters({ hasComorbidity: false });
    expect(result).toHaveProperty('hasComorbidity', false);
  });

  it('drops hasComorbidity when not boolean', () => {
    const result = sanitizeSavedSearchFilters({ hasComorbidity: 'yes' });
    expect(result).not.toHaveProperty('hasComorbidity');
  });

  // Mixed: known + unknown keys
  it('keeps only known keys from mixed input', () => {
    const result = sanitizeSavedSearchFilters({
      centers: ['org-uka'],
      evil: 1,
      __proto__: {},
      diagnosis: ['AMD'],
      injected: 'payload',
    });
    expect(result).toHaveProperty('centers', ['org-uka']);
    expect(result).toHaveProperty('diagnosis', ['AMD']);
    expect(result).not.toHaveProperty('evil');
    expect(result).not.toHaveProperty('__proto__');
    expect(result).not.toHaveProperty('injected');
  });

  // Full valid filter round-trip
  it('preserves all valid filter keys together', () => {
    const input = {
      diagnosis: ['AMD'],
      gender: ['female'],
      ageRange: [40, 90],
      visusRange: [0.0, 1.2],
      crtRange: [100, 800],
      centers: ['org-uka'],
      preset: 'flaggedQuality',
      flaggedCaseIds: ['case-001'],
      diagnosisSubtype: ['nAMD'],
      hasComorbidity: true,
      hba1cRange: [5.5, 8.0],
      medicationCodes: ['ATC-S01LA'],
      laterality: 'OS',
    };
    const result = sanitizeSavedSearchFilters(input);
    expect(result).toMatchObject({
      diagnosis: ['AMD'],
      gender: ['female'],
      ageRange: [40, 90],
      visusRange: [0.0, 1.2],
      crtRange: [100, 800],
      centers: ['org-uka'],
      preset: 'flaggedQuality',
      flaggedCaseIds: ['case-001'],
      diagnosisSubtype: ['nAMD'],
      hasComorbidity: true,
      hba1cRange: [5.5, 8.0],
      medicationCodes: ['ATC-S01LA'],
      laterality: 'OS',
    });
  });
});
