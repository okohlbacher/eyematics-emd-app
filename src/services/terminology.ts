/**
 * Browser-side terminology resolver module (Phase 25, plan 25-01).
 *
 * Replaces the hardcoded `getDiagnosisLabel` / `getDiagnosisFullText` switch
 * statements in `fhirLoader.ts` with a 3-tier strategy (full implementation
 * lands across 3 atomic commits in this plan):
 *
 *   1. (this commit, Task 1) `_seedMap` + `collectCodings` — well-known
 *      seed data and bundle-walking helper. Pure / I/O-free.
 *   2. (next commit, Task 2) `resolveDisplay` + `getCachedDisplay` — async
 *      lookup against `/api/terminology/lookup` plus the sync wrapper.
 *   3. (final commit, Task 3) `useDiagnosisDisplay` React hook + safety net.
 *
 * Module-only landing — no caller is wired in this plan (D-26 wave 1).
 * Callers migrate in plan 25-03; settings + docs in plan 25-04.
 *
 * See `.planning/phases/25-terminology-resolver/25-CONTEXT.md` decisions
 * D-01..D-09 for the binding contract.
 */
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
 * spurious diff in screenshot/snapshot tests during the 25-03 caller
 * migration.
 *
 * Note: legacy `getDiagnosisFullText` covers 10 cases (2 SNOMED + 8
 * ICD-10-GM); plan-text says "9" but the byte-identical migration
 * requires all 10 — see plan SUMMARY for the deviation note.
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
