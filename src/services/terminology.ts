/**
 * Browser-side terminology resolver module (Phase 25, plan 25-01).
 *
 * Replaces the hardcoded `getDiagnosisLabel` / `getDiagnosisFullText` switch
 * statements in `fhirLoader.ts` with a 3-tier strategy:
 *   1. L1 in-memory cache
 *   2. Server-proxied FHIR `$lookup` (added in plan 25-02)
 *   3. Well-known seed map (`_seedMap`)
 *
 * Module-only landing — no caller is wired in this plan (D-26 wave 1).
 * Callers migrate in plan 25-03; settings + docs in plan 25-04.
 *
 * See `.planning/phases/25-terminology-resolver/25-CONTEXT.md` decisions
 * D-01..D-09 for the binding contract.
 */
import { useEffect, useReducer } from 'react';

import { SNOMED_AMD, SNOMED_DR } from '../../shared/fhirCodes';
import type { FhirBundle } from '../types/fhir';

const SYSTEM_SNOMED = 'http://snomed.info/sct';
const SYSTEM_ICD10_GM = 'http://fhir.de/CodeSystem/bfarm/icd-10-gm';

interface SeedEntry {
  label: { de: string; en: string };
  fullText: { de: string; en: string };
}

/**
 * Well-known seed map (D-07, D-08). Keys: `${system}|${code}`.
 *
 * Strings are byte-identical to the existing `getDiagnosisLabel` /
 * `getDiagnosisFullText` outputs in `fhirLoader.ts:112-170` to avoid
 * spurious diff in screenshot/snapshot tests during migration.
 *
 * Exported with `_` prefix per D-04 — test-only access surface.
 */
export const _seedMap: Map<string, SeedEntry> = new Map([
  // SNOMED CT — AMD
  [`${SYSTEM_SNOMED}|${SNOMED_AMD}`, {
    label: { de: 'AMD', en: 'AMD' },
    fullText: {
      de: 'Altersbedingte Makuladegeneration (267718000)',
      en: 'Age-related macular degeneration (267718000)',
    },
  }],
  // SNOMED CT — Diabetic Retinopathy
  [`${SYSTEM_SNOMED}|${SNOMED_DR}`, {
    label: { de: 'Diabetische Retinopathie', en: 'Diabetic Retinopathy' },
    fullText: {
      de: 'Diabetische Retinopathie (312898008)',
      en: 'Diabetic retinopathy (312898008)',
    },
  }],
  // ICD-10-GM — Diabetes mellitus type 2 (preserve raw-code label per existing behavior)
  [`${SYSTEM_ICD10_GM}|E11.9`, {
    label: { de: 'E11.9', en: 'E11.9' },
    fullText: {
      de: 'Diabetes mellitus Typ 2, ohne Komplikationen (E11.9)',
      en: 'Type 2 diabetes mellitus, without complications (E11.9)',
    },
  }],
  // ICD-10-GM — Diabetes mellitus type 1
  [`${SYSTEM_ICD10_GM}|E10.9`, {
    label: { de: 'E10.9', en: 'E10.9' },
    fullText: {
      de: 'Diabetes mellitus Typ 1, ohne Komplikationen (E10.9)',
      en: 'Type 1 diabetes mellitus, without complications (E10.9)',
    },
  }],
  // ICD-10-GM — Primary open-angle glaucoma
  [`${SYSTEM_ICD10_GM}|H40.1`, {
    label: { de: 'H40.1', en: 'H40.1' },
    fullText: {
      de: 'Primäres Offenwinkelglaukom (H40.1)',
      en: 'Primary open-angle glaucoma (H40.1)',
    },
  }],
  // ICD-10-GM — Senile nuclear cataract
  [`${SYSTEM_ICD10_GM}|H25.1`, {
    label: { de: 'H25.1', en: 'H25.1' },
    fullText: {
      de: 'Senile Kernkatarakt (H25.1)',
      en: 'Senile nuclear cataract (H25.1)',
    },
  }],
  // ICD-10-GM — Retinal detachment
  [`${SYSTEM_ICD10_GM}|H33.0`, {
    label: { de: 'H33.0', en: 'H33.0' },
    fullText: {
      de: 'Netzhautablösung mit Riss (H33.0)',
      en: 'Retinal detachment with break (H33.0)',
    },
  }],
  // ICD-10-GM — Essential hypertension
  [`${SYSTEM_ICD10_GM}|I10`, {
    label: { de: 'I10', en: 'I10' },
    fullText: {
      de: 'Essentielle Hypertonie (I10)',
      en: 'Essential hypertension (I10)',
    },
  }],
  // ICD-10-GM — Hypercholesterolemia
  [`${SYSTEM_ICD10_GM}|E78.0`, {
    label: { de: 'E78.0', en: 'E78.0' },
    fullText: {
      de: 'Hypercholesterinämie (E78.0)',
      en: 'Hypercholesterolemia (E78.0)',
    },
  }],
  // ICD-10-GM — Coronary artery disease
  [`${SYSTEM_ICD10_GM}|I25.1`, {
    label: { de: 'I25.1', en: 'I25.1' },
    fullText: {
      de: 'Koronare Herzkrankheit (I25.1)',
      en: 'Coronary artery disease (I25.1)',
    },
  }],
]);

// --- Module-private cache state (D-04, D-05) ---

const _l1Cache: Map<string, string> = new Map();
const _l1FullTextCache: Map<string, string> = new Map();
const _pendingLookups: Set<string> = new Set();
const _listeners: Set<() => void> = new Set();

function cacheKey(system: string | undefined, code: string, locale: string): string {
  return `${system ?? '_'}|${code}|${locale}`;
}

function seedKey(system: string | undefined, code: string): string {
  return `${system ?? '_'}|${code}`;
}

function pickLocale(value: { de: string; en: string }, locale: string): string {
  return locale === 'en' ? value.en : value.de;
}

function _notifyAll(): void {
  for (const fn of _listeners) {
    fn();
  }
}

/**
 * Reset module state. Test-only helper (D-04 underscore prefix).
 * Vitest calls this in `beforeEach` to keep tests independent.
 */
export function _resetForTests(): void {
  _l1Cache.clear();
  _l1FullTextCache.clear();
  _pendingLookups.clear();
  _listeners.clear();
}

/**
 * Walk the supplied bundles and return a `Map<system, Set<code>>` covering
 * every distinct (system, code) pair seen on `Condition`, `Observation`, or
 * `Procedure` resources (D-04). Pure — no I/O, no caching.
 *
 * Codings without a `system` are bucketed under the `'_'` sentinel
 * (matches D-05 cache-key sentinel).
 */
export function collectCodings(bundles: FhirBundle[]): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  const interesting = new Set(['Condition', 'Observation', 'Procedure']);

  for (const bundle of bundles) {
    for (const entry of bundle.entry) {
      const resource = entry.resource as { resourceType: string; code?: { coding?: Array<{ system?: string; code: string }> } };
      if (!interesting.has(resource.resourceType)) continue;
      const codings = resource.code?.coding ?? [];
      for (const coding of codings) {
        const sys = coding.system ?? '_';
        let codes = result.get(sys);
        if (!codes) {
          codes = new Set<string>();
          result.set(sys, codes);
        }
        codes.add(coding.code);
      }
    }
  }

  return result;
}

/**
 * Sync display lookup (D-04, D-06, D-09). Order:
 *   1. L1 cache
 *   2. _seedMap → label
 *   3. fallthrough → raw code AND fire-and-forget async lookup
 *
 * MUST NOT block render. Safe to call from any render path.
 */
export function getCachedDisplay(
  system: string | undefined,
  code: string,
  locale: string
): string {
  const key = cacheKey(system, code, locale);
  const cached = _l1Cache.get(key);
  if (cached !== undefined) return cached;

  const seed = _seedMap.get(seedKey(system, code));
  if (seed) {
    return pickLocale(seed.label, locale);
  }

  // Fire-and-forget async lookup — dedupe via _pendingLookups
  if (!_pendingLookups.has(key)) {
    void resolveDisplay({ system, code, locale }).catch(() => {
      // Errors swallowed in fire-and-forget path; surfaced via resolveDisplay
      // for explicit awaiters.
    });
  }
  return code;
}

/**
 * Sync fullText lookup — sibling of `getCachedDisplay` for tooltip contexts.
 * Mirrors the same 3-tier strategy but reads `entry.fullText[locale]` on
 * seed hits.
 */
export function getCachedFullText(
  system: string | undefined,
  code: string,
  locale: string
): string {
  const key = cacheKey(system, code, locale);
  const cached = _l1FullTextCache.get(key);
  if (cached !== undefined) return cached;

  const seed = _seedMap.get(seedKey(system, code));
  if (seed) {
    return pickLocale(seed.fullText, locale);
  }

  if (!_pendingLookups.has(key)) {
    void resolveDisplay({ system, code, locale }).catch(() => {});
  }
  return code;
}

interface LookupResponse {
  display?: string;
}

/**
 * Async display lookup (D-04, D-12, D-13). Order:
 *   1. L1 cache
 *   2. POST /api/terminology/lookup → on 200, cache + return display
 *   3. on 503 / non-2xx → seed fallback; if seed hits, cache seed.label and return
 *   4. else → cache the raw code (suppress repeat fetches per D-09 note) and return
 *
 * Throw-only error policy (CLAUDE.md D-03): network errors propagate so callers
 * can decide. The fire-and-forget path in `getCachedDisplay` swallows them.
 */
export async function resolveDisplay(args: {
  system: string | undefined;
  code: string;
  locale: string;
}): Promise<string> {
  const { system, code, locale } = args;
  const key = cacheKey(system, code, locale);

  const cached = _l1Cache.get(key);
  if (cached !== undefined) return cached;

  _pendingLookups.add(key);
  try {
    let display: string | null = null;
    try {
      const resp = await fetch('/api/terminology/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system, code, locale }),
        credentials: 'include',
      });
      if (resp.ok) {
        const data = (await resp.json()) as LookupResponse;
        if (data && typeof data.display === 'string' && data.display.length > 0) {
          display = data.display;
        }
      }
      // Non-OK (incl. 503): fall through to seed
    } catch {
      // Network failure — fall through to seed
    }

    if (display !== null) {
      _l1Cache.set(key, display);
      // Mirror display into fullText cache slot if no fullText cached yet —
      // server lookup returns a single display string; tooltip will show same.
      if (!_l1FullTextCache.has(key)) {
        _l1FullTextCache.set(key, display);
      }
      _notifyAll();
      return display;
    }

    const seed = _seedMap.get(seedKey(system, code));
    if (seed) {
      const label = pickLocale(seed.label, locale);
      const fullText = pickLocale(seed.fullText, locale);
      _l1Cache.set(key, label);
      _l1FullTextCache.set(key, fullText);
      _notifyAll();
      return label;
    }

    // Genuinely unknown code — cache raw to suppress repeat fetches (D-09 note)
    _l1Cache.set(key, code);
    if (!_l1FullTextCache.has(key)) {
      _l1FullTextCache.set(key, code);
    }
    _notifyAll();
    return code;
  } finally {
    _pendingLookups.delete(key);
  }
}

/**
 * React hook (D-04). Returns `{ label, fullText, isResolving }` and
 * re-renders any consumer when L1 fills (cache writes from anywhere
 * in the app trigger updates).
 */
export function useDiagnosisDisplay(
  code: string,
  system: string | undefined,
  locale: string
): { label: string; fullText: string; isResolving: boolean } {
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    _listeners.add(force);
    return () => {
      _listeners.delete(force);
    };
  }, []);

  const label = getCachedDisplay(system, code, locale);
  const fullText = getCachedFullText(system, code, locale);
  const isResolving = _pendingLookups.has(cacheKey(system, code, locale));
  return { label, fullText, isResolving };
}
