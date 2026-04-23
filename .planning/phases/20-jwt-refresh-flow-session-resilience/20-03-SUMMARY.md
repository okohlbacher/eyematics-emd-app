---
phase: 20
plan: 03
subsystem: audit-i18n
tags: [audit, i18n, jwt-refresh, status-conditional-skip, redact-paths, session-resilience]
dependency_graph:
  requires:
    - server/auditMiddleware.ts (existing SKIP_AUDIT_PATHS, REDACT_PATHS, redactBody)
    - src/pages/audit/auditFormatters.ts (Phase 19 describeAction relocation)
    - src/i18n/translations.ts (existing audit_action_logout key, line 433)
    - server/jwtUtil.ts + POST /api/auth/refresh + POST /api/auth/logout (Plan 20-01)
  provides:
    - SKIP_AUDIT_IF_STATUS map (status-conditional skip mechanism, currently scoped to /api/auth/refresh:200)
    - REDACT_PATHS membership for /api/auth/refresh + /api/auth/logout
    - audit_action_refresh i18n key (DE+EN)
    - describeAction mapping for POST /api/auth/refresh + POST /api/auth/logout
  affects:
    - AuditPage rows for refresh failures + every logout (now translated, not raw method/path)
    - Audit log volume: ~80 background refreshes/user/12h are silenced (T-20-19 mitigated)
tech_stack:
  added: []
  patterns:
    - Status-conditional audit skip (Record<string, Set<number>>) — distinct from the unconditional SKIP_AUDIT_PATHS
    - "Audit success silently, surface failures loudly" (CONTEXT D-19, RESEARCH Pitfall 5 option a)
    - Defense-in-depth REDACT_PATHS for endpoints whose body should always be empty/CSRF-only
key_files:
  created:
    - tests/auditFormatters.test.ts
  modified:
    - server/auditMiddleware.ts (SKIP_AUDIT_IF_STATUS const + status-conditional check + 2 REDACT_PATHS entries)
    - src/i18n/translations.ts (1 net-new key: audit_action_refresh)
    - src/pages/audit/auditFormatters.ts (2 new describeAction lines + grouping comment)
    - tests/auditMiddleware.test.ts (6 new tests in a new describe block)
decisions:
  - "Used a separate SKIP_AUDIT_IF_STATUS map (Record<string, Set<number>>) rather than overloading SKIP_AUDIT_PATHS. The two have different semantics — handler-written rows (Phase 11) vs. high-volume successful background events (Phase 20) — and conflating them would force every future caller to reason about two failure modes at once."
  - "Status-conditional check runs AFTER the existing SKIP_AUDIT_PATHS check and BEFORE body capture (line 180), preserving the Phase 11 invariant that handler-written paths never have their raw bodies serialised here."
  - "Added /api/auth/logout to REDACT_PATHS as defense in depth even though current logout body is empty — closes T-20-20 against future regressions where a body field could be added unintentionally."
  - "describeAction mapping for /api/auth/logout was added even though no plan-01 code path emits a logout body — the Phase 19 RESEARCH already noted the i18n key existed but was unwired, so this plan completes that loose end alongside the new refresh wiring."
metrics:
  duration_minutes: ~6
  completed: "2026-04-23"
  tasks: 2
  tests_added: 12
  tests_passing: "129/129 across the 7 audit-touched test files"
---

# Phase 20 Plan 03: Audit + i18n for Refresh/Logout Endpoints Summary

Status-conditional audit skip + i18n wiring for the new auth endpoints from
Plan 20-01. Successful refreshes (the ~80/user/12h background event) are now
silenced; failed refreshes (401/403) and every logout still produce audit
rows. AuditPage now renders translated labels ("Token refreshed" / "Token
erneuert" / "Logout" / "Abmeldung") instead of the `audit_action_unknown`
fallback.

## Tasks Executed

### Task 1 — auditMiddleware status-conditional skip + REDACT extension (commits c005a0c → 0e53506)

**Files:** `server/auditMiddleware.ts`, `tests/auditMiddleware.test.ts`

Exact line numbers (post-edit):

- `SKIP_AUDIT_IF_STATUS` constant declared at **line 87** of `server/auditMiddleware.ts`
  (immediately after the existing `SKIP_AUDIT_PATHS` block).
- Status-conditional skip check at **line 180** of `server/auditMiddleware.ts`,
  positioned AFTER the existing `if (SKIP_AUDIT_PATHS.has(urlPath)) return;`
  check (line 175) and BEFORE the body-capture block. Preserves the Phase 11
  invariant that the raw body for handler-written paths is never serialised here.
- `REDACT_PATHS` (line 35) extended with `'/api/auth/refresh'` and `'/api/auth/logout'`
  (lines 42–43).

**Behaviour matrix:**

| Endpoint              | Status | Audit row? | Body redacted? |
|-----------------------|--------|------------|----------------|
| POST /api/auth/refresh | 200   | NO         | n/a            |
| POST /api/auth/refresh | 401   | YES        | YES            |
| POST /api/auth/refresh | 403   | YES        | YES            |
| POST /api/auth/logout  | any   | YES        | YES            |

**Tests added (6):**

1. skips successful (200) /api/auth/refresh
2. audits failed (401) /api/auth/refresh
3. audits failed (403) /api/auth/refresh
4. always audits POST /api/auth/logout (200)
5. redacts /api/auth/refresh body (REDACT_PATHS membership)
6. redacts /api/auth/logout body (REDACT_PATHS membership)

Mock pattern mirrors the existing `auditMiddleware.test.ts` setup
(`vi.mock('../server/auditDb.js')` + `mockReq` / `mockRes` helpers, manual
`statusCode` assignment before `_emit('finish')`).

### Task 2 — i18n key + describeAction mapping + new test file (commits 83b9b07 → 214dede → 3b41a2e)

**Files:** `src/i18n/translations.ts`, `src/pages/audit/auditFormatters.ts`,
`tests/auditFormatters.test.ts`

- `src/i18n/translations.ts` line 434: net-new key
  `audit_action_refresh: { de: 'Token erneuert', en: 'Token refreshed' }`,
  inserted immediately after the pre-existing `audit_action_logout` entry on
  line 433. `TranslationKey` is `keyof typeof translations` (line 821) so the
  new key auto-extends the union.
- `src/pages/audit/auditFormatters.ts` lines 20–21: two new mappings inside
  the auth-actions block, plus a grouping comment "Auth actions (Phase 20
  SESSION-13: refresh + logout)" on line 17:
  ```typescript
  if (method === 'POST' && path === '/api/auth/refresh') return t('audit_action_refresh');
  if (method === 'POST' && path === '/api/auth/logout') return t('audit_action_logout');
  ```
- `audit_action_logout` was pre-existing per Phase 19 RESEARCH (translations.ts
  line 433) — this plan adds the **wiring** in describeAction; no new logout
  i18n key.

**Tests added (6, in new file `tests/auditFormatters.test.ts`):**

1. POST /api/auth/refresh → 'Token refreshed' (en)
2. POST /api/auth/logout → 'Logout' (en)
3. POST /api/auth/refresh → 'Token erneuert' (de)
4. POST /api/auth/logout → 'Abmeldung' (de)
5. Phase 19 regression: POST /api/auth/login still returns 'Login'
6. POST-only guard: GET /api/auth/refresh falls through to `audit_action_unknown`

Pure unit test (no supertest, no DOM, no router). Imports the actual
`translations` map and uses `enT` / `deT` resolvers.

## Confirmations

- **REDACT_PATHS contains both new paths:**
  `grep -E "'/api/auth/refresh'|'/api/auth/logout'" server/auditMiddleware.ts`
  shows `/api/auth/refresh` twice (REDACT_PATHS line 42, SKIP_AUDIT_IF_STATUS
  line 88) and `/api/auth/logout` once (REDACT_PATHS line 43).
- **Status-conditional check ordering:** `grep -n` confirms `SKIP_AUDIT_PATHS.has`
  is at line 175 and `SKIP_AUDIT_IF_STATUS[urlPath]?.has(res.statusCode)` at
  line 180 — required ordering preserved.
- **One net-new i18n key:** `audit_action_refresh` added; `audit_action_logout`
  was pre-existing (translations.ts line 433 confirmed in CONTEXT and Phase 19
  RESEARCH).
- **Phase 19 audit tests still green:** `auditPageReducer.test.ts` (36 tests)
  and `auditPageCharacterization.test.tsx` (11 tests) both pass unchanged.
- **All 4 STRIDE threats addressed:** T-20-19 (DoS via flood) mitigated by
  SKIP_AUDIT_IF_STATUS; T-20-20 (CSRF token in audit body) mitigated by
  REDACT_PATHS membership; T-20-21 (failed refresh invisible) verified by tests
  2+3 of Task 1; T-20-22 (i18n raw-key leak) accept-disposed and avoided by
  proper key addition.

## Note for Plan 20-04 / Verification

Live verification of the "no audit row for 200 refresh" invariant — i.e.
tailing `audit.db` while the browser actually hits POST /api/auth/refresh past
the 10-min access-token boundary — requires Plan 20-04's `authFetch` silent
refresh wiring to fire the endpoint. Until then, Task 1's unit tests are the
authoritative behavioural proof. Phase 20's `<verification>` step 5 explicitly
notes this is a post-Plan-04 manual smoke step.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Lint] Import sort in `tests/auditFormatters.test.ts`**

- **Found during:** Task 2 final lint sweep
- **Issue:** `simple-import-sort/imports` flagged the new test file's import
  order (vitest before relative imports) as needing autofix.
- **Fix:** Ran `npx eslint --fix tests/auditFormatters.test.ts`. The autofixer
  reordered the named imports inside `from '../src/i18n/translations'` to
  `{ type TranslationKey, translations }` (alphabetical); top-level grouping
  was already correct.
- **Files modified:** `tests/auditFormatters.test.ts` (commit 3b41a2e).

### Pre-existing Lint Errors (out of scope — Rule SCOPE BOUNDARY)

`npm run lint` reports 54 errors / 58 warnings on the base. None are in this
plan's touched files (`auditMiddleware.ts`, `auditFormatters.ts`,
`translations.ts`, `auditMiddleware.test.ts`, `auditFormatters.test.ts`).
Confirmed via `npm run lint 2>&1 | grep -E "<touched files>"`. Pre-existing
`auditFormatters.ts` line-5 import-sort warning is from the Phase 19 commit
and untouched here. Pre-existing failures from Plan 20-01's
`deferred-items.md` (`outcomesPanelCrt.test.tsx`, `OutcomesPage.test.tsx`)
remain out of scope.

## Self-Check: PASSED

- **Files exist:**
  - server/auditMiddleware.ts: FOUND (modified)
  - src/i18n/translations.ts: FOUND (modified, key at line 434)
  - src/pages/audit/auditFormatters.ts: FOUND (modified, mappings at lines 20–21)
  - tests/auditMiddleware.test.ts: FOUND (modified, +6 tests)
  - tests/auditFormatters.test.ts: FOUND (created, 6 tests)
- **Commits exist:** `git log --oneline 2e9433b..HEAD` shows
  `c005a0c, 0e53506, 83b9b07, 214dede, 3b41a2e` — all present.
- **Tests:** 12 net-new tests green (6 auditMiddleware + 6 auditFormatters);
  129/129 across the 7 audit-touched test files
  (auditMiddleware.test.ts, auditFormatters.test.ts, audit.test.ts,
  auditApi.test.ts, auditPageReducer.test.ts, auditPageCharacterization.test.tsx,
  outcomesAggregateAudit.test.ts).
- **Acceptance criteria:** Both tasks' criteria confirmed via grep + test runs.
- **Success criteria from PLAN:**
  - [x] auditMiddleware status-conditional skip works (200-refresh silent;
        401-refresh audited)
  - [x] /api/auth/refresh + /api/auth/logout in REDACT_PATHS
  - [x] audit_action_refresh i18n key present in DE+EN
  - [x] describeAction maps refresh + logout
  - [x] 12 new tests across both files green
  - [x] All Phase 19 audit tests still green
