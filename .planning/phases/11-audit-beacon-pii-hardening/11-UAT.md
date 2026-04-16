---
status: complete
phase: 11-audit-beacon-pii-hardening
source: [11-01-SUMMARY.md, 11-02-SUMMARY.md, 11-03-SUMMARY.md]
started: 2026-04-16T18:48:00Z
updated: 2026-04-16T18:53:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Stop and restart both servers. Both come up cleanly with no errors. App loads at localhost:5173 and admin/admin login works.
result: pass

### 2. Cohort id absent from beacon URL
expected: |
  Open DevTools → Network tab. Log in, navigate to /analysis?tab=trajectories.
  Find the request to /api/audit/events/view-open. It should be METHOD=POST,
  URL exactly `/api/audit/events/view-open` with NO cohort=... or filter=... in the URL.
  Before Phase 11 this was a GET with the raw cohort id in the querystring.
result: pass

### 3. Beacon POST body contains only hashed cohort data
expected: |
  From the same Network tab, open the POST /api/audit/events/view-open request and
  inspect the Request Payload. It should be JSON containing { name: "open_outcomes_view",
  cohortId: "<opaque-id>", filter: {...} } — the cohortId in the request body is the
  saved-search id (not PII). No raw patient identifiers present.
result: pass

### 4. audit.cohortHashSecret admin-only visibility
expected: |
  While logged in as admin, visit /settings. Under the audit section the field
  "cohortHashSecret" should be present (or visible via GET /api/settings in DevTools).
  Log out, log back in as forscher1/changeme2025!, repeat the check — the
  cohortHashSecret field should be ABSENT from GET /api/settings for non-admin users.
result: pass

### 5. Audit DB stores hashed cohort, not raw id
expected: |
  In a terminal run: sqlite3 data/audit.db "SELECT body FROM audit_log WHERE url='/api/audit/events/view-open' ORDER BY id DESC LIMIT 3"
  The body column should contain a JSON blob with a cohortHash field (16-hex-char string)
  and NO cohortId field with the raw identifier. Before Phase 11 the raw cohort id was
  stored verbatim.
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
