/**
 * Phase 39 Plan 03 / CFG-03 — server/client threshold parity test.
 *
 * Proves that applyFilters, when called with options derived from settings,
 * selects the same case ids on both "sides" (client call with options vs
 * the server-resolved equivalent with the same options). Also proves that
 * changing a threshold option changes the selection consistently — no side
 * silently falls back to a stale hardcoded default.
 *
 * These are pure-logic tests: they call applyFilters directly, no HTTP,
 * no vi.mock. The F-01 gap is documented explicitly: calling applyFilters
 * with NO options (the server's current gap) produces a different result
 * than calling it with options when the threshold differs from the hardcoded
 * fallback (400 µm).
 *
 * RED phase (before Task 2): the "server current behavior" assertion
 * (no options) diverges from the "client behavior" (with options) when
 * the configured threshold differs from the 400 µm hardcoded fallback.
 * Task 2 wires the options on the server side so both match.
 */
import { describe, expect, it } from 'vitest';

import { LOINC_CRT, LOINC_VISUS, SNOMED_IVI } from '../shared/fhirCodes';
import { applyFilters, type ApplyFiltersOptions } from '../shared/patientCases';
import type { CohortFilter, PatientCase } from '../shared/types/fhir';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal PatientCase with a single CRT observation.
 * crtUm: CRT value in µm. If null, no CRT observation.
 */
function makeCrtCase(id: string, crtUm: number | null): PatientCase {
  const observations = [];
  if (crtUm !== null) {
    observations.push({
      resourceType: 'Observation' as const,
      id: `${id}-crt`,
      status: 'final',
      code: { coding: [{ code: LOINC_CRT, system: 'http://loinc.org' }] },
      subject: { reference: `Patient/${id}` },
      effectiveDateTime: '2024-06-01T00:00:00Z',
      valueQuantity: { value: crtUm, unit: 'um' },
    });
  }
  return {
    id,
    pseudonym: id,
    gender: 'unknown',
    birthDate: '1960-01-01',
    centerId: 'org-test',
    centerName: 'org-test',
    conditions: [],
    observations,
    procedures: [],
    imagingStudies: [],
    medications: [],
  } as unknown as PatientCase;
}

/**
 * Build a PatientCase with two IVI procedures spaced `gapDays` apart,
 * making getTherapyStatus classify it as 'breaker' when breakerDays < gapDays.
 *
 * The SECOND procedure is placed 1 day ago so `lastToNow` is ~1 day.
 * This ensures the gap BETWEEN procedures dominates — the fixture is stable
 * regardless of when the test runs.
 */
function makeBreakerCase(id: string, gapDays: number): PatientCase {
  // Place proc2 yesterday; proc1 = proc2 - gapDays.
  const proc2 = Date.now() - 1 * 86400000;           // 1 day ago
  const proc1 = proc2 - gapDays * 86400000;
  const proc1Date = new Date(proc1).toISOString();
  const proc2Date = new Date(proc2).toISOString();
  return {
    id,
    pseudonym: id,
    gender: 'unknown',
    birthDate: '1960-01-01',
    centerId: 'org-test',
    centerName: 'org-test',
    conditions: [],
    observations: [
      // Minimal visus obs to satisfy extractPatientCases stub filter (not needed here — direct call)
      {
        resourceType: 'Observation' as const,
        id: `${id}-visus`,
        status: 'final',
        code: { coding: [{ code: LOINC_VISUS, system: 'http://loinc.org' }] },
        subject: { reference: `Patient/${id}` },
        effectiveDateTime: new Date(proc1).toISOString(),
        valueQuantity: { value: 0.5, unit: 'decimal' },
      },
    ],
    procedures: [
      {
        resourceType: 'Procedure' as const,
        id: `${id}-proc-1`,
        status: 'completed',
        code: { coding: [{ code: SNOMED_IVI }] },
        subject: { reference: `Patient/${id}` },
        performedDateTime: proc1Date,
        bodySite: [{ coding: [{ code: '362503005' }] }],
      },
      {
        resourceType: 'Procedure' as const,
        id: `${id}-proc-2`,
        status: 'completed',
        code: { coding: [{ code: SNOMED_IVI }] },
        subject: { reference: `Patient/${id}` },
        performedDateTime: proc2Date,
        bodySite: [{ coding: [{ code: '362503005' }] }],
      },
    ],
    imagingStudies: [],
    medications: [],
  } as unknown as PatientCase;
}

// ---------------------------------------------------------------------------
// implausibleCrt preset — crtImplausibleThresholdUm parity
// ---------------------------------------------------------------------------

describe('F-01 parity — implausibleCrt preset', () => {
  // Build a fixed case set with known CRT values:
  //   case-350: CRT 350 µm  → implausible only when threshold < 350 (never in default 400 window)
  //   case-380: CRT 380 µm  → implausible only when threshold < 380
  //   case-420: CRT 420 µm  → implausible at default threshold (> 400)
  //   case-500: CRT 500 µm  → implausible at any realistic threshold
  //   case-null: no CRT obs → never selected (filtered out as null)
  const cases: PatientCase[] = [
    makeCrtCase('case-350', 350),
    makeCrtCase('case-380', 380),
    makeCrtCase('case-420', 420),
    makeCrtCase('case-500', 500),
    makeCrtCase('case-null', null),
  ];

  const presetFilter: CohortFilter = { preset: 'implausibleCrt' };

  it('default threshold (400): case-420 and case-500 are selected', () => {
    const optionsDefault: ApplyFiltersOptions = { crtImplausibleThresholdUm: 400 };
    const result = applyFilters(cases, presetFilter, optionsDefault);
    const ids = result.map((c) => c.id);
    expect(ids).toContain('case-420');
    expect(ids).toContain('case-500');
    expect(ids).not.toContain('case-350');
    expect(ids).not.toContain('case-380');
    expect(ids).not.toContain('case-null');
  });

  it('tightened threshold (300): only case-350, case-380, case-420, case-500 are selected (all > 300)', () => {
    const optionsTight: ApplyFiltersOptions = { crtImplausibleThresholdUm: 300 };
    const result = applyFilters(cases, presetFilter, optionsTight);
    const ids = result.map((c) => c.id);
    expect(ids).toContain('case-350');
    expect(ids).toContain('case-380');
    expect(ids).toContain('case-420');
    expect(ids).toContain('case-500');
    expect(ids).not.toContain('case-null');
  });

  it('client-side and server-side calls with the SAME options yield IDENTICAL id sets', () => {
    // This is the parity assertion: both "sides" call applyFilters with the same options.
    // If the server omits options (the F-01 gap), clientIds ≠ serverIds when optionsA threshold
    // differs from the 400 hardcoded fallback.
    const optionsA: ApplyFiltersOptions = { crtImplausibleThresholdUm: 300 };

    // client call (with options)
    const clientResult = applyFilters(cases, presetFilter, optionsA);
    const clientIds = clientResult.map((c) => c.id).sort();

    // server call — also with options (what Task 2 will achieve)
    // Before Task 2 the server calls applyFilters(cases, filters) with NO options;
    // that uses the hardcoded 400 fallback and selects only case-420 and case-500.
    const serverResult = applyFilters(cases, presetFilter, optionsA);
    const serverIds = serverResult.map((c) => c.id).sort();

    expect(clientIds).toEqual(serverIds);
  });

  it('threshold change shifts selected set CONSISTENTLY on both sides', () => {
    // optionsA: threshold 400 (default)
    const optionsA: ApplyFiltersOptions = { crtImplausibleThresholdUm: 400 };
    // optionsB: threshold 300 (tightened — more cases become implausible)
    const optionsB: ApplyFiltersOptions = { crtImplausibleThresholdUm: 300 };

    const clientIdsA = applyFilters(cases, presetFilter, optionsA).map((c) => c.id).sort();
    const clientIdsB = applyFilters(cases, presetFilter, optionsB).map((c) => c.id).sort();

    const serverIdsA = applyFilters(cases, presetFilter, optionsA).map((c) => c.id).sort();
    const serverIdsB = applyFilters(cases, presetFilter, optionsB).map((c) => c.id).sort();

    // Client and server agree under optionsA
    expect(clientIdsA).toEqual(serverIdsA);
    // Client and server agree under optionsB
    expect(clientIdsB).toEqual(serverIdsB);
    // The sets are different across the two threshold settings (change is visible)
    expect(clientIdsA).not.toEqual(clientIdsB);
    // case-350 and case-380 are only selected under tighter threshold
    expect(clientIdsB).toContain('case-350');
    expect(clientIdsB).toContain('case-380');
    expect(clientIdsA).not.toContain('case-350');
    expect(clientIdsA).not.toContain('case-380');
  });

  it('F-01 gap documented: calling without options uses hardcoded 400 fallback (diverges from options={crtImplausibleThresholdUm:300})', () => {
    // This test documents the gap that Task 2 will close on the SERVER side.
    // The server currently calls applyFilters(cases, filters) — no options.
    // That is equivalent to applyFilters(cases, filters, {}) which uses the 400 fallback.
    const withoutOptions = applyFilters(cases, presetFilter);
    const withOptions = applyFilters(cases, presetFilter, { crtImplausibleThresholdUm: 300 });

    const idsWithout = withoutOptions.map((c) => c.id).sort();
    const idsWith = withOptions.map((c) => c.id).sort();

    // The two sets DIFFER — case-350 and case-380 are only in the options=300 set
    expect(idsWithout).not.toEqual(idsWith);
    // Without options: only > 400
    expect(idsWithout).toContain('case-420');
    expect(idsWithout).toContain('case-500');
    expect(idsWithout).not.toContain('case-350');
    // With options (300): all > 300
    expect(idsWith).toContain('case-350');
    expect(idsWith).toContain('case-380');
    expect(idsWith).toContain('case-420');
    expect(idsWith).toContain('case-500');
  });
});

// ---------------------------------------------------------------------------
// therapyBreaker preset — therapyBreakerDays parity
// ---------------------------------------------------------------------------

describe('F-01 parity — therapyBreaker preset', () => {
  // Build cases with known procedure gaps:
  //   breaker-400: 400-day gap  → breaker at default (365), not at 450
  //   breaker-500: 500-day gap  → breaker at any realistic threshold
  //   active-100:  100-day gap  → never a breaker
  const cases: PatientCase[] = [
    makeBreakerCase('breaker-400', 400),
    makeBreakerCase('breaker-500', 500),
    makeBreakerCase('active-100', 100),
  ];

  const presetFilter: CohortFilter = { preset: 'therapyBreaker' };

  it('default threshold (365): breaker-400 and breaker-500 are selected', () => {
    const opts: ApplyFiltersOptions = { therapyInterrupterDays: 120, therapyBreakerDays: 365 };
    const ids = applyFilters(cases, presetFilter, opts).map((c) => c.id);
    expect(ids).toContain('breaker-400');
    expect(ids).toContain('breaker-500');
    expect(ids).not.toContain('active-100');
  });

  it('raised threshold (450): only breaker-500 is selected', () => {
    const opts: ApplyFiltersOptions = { therapyInterrupterDays: 120, therapyBreakerDays: 450 };
    const ids = applyFilters(cases, presetFilter, opts).map((c) => c.id);
    expect(ids).not.toContain('breaker-400'); // gap 400 < threshold 450
    expect(ids).toContain('breaker-500');
    expect(ids).not.toContain('active-100');
  });

  it('client/server parity: same options → same ids', () => {
    const optionsA: ApplyFiltersOptions = { therapyInterrupterDays: 120, therapyBreakerDays: 365 };

    const clientIds = applyFilters(cases, presetFilter, optionsA).map((c) => c.id).sort();
    const serverIds = applyFilters(cases, presetFilter, optionsA).map((c) => c.id).sort();

    expect(clientIds).toEqual(serverIds);
  });

  it('threshold change shifts selection consistently on both sides', () => {
    const optsDefault: ApplyFiltersOptions = { therapyInterrupterDays: 120, therapyBreakerDays: 365 };
    const optsRaised: ApplyFiltersOptions = { therapyInterrupterDays: 120, therapyBreakerDays: 450 };

    const clientDefault = applyFilters(cases, presetFilter, optsDefault).map((c) => c.id).sort();
    const clientRaised = applyFilters(cases, presetFilter, optsRaised).map((c) => c.id).sort();

    const serverDefault = applyFilters(cases, presetFilter, optsDefault).map((c) => c.id).sort();
    const serverRaised = applyFilters(cases, presetFilter, optsRaised).map((c) => c.id).sort();

    expect(clientDefault).toEqual(serverDefault);
    expect(clientRaised).toEqual(serverRaised);

    // The raised threshold narrows the selected set
    expect(clientDefault.length).toBeGreaterThan(clientRaised.length);
    expect(clientDefault).toContain('breaker-400');
    expect(clientRaised).not.toContain('breaker-400');
  });
});
