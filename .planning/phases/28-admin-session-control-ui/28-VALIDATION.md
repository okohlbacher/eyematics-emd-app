---
phase: 28
slug: admin-session-control-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-14
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.5 |
| **Config file** | `vitest.config.ts` (project root) |
| **Quick run command** | `npx vitest run tests/sessionsDb.test.ts tests/settingsApi.test.ts` |
| **Full suite command** | `npm run test:ci` (619 baseline tests must remain passing) |
| **Estimated runtime** | ~15 seconds (quick), ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/sessionsDb.test.ts tests/settingsApi.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** `npm run test:ci` must be green (619+ tests passing)
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 28-01-01 | 01 | 0 | SESS-01, SESSUI-01, SESSUI-02 | T-28-01 / — | Admin-only guard returns 403 for non-admin | unit/integration | `npx vitest run tests/sessionRevoke.test.ts` | ❌ W0 | ⬜ pending |
| 28-01-02 | 01 | 0 | SESSUI-03 | — | hours↔ms round-trip, client validation | unit | `npx vitest run tests/ttlConversion.test.ts` | ❌ W0 | ⬜ pending |
| 28-02-01 | 02 | 1 | SESSUI-01, SESSUI-02 | T-28-02 | listActiveSessionsByUser filters revoked/expired | integration | `npx vitest run tests/sessionsDb.test.ts` | ✅ extend | ⬜ pending |
| 28-02-02 | 02 | 1 | SESS-01 | T-28-01 | DELETE /sessions?username revokes all, returns count | integration | `npx vitest run tests/sessionRevoke.test.ts` | ❌ W0 | ⬜ pending |
| 28-02-03 | 02 | 1 | SESSUI-02 | — | DELETE /sessions/:id 404 if not found | integration | `npx vitest run tests/sessionRevoke.test.ts` | ❌ W0 | ⬜ pending |
| 28-03-01 | 03 | 2 | SESSUI-03 | — | AppSettings.auth persists through resetSettings | integration | `npx vitest run tests/settingsApi.test.ts` | ✅ extend | ⬜ pending |
| 28-04-01 | 04 | 2 | i18n | — | All 19 new keys have de+en entries | unit | `npx vitest run tests/outcomesI18n.test.ts` or new test | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/sessionRevoke.test.ts` — stubs covering:
  - `GET /api/auth/sessions?username=u` returns active rows only (SESSUI-01)
  - `DELETE /api/auth/sessions/:id` revokes individual session, 404 if missing (SESSUI-02)
  - `DELETE /api/auth/sessions?username=u` revokes all, returns count (SESS-01)
  - Admin-only guard: 403 for non-admin role on all three endpoints
  - Route ordering: DELETE /sessions/:id hits :id handler, not query-param handler
- [ ] `tests/ttlConversion.test.ts` — stubs covering:
  - `refreshTtlHours * 3_600_000` round-trips through load/save (SESSUI-03, D-07)
  - Client validation: refresh ≥ 1h, absolute cap ≥ refresh TTL (D-08)
  - Edge case: fractional hours are rounded (Math.round on load)

*Existing infrastructure (`tests/sessionsDb.test.ts`, `tests/settingsApi.test.ts`, `tests/outcomesI18n.test.ts`) must be extended but not replaced.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Revoked session's next API call returns 401 in browser | SESSUI-02 | Requires live browser + live server — cannot be unit-tested | 1. Log in as test user in browser A. 2. Admin revokes that session via Admin panel. 3. Browser A makes any API call — confirm redirect to /login or 401 response. |
| "Sign out everywhere" empties session list in UI | SESS-01 | DOM interaction with live server | 1. Open Admin panel, expand session accordion for a user with 2+ sessions. 2. Click "Sign out everywhere". 3. Confirm list shows "No active sessions." |
| TTL values persist after page reload | SESSUI-03 | Requires full settings.yaml write + server reload | 1. Set refresh TTL to 2h in Settings. 2. Save. 3. Reload page. 4. Confirm Settings shows 2h. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
