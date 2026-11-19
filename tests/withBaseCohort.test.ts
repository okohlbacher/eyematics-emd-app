// @vitest-environment jsdom
/**
 * Z0-P22 — withBaseCohort: switching the base cohort in "Kohorte wählen" keeps a running comparison
 * (PLAN Z0-P22 §3: replace the base in ?cohorts=, keep the other comparison cohorts).
 */
import { describe, expect, it } from 'vitest';

import { withBaseCohort } from '../src/components/outcomes/useOutcomesRouteState';
import { ALL_PATIENTS_COHORT_ID as ALL } from '../src/services/allPatientsCohort';

function sw(query: string, nextId: string | null, compareBaseId?: string | null): Record<string, string> {
  const p = new URLSearchParams(query);
  return Object.fromEntries(withBaseCohort(p, nextId, compareBaseId === undefined ? nextId : compareBaseId));
}

describe('withBaseCohort (Z0-P22)', () => {
  it('without a comparison only sets ?cohort=', () => {
    expect(sw('cohort=T', 'V')).toEqual({ cohort: 'V' });
  });

  it('saved → saved replaces the base and keeps the other comparison cohorts', () => {
    expect(sw(`cohort=T&cohorts=T,${ALL}`, 'V')).toEqual({ cohort: 'V', cohorts: `V,${ALL}` });
  });

  it('saved → "Alle Patienten" enters the reserved id as base and keeps the others', () => {
    expect(sw('cohort=T&cohorts=T,X', null, ALL)).toEqual({ cohorts: `${ALL},X` });
  });

  it('"Alle Patienten" → saved replaces the reserved id (round trip restores the comparison)', () => {
    expect(sw(`cohorts=${ALL},X`, 'T')).toEqual({ cohorts: 'T,X', cohort: 'T' });
  });

  it('with a filtered base (?filters=) the reserved id is a comparison cohort, not the base', () => {
    expect(sw(`filters=%7B%7D&cohorts=${ALL},X`, 'T')).toEqual({ filters: '{}', cohorts: `T,${ALL},X`, cohort: 'T' });
  });

  it('caps the comparison at 4 cohorts', () => {
    expect(sw('cohort=T&cohorts=T,A,B,C', 'V')).toEqual({ cohort: 'V', cohorts: 'V,A,B,C' });
  });
});
