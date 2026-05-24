---
phase: 34-data-completeness-consent-stubs
plan: "02"
subsystem: shared-patientCases, fhirLoader
tags: [stub-isolation, d-03, d-04, d-09, wave-2, chokepoint-filter]

dependency_graph:
  requires: ["34-01 — FhirBundle types + test scaffolds"]
  provides:
    - "D-03 stub-exclusion filter at extractPatientCases single chokepoint"
    - "D-04 stub-excluding patientCount in extractCenters"
    - "D-09 countRawPatients(bundles) exported helper — stub-inclusive denominator"
  affects:
    - "shared/patientCases.ts — clinicalPatients filter inserted before patients.map"
    - "src/services/fhirLoader.ts — patientCount expression changed + countRawPatients added"
    - "tests/stubIsolation.test.ts — D-09 assertions added (2 new tests)"

tech_stack:
  added: []
  patterns:
    - "Single-chokepoint stub exclusion: filter at extractPatientCases, not per-consumer"
    - "Absence-of-Observations as stub discriminator (no tag/profile/extension)"
    - "D-09 denominator helper: bundles-only param, no center filter override"

key_files:
  created: []
  modified:
    - shared/patientCases.ts
    - src/services/fhirLoader.ts
    - tests/stubIsolation.test.ts

decisions:
  - "D-03 filter placed after observationsByRef is built but before patients.map — single chokepoint"
  - "No tag/profile/extension discriminator used — stub = absence of Observations (D-01)"
  - "countRawPatients takes only bundles param — server already filters by req.auth.centers (Pitfall 3)"
  - "D-04 uses observations.some() per patient rather than pre-indexed Set — both O(N*M) and O(N) approaches equivalent for current dataset sizes"

metrics:
  duration: "~10 min"
  completed: "2026-05-24"
  tasks_completed: 2
  tasks_total: 2
  files_created: 0
  files_modified: 3
---

# Phase 34 Plan 02: Stub Isolation at Chokepoint + countRawPatients Summary

**One-liner:** D-03 single-chokepoint stub filter in extractPatientCases + D-04 clinical-only patientCount + D-09 countRawPatients denominator helper — turns all stubIsolation.test.ts assertions green.

## What Was Done

### Task 1: D-03 stub-exclusion filter (commit `101fdbd`)

In `shared/patientCases.ts`, inserted a `clinicalPatients` filter between the `observationsByRef = groupBySubject(observations)` line (line 75) and the `return patients.map(...)` line (line 81):

```typescript
const clinicalPatients = patients.filter((pat) => {
  const ref = `Patient/${pat.id}`;
  return (observationsByRef.get(ref) ?? []).length > 0;
});

return clinicalPatients.map((pat) => {
```

Key properties:
- `observationsByRef` is fully built before the filter (ordering preserved)
- No tag/profile/extension check — stub = zero Observations (D-01)
- Single chokepoint: all clinical consumers (cohort, outcomes, quality, charts, server aggregation) are clean by construction

### Task 2: D-04 patientCount fix + D-09 countRawPatients (commit `6bb8995`)

Two changes in `src/services/fhirLoader.ts`:

**D-04:** Added `Observation` import, extracted `observations` array inside `extractCenters`, changed `patientCount: orgPatients.length` to filter only patients with at least one matching Observation:

```typescript
patientCount: orgPatients.filter((p) =>
  observations.some((o) => o.subject.reference === `Patient/${p.id}`)
).length,
```

**D-09:** Added and exported `countRawPatients(bundles: FhirBundle[]): number` after `extractCenters`:

```typescript
export function countRawPatients(bundles: FhirBundle[]): number {
  return bundles.reduce(
    (sum, b) =>
      sum + b.entry.filter((e) => e.resource.resourceType === 'Patient').length,
    0,
  );
}
```

Extended `tests/stubIsolation.test.ts` with 2 D-09 assertions:
- `countRawPatients([bundle])` returns 2 (1 full + 1 stub)
- `countRawPatients.length === 1` (takes only bundles, no center param)

## Verification

- `npx vitest run tests/stubIsolation.test.ts`: 4/4 tests passing (D-03, D-04, D-09 x2)
- `npx tsc -b --noEmit`: clean
- `npm run test:ci`: 891 passing / 2 failing (the 2 failures are pre-existing from Plan 01 — `tests/datenvollstaendigkeitCard.test.tsx` smoke tests that fail because LandingPage does not yet use `bundles` from useData; that wiring lands in Plan 04)

## Deviations from Plan

None — plan executed exactly as written. The datenvollstaendigkeitCard.test.tsx failures are pre-existing (present before Plan 02 execution, confirmed by git stash verification) and documented as deferred items for Plan 04.

## Deferred Items

| File | Issue | Resolution |
|------|-------|------------|
| tests/datenvollstaendigkeitCard.test.tsx | 2 smoke tests fail: LandingPage crashes on `c.observations.length` because mock cases lack observations field | Plan 04 wires `bundles` + `countRawPatients` into LandingPage; the mock will be updated then |

## Known Stubs

None — all code paths are wired. `countRawPatients` is a pure function ready for Plan 04 consumption.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. `countRawPatients` is a pure in-memory helper operating on already server-filtered bundles (Pitfall 3 / A2 respected).

## Self-Check: PASSED

- `shared/patientCases.ts` clinicalPatients filter — FOUND (`grep -n "clinicalPatients"` returns lines 85, 90)
- `src/services/fhirLoader.ts` countRawPatients — FOUND (`grep "export function countRawPatients"` returns match)
- `tests/stubIsolation.test.ts` D-09 tests — FOUND (4 tests pass)
- Commit `101fdbd` — FOUND
- Commit `6bb8995` — FOUND
- `npx vitest run tests/stubIsolation.test.ts`: 4/4 green — VERIFIED
