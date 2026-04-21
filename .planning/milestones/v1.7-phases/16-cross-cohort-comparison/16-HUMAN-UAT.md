---
status: complete
phase: 16-cross-cohort-comparison
source: [16-VERIFICATION.md]
started: 2026-04-21T14:14:00Z
updated: 2026-04-21T18:10:00Z
---

## Current Test

[all tests complete]

## Tests

### 1. 4-Cohort Overlay Readability
expected: Overlay 4 cohorts and confirm each panel renders 4 distinct colored medians (emerald, amber, cyan, fuchsia) with no per-patient noise visible
result: pass
note: Initial UX issues fixed during UAT — (a) VIS-04 opacity regression from merge 935717a restored in palette.ts (commit b19a765); (b) icon-only GitCompare button replaced with labeled "Compare cohorts" pill; (c) drawer checkboxes were unresponsive without a primary ?cohort= — first selection now promotes to primary (commit 563df9d)

### 2. Single-Cohort VIS-04 Hierarchy
expected: Gray per-patient lines at 0.22 opacity read as visually subordinate to the colored median line (4px stroke weight, full saturation) — perceptual hierarchy matches the phase goal
result: pass

### 3. Reset Flow
expected: CohortCompareDrawer "Reset to single cohort" link clears ?cohorts=, restores ?cohort=primaryId, view returns to single-cohort mode
result: pass

### 4. Settings Drawer perPatient Suppression
expected: When cross-cohort mode is active, the per-patient toggle row is absent from OutcomesSettingsDrawer and the suppressed-note text (outcomesComparePerPatientSuppressed) is visible and readable
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
