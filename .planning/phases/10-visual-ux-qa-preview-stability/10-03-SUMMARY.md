---
phase: 10-visual-ux-qa-preview-stability
plan: 03
subsystem: outcomes-empty-state
tags: [outcomes, empty-state, i18n, vqa-05, d-07, d-08, vitest, rtl]

# Dependency graph
requires:
  - phase: 09-outcomes-page-ui
    provides: OutcomesEmptyState 2-variant component, OutcomesPage early-return chain, LayerState + aggregate useMemo
provides:
  - Third empty-state variant 'all-eyes-filtered' (D-07) with D-08 DE + EN copy
  - Layer-all-off dispatch signal on OutcomesPage (distinct from no-visus)
  - Regression test covering variant dispatch + DE/EN localization + no-action-link invariant
affects: [phase-13-new-outcome-metrics, any-future-outcomes-filter-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Switch-statement routing on a discriminated Variant union (replaces nested ternaries) — easier to extend when a fourth empty state arrives"
    - "Translation stub for RTL tests that reads the real translations table, parameterised by locale, keeping tests independent of LanguageContext"

key-files:
  created:
    - tests/outcomesEmptyState.test.tsx
  modified:
    - src/i18n/translations.ts
    - src/components/outcomes/OutcomesEmptyState.tsx
    - src/pages/OutcomesPage.tsx

key-decisions:
  - "Pre-edit grep of OutcomesSettingsDrawer + OutcomesPage for 'eyeFilter|od_filter|os_filter|showOd|showOs' returned zero matches — confirming no existing OD/OS filter UI, so the D-07 trigger reduces to layer-all-off as planned."
  - "Variant routing rewritten as a switch statement (was: nested ternaries). Easier to extend and gives TypeScript exhaustiveness via the union."
  - "Translation RTL stub resolves strings from the real translations table keyed by locale — guarantees tests fail if D-08 copy ever drifts, without coupling to LanguageContext."
  - "Kept branch order explicit: no-cohort -> no-visus -> all-eyes-filtered. The all-eyes-filtered branch additionally asserts 'data exists' so it cannot shadow no-visus."

patterns-established:
  - "Discriminated-union empty-state component with switch-based key routing (title/body/action) — reusable for future empty states elsewhere in the app"

requirements-completed: [VQA-05]

# Metrics
duration: 4min
completed: 2026-04-16
---

# Phase 10 Plan 03: Empty-State i18n (D-07 / D-08 / VQA-05) Summary

**Third outcomes empty-state variant `all-eyes-filtered` shipped with verbatim D-08 DE + EN copy and a 6-assertion regression harness — closes VQA-05; outcomes i18n bundle grows from 71 to 73 keys with placeholder parity preserved.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-16T11:22:52Z
- **Completed:** 2026-04-16T11:26:45Z
- **Tasks:** 4 (autonomous)
- **Files modified:** 3 (2 source + 1 page); 1 new test file

## Accomplishments

- Added `outcomesEmptyAllEyesFilteredTitle` + `outcomesEmptyAllEyesFilteredBody` to `src/i18n/translations.ts` with verbatim D-08 copy (DE + EN).
- Extended `OutcomesEmptyState.tsx` `Variant` union to `'no-cohort' | 'no-visus' | 'all-eyes-filtered'`; switched nested-ternary routing for a switch statement.
- Added dispatch branch in `OutcomesPage.tsx` (between `no-visus` and the main render) that fires the new variant when `cohort.cases.length > 0` AND `aggregate.od.summary.measurementCount + aggregate.os.summary.measurementCount > 0` AND all four layer toggles are off.
- New `tests/outcomesEmptyState.test.tsx` with 6 assertions: EN copy verbatim, DE copy verbatim, no action link for new variant, no-cohort variant retains `<a href="/cohort">` (regression guard), plus two direct translation-table assertions.
- All regression targets green: `tests/outcomesEmptyState.test.tsx` (6/6), `tests/outcomesI18n.test.ts` (3/3), `tests/OutcomesPage.test.tsx` (17/17), `tsc -b` exits 0.

## Task Commits

Each task committed atomically (parallel-executor flag: `--no-verify`):

1. **Task 1: i18n keys for D-08 copy** — `f57a021` (feat)
2. **Task 2: Extend Variant union + switch routing** — `4c8d229` (feat)
3. **Task 3: Dispatch branch in OutcomesPage** — `38215a1` (feat)
4. **Task 4: Empty-state + translation regression tests** — `5a2f784` (test)

## Files Created/Modified

- **Modified** `src/i18n/translations.ts` — inserted 2 new `outcomesEmptyAllEyesFiltered*` entries immediately after `outcomesNoVisusBody` (keeps outcomes-empty block contiguous).
- **Modified** `src/components/outcomes/OutcomesEmptyState.tsx` — Variant union widened to 3 members; nested ternaries replaced with `switch` over variant; JSX body unchanged.
- **Modified** `src/pages/OutcomesPage.tsx` — new early-return branch placed after `no-visus`; no logic changes elsewhere.
- **Created** `tests/outcomesEmptyState.test.tsx` — 94-line jsdom test file; 2 describe blocks, 6 tests; uses RTL + MemoryRouter + a locale-parameterised translation stub.

## OutcomesSettingsDrawer OD/OS Filter Grep (plan `<output>` requirement)

Pre-edit grep on both `OutcomesSettingsDrawer.tsx` and `OutcomesPage.tsx`:

```bash
grep -En "eyeFilter|od_filter|os_filter|showOd|showOs" src/components/outcomes/OutcomesSettingsDrawer.tsx src/pages/OutcomesPage.tsx
# (no matches)
```

No OD/OS filter exists in the current UI. Dispatch condition used is therefore the layer-all-off signal specified in the plan: `!layers.median && !layers.perPatient && !layers.scatter && !layers.spreadBand`. The dispatch condition was NOT broadened.

## Shipped D-08 Copy (verbatim)

| Key | DE | EN |
| --- | --- | --- |
| `outcomesEmptyAllEyesFilteredTitle` | `Keine Augen entsprechen den aktuellen Filtern.` | `No eyes match the current filters.` |
| `outcomesEmptyAllEyesFilteredBody`  | `Passen Sie die OD/OS- oder Layer-Filter an, um Daten zu sehen.` | `Adjust the OD/OS or layer toggles to see data.` |

**No action-link key** was added — Task 1 acceptance criterion `! grep -E "outcomesEmptyAllEyesFilteredAction" src/i18n/translations.ts` passed, confirming D-08's explicit "user fixes it inline via the same toolbar" decision.

## i18n Completeness Test Delta

- Before: 71 `outcomes*` keys (per v1.5 PROJECT.md footnote)
- After:  73 `outcomes*` keys (verified via `grep -cE "^\s+outcomes[A-Z][A-Za-z0-9]+:" src/i18n/translations.ts` → 73)
- Delta: +2 (matches plan expectation of +2)
- `tests/outcomesI18n.test.ts` still green on all 3 assertions:
  - every key has non-empty DE + EN (sanity floor `> 40` unchanged)
  - placeholder tokens parity DE ↔ EN (new keys have none — trivially parity)
  - every `t('outcomes*')` reference in `src/` resolves to a defined key

The plan's output section estimated "~73 → ~75 keys"; actual starting count was 71 (exact v1.5 value), so final is 73 — same delta (+2), different base.

## Deviations from Plan

**None.** Plan executed exactly as written across all 4 tasks.

- No Rule 1 (bug) fixes required.
- No Rule 2 (missing critical functionality) additions required — threat model shows zero disposition; no trust boundary crossed.
- No Rule 3 (blocking issue) fixes required.
- No Rule 4 (architectural decision) triggered.

## Threat Flags

None. Plan's threat register declared all STRIDE categories N/A or `accept`; implementation touches no new trust boundary (two static string literals, a TypeScript union widen, one client-side branch predicate, one jsdom test file). Severity summary remains **none**.

## Known Stubs

None. The new variant routes to real DE + EN translations; `OutcomesPage.tsx` dispatch predicate uses existing `cohort`, `aggregate`, and `layers` values — no placeholders, no hardcoded empty data, no TODOs introduced.

## Verification Results

- `npx vitest run tests/outcomesEmptyState.test.tsx` → **6/6 pass** (6/6 expected)
- `npx vitest run tests/outcomesI18n.test.ts` → **3/3 pass**
- `npx vitest run tests/OutcomesPage.test.tsx` → **17/17 pass** (no regression — existing tests never set all four layers false)
- `npx tsc -b` → exit 0
- `grep -F "outcomesEmptyAllEyesFilteredTitle" src/i18n/translations.ts` → match
- `grep -F "outcomesEmptyAllEyesFilteredBody" src/i18n/translations.ts` → match
- `grep -F 'variant="all-eyes-filtered"' src/pages/OutcomesPage.tsx` → match (exactly 1 occurrence)

## Self-Check: PASSED

Files (existence verified):
- FOUND: src/i18n/translations.ts (modified)
- FOUND: src/components/outcomes/OutcomesEmptyState.tsx (modified)
- FOUND: src/pages/OutcomesPage.tsx (modified)
- FOUND: tests/outcomesEmptyState.test.tsx (created)

Commits (presence verified via `git log --oneline`):
- FOUND: f57a021 feat(10-03): add D-08 all-eyes-filtered i18n keys
- FOUND: 4c8d229 feat(10-03): extend OutcomesEmptyState Variant with all-eyes-filtered
- FOUND: 38215a1 feat(10-03): dispatch all-eyes-filtered empty-state variant
- FOUND: 5a2f784 test(10-03): add D-07 dispatch + D-08 localization tests
