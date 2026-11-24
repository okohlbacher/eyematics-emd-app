/**
 * Z0-P23 (Q46) — the unsaved filtered cohort (?filters=) as the fixed base cohort of a comparison:
 * its reserved id lives in ?cohorts= only (never in ?cohort=), and "Kohorte wählen" replaces it like any other base.
 */
import type { SetURLSearchParams } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { compareHandlers } from '../src/components/outcomes/compareSelection';
import { withBaseCohort } from '../src/components/outcomes/useOutcomesRouteState';
import { ALL_PATIENTS_COHORT_ID as ALL } from '../src/services/allPatientsCohort';
import {
  compareBaseCohortId,
  FILTERED_COHORT_ID as FILTERED,
  withFilteredCohort,
} from '../src/services/filteredCompareCohort';

function handlers(query: string, primary: string | null, cross: string[] = []) {
  const p = new URLSearchParams(query);
  let open = false;
  const setSearchParams = ((updater: (prev: URLSearchParams) => URLSearchParams) => {
    updater(p);
  }) as SetURLSearchParams;
  const h = compareHandlers({
    primaryCohortId: primary,
    crossCohortIds: cross,
    isCrossMode: cross.length >= 2,
    setSearchParams,
    setCompareOpen: (v) => { open = v; },
  });
  return { h, url: () => Object.fromEntries(p), isOpen: () => open };
}

describe('filtered cohort as compare base (Z0-P23, Q46)', () => {
  it('the base id is the saved cohort, else the filtered cohort, else none', () => {
    expect(compareBaseCohortId('T', true)).toBe('T');
    expect(compareBaseCohortId(null, true)).toBe(FILTERED);
    expect(compareBaseCohortId(null, false)).toBeNull();
  });

  it('adds the filtered cohort as a virtual saved search only when given', () => {
    expect(withFilteredCohort([], null)).toEqual([]);
    expect(withFilteredCohort([], { name: 'Gefilterte Kohorte · Alter ≥ 70', filters: { ageRange: [70, null] } }))
      .toEqual([{ id: FILTERED, name: 'Gefilterte Kohorte · Alter ≥ 70', createdAt: '', filters: { ageRange: [70, null] } }]);
  });

  it('opening the drawer preselects "Alle Patienten" next to the filtered base, without writing ?cohort=', () => {
    const { h, url, isOpen } = handlers('filters=%7B%7D', FILTERED);
    h.openCompare();
    expect(url()).toEqual({ filters: '{}', cohorts: `${FILTERED},${ALL}` });
    expect(isOpen()).toBe(true);
  });

  it('a change keeps the filtered base first and never writes it to ?cohort=', () => {
    const { h, url } = handlers(`filters=%7B%7D&cohorts=${FILTERED},${ALL}`, FILTERED, [FILTERED, ALL]);
    h.handleCompareChange(['X']);
    expect(url()).toEqual({ filters: '{}', cohorts: `${FILTERED},X` });
  });

  it('reset drops ?cohorts= and keeps ?filters= without ?cohort=', () => {
    const { h, url } = handlers(`filters=%7B%7D&cohorts=${FILTERED},${ALL}`, FILTERED, [FILTERED, ALL]);
    h.handleCompareReset();
    expect(url()).toEqual({ filters: '{}' });
  });

  it('"Kohorte wählen": filtered → saved replaces the filtered base in a running comparison', () => {
    const p = new URLSearchParams(`filters=%7B%7D&cohorts=${FILTERED},${ALL}`);
    expect(Object.fromEntries(withBaseCohort(p, 'T'))).toEqual({ filters: '{}', cohorts: `T,${ALL}`, cohort: 'T' });
  });

  it('"Kohorte wählen": saved → filtered puts the filtered base back in place of the saved one', () => {
    const p = new URLSearchParams(`filters=%7B%7D&cohort=T&cohorts=T,${ALL}`);
    expect(Object.fromEntries(withBaseCohort(p, null, FILTERED))).toEqual({ filters: '{}', cohorts: `${FILTERED},${ALL}` });
  });
});
