---
status: passed
phase: 31-subcohort-support
source: [31-VERIFICATION.md]
started: 2026-05-21T00:00:00Z
updated: 2026-05-21T00:00:00Z
---

## Current Test

[complete — all items approved by user 2026-05-21]

## Tests

### 1. Tree render + chevron collapse/expand (SC2)
expected: After saving `C1:Male` and `C1:Female`, opening the cohort compare drawer shows `C1` as a parent row with the subcohorts indented (pl-6) beneath it, expanded by default. The chevron toggles collapse/expand. Cohorts with no subcohorts still render flat (unchanged).
result: passed

### 2. Orphan subcohort amber warning + save proceeds (SC5)
expected: Typing `Ghost:Sub` (no matching parent cohort) in the save dialog shows a non-blocking amber warning (visually distinct from the red hard-error state); the Save button stays enabled and clicking it saves the subcohort.
result: passed

### 3. Split button cursor placement (D-03)
expected: Clicking the teal GitBranch "Split" action on a saved cohort row fills the name input with `<cohortName>:`, focuses the input, and places the cursor immediately after the colon (so the user types only the sub identifier).
result: passed

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
