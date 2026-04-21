---
phase: 17
plan: 03
subsystem: dark-mode-foundation
tags: [dark-mode, tailwind, theme-context, i18n, wcag, palette]
dependency_graph:
  requires: [17-01]
  provides: [ThemeContext, DARK_EYE_COLORS, DARK_COHORT_PALETTES, dark-css-variant, 16-i18n-keys]
  affects: [src/components/outcomes/palette.ts, src/i18n/translations.ts, src/index.css, index.html, src/context/ThemeContext.tsx]
tech_stack:
  added: [ThemeContext, FOUC-prevention-script]
  patterns: [class-based-dark-mode, Tailwind-v4-CSS-first, localStorage-theme-persist, system-media-query-listener]
key_files:
  created:
    - src/context/ThemeContext.tsx
  modified:
    - src/components/outcomes/palette.ts
    - src/i18n/translations.ts
    - src/index.css
    - index.html
    - tests/outcomesPalette.contrast.test.ts
    - tests/outcomesI18n.test.ts
decisions:
  - "DARK_EYE_COLORS uses blue-300/red-300/violet-300 (all ≥ 7.8:1 vs #111827, well above 4.5:1 AA)"
  - "DARK_COHORT_PALETTES uses emerald/amber/cyan/fuchsia-300 (all ≥ 5.7:1 vs #111827, above 3.0:1 graphical)"
  - "ThemeContext readStored() uses strict === equality — arbitrary localStorage values silently fall back to light mode (T-17-03)"
  - "FOUC script uses hardcoded 'dark' literal in classList.add() — no dynamic class string (T-17-07)"
  - "ThemeProvider not wrapped in App.tsx yet — Plan 04 integrates it"
metrics:
  duration: "~12 minutes"
  completed: "2026-04-21T17:09:14Z"
  tasks_completed: 3
  files_changed: 7
---

# Phase 17 Plan 03: Dark Mode Foundation Summary

Dark-mode infrastructure built: WCAG-verified dark chart palettes, 16 new i18n keys, Tailwind v4 class-based dark variant, FOUC-prevention script, and ThemeContext with system media query support — all turning Plan 01 red tests green.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add DARK_EYE_COLORS + DARK_COHORT_PALETTES | 5d697c7 | palette.ts, test files |
| 2 | Add 16 Phase 17 i18n keys (EN + DE) | 3718c4d | translations.ts |
| 3 | Dark variant + FOUC + ThemeContext | 55cff7f | index.css, index.html, ThemeContext.tsx |

## Verification Results

- `npx vitest run tests/outcomesPalette.contrast.test.ts` — **13/13 passed** (DARK_EYE_COLORS ≥ 4.5:1, DARK_COHORT_PALETTES ≥ 3.0:1)
- `npx vitest run tests/outcomesI18n.test.ts` — **38/38 passed** (all 16 Phase 17 keys × 2 locales)
- `src/index.css` contains `@custom-variant dark (&:where(.dark, .dark *))` and retains `@import "tailwindcss"`
- `index.html` contains `localStorage.getItem('emd-theme')`, `classList.add('dark')`, `prefers-color-scheme: dark`
- `src/context/ThemeContext.tsx` exports `ThemeProvider`, `useTheme`, `Theme` type with `'emd-theme'` storage key
- Full suite: 2 pre-existing failures in `outcomesPanelCrt.test.tsx` and `metricSelector.test.ts` (existed before this plan; no regressions introduced)

## Must-Have Truth Table

| Truth | Status |
|-------|--------|
| DARK_EYE_COLORS + DARK_COHORT_PALETTES exported from palette.ts | PASS |
| All DARK_EYE_COLORS pass WCAG 4.5:1 against #111827 | PASS |
| All DARK_COHORT_PALETTES pass WCAG 3.0:1 against #111827 | PASS |
| All Phase 17 i18n keys exist in EN + DE | PASS |
| Tailwind v4 class-based dark mode enabled via @custom-variant | PASS |
| index.html FOUC script applies .dark to <html> synchronously | PASS |
| ThemeContext provides theme/setTheme/effectiveTheme; useTheme hook available | PASS |

## Deviations from Plan

None - plan executed exactly as written.

Note: Plan 01 test scaffolds (`tests/outcomesPalette.contrast.test.ts`, `tests/outcomesI18n.test.ts`) were sourced from Plan 01 commits in the main repo (commits `d055b39` and `08eb5f3`) since the worktree was based on the pre-Plan-01 commit. This is expected parallel execution behavior, not a deviation.

## Known Stubs

None — all exported values are fully wired. ThemeProvider wrapping of App.tsx is intentionally deferred to Plan 04 (per plan spec: "DO NOT wrap ThemeProvider in App.tsx yet — Plan 04 integrates it").

## Threat Flags

No new threat surfaces introduced beyond those in the plan's threat model (T-17-03, T-17-07, T-17-08 all mitigated per spec):
- localStorage reads use strict `===` equality — arbitrary values fall back to light
- FOUC script never renders storage value to DOM or passes to eval/innerHTML
- try/catch around all localStorage access in both FOUC script and ThemeContext

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/context/ThemeContext.tsx exists | FOUND |
| src/index.css has @custom-variant dark | FOUND |
| index.html has FOUC script | FOUND |
| DARK_EYE_COLORS in palette.ts | FOUND |
| themeLight in translations.ts | FOUND |
| commit 5d697c7 (palette) | FOUND |
| commit 3718c4d (i18n) | FOUND |
| commit 55cff7f (CSS+FOUC+ThemeContext) | FOUND |
