---
phase: 10-visual-ux-qa-preview-stability
plan: 04b
subsystem: outcomes-preview
tags: [outcomes, data-preview, react-keys, tdd, vitest, rtl]

# Dependency graph
requires:
  - phase: 09-outcomes-page-ui
    provides: OutcomesDataPreview component (OUTCOME-08 / D-27..D-30); row structure (patient_pseudonym, eye, observation_date)
provides:
  - Stable composite row-key function (${pseudo}|${eye}|${date}[|#N]) for OutcomesDataPreview
  - data-row-key DOM attribute for test observability of React keys without reaching into fibers
  - Regression fixture for React-key-uniqueness (uniqueness + reorder-stability + duplicate-tuple fallback)
affects: [phase-13-new-outcome-metrics, any-future-preview-table, phase-12-server-side-pre-aggregation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composite-key pattern for tabular React lists: identity tuple joined with '|', duplicates get '|#N' counter"
    - "data-row-key DOM attribute for RTL key observability (avoids React internal APIs)"

key-files:
  created:
    - tests/outcomesDataPreview.test.tsx
    - .planning/phases/10-visual-ux-qa-preview-stability/10-04b-preview-row-keys-PLAN.md
  modified:
    - src/components/outcomes/OutcomesDataPreview.tsx

key-decisions:
  - "Composite key format: ${pseudo}|${eye}|${date}, duplicates disambiguated with |#N suffix (D-10/D-11)"
  - "Duplicate counter uses first-encountered order within flattenToRows output (deterministic since flattenToRows sorts ascending by date per eye)"
  - "Expose key via data-row-key DOM attribute instead of querying React fiber internals — simpler + framework-version-proof"
  - "Test-2 regex bug fixed during execution: /-\\d+$/ false-matches ISO dates ending -DD; replaced with per-segment format assertion"

patterns-established:
  - "Pipe-separated identity key with #N duplicate counter — reusable for any row-list component going forward"

requirements-completed: [CRREV-02]

# Metrics
duration: 3min
completed: 2026-04-16
---

# Phase 10 Plan 04b: OutcomesDataPreview Row Key Stability Summary

**OutcomesDataPreview rows now keyed by stable composite `${pseudo}|${eye}|${date}` (with `|#N` for rare duplicate tuples), closing Phase 9 code-review INFO finding IN-02 under a 4-assertion React-key-uniqueness test.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-16T11:14:43Z
- **Completed:** 2026-04-16T11:17:23Z
- **Tasks:** 3 (+ 1 plan-authoring commit)
- **Files modified:** 2 (1 source, 1 new test); 1 new plan file

## Accomplishments

- Replaced array-index-dependent row key (`${pseudo}-${eye}-${date}-${i}`) with pure identity-based composite key.
- Duplicate `(pseudo, eye, date)` tuples handled deterministically via `|#N` counter (N≥2).
- 4 new tests pin the invariant: uniqueness, no array-index suffix, stability under row reorder, duplicate-tuple fallback without React warnings.
- Full vitest suite: **317/317 green** (313 baseline + 4 new).

## Task Commits

Each task was committed atomically (per parallel-executor flag: `--no-verify` on commits):

0. **Plan authoring** — `64df9bc` (docs)
1. **Task 1: RED — React-key-uniqueness test** — `913566c` (test)
2. **Task 2: GREEN — composite key + data-row-key attribute** — `76d8386` (feat)
3. **Task 3: Full regression sweep** — no code change; full suite `npm test` → 317/317

## Files Created/Modified

- `src/components/outcomes/OutcomesDataPreview.tsx` — Added `rowKeys` pre-computation (lines ~161..176), replaced inline key template with `rowKeys[i]`, exposed `data-row-key={rowKeys[i]}` on each `<tr>`.
- `tests/outcomesDataPreview.test.tsx` — New jsdom test file (4 assertions, ~255 lines).
- `.planning/phases/10-visual-ux-qa-preview-stability/10-04b-preview-row-keys-PLAN.md` — Plan file authored at execution start (orchestrator spawned executor without pre-seeded PLAN.md; plan derived from 10-CONTEXT.md D-10/D-11 and ROADMAP success criterion #6).

## Decisions Made

- **Duplicate-tuple fallback is a counter, not `measurement_id`** (D-11 left this open). Adding `measurement_id` to `Row` would leak into the CSV export path (D-28 column set is frozen from Phase 9) — counter is self-contained and stable given `flattenToRows`'s deterministic sort.
- **`data-row-key` DOM attribute over fiber introspection** — lets the test observe the actual React key value without depending on React internals or requiring an external library (e.g., `react-test-renderer`'s `toJSON()` which doesn't surface keys reliably).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed false-positive regex in test-2**
- **Found during:** Task 2 (first GREEN run)
- **Issue:** Assertion `expect(k).not.toMatch(/-\d+$/)` matched the ISO date suffix (`…-01`, `…-02`), producing a spurious failure on a correct implementation. The regex was meant to catch the *old* trailing array-index suffix.
- **Fix:** Replaced with a structural assertion on the key segments: split by `|`, require ≥3 segments, require last segment to match `^(\d{4}-\d{2}-\d{2}|#\d+)$`.
- **Files modified:** `tests/outcomesDataPreview.test.tsx`
- **Verification:** All 4 assertions pass after the fix; full suite remains 317/317.
- **Committed in:** `76d8386` (part of the GREEN commit, since the test file was still in the same feature scope).

---

**Total deviations:** 1 auto-fixed (1 bug — in my own newly-authored test, not production code).
**Impact on plan:** Zero scope creep; the fix corrected a test-authoring error, not a production defect.

## Issues Encountered

- **Missing PLAN.md at start:** The orchestrator spawned the executor without a pre-seeded `10-04b-preview-row-keys-PLAN.md`. Since CONTEXT.md (D-10/D-11) and ROADMAP success criterion #6 fully specified CRREV-02, the plan was authored and committed at execution start (`64df9bc`) before tasks began. Documented here for audit.
- **Worktree base mismatch:** Initial `git merge-base HEAD edfc59d` returned a different commit (the worktree started from a detached "Initial commit"). Hard-reset to the expected base `edfc59d` before starting work. No commits were lost (the initial commit had no work on top).
- **Pre-existing test pollution:** `tests/issueApi.test.ts` writes transient fixture JSON files to `feedback/` without cleanup. Two new untracked files appeared during `npm test`. Out-of-scope (pre-existing, not caused by this plan) — left untracked per scope-boundary rule.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- CRREV-02 is fully closed (requirement check-box can be flipped by the orchestrator after all Phase 10 plans land).
- The `data-row-key` attribute pattern and composite-key recipe are available for Phase 13 metric panels (CRT/Interval/Responder) when they introduce their own tabular previews.
- No blockers for remaining Phase 10 plans (VQA-01..05 are independent of this work).

## Self-Check

Commits exist:
- `64df9bc` — plan authoring: FOUND
- `913566c` — RED test: FOUND
- `76d8386` — GREEN implementation: FOUND

Files created/modified exist:
- `src/components/outcomes/OutcomesDataPreview.tsx`: FOUND (modified)
- `tests/outcomesDataPreview.test.tsx`: FOUND (created)
- `.planning/phases/10-visual-ux-qa-preview-stability/10-04b-preview-row-keys-PLAN.md`: FOUND (created)
- `.planning/phases/10-visual-ux-qa-preview-stability/10-04b-preview-row-keys-SUMMARY.md`: FOUND (this file)

## Self-Check: PASSED

---
*Phase: 10-visual-ux-qa-preview-stability*
*Completed: 2026-04-16*
