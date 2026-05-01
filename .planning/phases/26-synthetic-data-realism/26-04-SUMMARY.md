---
phase: 26-synthetic-data-realism
plan: 04
subsystem: synthetic-data, testing, ci
tags: [fhir, bundles, distributions, vitest, verify-script, audit, ci-gate]

requires:
  - phase: 26-02-comorbidity-model
    provides: sampleComorbidities helper + comorbidity Conditions in generated bundles
  - phase: 26-03-hba1c-and-template-differentiation
    provides: HbA1c observations, age-disease coupling, AMD/DME/RVO template differentiation

provides:
  - scripts/verify-bundle-distributions.mjs — asserts aggregate priors (AMD median age ≥70, DME diabetes 100%, AMD comorbidity ≥60%, DME HbA1c ≥2)
  - tests/synthBundleDistributions.test.ts — Vitest wrapper for distribution assertions
  - 4 regenerated synthetic bundles (chemnitz, leipzig, greifswald, muenster) encoding all 26-02/26-03 improvements
  - npm run audit:bundles chains audit-bundle-codes + verify-bundle-distributions, wired into test:ci

affects: [phase-27-onwards, ci, bundle-generation, synthetic-data]

tech-stack:
  added: []
  patterns:
    - ESM verify script reads bundles via BUNDLE_GLOB env override (mirror of 26-01 audit pattern)
    - Atomic 4-bundle commit per D-11 to prevent partial-regeneration hazard

key-files:
  created:
    - scripts/verify-bundle-distributions.mjs
    - tests/synthBundleDistributions.test.ts
  modified:
    - public/data/center-chemnitz.json
    - public/data/center-leipzig.json
    - public/data/center-greifswald.json
    - public/data/center-muenster.json
    - package.json

key-decisions:
  - "Atomic 4-bundle commit (D-11): all 4 synthetic JSONs in single chore commit to prevent partial-regeneration state"
  - "audit:bundles chains both audit-bundle-codes.mjs AND verify-bundle-distributions.mjs; wired into test:ci"
  - "BUNDLE_GLOB env override enables unit-testing verifier against synthesized fixtures without touching public/data/"
  - "Reference bundles (aachen, tuebingen) untouched per D-06"

patterns-established:
  - "Distribution verifier: dependency-free .mjs, exit code for assertion failures, BUNDLE_GLOB override for tests"
  - "Safety-net chain: test:ci → audit:bundles → both audit + verify scripts must pass"

requirements-completed:
  - SYNTH-04

duration: 25min
completed: 2026-05-01
---

# Phase 26-04: Regenerate & Verify Summary

**4 synthetic FHIR bundles regenerated atomically with verify-bundle-distributions.mjs asserting all distribution priors (AMD median age 74, DME diabetes 100%, AMD comorbidity 65%, DME HbA1c ≥2) wired into test:ci**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-05-01
- **Tasks:** 2
- **Files modified:** 7 (4 bundles + verifier script + test + package.json)

## Accomplishments

- `scripts/verify-bundle-distributions.mjs` — dependency-free ESM script asserting all D-12 distribution priors across the 4 synthetic bundles; exits 0 on pass, 1 with diagnostic on failure; supports `BUNDLE_GLOB` env override for unit testing
- `tests/synthBundleDistributions.test.ts` — 6 Vitest behaviors covering: valid fixture pass, AMD age failure, DME diabetes absence failure, DME HbA1c count failure, AMD comorbidity rate failure, shipped-bundle integration assertion
- 4 synthetic bundles regenerated in a single atomic `chore(26-04)` commit — AMD median age 74, AMD comorbidity rate 65%, DME diabetes 100%, DME HbA1c 100% (all above thresholds)
- `npm run audit:bundles` now chains `audit-bundle-codes.mjs && verify-bundle-distributions.mjs`, wired into `test:ci`
- Full safety net passes: 682 tests, build clean, lint clean, knip no issues, audit:bundles exits 0

## Task Commits

1. **Task 1: Add verify-bundle-distributions script + tests + safety-net wiring** - `c233faa` (test) → `09b22c6` (feat)
2. **Task 2: Regenerate 4 synthetic bundles atomically + wire audit:bundles into test:ci** - `5bdd89a` (chore)

## Files Created/Modified

- `scripts/verify-bundle-distributions.mjs` — distribution prior assertion script
- `tests/synthBundleDistributions.test.ts` — Vitest wrapper + mutation tests
- `public/data/center-chemnitz.json` — regenerated with comorbidities, HbA1c, templates
- `public/data/center-leipzig.json` — regenerated
- `public/data/center-greifswald.json` — regenerated
- `public/data/center-muenster.json` — regenerated
- `package.json` — verify:bundles + chained audit:bundles + test:ci wiring

## Decisions Made

- Atomic commit for all 4 JSONs per D-11 (CONTEXT §code_context "Bundle-edit hazard") — prevents site counts being inconsistent mid-commit
- `BUNDLE_GLOB` env override mirrors the audit-bundle-codes.mjs pattern from 26-01, keeping scripts consistent
- `audit:bundles` supersedes the single-script version from 26-01: now chains both audit + verify

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All SYNTH-01..04 requirements fulfilled; Phase 26 fully complete
- Safety-net gate (`audit:bundles` in `test:ci`) will catch any future bundle regressions
- Reference bundles (aachen, tuebingen) untouched — safe for subsequent phases

---
*Phase: 26-synthetic-data-realism*
*Completed: 2026-05-01*
