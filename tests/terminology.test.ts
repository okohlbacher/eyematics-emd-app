// @vitest-environment jsdom
/**
 * Phase 25 / Plan 25-01 / TERM-01, TERM-05: Unit tests for the new
 * browser-side terminology resolver module (`src/services/terminology.ts`).
 *
 * Covers (D-21):
 *   - collectCodings shape over a fixture bundle
 *   - _seedMap byte-identical strings (regression guard for migration)
 *   - getCachedDisplay seed hit (no fetch fired)
 *   - getCachedDisplay miss → raw code + fire-and-forget fetch
 *   - resolveDisplay 200 path populates L1
 *   - resolveDisplay 503 path → seed fallback
 *   - useDiagnosisDisplay re-renders when L1 fills
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  _resetForTests,
  _seedMap,
  collectCodings,
  getCachedDisplay,
  resolveDisplay,
  useDiagnosisDisplay,
} from '../src/services/terminology';
import { terminologyFixture } from './fixtures/terminologyBundle';

const SYSTEM_SNOMED = 'http://snomed.info/sct';
const SYSTEM_ICD10_GM = 'http://fhir.de/CodeSystem/bfarm/icd-10-gm';

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : String(input);
    return await handler(url, init);
  });
  // Cast to satisfy fetch type
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('terminology — collectCodings + seedMap', () => {
  beforeEach(() => {
    _resetForTests();
  });

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

  it('_seedMap holds 15 entries and SNOMED AMD strings are byte-identical to legacy fhirLoader output', () => {
    // Phase 25: 10 entries (2 SNOMED + 8 ICD-10-GM).
    // Phase 26 SYNTH-01: +5 entries (SNOMED 312903003, 362098006; ICD-10-GM E11, H43.1, T85.8).
    expect(_seedMap.size).toBe(15);

    const amd = _seedMap.get(`${SYSTEM_SNOMED}|267718000`);
    expect(amd).toBeDefined();
    expect(amd!.label.de).toBe('AMD');
    expect(amd!.label.en).toBe('AMD');
    expect(amd!.fullText.de).toBe('Altersbedingte Makuladegeneration (267718000)');
    expect(amd!.fullText.en).toBe('Age-related macular degeneration (267718000)');
  });
});

describe('Phase 26 SYNTH-01 seed extension', () => {
  beforeEach(() => {
    _resetForTests();
  });

  it('SNOMED 312903003 — DME (label + fullText, de + en)', () => {
    const entry = _seedMap.get(`${SYSTEM_SNOMED}|312903003`);
    expect(entry).toBeDefined();
    expect(entry!.label.de).toBe('Diabetisches Makulaödem (DMÖ)');
    expect(entry!.label.en).toBe('Diabetic macular edema');
    expect(entry!.fullText.de).toBe('Diabetisches Makulaödem (312903003)');
    expect(entry!.fullText.en).toBe('Diabetic macular edema (312903003)');
  });

  it('SNOMED 362098006 — RVO (label + fullText, de + en)', () => {
    const entry = _seedMap.get(`${SYSTEM_SNOMED}|362098006`);
    expect(entry).toBeDefined();
    expect(entry!.label.de).toBe('Retinaler Venenverschluss (RVV)');
    expect(entry!.label.en).toBe('Retinal vein occlusion');
    expect(entry!.fullText.de).toBe('Retinaler Venenverschluss (362098006)');
    expect(entry!.fullText.en).toBe('Retinal vein occlusion (362098006)');
  });

  it('ICD-10-GM E11 — T2DM parent code (distinct from E11.9)', () => {
    const entry = _seedMap.get(`${SYSTEM_ICD10_GM}|E11`);
    expect(entry).toBeDefined();
    expect(entry!.label.de).toBe('E11');
    expect(entry!.label.en).toBe('E11');
    expect(entry!.fullText.de).toBe('Diabetes mellitus Typ 2 (E11)');
    expect(entry!.fullText.en).toBe('Type 2 diabetes mellitus (E11)');
    // Regression guard: E11.9 still distinct
    expect(_seedMap.get(`${SYSTEM_ICD10_GM}|E11.9`)).toBeDefined();
  });

  it('ICD-10-GM H43.1 — Vitreous hemorrhage', () => {
    const entry = _seedMap.get(`${SYSTEM_ICD10_GM}|H43.1`);
    expect(entry).toBeDefined();
    expect(entry!.label.de).toBe('H43.1');
    expect(entry!.label.en).toBe('H43.1');
    expect(entry!.fullText.de).toBe('Glaskörperblutung (H43.1)');
    expect(entry!.fullText.en).toBe('Vitreous hemorrhage (H43.1)');
  });

  it('ICD-10-GM T85.8 — Other complication of internal prosthetic devices', () => {
    const entry = _seedMap.get(`${SYSTEM_ICD10_GM}|T85.8`);
    expect(entry).toBeDefined();
    expect(entry!.label.de).toBe('T85.8');
    expect(entry!.label.en).toBe('T85.8');
    expect(entry!.fullText.de).toBe('Sonstige Komplikation durch Implantate (T85.8)');
    expect(entry!.fullText.en).toBe('Other complication of internal prosthetic devices (T85.8)');
  });
});

describe('terminology — getCachedDisplay + resolveDisplay', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    _resetForTests();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('Test A — sync seed hit returns label without firing fetch', () => {
    const fn = mockFetch(() => new Response('', { status: 200 }));

    const result = getCachedDisplay(SYSTEM_SNOMED, '267718000', 'de');
    expect(result).toBe('AMD');
    expect(fn).not.toHaveBeenCalled();
  });

  it('Test B — sync miss returns raw code and fires a single fire-and-forget fetch', async () => {
    const fn = mockFetch(() => new Response(JSON.stringify({}), { status: 503 }));

    const first = getCachedDisplay(undefined, 'X.unknown', 'de');
    expect(first).toBe('X.unknown');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0]?.[0]).toBe('/api/terminology/lookup');

    // Second sync call before fetch resolves must NOT fire a second fetch
    const second = getCachedDisplay(undefined, 'X.unknown', 'de');
    expect(second).toBe('X.unknown');
    expect(fn).toHaveBeenCalledTimes(1);

    // Let the in-flight resolveDisplay settle so it doesn't leak into other tests
    await flushMicrotasks();
    await flushMicrotasks();

    // After 503 + no seed, L1 holds the raw code so further calls don't refetch
    const third = getCachedDisplay(undefined, 'X.unknown', 'de');
    expect(third).toBe('X.unknown');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('Test C — resolveDisplay 200 populates L1 and suppresses subsequent fetches', async () => {
    const fn = mockFetch(() => new Response(JSON.stringify({ display: 'Custom Display' }), { status: 200 }));

    const display = await resolveDisplay({ system: 'urn:test', code: '42', locale: 'de' });
    expect(display).toBe('Custom Display');
    expect(fn).toHaveBeenCalledTimes(1);

    const cached = getCachedDisplay('urn:test', '42', 'de');
    expect(cached).toBe('Custom Display');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('Test D — resolveDisplay 503 falls through to seed', async () => {
    mockFetch(() => new Response('', { status: 503 }));

    const result = await resolveDisplay({
      system: SYSTEM_SNOMED,
      code: '267718000',
      locale: 'de',
    });
    expect(result).toBe('AMD');
  });
});

describe('terminology — useDiagnosisDisplay hook', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    _resetForTests();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('Test E — re-renders with resolved value when L1 fills', async () => {
    mockFetch(() => new Response(JSON.stringify({ display: 'Resolved' }), { status: 200 }));

    const { result } = renderHook(() => useDiagnosisDisplay('XYZ', 'urn:test', 'de'));

    // Initial render: raw code, isResolving true
    expect(result.current.label).toBe('XYZ');
    expect(result.current.isResolving).toBe(true);

    await act(async () => {
      await flushMicrotasks();
      await flushMicrotasks();
    });

    expect(result.current.label).toBe('Resolved');
    expect(result.current.isResolving).toBe(false);
  });
});
