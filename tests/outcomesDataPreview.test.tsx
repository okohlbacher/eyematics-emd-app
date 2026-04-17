// @vitest-environment jsdom
/**
 * OutcomesDataPreview — React-key-uniqueness test (CRREV-02 / Phase 10 Plan 04b).
 *
 * Pins the invariant that row keys are a pure function of row identity:
 *   `${patient_pseudonym}|${eye}|${observation_date}`  (plus `|#N` when the
 *   same tuple legitimately repeats within a dataset).
 *
 * Four assertions:
 *   1. All rendered row keys are unique.
 *   2. No key ends with `-<digit>` (no array-index suffix).
 *   3. Keys are stable across renders that reorder the patient list.
 *   4. Same (pseudonym, eye, date) tuple rendered twice → distinct keys via
 *      `|#N` counter, and React logs no duplicate-key warning.
 */
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// download.ts mock — the component imports it at module load.
// ---------------------------------------------------------------------------
vi.mock('../src/utils/download', () => ({
  downloadCsv: vi.fn(),
  datedFilename: (p: string, e: string) => `${p}-2026-04-16.${e}`,
}));

import { render, cleanup } from '@testing-library/react';
import OutcomesDataPreview from '../src/components/outcomes/OutcomesDataPreview';
import type { PatientCase } from '../src/types/fhir';
import type { TranslationKey } from '../src/i18n/translations';
import type { TrajectoryResult } from '../src/utils/cohortTrajectory';

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Build a PatientCase with N OD observations + M OS observations.
 * Each observation has a unique date in month i+1 / i+4 respectively.
 * (Mirrors the helper in tests/OutcomesPage.test.tsx to keep fixtures
 * consistent with the 09-03 suite.)
 */
function buildPatientCase(
  pseudo: string,
  odCount: number,
  osCount: number,
): PatientCase {
  const observations = [
    ...Array.from({ length: odCount }, (_, i) => ({
      resourceType: 'Observation',
      id: `obs-od-${pseudo}-${i}`,
      code: { coding: [{ system: 'http://loinc.org', code: '79880-1' }] },
      valueQuantity: { value: 0.8 - i * 0.05, unit: 'decimal' },
      effectiveDateTime: `2024-0${i + 1}-01`,
      // SNOMED_EYE_RIGHT = '362503005' → 'od'
      bodySite: { coding: [{ system: 'http://snomed.info/sct', code: '362503005' }] },
    })),
    ...Array.from({ length: osCount }, (_, i) => ({
      resourceType: 'Observation',
      id: `obs-os-${pseudo}-${i}`,
      code: { coding: [{ system: 'http://loinc.org', code: '79880-1' }] },
      valueQuantity: { value: 0.7 - i * 0.05, unit: 'decimal' },
      effectiveDateTime: `2024-0${i + 4}-01`,
      // SNOMED_EYE_LEFT = '362502000' → 'os'
      bodySite: { coding: [{ system: 'http://snomed.info/sct', code: '362502000' }] },
    })),
  ];
  return {
    id: pseudo,
    pseudonym: pseudo,
    gender: 'female',
    birthDate: '1965-03-15',
    centerId: 'org-uka',
    centerName: 'UKA',
    conditions: [],
    observations,
    procedures: [],
    imagingStudies: [],
    medications: [],
  } as unknown as PatientCase;
}

/**
 * Build a PatientCase where two LOINC_VISUS observations share the same
 * eye + date (same-day second measurement). This triggers the D-11 fallback.
 */
function buildDuplicateTupleCase(pseudo: string): PatientCase {
  const observations = [
    {
      resourceType: 'Observation',
      id: `obs-od-${pseudo}-a`,
      code: { coding: [{ system: 'http://loinc.org', code: '79880-1' }] },
      valueQuantity: { value: 0.8, unit: 'decimal' },
      effectiveDateTime: '2024-05-01',
      bodySite: { coding: [{ system: 'http://snomed.info/sct', code: '362503005' }] },
    },
    {
      resourceType: 'Observation',
      id: `obs-od-${pseudo}-b`,
      code: { coding: [{ system: 'http://loinc.org', code: '79880-1' }] },
      valueQuantity: { value: 0.7, unit: 'decimal' },
      // Same date + same eye as above → duplicate (pseudo, eye, date) tuple
      effectiveDateTime: '2024-05-01',
      bodySite: { coding: [{ system: 'http://snomed.info/sct', code: '362503005' }] },
    },
  ];
  return {
    id: pseudo,
    pseudonym: pseudo,
    gender: 'female',
    birthDate: '1970-01-01',
    centerId: 'org-uka',
    centerName: 'UKA',
    conditions: [],
    observations,
    procedures: [],
    imagingStudies: [],
    medications: [],
  } as unknown as PatientCase;
}

/** Minimal TrajectoryResult with counts that satisfy the parity invariant. */
function makeAggregate(odCount: number, osCount: number): TrajectoryResult {
  const emptyPanel = (count: number) => ({
    patients: [],
    scatterPoints: [],
    medianGrid: [],
    summary: { patientCount: 0, measurementCount: count, excludedCount: 0 },
  });
  return {
    od: emptyPanel(odCount),
    os: emptyPanel(osCount),
    combined: emptyPanel(odCount + osCount),
  } as unknown as TrajectoryResult;
}

const t = (k: TranslationKey) => k;

/** Open the <details> so rows actually render in the DOM, then return the <tr>s. */
function openAndGetRows(container: HTMLElement): HTMLTableRowElement[] {
  const details = container.querySelector('details');
  if (!details) throw new Error('details element missing');
  details.setAttribute('open', '');
  return Array.from(container.querySelectorAll('tbody tr')) as HTMLTableRowElement[];
}

function keysFromRows(rows: HTMLTableRowElement[]): string[] {
  return rows.map((tr) => {
    const k = tr.getAttribute('data-row-key');
    if (k === null) throw new Error('row is missing data-row-key attribute');
    return k;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OutcomesDataPreview — row key stability (CRREV-02)', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('1. renders unique keys for every row', () => {
    // 2 patients × (3 OD + 2 OS) = 10 distinct rows
    const cases = [buildPatientCase('alice', 3, 2), buildPatientCase('bob', 3, 2)];
    const aggregate = makeAggregate(6, 4);

    const { container } = render(
      <OutcomesDataPreview cases={cases} aggregate={aggregate} t={t} locale="en" />,
    );

    const rows = openAndGetRows(container);
    expect(rows.length).toBe(10);

    const keys = keysFromRows(rows);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('2. keys contain no array-index suffix (no trailing -<digit>)', () => {
    const cases = [buildPatientCase('alice', 3, 2), buildPatientCase('bob', 3, 2)];
    const aggregate = makeAggregate(6, 4);

    const { container } = render(
      <OutcomesDataPreview cases={cases} aggregate={aggregate} t={t} locale="en" />,
    );

    const keys = keysFromRows(openAndGetRows(container));
    // Old key shape: `${pseudo}-${eye}-${date}-${index}` — dash-separated,
    // trailing index. New shape: `${pseudo}|${eye}|${date}` (pipe-separated),
    // with optional `|#N` counter for duplicate tuples.
    //
    // We assert the new shape directly:
    //   - every key contains two `|` separators (three tuple components), and
    //   - any trailing counter uses the `|#N` form, never `-N`.
    for (const k of keys) {
      expect(k.split('|').length).toBeGreaterThanOrEqual(3);
      // No dash-separated trailing numeric index (old format).
      // The ISO date itself ends with `-DD` but appears before the second `|`,
      // so only the final segment is checked.
      const lastSegment = k.split('|').pop() ?? '';
      // Last segment is either the date (YYYY-MM-DD) or `#N` counter.
      expect(lastSegment).toMatch(/^(\d{4}-\d{2}-\d{2}|#\d+)$/);
    }
  });

  it('3. keys are stable across renders that reorder the patient list', () => {
    const aggregate = makeAggregate(6, 4);

    const cases1 = [buildPatientCase('alice', 3, 2), buildPatientCase('bob', 3, 2)];
    const { container: c1, unmount: u1 } = render(
      <OutcomesDataPreview cases={cases1} aggregate={aggregate} t={t} locale="en" />,
    );
    const keys1 = keysFromRows(openAndGetRows(c1));
    u1();

    // Same rows, reversed patient order
    const cases2 = [buildPatientCase('bob', 3, 2), buildPatientCase('alice', 3, 2)];
    const { container: c2 } = render(
      <OutcomesDataPreview cases={cases2} aggregate={aggregate} t={t} locale="en" />,
    );
    const keys2 = keysFromRows(openAndGetRows(c2));

    // Identity set is invariant under row reorder
    expect(new Set(keys1)).toEqual(new Set(keys2));
  });

  it('4. duplicate (pseudo, eye, date) tuple → distinct keys with |#N suffix, no React warning', () => {
    const cases = [buildDuplicateTupleCase('carol')];
    const aggregate = makeAggregate(2, 0);

    const { container } = render(
      <OutcomesDataPreview cases={cases} aggregate={aggregate} t={t} locale="en" />,
    );

    const rows = openAndGetRows(container);
    expect(rows.length).toBe(2);

    const keys = keysFromRows(rows);
    expect(keys[0]).toBe('carol|od|2024-05-01');
    expect(keys[1]).toBe('carol|od|2024-05-01|#2');
    expect(new Set(keys).size).toBe(2);

    // React emits console.error('Encountered two children with the same key, …')
    // when it detects duplicate keys. The spy is installed in beforeEach.
    const duplicateKeyCalls = consoleErrorSpy.mock.calls.filter((args) =>
      args.some(
        (a) => typeof a === 'string' && a.includes('Encountered two children with the same key'),
      ),
    );
    expect(duplicateKeyCalls).toHaveLength(0);
  });
});
