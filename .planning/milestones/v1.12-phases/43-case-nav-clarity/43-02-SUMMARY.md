---
phase: 43-case-nav-clarity
plan: "02"
subsystem: outcomes-trajectory
tags: [drill-down, navigation, idor, accessibility, tdd, recharts]
dependency_graph:
  requires: [43-01]
  provides: [fall-010-scatter-drill-down, idor-gated-case-navigation]
  affects: [phase-44-outcomes-decomposition]
tech_stack:
  added: []
  patterns: [useNavigate, useCallback, recharts-scatter-onclick, tdd-red-green]
key_files:
  created:
    - tests/OutcomesPanelDrillDown.test.tsx
  modified:
    - src/components/outcomes/OutcomesPanel.tsx
    - src/components/outcomes/OutcomesView.tsx
    - src/i18n/translations.ts
decisions:
  - "onPointClick is optional on OutcomesPanel — backward-compat; absent = no pointer/click"
  - "IDOR gate lives in OutcomesView.handlePointDrillDown; unknown pseudonyms produce no navigation"
  - "cursor='pointer' passed directly to Recharts Scatter (not via style prop) for clean prop forwarding"
  - "Cross-cohort mode: onPointClick=undefined passed explicitly; scatter already suppressed there"
  - "Resolution tests use a pure makeDrillDownHandler fixture to avoid mocking full OutcomesView tree"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-26"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 43 Plan 02: FALL-010 Chart Drill-Down Summary

**One-liner:** Recharts scatter points in trajectory panels now navigate to the corresponding case detail via a pseudonym-to-case-id IDOR-gated lookup within the user's authorized cohort.

## Tasks

| # | Name | Commit | Files |
|---|------|--------|-------|
| RED | Add failing drill-down tests | 00f2098 | tests/OutcomesPanelDrillDown.test.tsx |
| 1 | onPointClick prop + pointer cursor + i18n | f8cf1fd | OutcomesPanel.tsx, translations.ts |
| 2 | handlePointDrillDown + navigate in OutcomesView | 4a9a8d8 | OutcomesView.tsx |

## What Was Built

### OutcomesPanel.tsx (FALL-010)
- New optional prop `onPointClick?: (patientId: string) => void`
- When provided: `<Scatter cursor="pointer" onClick={...}>` — onClick reads `datum.patientId` and calls `onPointClick(patientId)`; guards against undefined patientId (does nothing if absent)
- `role="img"` aria-label extended with `outcomesDrillDownHint` translation when `onPointClick` is present
- Not wired in cross-cohort mode (caller passes `undefined` explicitly; scatter is suppressed there anyway)

### OutcomesView.tsx (FALL-010)
- Imports `useNavigate` (from react-router-dom) and `useCallback`
- `handlePointDrillDown(patientId)`: resolves pseudonym against `cohort.cases.find(c => c.pseudonym === patientId)` then calls `navigate(\`/case/${found.id}\`)`. Unknown pseudonym → no navigation (IDOR gate T-43-03)
- All six `<OutcomesPanel>` instances (3 visus + 3 CRT) receive `onPointClick={!isCrossMode ? handlePointDrillDown : undefined}`
- Handler is small and self-contained, ready for Phase 44 hook extraction

### translations.ts
- New key `outcomesDrillDownHint`: `{ de: 'Datenpunkt anklicken, um den Fall zu öffnen', en: 'Click a data point to open the case' }`

### tests/OutcomesPanelDrillDown.test.tsx (9 tests)
- Task 1: onPointClick fires with patientId; data-has-onclick=true; data-cursor=pointer; absent when no prop; aria-label contains hint key
- Task 2: pure resolution handler — navigates to /case/CASE-7 for PSN-7; navigates to /case/CASE-99 for PSN-99; no navigate for unknown pseudonym; no navigate on empty cohort

## Test Results
- 1079 tests pass (`npm run test:ci`) — +9 new tests over 1070 baseline
- `npm run lint` — 0 warnings

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. Drill-down is fully wired from scatter click → pseudonym resolution → navigate.

## Threat Flags

None. T-43-03 (IDOR) mitigated by `cohort.cases.find()` gate; T-43-04 (information disclosure) accepted per plan — case id in URL belongs to an already-authorized case.

## Self-Check: PASSED

- `src/components/outcomes/OutcomesPanel.tsx` — FOUND
- `src/components/outcomes/OutcomesView.tsx` — FOUND
- `src/i18n/translations.ts` — FOUND
- `tests/OutcomesPanelDrillDown.test.tsx` — FOUND
- commit 00f2098 — FOUND
- commit f8cf1fd — FOUND
- commit 4a9a8d8 — FOUND
