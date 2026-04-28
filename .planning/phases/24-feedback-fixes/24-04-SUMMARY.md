---
phase: 24-feedback-fixes
plan: 04
subsystem: doc-quality
tags: [palette, design, css-vars, recharts, FB-04]
requires: []
provides:
  - QUALITY_CATEGORY_COLORS reusing muted page-established CSS-var tokens
affects:
  - src/utils/qualityMetrics.ts
  - src/components/doc-quality/CenterComparisonChart.tsx (consumer; unchanged)
tech-stack:
  added: []
  patterns:
    - "CSS-var tokens consumed directly as recharts Bar fill"
key-files:
  created:
    - tests/qualityMetrics.test.ts
  modified:
    - src/utils/qualityMetrics.ts
decisions:
  - "Reuse var(--color-teal|sage|indigo|amber) — four muted hues already on the page"
  - "No new palette introduced (D-13)"
  - "recharts accepts var(...) fills directly; no fallback resolver needed"
metrics:
  duration: ~6m
  completed: 2026-04-28
  tasks: 2/2
  commits: 2
requirements: [FB-04]
---

# Phase 24 Plan 04: DocQuality Palette Re-skin Summary

Re-skinned the Documentation Quality `CenterComparisonChart` so its four bars
use the project's muted page-established CSS-var tokens
(`var(--color-teal|sage|indigo|amber)`) instead of the saturated
`COHORT_PALETTES[0..3]` (emerald/amber/cyan/fuchsia 700) borrowed from cohort
charts.

## What changed

- `src/utils/qualityMetrics.ts`
  - `QUALITY_CATEGORY_COLORS` now maps:
    - `completeness` → `var(--color-teal)`
    - `dataCompleteness` → `var(--color-sage)`
    - `plausibility` → `var(--color-indigo)`
    - `overall` → `var(--color-amber)`
  - Removed the now-unused `COHORT_PALETTES` import.
- `src/components/doc-quality/CenterComparisonChart.tsx`
  - **No change required.** The component already reads
    `fill={QUALITY_CATEGORY_COLORS[category]}` (line 84). recharts accepts
    `var(...)` fills directly in the rendered SVG — verified by full build
    + 610/610 vitest pass.
- `tests/qualityMetrics.test.ts` *(new)*
  - Asserts four canonical keys, every value starts with `var(--color-`,
    and the four values are pairwise distinct (D-14).

## Why this works

The CSS variables are defined in `src/index.css` with both light-mode and
dark-mode (`.dark`) values:

| Token              | Light                 | Dark                  |
|--------------------|-----------------------|-----------------------|
| `--color-teal`     | `oklch(0.55 0.12 195)` | `oklch(0.72 0.12 195)` |
| `--color-sage`     | `oklch(0.68 0.10 145)` | `oklch(0.78 0.10 145)` |
| `--color-indigo`   | `oklch(0.52 0.12 260)` | `oklch(0.70 0.13 260)` |
| `--color-amber`    | `oklch(0.72 0.14 75)`  | `oklch(0.80 0.14 75)`  |

Both modes inherit theme-aware contrast — no contrast regression (D-15).

The four hues (teal / sage / indigo / amber → cyan / green / blue / yellow
families) span well-separated parts of the colour wheel, so series remain
visually distinguishable (D-14).

Tokens are the same family already used in `LandingPage.tsx`'s
`CENTRE_ACCENTS`, satisfying D-12 ("reuse what's on the page") and D-13
("no new palette").

## Commits

| Hash      | Type      | Subject                                                              |
| --------- | --------- | -------------------------------------------------------------------- |
| `c6e8f4c` | refactor  | align DocQuality bar palette with muted page tokens (FB-04)          |
| `6117abf` | test      | assert DocQuality palette uses distinct muted page tokens (FB-04)    |

## Safety net

Per CLAUDE.md and D-16, run after every commit: `test:ci` + `build` + `lint`
+ `knip`. Final state:

- `npm run test:ci` → **610/610** passing (was 607; +3 from new test —
  upstream Phase 21 baseline of 608 stands aside from another pre-existing
  delta unrelated to this plan)
- `npm run build` → **success** (only the pre-existing 500kB chunk advisory)
- `npm run lint` → **clean**
- `npm run knip` → **only pre-existing config hints** (4); no new findings

## Verification (per plan)

- `grep -n COHORT_PALETTES src/utils/qualityMetrics.ts` → no matches
- `QUALITY_CATEGORY_COLORS` values all start with `var(--color-`
- Bar fill consumer (`CenterComparisonChart.tsx:84`) is unchanged — recharts
  passes `var(--color-…)` straight to SVG `fill`, which the browser resolves
  per-theme.

## Deviations from Plan

None — plan executed exactly as written.

The plan's optional fallback ("resolve `var(...)` via `getComputedStyle` if
recharts cannot handle it") was not needed: tests + build + browser SVG all
accept `var(...)` as a fill string.

## Self-Check: PASSED

- [x] `src/utils/qualityMetrics.ts` modified — verified
- [x] `tests/qualityMetrics.test.ts` created — verified
- [x] commit `c6e8f4c` exists — verified
- [x] commit `6117abf` exists — verified
- [x] full safety net green
