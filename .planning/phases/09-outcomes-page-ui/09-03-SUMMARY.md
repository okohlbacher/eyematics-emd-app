---
plan: 09-03
status: complete
completed: 2026-04-15
tasks_completed: 3
---

# 09-03 Summary — Data Preview + CSV Export

## Objective

Add the final piece of Phase 9's Outcomes UI: the expandable `<details>` panel with a measurements table and Export-CSV button. Covers OUTCOME-08 and closes the user-facing surface of Phase 9.

## Tasks

1. **Task 3.1 (RED)** — `test(09-03): add RED tests 13-17 for data preview + CSV export` → commit `007295c`
   - 5 new RTL tests added to `tests/OutcomesPage.test.tsx`
   - Assertions: details collapsed by default, 8-column CSV headers, no `center_id`, dated filename shape, row-count = `aggregate.od.summary.measurementCount + aggregate.os.summary.measurementCount`
   - Mocks `src/utils/download.ts` via `vi.mock` to capture `downloadCsv` call shape

2. **Task 3.2 (GREEN)** — `feat(09-03): add OutcomesDataPreview with flattenToRows + CSV export` → commit `02a2375`
   - `src/components/outcomes/OutcomesDataPreview.tsx` (258 lines): native `<details>` + summary + caption + Export-CSV button + scrollable table (`max-h-96 overflow-auto`)
   - `flattenToRows(cases: PatientCase[]): Row[]` defined LOCALLY inside the component (09-CONTEXT.md locked decision 3 — does NOT modify `cohortTrajectory.ts`, does NOT call `computeCohortTrajectory` a second time)
   - Baseline lookup: earliest LOINC_VISUS observation per (patient, eye) from the patient's full observation record
   - `treatment_index`: count of SNOMED_IVI Procedures with date ≤ observation.date and matching eye laterality (SNOMED_EYE_RIGHT / SNOMED_EYE_LEFT)
   - logMAR + Snellen via imported `decimalToLogmar`, `decimalToSnellen`, `eyeOf` helpers from `cohortTrajectory.ts` (read-only imports; no mutation of Phase 8 code)
   - Extended `src/pages/OutcomesPage.tsx` to render `<OutcomesDataPreview cases={cohort.cases} aggregate={aggregate} t={t} locale={locale} />` below the panels grid
   - CSV headers use the outcomes* i18n keys from 08-04: `outcomesPreviewColPseudonym`, `outcomesPreviewColEye`, `outcomesPreviewColDate`, `outcomesPreviewColDaysSinceBaseline`, `outcomesPreviewColTreatmentIndex`, `outcomesPreviewColVisusLogmar`, `outcomesPreviewColSnellenNum`, `outcomesPreviewColSnellenDen`
   - Filename via `datedFilename('outcomes-cohort', 'csv')` → `outcomes-cohort-YYYY-MM-DD.csv`

3. **Task 3.3 (REFACTOR + SUMMARY)** — `docs(09-03): REFACTOR + plan summary for data preview + CSV` → this commit
   - Inline Recharts fix in `OutcomesPanel.tsx` (see Deviations below)
   - SUMMARY.md at `.planning/phases/09-outcomes-page-ui/09-03-SUMMARY.md`

## Files Modified (matches plan fence exactly)

| File | Lines added | Status |
|------|------------:|--------|
| `src/components/outcomes/OutcomesDataPreview.tsx` | 258 | Created |
| `src/pages/OutcomesPage.tsx` | +25 | Extended (wire preview below panels) |
| `tests/OutcomesPage.test.tsx` | +175 | Extended (tests 13-17) |

Drift-check against plan `files_modified` passed on every commit. Phase 8's `src/utils/cohortTrajectory.ts` remains untouched since commit `dfa616c`.

## Verification

- `npm test -- tests/OutcomesPage.test.tsx` — **17/17 passing** (1 file, 218ms)
- `grep -c "computeCohortTrajectory" src/components/outcomes/OutcomesDataPreview.tsx` — 1 hit (in a comment affirming non-use; zero actual calls)
- `grep -c "center_id" src/components/outcomes/OutcomesDataPreview.tsx` — 1 hit (in a comment affirming exclusion; zero in code)
- `grep -c "downloadCsv(" src/components/outcomes/OutcomesDataPreview.tsx` — 1 call
- `grep -c "datedFilename(" src/components/outcomes/OutcomesDataPreview.tsx` — 1 call
- `git diff --name-only dfa616c HEAD -- src/utils/cohortTrajectory.ts` — empty (Phase 8 math frozen)
- Commit count: 3 atomic commits per task (`007295c` RED, `02a2375` GREEN, this REFACTOR)

## Deviations

### 1. Recharts `baseLine` prop type fix (inline REFACTOR)

Phase 8's `08-RESEARCH.md` A1 asserted Recharts 3.8.1 supports `baseLine="dataKeyName"` as a string reference to another data field. The 09-CONTEXT.md locked decision 2 copied this assumption and mandated the single-Area approach. After 09-02 shipped, `tsc -b` revealed the actual Recharts type is `BaseLineType = number | ReadonlyArray<NullableCoordinate>` — it never accepted a string dataKey.

**Fix:** Kept the locked decision's single-`<Area>` intent but pass `baseLine` as a pre-computed coordinate array derived from `panel.medianGrid`:

```typescript
const iqrBaseLine = panel.medianGrid.map((g) => ({ x: g.x, y: g.p25 }));
// ...
<Area data={iqrData} dataKey="iqrHigh" baseLine={iqrBaseLine} .../>
```

This produces the visual result the locked decision intended (single Area filled between p25 and p75) without the explicitly-forbidden two-area mask fallback. Comment in `OutcomesPanel.tsx` documents the Phase-8-research correction.

Inline code change: `src/components/outcomes/OutcomesPanel.tsx` lines 74-86 and 131-141 (REFACTOR commit).

### 2. Agent timeout during Task 3.3 execution

The spawned executor agent completed Task 3.1 (RED, commit `007295c`) and Task 3.2 (GREEN, commit `02a2375`) successfully, but stalled at the start of Task 3.3 without producing the REFACTOR commit or SUMMARY.md. Orchestrator waited ~4 hours without a completion signal, then took over manually:

- Merged the 2 completed commits into main
- Applied the Recharts fix (Deviation 1)
- Wrote this SUMMARY.md
- Committed everything as the Task 3.3 REFACTOR step

All invariants from the plan's acceptance criteria were verified after takeover. Work product is equivalent to what the agent would have produced.

### 3. Pre-existing `auditService.ts` build error (out of scope, documented)

`npm run build` reports one unresolved import:
```
src/services/auditService.ts(40,10): error TS2305:
  Module '"../config/clinicalThresholds"' has no exported member 'MAX_AUDIT_ENTRIES'.
```

`auditService.ts` was salvaged in commit `20611e0` (chore: add synthetic BvK center datasets + audit/storage infra) when Phase 8 was rescoped. It references a constant `MAX_AUDIT_ENTRIES` that was never added to `src/config/clinicalThresholds.ts`. `usePageAudit.ts` imports `auditService`, but neither is currently wired up anywhere in the render tree.

This error **pre-dates Phase 9 entirely** and is outside this plan's files_modified fence. The 09-01 executor agent flagged it during its run. No Phase 9 code is affected; Phase 9's own files compile cleanly. **Flag for follow-up**: a separate task should either delete the unused `auditService.ts` / `usePageAudit.ts` / `useLocalStorageState.ts` / `safeJson.ts` quartet or wire them up and add the missing constant. Not this phase.

## Cross-plan invariants (verified)

- `flattenToRows(cohort.cases).length === aggregate.od.summary.measurementCount + aggregate.os.summary.measurementCount` — enforced by test 17
- `<details>` collapsed on first render (no `open` attribute) — enforced by test 13
- CSV filename matches `outcomes-cohort-YYYY-MM-DD.csv` — enforced by test 16 via stub capture
- CSV header set matches exactly the 8 D-28 i18n keys (no `center_id`) — enforced by test 14 + test 15

## Handoff

Phase 9 execution complete. Next orchestrator steps:
1. Merge this REFACTOR commit back to main (already on main if orchestrator-driven)
2. Update ROADMAP plan status for 09-03 to completed
3. Run code-review gate (`/gsd-code-review 9`)
4. Run regression gate (re-run prior-phase tests)
5. Run phase goal verification (`gsd-verifier` → VERIFICATION.md)
6. Route to `/gsd-complete-milestone` if no issues — Phase 9 is the final Phase of milestone v1.5
