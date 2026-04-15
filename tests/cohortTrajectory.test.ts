/**
 * Tests for src/utils/cohortTrajectory.ts — pure trajectory math utility (Phase 8).
 *
 * TDD RED phase: all tests import from the module before it exists.
 * They will fail with "Cannot find module" or similar until Task 2 creates the file.
 */

import { describe, expect, it } from 'vitest';

import {
  buildGrid,
  decimalToLogmar,
  decimalToSnellen,
  defaultScatterOn,
  eyeOf,
  interpolate,
  percentile,
  treatmentIndexAt,
} from '../src/utils/cohortTrajectory';
import {
  SNOMED_EYE_LEFT,
  SNOMED_EYE_RIGHT,
} from '../src/services/fhirLoader';

// ---------------------------------------------------------------------------
// Helper: build minimal Procedure fixture for treatmentIndexAt tests
// ---------------------------------------------------------------------------
function makeIviProc(performedDateTime: string, eyeCode?: string) {
  return {
    performedDateTime,
    code: { coding: [{ code: '36189003' }] }, // SNOMED_IVI
    bodySite: eyeCode ? [{ coding: [{ code: eyeCode }] }] : undefined,
  };
}

function makeOtherProc(performedDateTime: string) {
  return {
    performedDateTime,
    code: { coding: [{ code: '99999999' }] }, // non-IVI code
    bodySite: undefined,
  };
}

// ---------------------------------------------------------------------------
// describe: cohortTrajectory — pure helpers
// ---------------------------------------------------------------------------
describe('cohortTrajectory — pure helpers', () => {

  // -------------------------------------------------------------------------
  // decimalToLogmar
  // -------------------------------------------------------------------------
  describe('decimalToLogmar', () => {
    it('decimalToLogmar(1.0) === 0', () => {
      expect(decimalToLogmar(1.0)).toBeCloseTo(0, 3);
    });

    it('decimalToLogmar(0.5) ≈ 0.301', () => {
      expect(decimalToLogmar(0.5)).toBeCloseTo(0.301, 3);
    });

    it('decimalToLogmar(0.1) ≈ 1.0', () => {
      expect(decimalToLogmar(0.1)).toBeCloseTo(1.0, 3);
    });

    it('decimalToLogmar(0) is NaN — documented per D-40/pitfall 7', () => {
      expect(decimalToLogmar(0)).toBeNaN();
    });

    it('decimalToLogmar(-0.1) is NaN', () => {
      expect(decimalToLogmar(-0.1)).toBeNaN();
    });
  });

  // -------------------------------------------------------------------------
  // decimalToSnellen
  // -------------------------------------------------------------------------
  describe('decimalToSnellen', () => {
    it('decimalToSnellen(0.5) === { num: 20, den: 40 }', () => {
      expect(decimalToSnellen(0.5)).toEqual({ num: 20, den: 40 });
    });

    it('decimalToSnellen(1.0) === { num: 20, den: 20 }', () => {
      expect(decimalToSnellen(1.0)).toEqual({ num: 20, den: 20 });
    });

    it('decimalToSnellen(0.1) === { num: 20, den: 200 }', () => {
      expect(decimalToSnellen(0.1)).toEqual({ num: 20, den: 200 });
    });

    it('decimalToSnellen(0.4) === { num: 20, den: 50 } — 20/0.4 = 50', () => {
      expect(decimalToSnellen(0.4)).toEqual({ num: 20, den: 50 });
    });
  });

  // -------------------------------------------------------------------------
  // eyeOf
  // -------------------------------------------------------------------------
  describe('eyeOf', () => {
    it('eyeOf(CodeableConcept with SNOMED_EYE_RIGHT) === "od"', () => {
      expect(eyeOf({ coding: [{ code: SNOMED_EYE_RIGHT }] })).toBe('od');
    });

    it('eyeOf(array form with SNOMED_EYE_LEFT) === "os"', () => {
      expect(eyeOf([{ coding: [{ code: SNOMED_EYE_LEFT }] }])).toBe('os');
    });

    it('eyeOf(unknown code) === null', () => {
      expect(eyeOf({ coding: [{ code: 'unknown' }] })).toBeNull();
    });

    it('eyeOf(undefined) === null', () => {
      expect(eyeOf(undefined)).toBeNull();
    });

    it('eyeOf({}) === null', () => {
      expect(eyeOf({})).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // treatmentIndexAt
  // -------------------------------------------------------------------------
  describe('treatmentIndexAt', () => {
    it('zero procedures → 0 for any (eye, date)', () => {
      expect(treatmentIndexAt([], '2023-06-01', 'od')).toBe(0);
      expect(treatmentIndexAt([], '2023-06-01', 'os')).toBe(0);
      expect(treatmentIndexAt([], '2023-06-01', 'combined')).toBe(0);
    });

    it('3 IVI OD procedures on days 0, 30, 60; queried at day 45 → OD=2, OS=0, combined=2', () => {
      const procs = [
        makeIviProc('2023-01-01', SNOMED_EYE_RIGHT), // day 0
        makeIviProc('2023-01-31', SNOMED_EYE_RIGHT), // day 30
        makeIviProc('2023-03-02', SNOMED_EYE_RIGHT), // day 60
      ];
      // Query at day 45 = 2023-02-15
      expect(treatmentIndexAt(procs as any, '2023-02-15', 'od')).toBe(2);
      expect(treatmentIndexAt(procs as any, '2023-02-15', 'os')).toBe(0);
      expect(treatmentIndexAt(procs as any, '2023-02-15', 'combined')).toBe(2);
    });

    it('mixed eyes: OD on 0,30 + OS on 10,40 + bilateral (no bodySite) on 20; at day 50 → OD=2, OS=2, combined=5', () => {
      const procs = [
        makeIviProc('2023-01-01', SNOMED_EYE_RIGHT), // OD day 0
        makeIviProc('2023-01-11', SNOMED_EYE_LEFT),  // OS day 10
        makeIviProc('2023-01-21'),                   // bilateral (no bodySite) day 20
        makeIviProc('2023-01-31', SNOMED_EYE_RIGHT), // OD day 30
        makeIviProc('2023-02-10', SNOMED_EYE_LEFT),  // OS day 40
      ];
      // Query at day 50 = 2023-02-20
      expect(treatmentIndexAt(procs as any, '2023-02-20', 'od')).toBe(2);
      expect(treatmentIndexAt(procs as any, '2023-02-20', 'os')).toBe(2);
      expect(treatmentIndexAt(procs as any, '2023-02-20', 'combined')).toBe(5);
    });

    it('non-IVI procedures are ignored', () => {
      const procs = [
        makeOtherProc('2023-01-01'),
        makeOtherProc('2023-01-15'),
        makeIviProc('2023-02-01', SNOMED_EYE_RIGHT),
      ];
      expect(treatmentIndexAt(procs as any, '2023-03-01', 'od')).toBe(1);
      expect(treatmentIndexAt(procs as any, '2023-03-01', 'combined')).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // interpolate
  // -------------------------------------------------------------------------
  describe('interpolate', () => {
    it('empty series + any grid → all null', () => {
      expect(interpolate([], [0, 50, 100])).toEqual([null, null, null]);
    });

    it('single-point series, grid includes that x → value at matching x, null elsewhere', () => {
      // Single point at x=50, y=1.0
      const result = interpolate([{ x: 50, y: 1.0 }], [10, 50, 90]);
      expect(result[0]).toBeNull();
      expect(result[1]).toBe(1.0);
      expect(result[2]).toBeNull();
    });

    it('interpolate([{x:0,y:1},{x:100,y:2}], [−5,0,50,100,200]) → [null,1,1.5,2,null]', () => {
      // x=50 is the true midpoint of [0,100], so y = 1 + (50/100)*1 = 1.5
      const series = [{ x: 0, y: 1 }, { x: 100, y: 2 }];
      const result = interpolate(series, [-5, 0, 50, 100, 200]);
      expect(result[0]).toBeNull();          // -5 < 0 → outside span
      expect(result[1]).toBe(1);             // exact match at x=0
      expect(result[2]).toBeCloseTo(1.5, 5); // true midpoint
      expect(result[3]).toBe(2);             // exact match at x=100
      expect(result[4]).toBeNull();          // 200 > 100 → outside span (D-15)
    });

    it('returns null outside observed span (D-15)', () => {
      const series = [{ x: 20, y: 0.5 }, { x: 80, y: 0.8 }];
      const result = interpolate(series, [0, 20, 50, 80, 100]);
      expect(result[0]).toBeNull();  // before span
      expect(result[4]).toBeNull();  // after span
    });
  });

  // -------------------------------------------------------------------------
  // percentile
  // -------------------------------------------------------------------------
  describe('percentile', () => {
    it('percentile([], 0.5) is NaN', () => {
      expect(percentile([], 0.5)).toBeNaN();
    });

    it('percentile([5], 0.5) === 5', () => {
      expect(percentile([5], 0.5)).toBe(5);
    });

    it('percentile([1,2,3,4,5], 0.25) === 2', () => {
      expect(percentile([1, 2, 3, 4, 5], 0.25)).toBe(2);
    });

    it('percentile([1,2,3,4,5], 0.75) === 4', () => {
      expect(percentile([1, 2, 3, 4, 5], 0.75)).toBe(4);
    });

    it('percentile([1,2], 0.5) === 1.5 (linear interp)', () => {
      expect(percentile([1, 2], 0.5)).toBeCloseTo(1.5, 5);
    });
  });

  // -------------------------------------------------------------------------
  // buildGrid
  // -------------------------------------------------------------------------
  describe('buildGrid', () => {
    it('[[0,10,20]] with 3 points → [0,10,20]', () => {
      expect(buildGrid([[0, 10, 20]], 3)).toEqual([0, 10, 20]);
    });

    it('[[0,100],[50,150]] with 4 points → [0,50,100,150]', () => {
      expect(buildGrid([[0, 100], [50, 150]], 4)).toEqual([0, 50, 100, 150]);
    });

    it('max === min → single-point grid', () => {
      const result = buildGrid([[42, 42]], 5);
      expect(result).toEqual([42]);
    });

    it('empty input → empty array', () => {
      expect(buildGrid([], 10)).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // defaultScatterOn
  // -------------------------------------------------------------------------
  describe('defaultScatterOn', () => {
    it('defaultScatterOn(0) === true', () => {
      expect(defaultScatterOn(0)).toBe(true);
    });

    it('defaultScatterOn(29) === true (D-39 boundary)', () => {
      expect(defaultScatterOn(29)).toBe(true);
    });

    it('defaultScatterOn(30) === true (D-39 boundary: ≤ 30 ON)', () => {
      expect(defaultScatterOn(30)).toBe(true);
    });

    it('defaultScatterOn(31) === false (D-39 boundary)', () => {
      expect(defaultScatterOn(31)).toBe(false);
    });

    it('defaultScatterOn(1000) === false', () => {
      expect(defaultScatterOn(1000)).toBe(false);
    });
  });

});
