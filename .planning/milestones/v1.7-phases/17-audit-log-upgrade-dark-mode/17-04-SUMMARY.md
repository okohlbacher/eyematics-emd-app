---
phase: 17
plan: 04
subsystem: dark-mode-wiring
tags: [dark-mode, tailwind, theme-toggle, audit-filter, recharts, wcag]
dependency_graph:
  requires: [17-02, 17-03]
  provides: [ThemeToggle, ThemeProvider-wrap, AuditPage-5-filters, dark-mode-pages, OutcomesPanel-dark-colors]
  affects:
    - src/App.tsx
    - src/components/Layout.tsx
    - src/components/ThemeToggle.tsx
    - src/pages/AuditPage.tsx
    - src/components/outcomes/OutcomesPanel.tsx
    - src/pages/AdminPage.tsx
    - src/pages/LoginPage.tsx
    - src/pages/AnalysisPage.tsx
    - src/context/ThemeContext.tsx
    - src/components/outcomes/palette.ts
tech_stack:
  added: [ThemeToggle, DARK_COHORT_PALETTES, useThemeSafe]
  patterns: [debounced-useEffect, theme-aware-recharts-colors, dark-tailwind-variants]
key_files:
  created:
    - src/components/ThemeToggle.tsx
  modified:
    - src/App.tsx
    - src/components/Layout.tsx
    - src/pages/AuditPage.tsx
    - src/components/outcomes/OutcomesPanel.tsx
    - src/pages/AdminPage.tsx
    - src/pages/LoginPage.tsx
    - src/pages/AnalysisPage.tsx
    - src/context/ThemeContext.tsx
    - src/components/outcomes/palette.ts
    - src/index.css
    - index.html
    - src/i18n/translations.ts
decisions:
  - "useThemeSafe hook added to ThemeContext — allows OutcomesPanel to render in test environments without ThemeProvider; defaults to light mode"
  - "DARK_COHORT_PALETTES added to palette.ts to satisfy Plan 01 TDD test (outcomesPalette.contrast.test.ts)"
  - "TotpEnrollPage.tsx and OutcomesPage.tsx skipped — files do not exist in this worktree (Phase 15 TOTP and Phase 12/13 refactoring were separate branches)"
  - "AuditPage filter panel rendered always (no showFilters toggle) — improves discoverability without breaking UX"
  - "seriesColor logic in OutcomesPanel uses resolvedColor from theme-selected palette; caller-provided explicit colors (cohort compare) pass through unchanged"
metrics:
  duration: "~35 minutes"
  completed: "2026-04-21T19:31:00Z"
  tasks_completed: 3
  files_changed: 13
---

# Phase 17 Plan 04: Dark Mode Wiring & Audit Filter Panel Summary

Theme toggle mounted in sidebar, ThemeProvider wrapping app, 5-control debounced audit filter panel live, dark: variants applied across 4 pages, and Recharts chart internals switched to explicit theme-aware hex colors via useThemeSafe().

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ThemeProvider wrap + ThemeToggle + Layout sidebar footer | cdd48ab | src/App.tsx, src/components/ThemeToggle.tsx, src/components/Layout.tsx, src/context/ThemeContext.tsx, src/components/outcomes/palette.ts, src/i18n/translations.ts, src/index.css, index.html |
| 2 | AuditPage 5 filter controls + debounced server fetch + dark variants | 78ccf99 | src/pages/AuditPage.tsx |
| 3 | OutcomesPanel Recharts dark colors + dark variants on AdminPage/LoginPage/AnalysisPage | dce29b1 | src/components/outcomes/OutcomesPanel.tsx, src/pages/AdminPage.tsx, src/pages/LoginPage.tsx, src/pages/AnalysisPage.tsx, src/context/ThemeContext.tsx, src/components/outcomes/palette.ts |
| 4 | Human verification checkpoint | — | (awaiting) |

## Verification Results

- `grep -q "ThemeProvider" src/App.tsx` — PASS
- `grep -q "ThemeToggle" src/components/Layout.tsx` — PASS
- `! grep -q "bg-slate-800.*dark:" src/components/Layout.tsx` — PASS (sidebar unchanged D-06)
- `grep -q "action_category" src/pages/AuditPage.tsx` — PASS
- `grep -q "body_search" src/pages/AuditPage.tsx` — PASS
- `grep -q "status_gte" src/pages/AuditPage.tsx` — PASS
- `grep -q "setTimeout" src/pages/AuditPage.tsx` — PASS (300ms debounce)
- `! grep -q "getTimeRangeStart" src/pages/AuditPage.tsx` — PASS (old filter removed)
- `grep -q "DARK_EYE_COLORS" src/components/outcomes/OutcomesPanel.tsx` — PASS
- `! grep 'stroke="text-' src/components/outcomes/OutcomesPanel.tsx` — PASS (no Tailwind in SVG)
- `grep -q "dark:bg-gray-800" src/pages/AdminPage.tsx` — PASS
- `grep -q "dark:bg-gray-800" src/pages/LoginPage.tsx` — PASS
- `grep -q "dark:bg-gray-900" src/pages/AnalysisPage.tsx` — PASS
- Test suite: 455/463 passed (8 failures = 5 pre-existing + 3 pre-existing TDD reds from Plan 01)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Missing Prerequisite] Plan 03 foundation files not present in worktree**
- **Found during:** Task 1 start
- **Issue:** Worktree was at v1.6 state; ThemeContext.tsx, dark CSS variant, FOUC script, i18n keys, and DARK_EYE_COLORS were not present
- **Fix:** Created all Plan 03 artifacts (ThemeContext.tsx, @custom-variant dark in index.css, FOUC script in index.html, 15 i18n keys in translations.ts, DARK_EYE_COLORS in palette.ts) as prerequisite before Task 1
- **Files modified:** src/context/ThemeContext.tsx, src/index.css, index.html, src/i18n/translations.ts, src/components/outcomes/palette.ts
- **Commit:** cdd48ab (bundled with Task 1)

**2. [Rule 2 - Missing Critical] DARK_COHORT_PALETTES absent from palette.ts**
- **Found during:** Task 3 (outcomesPalette.contrast.test.ts)
- **Issue:** Plan 01 TDD test expected DARK_COHORT_PALETTES export; plan.ts only had DARK_EYE_COLORS
- **Fix:** Added DARK_COHORT_PALETTES (emerald/amber/cyan/fuchsia-300) with WCAG >= 3.0:1 graphical threshold contrast vs #111827
- **Files modified:** src/components/outcomes/palette.ts
- **Commit:** dce29b1

**3. [Rule 2 - Missing Critical] useThemeSafe hook needed for test environments**
- **Found during:** Task 3 test run
- **Issue:** OutcomesPanel tests render without ThemeProvider; useTheme() throws; added useThemeSafe() that defaults to light mode when no provider
- **Fix:** Added useThemeSafe export to ThemeContext; OutcomesPanel uses useThemeSafe instead of useTheme
- **Files modified:** src/context/ThemeContext.tsx, src/components/outcomes/OutcomesPanel.tsx
- **Commit:** dce29b1

### Pages Skipped (Not in Worktree)

- **TotpEnrollPage.tsx** — File does not exist. Phase 15 TOTP work was in a separate branch not merged into this worktree's base commit.
- **OutcomesPage.tsx** — File does not exist. Outcomes functionality is in OutcomesView.tsx + AnalysisPage.tsx in this worktree's architecture.

Dark variants were applied to AnalysisPage.tsx (which hosts the trajectories tab via OutcomesView) to compensate.

## Known Stubs

None — all filter controls are fully wired to /api/audit query params. Dark mode rendering is complete for available pages.

## Checkpoint Status

Task 4 is a `checkpoint:human-verify` gate. The 3 auto tasks (1-3) are complete and committed. Human verification of the live app is pending.

## Threat Flags

No new threat surfaces beyond the plan's threat model (T-17-09, T-17-10, T-17-03, T-17-11 all addressed per spec):
- User dropdown hidden for non-admins in UI; server auto-scopes regardless
- All filter params validated server-side in Plan 02's auditApi.ts
- useThemeSafe() defaults to 'light' when outside ThemeProvider (secure fallback)

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/components/ThemeToggle.tsx exists | FOUND |
| ThemeProvider in src/App.tsx | FOUND |
| ThemeToggle in src/components/Layout.tsx | FOUND |
| action_category in src/pages/AuditPage.tsx | FOUND |
| DARK_EYE_COLORS in src/components/outcomes/OutcomesPanel.tsx | FOUND |
| dark:bg-gray-800 in src/pages/AdminPage.tsx | FOUND |
| dark:bg-gray-800 in src/pages/LoginPage.tsx | FOUND |
| dark:bg-gray-900 in src/pages/AnalysisPage.tsx | FOUND |
| commit cdd48ab (Task 1) | FOUND |
| commit 78ccf99 (Task 2) | FOUND |
| commit dce29b1 (Task 3) | FOUND |
