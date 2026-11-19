// Z0-P04 — Verläufe resolves the unsaved filter cohort from ?filters= (PLAN Z0 § Z0-P04, item 3). Synthetic data only.
import { describe, expect, it } from 'vitest';

import type { PatientCase } from '../../../shared/types/fhir';
import { resolveCohort } from '../../../src/components/outcomes/useOutcomesRouteState';

function caseAged(id: string, birthYear: number): PatientCase {
  return {
    id, pseudonym: id, centerId: 'CENTER-SYN', centerName: 'Synthetic', gender: 'female',
    birthDate: `${birthYear}-01-01`,
    conditions: [], observations: [], procedures: [], imagingStudies: [], medications: [],
  } as unknown as PatientCase;
}
const CASES = [caseAged('young', 1990), caseAged('old', 1930)];
const OPTIONS = { therapyInterrupterDays: 120, therapyBreakerDays: 365, crtImplausibleThresholdUm: 400 };

describe('[Z0-P04] resolveCohort with ?filters=', () => {
  it('applies the ?filters= cohort written by "Kohorte analysieren"', () => {
    const sp = new URLSearchParams();
    sp.set('filters', JSON.stringify({ ageRange: [70, null] }));
    const resolved = resolveCohort(sp, CASES, [], OPTIONS);
    expect(resolved?.cases.map((c) => c.id)).toEqual(['old']);
  });
});
