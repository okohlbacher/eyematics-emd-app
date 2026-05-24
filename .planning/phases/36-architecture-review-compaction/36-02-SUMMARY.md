---
plan: 36-02
phase: 36-architecture-review-compaction
status: complete
requirements: [ARCH-03]
completed: 2026-05-24
subsystem: outcomes / shared clinical transforms
tags: [compaction, de-duplication, refactor, behavior-preserving]
key_files:
  created:
    - shared/laterality.ts
    - src/utils/cohortFilterSerialization.ts
  modified:
    - shared/types/fhir.ts
    - tests/stubIsolation.test.ts
    - tests/augmentReferenceBundles.test.ts
    - src/services/dataSource.ts
    - src/services/fhirLoader.ts
    - shared/cohortTrajectory.ts
    - shared/responderMetric.ts
    - shared/intervalMetric.ts
    - src/components/outcomes/OutcomesDataPreview.tsx
    - src/components/outcomes/OutcomesView.tsx
    - src/pages/CohortBuilderPage.tsx
    - src/pages/AnalysisPage.tsx
    - .planning/reviews/v1.11-arch-review/APPROVED.md
  deleted:
    - scripts/generate-changelog-doc.py
    - src/assets/react.svg
    - src/assets/vite.svg
    - src/assets/hero.png
---

# Phase 36 Plan 02: Approved v1.11 Compaction (Tier A + Tier B) Summary

One-liner: applied the user-approved Tier A hygiene deletions and Tier B behavior-preserving
de-duplications — centralized laterality, cohort-filter safe-pick, interval/responder/measurement
row projectors, and collapsed `OutcomesDataPreview` to a metric-config shell — with the full
901-test suite green after every commit.

## Approval gate

The user approved **Tier A + Tier B**, deferring **Tier C** to the v1.12 backlog. Recorded in
`.planning/reviews/v1.11-arch-review/APPROVED.md`. No product code was touched before approval.

## Tier A — applied (mechanical hygiene, near-zero behavior risk)

| ID | What | Commit |
|----|------|--------|
| BASE-1 | Dropped unused `Encounter`/`Consent` exported types so knip is clean (`shared/types/fhir.ts`) | `0d34e91` |
| BASE-2 | `lint:fix` of 2 import-sort warnings (`tests/stubIsolation.test.ts`, `tests/augmentReferenceBundles.test.ts`) | `fedf661` |
| F-12 | Removed ignored params from data-source abstraction (`src/services/dataSource.ts`, `src/services/fhirLoader.ts`) | `c27dbb1` |
| F-14 | Deleted stale changelog generator (`scripts/generate-changelog-doc.py`) | `6ee1268` |
| F-15 | Deleted unused starter/hero assets (`src/assets/react.svg`, `vite.svg`, `hero.png`) | `f0d22ae` |

## Tier B — applied (behavior-preserving de-duplication, test:ci green after each)

| ID | What | Commit |
|----|------|--------|
| F-05 | Centralized OD/OS laterality into `shared/laterality.ts` (`resolveEye`); `cohortTrajectory.eyeOf` now aliases it; deleted 3 local copies (`eyeFromBodySite`, `eyeOfProc`, `bodySiteEye`) | `0ed69a1` |
| F-04 | Centralized `CohortFilter` safe-pick whitelist into `src/utils/cohortFilterSerialization.ts` (`safePickCohortFilter` + `parseCohortFilterJson`); removed 3 hand-maintained copies | `d23e191` |
| F-07 | Added shared `flattenIntervalRows` (`IntervalGapRow`) in `shared/intervalMetric.ts`; CSV path consumes it | `a4cb18d` |
| F-06 | Added shared `projectResponderRows` (`ResponderExportRow`) in `shared/responderMetric.ts`; CSV path consumes it | `9e52927` |
| F-08 | Added shared `flattenVisusRows`/`flattenCrtRows` (`VisusExportRow`/`CrtExportRow`) in `shared/cohortTrajectory.ts`; CSV path consumes them | `5be94d5` |
| F-11 | Collapsed `OutcomesDataPreview` 4 repeated `<details>`/header/export/table branches into one metric-config shell (columns, CSV value, cell, filename, export label, rowKey, optional parity surface). 751 → ~270 lines | `775d543` |

## Behavior-preservation notes

- **F-05 union behavior:** `resolveEye` is the union of all four prior implementations — accepts a
  single CodeableConcept or an array (Procedure.bodySite), inspects `coding[0].code`, and recognizes
  both primary SNOMED laterality codes and the alternate structure codes (`24028007`/`8966001`). The
  old `eyeOfProc` "fallback" and the OutcomesDataPreview `?? eyeOf(...)` chaining were redundant
  (already covered) and were dropped without behavior change.
- **F-06 scope clarification:** `ResponderView` keeps `classifyResponders` (per-PATIENT, combined-eye
  averaging — distinct chart-bucket projection). The real duplication was the CSV's per-EYE year-1
  delta selection + bucket assignment, which is what `projectResponderRows` now owns. Forcing
  ResponderView onto the per-eye projector would have changed its bucket semantics, so it was left
  intact. Behavior of both paths is unchanged.
- **F-07/F-08 byte-identical math:** the shared projectors replicate the prior in-component CSV path
  exactly (`.slice(0,10)` date truncation, `Math.round` gap/day math, positive-finite filtering,
  1-based `gap_index`, `crt_um`/`crt_delta_um` rounding). The histogram keeps its own internal
  `getEyeDates`/`computeGaps` (`Math.floor`) — not merged, to avoid altering bin math.
- **F-11 DOM parity:** the metric-config shell reproduces the exact `data-testid`, caption
  `{rows}` substitution, export `aria-label`, table headers, eye-translation cells, the D-26
  `outcomes-preview-parity` surface (visus only), and the CRREV-02 `data-row-key` (visus only).
  CSV columns/values and rendered cells are unchanged across all four metrics.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] Removed now-unused `CohortFilter` import in `OutcomesView.tsx`**
- **Found during:** F-11 gate (lint failed: `'CohortFilter' is defined but never used`).
- **Issue:** F-04 removed the local `safePickFilter` (which referenced the `CohortFilter` type),
  leaving an unused type import that tripped `@typescript-eslint/no-unused-vars`.
- **Fix:** dropped the unused `import type { CohortFilter }` line.
- **Files modified:** `src/components/outcomes/OutcomesView.tsx`
- **Commit:** `775d543` (folded into the F-11 commit since it was discovered at that gate).

No items were deferred — all six Tier B items (F-04, F-05, F-06, F-07, F-08, F-11) applied cleanly;
F-11 did not need to be reverted.

## Tier C — deferred to v1.12 backlog (per approval)

F-01 (server aggregation settings thresholds), F-02 (clinical thresholds into settings.yaml),
F-13 (server-side saved-search provenance + filter sanitization), F-09 (split `authApi.ts`),
F-10 (decompose `OutcomesView.tsx`), F-03 (remove unreachable Keycloak path, tied to KEYCLK-01).

## Final gate results

- `npm run test:ci` → **901 passed (83 files), 0 failures**; `audit:bundles`/`verify:bundles` priors pass.
- `npm run knip` → no new dead code (Encounter/Consent resolved). Only 4 pre-existing
  "Configuration hints" about redundant `knip.json` entry patterns — not dead code, not introduced here.
- `npm run lint` → **0 errors, 0 warnings**.
- Cumulative diff (Tier A + Tier B): 16 files, +624 / −864 lines.

## Self-Check: PASSED
