---
phase: 29-home-panel-ux
plan: "01"
subsystem: i18n + test scaffolds
tags: [i18n, tests, tdd, wave-0, ux]
requires: []
provides: [reviewTherapyBreakers-key, reviewFlaggedCases-key, recentActivityStore-tests, qualityPageDeepLink-tests, landingPageAlerts-tests, jumpBackIn-tests]
affects: [src/i18n/translations.ts, tests/]
tech_stack:
  added: []
  patterns: [vitest-node-stubGlobal, vitest-jsdom-MemoryRouter, RTL-no-jest-dom]
key_files:
  created:
    - tests/recentActivityStore.test.ts
    - tests/qualityPageDeepLink.test.tsx
    - tests/landingPageAlerts.test.tsx
    - tests/jumpBackIn.test.tsx
  modified:
    - src/i18n/translations.ts
decisions:
  - "Test files are RED (failing on missing Plan 02/03/04 production modules) — expected Wave 0 state"
  - "recentActivityStore.test.ts uses node env (no jsdom): vi.stubGlobal localStorage with .length/.key() per authHeaders.test.ts pattern"
  - "Three jsdom test files mock useNavigate via react-router-dom factory override; fireEvent used (no @testing-library/user-event installed)"
  - "qualityPageDeepLink asserts status=flagged → in_progress mapping (flagged is not a valid QualityStatus)"
  - "jumpBackIn test imports useRecentActivity type from hooks module — fails with 'Cannot find module' until Plan 04"
metrics:
  duration_minutes: 15
  completed_date: "2026-05-21"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 1
---

# Phase 29 Plan 01: Wave 0 Test Foundation + i18n Keys Summary

**One-liner:** Four RED test files pinning UX-01/UX-02 behaviors + two aria-label i18n keys (`reviewTherapyBreakers`, `reviewFlaggedCases`) needed by LandingPage Review buttons.

---

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add reviewTherapyBreakers + reviewFlaggedCases i18n keys | ca91d2e | src/i18n/translations.ts |
| 2 | Create tests/recentActivityStore.test.ts (RED) | bfc3fee | tests/recentActivityStore.test.ts |
| 3 | Create three jsdom integration test files (RED) | faf1986 | tests/qualityPageDeepLink.test.tsx, tests/landingPageAlerts.test.tsx, tests/jumpBackIn.test.tsx |

---

## Decisions Made

1. **Node env for store tests**: `recentActivityStore.test.ts` uses the node environment (no `@vitest-environment jsdom` docblock), matching the `authHeaders.test.ts` analog. localStorage is fully stubbed via `vi.stubGlobal` with a plain `Record<string,string>` backing store.

2. **fireEvent over userEvent**: `@testing-library/user-event` is not installed in this project. All click interactions use `fireEvent.click()` from `@testing-library/react` (confirmed by `metricSelector.test.tsx` precedent).

3. **status=flagged → in_progress mapping**: The `qualityPageDeepLink` test explicitly asserts that `?status=flagged` resolves to `filterStatus='in_progress'` (not `'flagged'`). `'flagged'` is not a valid `QualityStatus` value per `shared/types/fhir.ts:175`; the mapping is a required correctness behavior pinned by this test.

4. **RED by design**: All four test files fail in the worktree (missing production modules `src/services/recentActivityStore.ts` and `src/hooks/useRecentActivity.ts`). The three jsdom tests additionally fail because the LandingPage/QualityPage production wiring doesn't exist yet. The 729 existing tests pass unaffected.

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Verification Results

- `grep -c "reviewTherapyBreakers\|reviewFlaggedCases" src/i18n/translations.ts` → **2** (PASS)
- All four test files exist and are discovered + run by vitest (reported under "Test Files") — **PASS**
- `npm run test:ci` from main repo: **729 passed, 0 failed** — baseline preserved (PASS)
- Build (`npm run build`) succeeded — TypeScript satisfied both new i18n keys (PASS)

---

## Known Stubs

None — this plan adds no production code with stubs.

---

## Threat Flags

None — this plan adds test scaffolds and static i18n strings only (no runtime data flow, no new network endpoints).

---

## Self-Check: PASSED

- src/i18n/translations.ts modified: FOUND
- tests/recentActivityStore.test.ts: FOUND (commit bfc3fee)
- tests/qualityPageDeepLink.test.tsx: FOUND (commit faf1986)
- tests/landingPageAlerts.test.tsx: FOUND (commit faf1986)
- tests/jumpBackIn.test.tsx: FOUND (commit faf1986)
- ca91d2e, bfc3fee, faf1986: all present in git log
