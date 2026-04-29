/**
 * Phase 25 / Plan 25-01 / TERM-01, TERM-05: Unit tests for the new
 * browser-side terminology resolver module (`src/services/terminology.ts`).
 *
 * This file grows over 3 atomic commits in plan 25-01:
 *   - Task 1 (this commit): collectCodings shape + _seedMap byte-identical strings
 *   - Task 2: getCachedDisplay seed/miss + resolveDisplay 200/503 paths
 *   - Task 3: useDiagnosisDisplay hook (RTL renderHook test)
 */
import { describe, expect, it } from 'vitest';

import { _seedMap, collectCodings } from '../src/services/terminology';
import { terminologyFixture } from './fixtures/terminologyBundle';

const SYSTEM_SNOMED = 'http://snomed.info/sct';
const SYSTEM_ICD10_GM = 'http://fhir.de/CodeSystem/bfarm/icd-10-gm';

describe('terminology — collectCodings + seedMap', () => {
  it('collectCodings returns a Map covering Condition/Observation/Procedure codings only', () => {
    const result = collectCodings([terminologyFixture]);

    // 4 systems: SNOMED, ICD-10-GM, LOINC, '_' sentinel for the no-system coding.
    // Patient resource must be ignored.
    expect(result.size).toBe(4);

    expect(result.get(SYSTEM_SNOMED)).toEqual(new Set(['267718000', '36189003']));
    expect(result.get(SYSTEM_ICD10_GM)).toEqual(new Set(['E11.9']));
    expect(result.get('http://loinc.org')).toEqual(new Set(['79880-1']));
    expect(result.get('_')).toEqual(new Set(['NOSYS']));
  });

  it('_seedMap holds 10 entries and SNOMED AMD strings are byte-identical to legacy fhirLoader output', () => {
    // Plan text says "9" but legacy getDiagnosisFullText covers 10 cases:
    // 2 SNOMED (AMD, DR) + 8 ICD-10-GM (E11.9, E10.9, H40.1, H25.1, H33.0, I10, E78.0, I25.1).
    // Migration must be byte-identical (D-08), so the seed has 10 entries — plan-text deviation.
    expect(_seedMap.size).toBe(10);

    const amd = _seedMap.get(`${SYSTEM_SNOMED}|267718000`);
    expect(amd).toBeDefined();
    expect(amd!.label.de).toBe('AMD');
    expect(amd!.label.en).toBe('AMD');
    expect(amd!.fullText.de).toBe('Altersbedingte Makuladegeneration (267718000)');
    expect(amd!.fullText.en).toBe('Age-related macular degeneration (267718000)');
  });
});
