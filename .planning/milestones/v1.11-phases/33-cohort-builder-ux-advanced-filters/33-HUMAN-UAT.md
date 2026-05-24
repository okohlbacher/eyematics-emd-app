---
status: partial
phase: 33-cohort-builder-ux-advanced-filters
source: [33-VERIFICATION.md]
started: 2026-05-22
updated: 2026-05-22
---

## Current Test

[awaiting human testing]

## Tests

### 1. COH-01 inline validation UX
expected: In the cohort builder, entering age lower > upper, a Visus value > 1 (or negative/non-numeric in age/Visus/CRT) shows an inline error paragraph under the field, the Save Cohort button disables, and the live results count keeps updating from the still-valid filters (only Save is blocked).
result: [pending]

### 2. COH-02 navigation + reload persistence
expected: Set some filters (including Visus text values), navigate away to another page and back within the session — filters and the Visus text inputs are restored. A full page reload in the same tab also restores them. Reset clears all filters. Logging out and back in (same browser) starts clean.
result: [pending]

### 3. DASH-02 dashboard CRT Review button end-to-end
expected: On the dashboard "Attention needed" panel, the Implausible-CRT Review button lands on the Quality view with the filter panel auto-opened and cases filtered to CRT-implausible (> 400 µm) — NOT the old status=flagged view. The Therapie-Abbrecher button still lands correctly. Each button's destination matches its label.
result: [pending]

### 4. COH-03 preset toggle visual state
expected: Each of the four preset buttons (Therapie-Abbrecher, Unplausible CRT-Werte, Flagged, Implausible Visus) applies its filter live on click, shows an active style (teal ring / aria-pressed), narrows the live count, and clears when a filter is manually edited.
result: [pending]

### 5. COH-04 advanced dialog HbA1c inverted-range block + focus
expected: Opening the Advanced filters modal moves keyboard focus into the dialog (Tab is trapped). Entering an HbA1c min greater than max blocks Apply (dialog stays open). The 5 curated attributes render correctly in both light and dark themes.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
