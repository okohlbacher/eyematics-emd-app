---
phase: 11
slug: audit-beacon-pii-hardening
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + supertest + jsdom (already installed) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npm test -- tests/hashCohortId.test.ts tests/auditApi.test.ts tests/OutcomesPage.test.tsx --run` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~15 seconds quick / ~45 seconds full |

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

> Planner fills this in when plans land; entries below are the target shape the planner must hit.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-XX-01 | XX | N | CRREV-01 | T-11-01 | Raw cohortId never written to audit_log.query or audit_log.body | integration | `npm test -- tests/auditApi.test.ts --run` | ❌ W0 (extend existing) | ⬜ pending |
| 11-XX-02 | XX | N | CRREV-01 | T-11-02 | hashCohortId is deterministic across process restarts | unit | `npm test -- tests/hashCohortId.test.ts --run` | ❌ W0 (new file) | ⬜ pending |
| 11-XX-03 | XX | N | CRREV-01 | T-11-03 | Missing cohortHashSecret crashes startup (fail-fast) | unit | `npm test -- tests/hashCohortId.test.ts --run` | ❌ W0 (new file) | ⬜ pending |
| 11-XX-04 | XX | N | CRREV-01 | — | Client beacon POSTs to /api/audit/events/view-open with JSON body; no cohort id in URL | unit | `npm test -- tests/OutcomesPage.test.tsx --run` | ✅ (modify test 6) | ⬜ pending |
| 11-XX-05 | XX | N | CRREV-01 | T-11-04 | cohortHashSecret is stripped from /api/settings GET for non-admins | integration | `npm test -- tests/settingsApi.test.ts --run` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/hashCohortId.test.ts` — new file; determinism + fail-fast + truncation-length assertions for CRREV-01
- [ ] `tests/auditApi.test.ts` — extend with POST /api/audit/events/view-open test: seed cohort, fire beacon, assert audit_log row contains cohortHash (16 hex chars) and NO raw cohort id in body or query
- [ ] `tests/OutcomesPage.test.tsx` — migrate test 6 from GET-URL assertion to POST-body-shape assertion (method, URL, body JSON, keepalive flag)
- [ ] `tests/settingsApi.test.ts` — extend with assertion that `cohortHashSecret` is stripped from non-admin GET response
- [ ] `settings.yaml` — add `cohortHashSecret` key with a real dev value so tests that load real settings pass
- [ ] No framework install needed — vitest/supertest/jsdom already present

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Network tab shows POST with no cohort id in URL | CRREV-01 | UX smoke — confirms real browser behavior matches test env | Open OutcomesPage in dev browser, open DevTools Network, select a cohort, observe the `view-open` request: method=POST, URL has no querystring, request body is JSON with `cohortId`. Confirm response 204. |
| Missing secret crashes server | CRREV-01 (fail-fast intent) | Startup behavior — exercises process exit path | Temporarily remove `cohortHashSecret` from settings.yaml, run `npm run dev`, confirm server refuses to start with a clear error referencing the missing key. Restore key after. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
