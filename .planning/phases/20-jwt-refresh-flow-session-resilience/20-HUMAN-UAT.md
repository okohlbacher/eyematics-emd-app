---
status: partial
phase: 20-jwt-refresh-flow-session-resilience
source: [20-VERIFICATION.md]
started: 2026-04-23T10:20:00Z
updated: 2026-04-23T10:20:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Active-user smoke test — silent refresh past 10-min boundary
expected: Login, set sessionStorage emd-token expiry to <now>, trigger any /api/* call. Network tab shows original 401 → POST /api/auth/refresh 200 → original retried 200. UI never prompts re-login. devtools shows emd-refresh (HttpOnly, Path=/api/auth/refresh) and emd-csrf (non-HttpOnly) cookies present.
result: [pending]

### 2. Multi-tab BroadcastChannel adoption
expected: Open two tabs to the app; in tab A force a 401 (delete emd-token); confirm tab B's sessionStorage.emd-token updates to the new token without firing its own /api/auth/refresh request (verify in tab B's Network panel).
result: [pending]

### 3. Audit DB silence for 200 refresh, presence for 401 refresh and every logout
expected: Tail data/audit.db (or query via /api/audit) after multiple successful refresh cycles → zero rows with path=/api/auth/refresh, status=200. Force a 401 refresh → row appears with status=401. Logout → row appears with status=200, action=audit_action_logout. AuditPage UI displays 'Token refreshed' / 'Token erneuert' / 'Logout' / 'Abmeldung' (no audit_action_unknown raw).
result: [pending]

### 4. Idle-logout still fires at 10 minutes regardless of refresh validity
expected: Login, leave tab idle for 10 minutes; user is logged out at INACTIVITY_TIMEOUT despite a valid refresh token. D-25 contract preserved.
result: [pending]

### 5. Absolute session cap forces re-auth at 12h
expected: Login, age the refresh token's iat past auth.refreshAbsoluteCapMs (default 12h); next /api/auth/refresh returns 401 'Session cap exceeded'; client falls through to /login.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
