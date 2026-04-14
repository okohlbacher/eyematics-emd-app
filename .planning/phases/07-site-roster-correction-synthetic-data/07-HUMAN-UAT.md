---
status: partial
phase: 07-site-roster-correction-synthetic-data
source: [07-VERIFICATION.md]
started: 2026-04-14T22:40:00Z
updated: 2026-04-14T22:40:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Admin cohort filter UI shows the 7 new sites
expected: Logging in as `admin` and opening the cohort filter displays exactly the 7 German city names (Aachen, Chemnitz, Dresden, Greifswald, Leipzig, Mainz, Tübingen); none of Bonn/München/Münster appear anywhere in the UI.
result: [pending]

### 2. Unauthorized cross-site access returns 403 on live server
expected: A non-admin user whose `centers` array does not include `org-ukd` cannot GET `/api/fhir/bundles?center=org-ukd` (or any `/api/data/*` center-scoped endpoint) — response is 403.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
