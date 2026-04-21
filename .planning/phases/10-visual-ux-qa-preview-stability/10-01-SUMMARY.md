---
phase: 10-visual-ux-qa-preview-stability
plan: 01
subsystem: outcomes-ui
tags: [visual-qa, palette, wcag, contrast, refactor, tdd]
requirements: [VQA-02]
dependency_graph:
  requires: []
  provides:
    - "src/components/outcomes/palette.ts (EYE_COLORS, SERIES_STYLES, PANEL_BACKGROUND, computeContrastRatio, relativeLuminance)"
    - "Reusable palette module for Phase 13 CRT / Interval / Responder panels"
  affects:
    - src/components/outcomes/OutcomesPanel.tsx
    - src/pages/OutcomesPage.tsx
tech_stack:
  added: []
  patterns:
    - "Centralized palette module: role-derived series styles (median/perPatient/scatter/iqr) keyed by WCAG-verified base colors"
    - "WCAG 2.1 SC 1.4.11 sRGB relative-luminance math in pure TS (no external color lib)"
key_files:
  created:
    - src/components/outcomes/palette.ts
    - tests/outcomesPalette.contrast.test.ts
  modified:
    - src/components/outcomes/OutcomesPanel.tsx
    - src/pages/OutcomesPage.tsx
    - .planning/REQUIREMENTS.md
decisions:
  - "Tailwind-700 anchors chosen for all three eye colors (OD blue-700 #1d4ed8, OS red-700 #b91c1c, OD+OS violet-700 #6d28d9) — all pass >= 6.4:1 contrast vs #ffffff"
  - "Light-mode-only verification per 10-CONTEXT.md §Deferred; dark mode deferred (no theme infrastructure in codebase)"
  - "CHART_COLORS import dropped from OutcomesPage.tsx (zero remaining usage); clinicalThresholds.ts still exports it for AnalysisPage.tsx consumer"
  - "Scatter fillOpacity bumped 0.5 → 0.7 per D-01 (pre-existing 0.5 was below plan mandate)"
metrics:
  duration_seconds: 219
  tasks_completed: 4
  tests_before: 313
  tests_after: 319
  tests_added: 6
  files_created: 2
  files_modified: 3
  completed_date: "2026-04-16"
---

# Phase 10 Plan 01: Chart Palette Contrast Summary

One-liner: Extracted outcomes chart colors into a typed `palette.ts` module with role-derived `SERIES_STYLES`, refactored `OutcomesPanel.tsx` + `OutcomesPage.tsx` to consume it, and codified VQA-02 with a 6-assertion WCAG AA contrast Vitest gate (all EYE_COLORS ≥ 6.4:1 vs `#ffffff`, well above the 3.0 graphical threshold).

## Objective (from plan)

Close VQA-02 with a verifiable contrast test. Establish the palette module that Phase 13 (CRT / Interval / Responder panels) will reuse without duplication. Record the dark-mode deferral footnote on VQA-02 in REQUIREMENTS.md.

## What Shipped

### New palette module — `src/components/outcomes/palette.ts`

| Export | Shape | Notes |
|--------|-------|-------|
| `EYE_COLORS` | `{ OD, OS, 'OD+OS' }` 6-digit hex record | OD=`#1d4ed8`, OS=`#b91c1c`, OD+OS=`#6d28d9` (Tailwind-700 anchors) |
| `EyeKey` | `keyof typeof EYE_COLORS` | Type export for downstream consumers |
| `SERIES_STYLES` | `{ median, perPatient, scatter, iqr }` | D-01 role-derived styles |
| `PANEL_BACKGROUND` | `'#ffffff'` | Light-mode panel fill used as contrast reference |
| `relativeLuminance(hex)` | `(hex: string) => number` | WCAG 2.1 SC 1.4.11 sRGB-linear formula |
| `computeContrastRatio(fg, bg)` | `(fg, bg: string) => number` | `(L_hi + 0.05) / (L_lo + 0.05)` |

### Exact hex values chosen + computed contrast ratios vs `#ffffff`

| Panel | Hex | Tailwind anchor | Contrast ratio | WCAG 3.0 graphical gate |
|-------|-----|-----------------|----------------|-------------------------|
| OD | `#1d4ed8` | blue-700 | **6.70:1** | pass |
| OS | `#b91c1c` | red-700 | **6.47:1** | pass |
| OD+OS | `#6d28d9` | violet-700 | **7.10:1** | pass |

All three exceed the WCAG 2.1 SC 1.4.11 graphical element threshold (3.0:1) by >2x, and also clear the AA text threshold (4.5:1) as a free byproduct. Ratios verified by `tests/outcomesPalette.contrast.test.ts` (run on every CI invocation). Ratios also printed in the `palette.ts` file header comment so downstream readers don't need to re-run the math.

### Consumer refactor

**OutcomesPanel.tsx** — every chart-series literal now sourced from `SERIES_STYLES`:

| Layer | Was | Now |
|-------|-----|-----|
| IQR Area | `fillOpacity={0.15}` + `stroke="none"` | `fillOpacity={SERIES_STYLES.iqr.fillOpacity}` + `stroke={SERIES_STYLES.iqr.stroke}` |
| Per-patient Line | `strokeWidth={1.5}` + `strokeOpacity={p.sparse ? 0.3 : 0.6}` | `strokeWidth={SERIES_STYLES.perPatient.strokeWidth}` + `strokeOpacity={p.sparse ? ...opacitySparse : ...opacityDense}` |
| Scatter | `fillOpacity={0.5}` | `fillOpacity={SERIES_STYLES.scatter.fillOpacity}` (= **0.7**, bumped per D-01) |
| Median Line | `strokeWidth={3}` | `strokeWidth={SERIES_STYLES.median.strokeWidth}` |

**OutcomesPage.tsx** — per-panel color prop sourced from `EYE_COLORS`:

| Panel | Was | Now |
|-------|-----|-----|
| OD | `color={CHART_COLORS[0]}` | `color={EYE_COLORS.OD}` |
| OS | `color={CHART_COLORS[2]}` | `color={EYE_COLORS.OS}` |
| Combined | `color={CHART_COLORS[4]}` | `color={EYE_COLORS['OD+OS']}` |

### CHART_COLORS import in OutcomesPage

**Dropped** — post-refactor grep of `CHART_COLORS` in `src/pages/OutcomesPage.tsx` returns zero matches, so the import from `../config/clinicalThresholds` was removed.

`CHART_COLORS` itself is still exported from `src/config/clinicalThresholds.ts` because `src/pages/AnalysisPage.tsx:184` still consumes it for a Recharts `<Pie>` `<Cell>`. That consumer is out of scope for Phase 10 (only chart-series colors on the outcomes view were centralized per D-03).

### Scatter fillOpacity bump — snapshot impact

No snapshot broke. `tests/OutcomesPage.test.tsx` (17 assertions) covers scatter presence/absence and layer-toggle behavior via `data-testid`, not pixel snapshots. After the 0.5 → 0.7 bump, all 17 tests still pass unchanged. No image-snapshot harness in the repo, so no visual-regression to update.

### REQUIREMENTS.md footnote (VQA-02)

Appended to VQA-02 bullet:

> *Phase 10 scope note (2026-04-16):* Verified in **light mode only** (panel background `#ffffff`). Dark-mode contrast deferred — codebase has no dark-mode infrastructure (no Tailwind theme config, no `prefers-color-scheme`, no theme provider). Rationale and deferral captured in `.planning/phases/10-visual-ux-qa-preview-stability/10-CONTEXT.md` §Deferred. VQA-02 remains partially open pending dark-mode work in a future milestone.

Original VQA-02 text (`both light and dark mode`) was **not** rewritten — only augmented.

### Forward-compat note

`palette.ts` is ready for Phase 13 metric panels (CRT / Interval / Responder). The `EYE_COLORS` + `SERIES_STYLES` contract is eye-indexed, not visus-specific — CRT and other metric panels can import directly without any palette-module edits. If Phase 13 needs additional per-metric color variants (e.g., bucket colors for responder classification), extend the module with a new named record (e.g., `RESPONDER_BUCKET_COLORS`) rather than widening `EYE_COLORS`.

## Commits

| Hash | Type | Scope | Description |
|------|------|-------|-------------|
| `4057a78` | feat | 10-01 | Add outcomes palette module (EYE_COLORS, SERIES_STYLES, WCAG helpers) |
| `b611eb4` | refactor | 10-01 | Consume palette.ts from OutcomesPanel + OutcomesPage |
| `11fe911` | test | 10-01 | Add WCAG AA contrast gate for outcomes palette (+ sync ratio comments) |
| `cebc630` | docs | 10-01 | Record VQA-02 dark-mode deferral footnote in REQUIREMENTS.md |

## Verification

| Gate | Status |
|------|--------|
| `npx vitest run tests/outcomesPalette.contrast.test.ts` | **6/6 pass** (3 sanity + 3 EYE_COLORS) |
| `npx vitest run tests/OutcomesPage.test.tsx` | **17/17 pass** (no panel refactor regression) |
| Full `npx vitest run` suite | **319/319 pass across 28 files** (+6 new vs 313 baseline) |
| `npx tsc --noEmit -p tsconfig.app.json` | exit 0 (clean) |
| `! grep -En "fillOpacity=\{0\.5\}" src/components/outcomes/OutcomesPanel.tsx` | no match (D-01 bump enforced) |
| `! grep -E "strokeWidth=\{3\}|strokeWidth=\{1\.5\}|fillOpacity=\{0\.15\}" src/components/outcomes/OutcomesPanel.tsx` | no match (no chart-series inline literals) |
| `! grep -En "color=\{CHART_COLORS\[" src/pages/OutcomesPage.tsx` | no match (all three panels on EYE_COLORS) |
| `grep -F "Phase 10 scope note" .planning/REQUIREMENTS.md` | matches (dark-mode deferral recorded) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Worktree branch based on initial commit, not milestone feature tip**
- **Found during:** worktree branch-base check (first action)
- **Issue:** The worktree was created from the initial commit (`4e07e21`) instead of the feature branch HEAD (`edfc59d` — the milestone-v1.5 tip carrying the Phase 10 context and `.planning/` state). `git merge-base HEAD $EXPECTED_BASE` returned the wrong SHA; the `.planning/` tree was absent.
- **Fix:** `git reset --hard edfc59d13b56798d4ecbb6009da3bbc983ee7272` to rebase the worktree branch onto the correct base before any plan execution.
- **Commit:** (pre-task branch rebase, not a content commit)

**2. [Rule 1 — Doc accuracy] Plan's pre-verified contrast ratios were stale estimates**
- **Found during:** Task 3 (contrast test run)
- **Issue:** The plan's header comment and action block quoted ratios of OD ≈8.58, OS ≈6.51, OD+OS ≈8.68. Actual ratios computed by the shipped `computeContrastRatio` are 6.70 / 6.47 / 7.10. All still well above the 3.0 gate, but the numbers printed in the `palette.ts` header were wrong.
- **Fix:** Updated the palette.ts docblock to list the actual computed ratios (6.70 / 6.47 / 7.10). Did not swap hex values — they all clear the gate by >2x.
- **Files modified:** `src/components/outcomes/palette.ts`
- **Commit:** `11fe911` (rolled into the test commit)

No user permission needed for either — Rule 3 (blocking setup) and Rule 1 (doc bug) per deviation policy.

### Authentication gates

None. No auth-touching surface in this plan.

### Deferred issues

None — all 4 tasks closed, all verification green, no fix-attempt budget consumed.

## Known Stubs

None. All surfaces are wired to real data flows.

## Threat Flags

No new trust boundaries introduced. The threat register in the plan (`<threat_model>`) correctly marked the entire plan as N/A or accept-with-rationale; no new security-relevant surface materialized during execution.

## Self-Check: PASSED

Files expected to exist:
- `src/components/outcomes/palette.ts` — FOUND
- `tests/outcomesPalette.contrast.test.ts` — FOUND

Commits expected to exist:
- `4057a78` — FOUND
- `b611eb4` — FOUND
- `11fe911` — FOUND
- `cebc630` — FOUND

All files materialized, all commits landed, all verification gates green, full suite 319/319.
