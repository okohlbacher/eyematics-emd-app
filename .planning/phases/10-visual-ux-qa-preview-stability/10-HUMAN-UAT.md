---
status: partial
phase: 10-visual-ux-qa-preview-stability
source: [10-VERIFICATION.md]
started: 2026-04-16T13:42:00Z
updated: 2026-04-16T13:42:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Visual inspection of /outcomes chart panels across zoom levels
expected: OD (#1d4ed8), OS (#b91c1c), OD+OS (#6d28d9) series render distinguishably across median (strokeWidth=3), per-patient lines (strokeWidth=1.5, opacity 0.3/0.6), scatter dots (fillOpacity=0.7), and IQR band (fillOpacity=0.15). IQR band appears as soft fill; median line dominates visually. Verify at 100% / 150% / 200% zoom.
result: [pending]

### 2. Tooltip hover behavior on /outcomes with real Recharts
expected: Hovering per-patient series shows pseudonym → OD/OS → "{N} d" or "#{N}" → logMAR/Δ logMAR/% in expected order. Toggling perPatient layer off suppresses those tooltips; median/scatter/IQR tooltips still appear.
result: [pending]

### 3. Three empty states on /outcomes in DE + EN via real flow
expected: "no-cohort" (no cohort selected): "Keine Patient:innen in dieser Kohorte" / "No patients in this cohort" with Cohort Builder action. "no-visus" (empty cohort): "Keine Visus-Messungen in dieser Kohorte" / "No visus measurements in this cohort". "all-eyes-filtered" (cohort>0, measurements>0, all four layer toggles off): "Keine Augen entsprechen den aktuellen Filtern." / "No eyes match the current filters." with no action link.
result: [pending]

### 4. Admin center filter in live admin session
expected: On /admin, the Center select shows 8 options (All centers + UKA, UKC, UKD, UKG, UKL, UKMZ, UKT in that order). Selecting a specific center narrows the visible user table to only users assigned to that center.
result: [pending]

### 5. OutcomesDataPreview row rendering at realistic cohort sizes
expected: Expanding the preview on a cohort with hundreds of rows shows stable row ordering, no React key-collision console warnings in devtools, and reordering the underlying data does not cause visual jumps.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
