# Deferred Items — Phase 20

## Pre-existing test failures (NOT caused by Plan 20-01)

Verified by `git stash` + re-running the suite at the base commit
(`34d9396`): these 3 failures exist on `main` and are unrelated to
the JWT-refresh work in Plan 20-01.

- `tests/outcomesPanelCrt.test.tsx`
  - "visus absolute mode: y-domain is [0, 2] (data-min='0' data-max='2')"
  - "backward compat: no metric prop defaults to visus absolute [0, 2]"
- `tests/OutcomesPage.test.tsx`
  - "fires audit beacon POST with JSON body, keepalive, and no cohort id in URL (Phase 11)"

Out of scope for Plan 20-01 (jwt-refresh foundation). Belongs to whoever
owns Phase 13 (CRT metric) / Phase 11 (audit beacon) regression tracking.
