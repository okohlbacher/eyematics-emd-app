---
phase: 20
slug: jwt-refresh-flow-session-resilience
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-23
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 1.x + supertest (server) + RTL (client) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30s |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot tests/<touched>.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

To be filled by planner — one row per task with file, requirement, threat ref, automated command.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/jwtUtil.test.ts` — HS256 verify hardening (SESSION-09)
- [ ] `tests/refreshEndpoint.test.ts` — server refresh flow + CSRF (SESSION-04, SESSION-05, SESSION-08)
- [ ] `tests/authFetchRefresh.test.tsx` — client single-flight + 401 retry (SESSION-01, SESSION-02)
- [ ] `tests/broadcastChannel.test.ts` — cross-tab coordination (SESSION-06) with `vi.stubGlobal('BroadcastChannel', MockBC)`
- [ ] `tests/credentialMutation.test.ts` — tokenVersion / passwordChangedAt / totpChangedAt invalidation (SESSION-03)
- [ ] `tests/auditRefresh.test.ts` — SKIP_AUDIT_PATHS conditional (success skipped, failure audited) (SESSION-12)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Active user crosses 10-min boundary in browser without UX prompt | SESSION-01 | Real cookie + timing | Login, set access TTL low, work past expiry, observe transparent refresh |
| Multi-tab refresh dedup via BroadcastChannel | SESSION-06 | Real BC API not in jsdom | Open 3 tabs, force 401 simultaneously, verify only one /api/auth/refresh hits server |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
