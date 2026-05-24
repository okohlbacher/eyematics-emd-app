---
phase: 34-data-completeness-consent-stubs
plan: "01"
subsystem: shared-types, test-scaffolds
tags: [fhir-types, wave-0, tdd-scaffolds, d-03, d-04, d-07, d-13]

dependency_graph:
  requires: []
  provides:
    - "Consent interface in shared/types/fhir.ts (flows via src/types/fhir.ts barrel)"
    - "Encounter interface in shared/types/fhir.ts (flows via src/types/fhir.ts barrel)"
    - "Wave 0 test scaffolds: stubIsolation, datenvollstaendigkeitCard, augmentReferenceBundles"
  affects:
    - "shared/types/fhir.ts — extended"
    - "src/types/fhir.ts — unchanged (barrel re-export auto-flows new types)"
    - "tests/ — 3 new files"

tech_stack:
  added: []
  patterns:
    - "FhirResource extension interfaces (Consent, Encounter) following Procedure pattern"
    - "Wave 0 RED test scaffold pattern: full assertion bodies, all .skip labeled SKIP_REASON:"
    - "RTL smoke test with countRawPatients mock; no jest-dom"

key_files:
  created:
    - shared/types/fhir.ts (modified — Consent and Encounter interfaces appended)
    - tests/stubIsolation.test.ts
    - tests/datenvollstaendigkeitCard.test.tsx
    - tests/augmentReferenceBundles.test.ts
  modified:
    - shared/types/fhir.ts

decisions:
  - "Consent and Encounter added only as FHIR bundle typing; not wired into PatientCase (D-01/D-02)"
  - "stubIsolation tests left RED — D-03/D-04 filters land in Plan 02"
  - "datenvollstaendigkeitCard card-presence tests skipped — card JSX lands in Plan 04"
  - "augmentReferenceBundles tests fully skipped — script lands in Plan 03"
  - "All .skip annotations have // SKIP_REASON: comments; npm run test:check-skips passes"

metrics:
  duration: "~15 min"
  completed: "2026-05-24"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 1
---

# Phase 34 Plan 01: FHIR Type Contracts + Wave 0 Test Scaffolds Summary

**One-liner:** Consent and Encounter FHIR interfaces in shared/types/fhir.ts + three Wave 0 RED/skipped test scaffolds that Plans 02, 03, 04 will turn green.

## What Was Done

### Task 1: Consent and Encounter interfaces (commit `4954735`)

Added two exported interfaces to `shared/types/fhir.ts`, both extending `FhirResource`:

- `Encounter`: `resourceType: 'Encounter'`, `status`, `subject: FhirReference`, optional `period?: FhirPeriod`, optional `serviceProvider?: FhirReference`.
- `Consent` (D-07): `resourceType: 'Consent'`, `status`, `scope: FhirCodeableConcept`, `category: FhirCodeableConcept[]`, `patient: FhirReference`, optional `organization?: FhirReference[]`, optional `dateTime?`, optional `policyRule?: FhirCodeableConcept`, optional `provision?: { type: string; purpose?: FhirCoding[] }`.

Neither type is wired into `PatientCase` or `extractPatientCases` (D-01/D-02). The `src/types/fhir.ts` barrel re-export auto-flows both types with no change needed.

### Task 2: Wave 0 test scaffolds (commit `9a8e9b7`)

Three Vitest files created under `tests/`:

**`tests/stubIsolation.test.ts`** — 2 non-skipped RED tests:
- D-03: `extractPatientCases([bundle])` excludes `pat-stub-001` and includes `pat-full-001`
- D-04: `extractCenters([bundle]).find(c => c.id === 'org-test').patientCount === 1`
- Expected RED until Plan 02 adds the stub filters.

**`tests/datenvollstaendigkeitCard.test.tsx`** — 2 non-skipped smoke tests + 5 skipped card-presence assertions:
- Non-skipped: LandingPage renders without throwing with `bundles` in `useData` mock; `countRawPatients` mocked to return 10.
- Skipped (Plan 04): caption, percentage, n/m sub-label, icon, progressbar aria assertions.
- No `toBeInTheDocument` or any jest-dom matcher used.

**`tests/augmentReferenceBundles.test.ts`** — 3 assertions all skipped (Plan 03):
- Byte-equality of pre-existing resources after augmentation (D-13)
- At least one new Consent or stub entry appended
- Idempotency: second run does not change `bundle.entry.length`

## Verification

- `npm run test:check-skips`: PASSED (83 test files, no unlabelled .skip)
- `npx vitest run tests/stubIsolation.test.ts tests/datenvollstaendigkeitCard.test.tsx tests/augmentReferenceBundles.test.ts`: all 3 files collected cleanly; 4 RED (expected), 8 skipped (expected), 0 collection errors.
- `npx tsc -b --noEmit`: clean (no new type errors).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. Test scaffolds are intentional pending states (not data stubs). All stub tests are labeled with `SKIP_REASON:` and will be resolved by their respective downstream plans.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. Test fixtures use synthetic placeholder IDs only (`pat-full-001`, `pat-stub-001`) — no PHI.

## Self-Check: PASSED

- `shared/types/fhir.ts` — FOUND (Consent and Encounter interfaces present)
- `tests/stubIsolation.test.ts` — FOUND
- `tests/datenvollstaendigkeitCard.test.tsx` — FOUND
- `tests/augmentReferenceBundles.test.ts` — FOUND
- Commit `4954735` — FOUND
- Commit `9a8e9b7` — FOUND
