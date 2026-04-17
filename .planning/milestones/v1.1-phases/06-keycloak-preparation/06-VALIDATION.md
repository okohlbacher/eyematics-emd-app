---
phase: 6
slug: keycloak-preparation
status: draft
nyquist_compliant: true
wave_0_complete: true
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| 6-01-T1 | 01 | 1 | KC-01 | T-06-04 | Config parsing validates required fields | unit | `npx vitest run tests/authMiddlewareKeycloak.test.ts` | ⬜ pending |
| 6-01-T2 | 01 | 1 | KC-02, KC-03, AUTH-03 | T-06-01, T-06-03, T-06-05 | RS256 JWT validated via JWKS; claim normalization; 503 on unreachable | unit | `npx vitest run tests/authMiddlewareKeycloak.test.ts` | ⬜ pending |
| 6-02-T1 | 02 | 2 | KC-03, KC-04, AUTH-03 | T-06-07 | /config returns provider; /login returns 405 in keycloak mode; local regression | unit | `npx vitest run tests/authConfigProvider.test.ts` | ⬜ pending |
| 6-02-T2 | 02 | 2 | KC-05 | — | N/A | manual | — | ⬜ pending |
| 6-02-T3 | 02 | 2 | KC-04 | T-06-09 | LoginPage toggle visual check | checkpoint | Human verify | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Test File Ownership

Test files are created within plan tasks (no separate Wave 0 needed):

| Test File | Created By | Covers |
|-----------|------------|--------|
| `tests/authMiddlewareKeycloak.test.ts` | Plan 01, Task 1 (stub) + Task 2 (full) | KC-01 config, KC-02 JWKS validation, KC-03 claim normalization, AUTH-03 local regression |
| `tests/authConfigProvider.test.ts` | Plan 02, Task 1 | KC-04 /config provider field, /login 405 in keycloak mode |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| docs/keycloak-setup.md covers prerequisites, realm config, client setup, role mapping, custom claims, settings.yaml example, verification steps | KC-05 | Documentation content review | Read docs/keycloak-setup.md and verify all 7 required sections present |
| LoginPage shows Keycloak button when provider=keycloak, local form when provider=local | KC-04 | Visual UI verification | Start dev server, verify login page in both provider modes (Plan 02, Task 3 checkpoint) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are checkpoints/manual
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Test files created within plan tasks (no Wave 0 gap)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
