---
phase: 6
slug: keycloak-preparation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.4 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run tests/authMiddlewareKeycloak.test.ts tests/authConfigProvider.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/authMiddlewareKeycloak.test.ts tests/authConfigProvider.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 0 | KC-01 | — | N/A | unit | `npx vitest run tests/initAuthKeycloak.test.ts` | ❌ W0 | ⬜ pending |
| 6-01-02 | 01 | 0 | KC-02 | — | N/A | unit | `npx vitest run tests/authMiddlewareKeycloak.test.ts` | ❌ W0 | ⬜ pending |
| 6-01-03 | 01 | 0 | KC-04 | — | N/A | unit | `npx vitest run tests/authConfigProvider.test.ts` | ❌ W0 | ⬜ pending |
| 6-02-01 | 02 | 1 | KC-01 | — | Config parsing validates required fields | unit | `npx vitest run tests/initAuthKeycloak.test.ts` | ❌ W0 | ⬜ pending |
| 6-02-02 | 02 | 1 | KC-02 | — | RS256 JWT validated via JWKS | unit | `npx vitest run tests/authMiddlewareKeycloak.test.ts` | ❌ W0 | ⬜ pending |
| 6-02-03 | 02 | 1 | KC-02 | — | 503 when JWKS unreachable | unit | `npx vitest run tests/authMiddlewareKeycloak.test.ts` | ❌ W0 | ⬜ pending |
| 6-02-04 | 02 | 1 | KC-03 | — | Role array normalized to string | unit | `npx vitest run tests/authMiddlewareKeycloak.test.ts` | ❌ W0 | ⬜ pending |
| 6-02-05 | 02 | 1 | KC-04 | — | /login returns 405 in keycloak mode | unit | `npx vitest run tests/authConfigProvider.test.ts` | ❌ W0 | ⬜ pending |
| 6-02-06 | 02 | 1 | KC-04 | — | /config returns provider field | unit | `npx vitest run tests/authConfigProvider.test.ts` | ❌ W0 | ⬜ pending |
| 6-02-07 | 02 | 1 | AUTH-03 | — | Local HS256 mode unbroken | regression | `npx vitest run tests/authMiddlewareKeycloak.test.ts` | ❌ W0 | ⬜ pending |
| 6-03-01 | 03 | 2 | KC-04 | — | N/A | unit | `npx vitest run tests/loginPageKeycloak.test.ts` | ❌ W0 | ⬜ pending |
| 6-04-01 | 04 | 2 | KC-05 | — | N/A | manual | — | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/initAuthKeycloak.test.ts` — stubs for KC-01 config parsing
- [ ] `tests/authMiddlewareKeycloak.test.ts` — stubs for KC-02, KC-03, AUTH-03 middleware validation
- [ ] `tests/authConfigProvider.test.ts` — stubs for KC-04 endpoint behavior
- [ ] `tests/loginPageKeycloak.test.ts` — stubs for KC-04 UI toggle
- [ ] `npm install jwks-rsa` — add dependency

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| docs/keycloak-setup.md covers prerequisites, realm config, client setup, role mapping, custom claims, settings.yaml example, verification steps | KC-05 | Documentation content review | Read docs/keycloak-setup.md and verify all 7 required sections present |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
