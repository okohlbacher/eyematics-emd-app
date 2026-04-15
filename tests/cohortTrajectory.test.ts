/**
 * Tests for src/utils/cohortTrajectory.ts — pure trajectory math utility (Phase 8).
 *
 * TDD RED phase: all tests import from the module before it exists.
 * They will fail with "Cannot find module" or similar until Task 2 creates the file.
 */

import { describe, expect, it } from 'vitest';

import {
  buildGrid,
  computeCohortTrajectory,
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

// ---------------------------------------------------------------------------
// Fixture helpers for computeCohortTrajectory tests
// ---------------------------------------------------------------------------

function makeObs(
  date: string,
  decimal: number,
  eyeCode?: string,
  id = 'obs-' + date + '-' + (eyeCode ?? 'unknown')
) {
  return {
    resourceType: 'Observation' as const,
    id,
    status: 'final',
    subject: { reference: 'Patient/p1' },
    code: { coding: [{ code: '79880-1', system: 'http://loinc.org' }] }, // LOINC_VISUS
    effectiveDateTime: date,
    valueQuantity: { value: decimal, unit: 'decimal' },
    ...(eyeCode ? { bodySite: { coding: [{ code: eyeCode }] } } : {}),
  };
}

function makeIVI(date: string, eyeCode?: string, id = 'proc-' + date) {
  return {
    resourceType: 'Procedure' as const,
    id,
    status: 'completed',
    subject: { reference: 'Patient/p1' },
    code: { coding: [{ code: '36189003' }] }, // SNOMED_IVI
    performedDateTime: date,
    ...(eyeCode ? { bodySite: [{ coding: [{ code: eyeCode }] }] } : {}),
  };
}

function makeCase(
  pseudonym: string,
  observations: ReturnType<typeof makeObs>[],
  procedures: ReturnType<typeof makeIVI>[] = []
) {
  return {
    id: pseudonym,
    pseudonym,
    gender: 'unknown',
    birthDate: '1960-01-01',
    centerId: 'org-test',
    centerName: 'Test Center',
    conditions: [],
    observations: observations as any,
    procedures: procedures as any,
    imagingStudies: [],
    medications: [],
  };
}

// ---------------------------------------------------------------------------
// describe: cohortTrajectory — computeCohortTrajectory OUTCOME-10 cases
// ---------------------------------------------------------------------------
describe('cohortTrajectory — computeCohortTrajectory OUTCOME-10 cases', () => {

  // -------------------------------------------------------------------------
  // 1. Empty cohort
  // -------------------------------------------------------------------------
  it('1. Empty cohort: all panels have patientCount=0, empty arrays', () => {
    const result = computeCohortTrajectory({
      cases: [],
      axisMode: 'days',
      yMetric: 'absolute',
      gridPoints: 20,
    });
    for (const panel of [result.od, result.os, result.combined]) {
      expect(panel.summary.patientCount).toBe(0);
      expect(panel.medianGrid).toEqual([]);
      expect(panel.patients).toEqual([]);
      expect(panel.scatterPoints).toEqual([]);
    }
  });

  // -------------------------------------------------------------------------
  // 2. Single patient, full data
  // -------------------------------------------------------------------------
  it('2. Single patient with 5 OD observations — od panel correct, os excluded', () => {
    const c = makeCase('p1', [
      makeObs('2023-01-01', 0.5, SNOMED_EYE_RIGHT, 'obs-1'),
      makeObs('2023-02-01', 0.6, SNOMED_EYE_RIGHT, 'obs-2'),
      makeObs('2023-03-01', 0.7, SNOMED_EYE_RIGHT, 'obs-3'),
      makeObs('2023-04-01', 0.6, SNOMED_EYE_RIGHT, 'obs-4'),
      makeObs('2023-05-01', 0.5, SNOMED_EYE_RIGHT, 'obs-5'),
    ]);

    const result = computeCohortTrajectory({
      cases: [c],
      axisMode: 'days',
      yMetric: 'absolute',
      gridPoints: 20,
    });

    // OD panel
    expect(result.od.patients).toHaveLength(1);
    expect(result.od.patients[0].excluded).toBe(false);
    // 5 measurements >= ceil(20/10)=2 threshold, sparse=false
    expect(result.od.patients[0].sparse).toBe(false);
    expect(result.od.medianGrid).toHaveLength(20);
    result.od.medianGrid.forEach((gp) => {
      expect(gp.n).toBe(1);
      expect(gp.p25).toBeCloseTo(gp.y, 5);
      expect(gp.p75).toBeCloseTo(gp.y, 5);
    });

    // OS panel — no OS data
    expect(result.os.summary.patientCount).toBe(0);
    expect(result.os.patients[0].excluded).toBe(true);

    // Combined panel — patient has OD data so included
    expect(result.combined.summary.patientCount).toBe(1);
  });

  // -------------------------------------------------------------------------
  // 3. Single measurement in OD
  // -------------------------------------------------------------------------
  it('3. Single measurement → scatter only, not in medianGrid', () => {
    const c = makeCase('p1', [
      makeObs('2023-01-01', 0.5, SNOMED_EYE_RIGHT, 'obs-1'),
    ]);

    const result = computeCohortTrajectory({
      cases: [c],
      axisMode: 'days',
      yMetric: 'absolute',
      gridPoints: 20,
    });

    expect(result.od.patients[0].measurements).toHaveLength(1);
    // D-18: single measurement — not excluded (has a measurement) but doesn't contribute to median
    expect(result.od.patients[0].excluded).toBe(false);
    // medianGrid should be empty (single-measurement patient excluded from grid, D-18)
    expect(result.od.medianGrid).toHaveLength(0);
    // But scatterPoints should have 1 entry
    expect(result.od.scatterPoints).toHaveLength(1);
    expect(result.od.scatterPoints[0].patientId).toBe('p1');
  });

  // -------------------------------------------------------------------------
  // 4. Sparse series
  // -------------------------------------------------------------------------
  it('4. 3 observations with gridPoints=50 → sparse=true (ceil(50/10)=5, 3<5)', () => {
    const c = makeCase('p1', [
      makeObs('2023-01-01', 0.5, SNOMED_EYE_RIGHT, 'obs-1'),
      makeObs('2023-03-01', 0.6, SNOMED_EYE_RIGHT, 'obs-2'),
      makeObs('2023-05-01', 0.7, SNOMED_EYE_RIGHT, 'obs-3'),
    ]);

    const result = computeCohortTrajectory({
      cases: [c],
      axisMode: 'days',
      yMetric: 'absolute',
      gridPoints: 50,
    });

    expect(result.od.patients[0].sparse).toBe(true);
    // Sparse patients still contribute to medianGrid (D-19)
    expect(result.od.medianGrid.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 5. Mismatched spans
  // -------------------------------------------------------------------------
  it('5. Mismatched spans: no grid point in gap between p1 and p2', () => {
    // p1: days 0-100, p2: days 500-600
    const p1 = makeCase('p1', [
      makeObs('2023-01-01', 0.8, SNOMED_EYE_RIGHT, 'obs-p1-1'),
      makeObs('2023-01-20', 0.7, SNOMED_EYE_RIGHT, 'obs-p1-2'),
      makeObs('2023-04-11', 0.6, SNOMED_EYE_RIGHT, 'obs-p1-3'), // ~day 100
    ]);
    const p2 = makeCase('p2', [
      makeObs('2024-05-16', 0.5, SNOMED_EYE_RIGHT, 'obs-p2-1'), // ~day 500
      makeObs('2024-05-26', 0.4, SNOMED_EYE_RIGHT, 'obs-p2-2'), // ~day 510
      makeObs('2024-07-15', 0.5, SNOMED_EYE_RIGHT, 'obs-p2-3'), // ~day 560
    ]);

    const result = computeCohortTrajectory({
      cases: [p1, p2],
      axisMode: 'days',
      yMetric: 'absolute',
      gridPoints: 20,
    });

    // All grid points must have n >= 1 (no empty points emitted)
    expect(result.od.medianGrid.every((g) => g.n >= 1)).toBe(true);

    // No grid point should fall in the gap (roughly day 100 to 500)
    // Gap check: all points outside p1's max (100) AND before p2's min (500)
    const p1MaxX = Math.max(...result.od.patients[0].measurements.map((m) => m.x));
    const p2MinX = Math.min(...result.od.patients[1].measurements.map((m) => m.x));
    const gapPoints = result.od.medianGrid.filter(
      (g) => g.x > p1MaxX && g.x < p2MinX
    );
    expect(gapPoints).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Additional: Y-metric 'delta'
  // -------------------------------------------------------------------------
  it('delta: first obs logMAR 0.5, second 0.3 → y values are [0, -0.2]; baseline=0.5', () => {
    // logMAR = -log10(decimal)
    // decimal 0.316... → logMAR 0.5, decimal 0.5 → logMAR 0.301
    // Use: decimal for logMAR 0.5 = 10^(-0.5) ≈ 0.31623
    //       decimal for logMAR 0.3 = 10^(-0.3) ≈ 0.50119
    const dec1 = Math.pow(10, -0.5); // logMAR = 0.5
    const dec2 = Math.pow(10, -0.3); // logMAR = 0.3

    const c = makeCase('p1', [
      makeObs('2023-01-01', dec1, SNOMED_EYE_RIGHT, 'obs-1'),
      makeObs('2023-07-02', dec2, SNOMED_EYE_RIGHT, 'obs-2'), // day ~182
    ]);

    const result = computeCohortTrajectory({
      cases: [c],
      axisMode: 'days',
      yMetric: 'delta',
      gridPoints: 20,
    });

    expect(result.od.patients[0].baseline).toBeCloseTo(0.5, 3);
    const meas = result.od.patients[0].measurements;
    expect(meas[0].y).toBeCloseTo(0, 3);    // baseline - baseline = 0
    expect(meas[1].y).toBeCloseTo(-0.2, 3); // 0.3 - 0.5 = -0.2
  });

  // -------------------------------------------------------------------------
  // Additional: Y-metric 'delta_percent' clamping
  // -------------------------------------------------------------------------
  it('delta_percent: baseline 0.5, value 1.5 → 200 (not clamped); 2.0 → 300 clipped to 200', () => {
    const baseline = Math.pow(10, -0.5); // logMAR 0.5
    const val200  = Math.pow(10, -1.5);  // logMAR 1.5 → delta = 1.0, delta% = 200
    const val300  = Math.pow(10, -2.0);  // logMAR 2.0 → delta = 1.5, delta% = 300 → clipped

    const c = makeCase('p1', [
      makeObs('2023-01-01', baseline, SNOMED_EYE_RIGHT, 'obs-1'),
      makeObs('2023-07-01', val200,   SNOMED_EYE_RIGHT, 'obs-2'),
      makeObs('2024-01-01', val300,   SNOMED_EYE_RIGHT, 'obs-3'),
    ]);

    const result = computeCohortTrajectory({
      cases: [c],
      axisMode: 'days',
      yMetric: 'delta_percent',
      gridPoints: 20,
    });

    const meas = result.od.patients[0].measurements;
    // obs-2: (1.5 - 0.5) / 0.5 * 100 = 200 — exactly at boundary, NOT clipped
    expect(meas[1].y).toBeCloseTo(200, 1);
    expect(meas[1].clipped).toBeFalsy();
    // obs-3: (2.0 - 0.5) / 0.5 * 100 = 300 → clipped to 200
    expect(meas[2].y).toBeCloseTo(200, 1);
    expect(meas[2].clipped).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Additional: Baseline cohort-independence (D-05)
  // -------------------------------------------------------------------------
  it('D-05: baseline from earliest obs (day -50); cohort obs start at day 0 → x starts at 50', () => {
    // Patient's earliest visus is at day -50 (before cohort window)
    // 'full observation record' means both obs are passed in observations[]
    const dec = 0.5; // logMAR ≈ 0.301
    const c = makeCase('p1', [
      makeObs('2022-11-12', dec, SNOMED_EYE_RIGHT, 'obs-early'), // day -50
      makeObs('2023-01-01', dec, SNOMED_EYE_RIGHT, 'obs-cohort'), // day 0 (cohort window)
    ]);

    const result = computeCohortTrajectory({
      cases: [c],
      axisMode: 'days',
      yMetric: 'absolute',
      gridPoints: 20,
    });

    // earliest OD obs is 2022-11-12; baseline date is that date
    // second obs at 2023-01-01 is ~50 days later
    const meas = result.od.patients[0].measurements;
    expect(meas[0].x).toBe(0);   // baseline itself at day 0 relative to baseline
    expect(meas[1].x).toBeGreaterThan(40); // ~50 days
    expect(meas[1].x).toBeLessThan(60);
  });

  // -------------------------------------------------------------------------
  // Additional: Treatment index axis
  // -------------------------------------------------------------------------
  it('Treatment index axis: 3 IVI OD procs on days 0,30,60; obs on days 10,40,70 → x = 1,2,3', () => {
    const start = new Date('2023-01-01');
    const dayOffset = (d: number) => {
      const dt = new Date(start);
      dt.setDate(dt.getDate() + d);
      return dt.toISOString().split('T')[0];
    };

    const c = makeCase('p1',
      [
        makeObs(dayOffset(10), 0.5, SNOMED_EYE_RIGHT, 'obs-1'),
        makeObs(dayOffset(40), 0.6, SNOMED_EYE_RIGHT, 'obs-2'),
        makeObs(dayOffset(70), 0.7, SNOMED_EYE_RIGHT, 'obs-3'),
      ],
      [
        makeIVI(dayOffset(0),  SNOMED_EYE_RIGHT, 'proc-1'),
        makeIVI(dayOffset(30), SNOMED_EYE_RIGHT, 'proc-2'),
        makeIVI(dayOffset(60), SNOMED_EYE_RIGHT, 'proc-3'),
      ]
    );

    const result = computeCohortTrajectory({
      cases: [c],
      axisMode: 'treatments',
      yMetric: 'absolute',
      gridPoints: 20,
    });

    const meas = result.od.patients[0].measurements;
    expect(meas[0].x).toBe(1); // obs at day 10: 1 IVI done (day 0)
    expect(meas[1].x).toBe(2); // obs at day 40: 2 IVI done (day 0,30)
    expect(meas[2].x).toBe(3); // obs at day 70: 3 IVI done (day 0,30,60)
  });

  // -------------------------------------------------------------------------
  // Additional: spreadMode='sd1' returns symmetric bands
  // -------------------------------------------------------------------------
  it('spreadMode=sd1 returns symmetric bands around median for uniform-y cohort', () => {
    // Two patients, same logMAR values at each time point → mean === median
    const dec = 0.5;
    const p1 = makeCase('p1', [
      makeObs('2023-01-01', dec, SNOMED_EYE_RIGHT, 'obs-p1-1'),
      makeObs('2023-07-01', dec, SNOMED_EYE_RIGHT, 'obs-p1-2'),
    ]);
    const p2 = makeCase('p2', [
      makeObs('2023-01-01', dec, SNOMED_EYE_RIGHT, 'obs-p2-1'),
      makeObs('2023-07-01', dec, SNOMED_EYE_RIGHT, 'obs-p2-2'),
    ]);

    const result = computeCohortTrajectory({
      cases: [p1, p2],
      axisMode: 'days',
      yMetric: 'absolute',
      gridPoints: 20,
      spreadMode: 'sd1',
    });

    // For uniform y values, sd=0, so p25 === y === p75
    result.od.medianGrid.forEach((gp) => {
      expect(gp.p25).toBeCloseTo(gp.y, 5);
      expect(gp.p75).toBeCloseTo(gp.y, 5);
    });
  });

});
