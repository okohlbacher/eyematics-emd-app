---
phase: 17-audit-log-upgrade-dark-mode
fixed_at: 2026-04-21T00:00:00Z
fix_scope: critical_warning
findings_in_scope: 4
fixed: 4
skipped: 0
iteration: 1
status: all_fixed
---

# Phase 17: Code Review Fix Report

**Fixed at:** 2026-04-21
**Source review:** .planning/phases/17-audit-log-upgrade-dark-mode/17-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: Missing dark-mode classes on the Age-vs-Visus chart container

**Files modified:** `src/pages/AnalysisPage.tsx`
**Commit:** 8633480
**Applied fix:** Added `dark:bg-gray-800` and `dark:border-gray-700` to the Age vs Visual Acuity scatter chart wrapper div at line 321, matching the dark-mode classes present on all other chart cards on the page.

---

### WR-02: Cross-cohort color resolver uses wrong reference palette in dark mode

**Files modified:** `src/components/outcomes/OutcomesPanel.tsx`
**Commit:** e0c970b
**Applied fix:** Replaced the three-way inequality check against `eyeColors` with a `Set` built from `Object.values` of both `EYE_COLORS` and `DARK_EYE_COLORS`. Any eye-color hex from either palette now maps to `resolvedColor`; only a genuinely different cohort-compare color passes through as-is. Both palettes were already imported so no import changes were needed.

---

### WR-03: `handleExportJson` silently swallows network errors — no user feedback

**Files modified:** `src/pages/AuditPage.tsx`
**Commit:** 0524d18
**Applied fix:** Wrapped the entire body of `handleExportJson` in a `try/catch`. On non-OK response, logs `[AuditPage] Export failed: {status}` and returns early. On thrown network error, logs `[AuditPage] Export network error: {err}`. The existing `!resp.ok` early-return was retained and now also logs the status code before returning.

---

### WR-04: `startPurgeInterval` never clears its `setInterval` — timer accumulates on hot-reload

**Files modified:** `server/auditDb.ts`
**Commit:** ca71a0a
**Applied fix:** Added module-level `let _purgeTimer` variable initialised to `null`. `startPurgeInterval` now clears any existing timer before registering a new one, preventing accumulation on hot-reload. Added exported `stopPurgeInterval` function (clears and nulls the timer) for use in test teardown to prevent spurious "DB not initialised" errors from stale intervals firing after a test's DB is torn down.

---

_Fixed: 2026-04-21_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
