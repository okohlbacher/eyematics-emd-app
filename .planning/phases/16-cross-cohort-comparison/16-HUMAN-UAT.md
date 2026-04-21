---
status: partial
phase: 16-cross-cohort-comparison
source: [16-VERIFICATION.md]
started: 2026-04-21T14:14:00Z
updated: 2026-04-21T14:14:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. 4-Cohort Overlay Readability
expected: Overlay 4 cohorts and confirm each panel renders 4 distinct colored medians (emerald, amber, cyan, fuchsia) with no per-patient noise visible
result: [pending]

### 2. Single-Cohort VIS-04 Hierarchy
expected: Gray per-patient lines at 0.22 opacity read as visually subordinate to the colored median line (4px stroke weight, full saturation) — perceptual hierarchy matches the phase goal
result: [pending]

### 3. Reset Flow
expected: CohortCompareDrawer "Reset to single cohort" link clears ?cohorts=, restores ?cohort=primaryId, view returns to single-cohort mode
result: [pending]

### 4. Settings Drawer perPatient Suppression
expected: When cross-cohort mode is active, the per-patient toggle row is absent from OutcomesSettingsDrawer and the suppressed-note text (outcomesComparePerPatientSuppressed) is visible and readable
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
