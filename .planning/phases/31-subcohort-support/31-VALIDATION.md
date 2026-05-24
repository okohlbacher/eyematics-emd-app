---
phase: 31
slug: subcohort-support
status: final
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-21
---

# Phase 31 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Frontend-only phase building on existing SavedSearch/CohortFilter infrastructure.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest + React Testing Library (existing) |
| **Config file** | `vitest.config.ts` (default env `node`; component tests use `// @vitest-environment jsdom` docblock) |
| **Quick run command** | `npm run test:ci` |
| **Full suite command** | `npm run test:ci` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:ci` (suite is fast; phase scope is small)
- **After the wave merge:** Run `npm run test:ci`
- **Before `/gsd-verify-work`:** Full suite must be green (current baseline 754/754 must not regress)
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| W0-a | 01 | 0 | KOH-003/SC4 | T-31-01 | parseSubcohortName validates untrusted name input | unit | `npm run test:ci -- cohortNames` | ❌ W0 (new `tests/cohortNames.test.ts`) | ⬜ pending |
| W0-b | 01 | 0 | KOH-003/SC1,SC5 | — | hard-error block + soft orphan warning | component | `npm run test:ci -- cohortBuilderEntryPoints` | ❌ W0 (extend existing) | ⬜ pending |
| W0-c | 01 | 0 | KOH-004/SC2,SC3,D-R5 | — | tree render, independent selection, max-4 | component | `npm run test:ci -- cohortCompareDrawer` | ❌ W0 (extend existing) | ⬜ pending |
| svc | 02 | 1 | KOH-003/SC4 | T-31-01 | `parseSubcohortName`/`groupByParent` in `src/services/cohortNames.ts` | unit | `npm run test:ci -- cohortNames` | ✅ after W0 | ⬜ pending |
| builder | 03 | 2 | KOH-003/SC1,SC5 | T-31-01 | save-dialog validation + Split action in CohortBuilderPage | component | `npm run test:ci -- cohortBuilderEntryPoints` | ✅ after W0 | ⬜ pending |
| drawer | 03 | 2 | KOH-004/SC2,SC3 | — | tree render + independent selection in CohortCompareDrawer | component | `npm run test:ci -- cohortCompareDrawer` | ✅ after W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*(Plan/wave numbers above are indicative; the planner finalizes the exact wave split.)*

---

## Success Criteria → Test Map

| SC | Description | Covered By |
|----|-------------|-----------|
| SC1 | Save `Cohort1:Male`; name validated; appears in drawer | `cohortNames.test.ts` (unit) + `cohortBuilderEntryPoints.test.tsx` (component) |
| SC2 | Drawer renders tree; flat cohorts unchanged | `cohortCompareDrawer.test.tsx` (component) |
| SC3 | Parent and subcohort selection independent | `cohortCompareDrawer.test.tsx` (component) |
| SC4 | `parseSubcohortName` returns `{parent,sub}` / throws on 0 or 2+ colons; unit-tested | `cohortNames.test.ts` (unit) |
| SC5 | Orphan subcohort: soft warning, save proceeds | `cohortBuilderEntryPoints.test.tsx` (component) |

---

## Wave 0 Requirements

- [ ] `tests/cohortNames.test.ts` (NEW) — `parseSubcohortName` unit tests: valid `C1:Male`→`{parent,sub}`; throws on `NoColon` and `A:B:C`; trims `C1 : Male `; case-insensitive duplicate normalization (`c1:male ` == `C1:Male`)
- [ ] `tests/cohortBuilderEntryPoints.test.tsx` (EXTEND) — hard errors (2+ colons, empty parent, empty sub, duplicate) disable Save; orphan parent shows soft amber warning with Save still enabled; Split button pre-fills `saveName` = `ParentName:`
- [ ] `tests/cohortCompareDrawer.test.tsx` (EXTEND) — parent+subcohort tree rows render; flat cohorts unchanged; selecting parent vs subcohort passes the correct independent id to onChange; parent+subcohort each count individually toward max-4

No new test framework install needed — Vitest + RTL already configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tree chevron expand/collapse feels right; indentation reads as hierarchy; dark-mode tokens correct | KOH-004 | Visual/interaction polish is subjective | In the running app, save `C1:Male` + `C1:Female`, open CohortCompareDrawer, confirm `C1` group is expanded by default with indented subcohorts and the chevron collapses/expands |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (3 test files)
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-21

31-VERIFICATION.md (status: passed, 5/5) + UAT confirm Wave 0 RED scaffolds (cohortNames + builder/drawer component tests) reached GREEN; wave_0_complete: true set 2026-05-24 (V&V backfill, Phase 35).
