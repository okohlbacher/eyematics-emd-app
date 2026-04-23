---
phase: 21
slug: test-uat-polish
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-23
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Phase 21 IS the test-polish phase — validation is self-referential (the deliverables are the tests themselves).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x + React Testing Library (no jest-dom) |
| **Config file** | `vitest.config.ts` + `tests/setup.ts` |
| **Quick run command** | `npx vitest run <file-pattern>` |
| **Full suite command** | `npm run test` (or `npm run test:ci` after TEST-04) |
| **Estimated runtime** | ~30s quick / ~60–90s full |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test file>`
- **After every plan wave:** Run `npm run test` (full suite)
- **Before `/gsd-verify-work`:** Full suite green with zero skipped tests
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 21-01-01 | 01 | 1 | TEST-01 | — | N/A | unit | `npx vitest run tests/outcomesPanelCrt.test.tsx` | ✅ | ⬜ |
| 21-01-02 | 01 | 1 | TEST-02 | — | N/A | unit | `npx vitest run tests/outcomesPanelCrt.test.tsx` | ✅ | ⬜ |
| 21-01-03 | 01 | 1 | TEST-03 | T-20 cookie-credentials | authFetch must send `credentials: 'include'` for audit beacon | unit | `npx vitest run tests/OutcomesPage.test.tsx` | ✅ | ⬜ |
| 21-01-04 | 01 | 1 | TEST-04 | — | N/A | ci-gate | `node scripts/check-skipped-tests.mjs` | ❌ W0 → created in 21-01 | ⬜ |
| 21-02-01 | 02 | 2 | UAT-AUTO-01 | T-20 silent-refresh | authFetch refreshes on 401 once, retries original request | unit | `npx vitest run tests/authFetchRefreshSuite.test.ts` | ❌ W0 | ⬜ |
| 21-02-02 | 02 | 2 | UAT-AUTO-02 | T-20 multi-tab single-flight | Only one tab performs refresh; others wait on BroadcastChannel | unit | `npx vitest run tests/authFetchRefreshSuite.test.ts` | ❌ W0 | ⬜ |
| 21-02-03 | 02 | 2 | UAT-AUTO-03 | T-11 audit PII | Successful /api/auth/refresh responses NOT written to audit.db | unit | `npx vitest run tests/authFetchRefreshSuite.test.ts` | ❌ W0 | ⬜ |
| 21-03-01 | 03 | 3 | UAT-AUTO-04 | T-20 idle-logout | 10-min inactivity triggers auto-logout | unit | `npx vitest run tests/sessionTimers.test.tsx` | ❌ W0 | ⬜ |
| 21-03-02 | 03 | 3 | UAT-AUTO-05 | T-20 absolute-cap | refreshAbsoluteCapMs forces re-auth regardless of activity | unit | `npx vitest run tests/sessionTimers.test.tsx` | ❌ W0 | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/setup.ts` — add in-memory `BroadcastChannel` shim (Map-backed, cross-instance broadcast) per CONTEXT D-03
- [ ] `tests/authFetchRefreshSuite.test.ts` — new file; UAT-AUTO-01..03 coverage
- [ ] `tests/sessionTimers.test.tsx` — new file; UAT-AUTO-04..05 coverage
- [ ] `scripts/check-skipped-tests.mjs` — grep-based gate enforcing `.skip` + `SKIP_REASON:` comment policy
- [ ] `package.json` — add `test:ci` script chaining vitest + skip-gate

*Existing `tests/authFetchRefresh.test.ts`, `tests/outcomesPanelCrt.test.tsx`, `tests/OutcomesPage.test.tsx` continue to serve; no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Browser back/forward preserves auth state | MSEL-04 (deferred) | Literal history navigation impossible in jsdom; needs Playwright | SKIP with `SKIP_REASON: MSEL-04 — Playwright deferred to future milestone` (per D-10) |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (BroadcastChannel shim, 2 new test files, skip-gate script)
- [ ] No watch-mode flags (`vitest run`, not `vitest`)
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills per-task `<automated>` blocks

**Approval:** pending
