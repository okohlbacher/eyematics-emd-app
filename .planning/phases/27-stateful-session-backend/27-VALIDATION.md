---
phase: 27
slug: stateful-session-backend
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-11
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.5 |
| **Config file** | `vitest.config.ts` (environment: node, setupFiles: tests/setup.ts) |
| **Quick run command** | `npm run test:ci -- tests/sessionsDb.test.ts tests/sessionRotation.test.ts tests/rotateKey.test.ts` |
| **Full suite command** | `npm run test:ci` |
| **Estimated runtime** | ~15 seconds (quick), ~60 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:ci -- tests/sessionsDb.test.ts tests/sessionRotation.test.ts tests/rotateKey.test.ts`
- **After every plan wave:** Run `npm run test:ci`
- **Before `/gsd-verify-work`:** Full suite must be green (682+ passing)
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 27-01-01 | 01 | 0 | SESS-02 | — | Wave 0 stub only | unit | `npm run test:ci -- tests/sessionsDb.test.ts` | ❌ W0 | ⬜ pending |
| 27-01-02 | 01 | 0 | SESS-03 | — | Wave 0 stub only | integration | `npm run test:ci -- tests/sessionRotation.test.ts` | ❌ W0 | ⬜ pending |
| 27-01-03 | 01 | 0 | SESS-04 | — | Wave 0 stub only | integration | `npm run test:ci -- tests/rotateKey.test.ts` | ❌ W0 | ⬜ pending |
| 27-02-01 | 02 | 1 | SESS-02 | T-SESS-02 / SQLi | Named params in all queries (no string concat) | unit | `npm run test:ci -- tests/sessionsDb.test.ts` | ❌ W0 | ⬜ pending |
| 27-02-02 | 02 | 1 | SESS-02 | — | sessions.db opened with WAL mode | unit | `npm run test:ci -- tests/sessionsDb.test.ts` | ❌ W0 | ⬜ pending |
| 27-02-03 | 02 | 1 | SESS-03 | T-SESS-03 / token reuse | jti lookup before accepting refresh; 401 on unknown/revoked | integration | `npm run test:ci -- tests/sessionRotation.test.ts` | ❌ W0 | ⬜ pending |
| 27-02-04 | 02 | 1 | SESS-03 | T-SESS-03 / replay | revokeFamily called; all rows for sid revoked=1 | unit+integration | `npm run test:ci -- tests/sessionRotation.test.ts tests/sessionsDb.test.ts` | ❌ W0 | ⬜ pending |
| 27-03-01 | 03 | 1 | SESS-04 | T-SESS-04 / key rotate | prev-key tokens still verify after rotation | unit | `npm run test:ci -- tests/rotateKey.test.ts` | ❌ W0 | ⬜ pending |
| 27-03-02 | 03 | 1 | SESS-04 | T-SESS-04 / authz | /rotate-key returns 403 for non-admin | integration | `npm run test:ci -- tests/rotateKey.test.ts` | ❌ W0 | ⬜ pending |
| 27-03-03 | 03 | 1 | SESS-04 | — | prev-key expired tokens return 401 (not 500) | integration | `npm run test:ci -- tests/rotateKey.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/sessionsDb.test.ts` — stubs/skeletons for SESS-02, SESS-03 unit assertions (schema creation, CRUD, cleanup, family revocation)
- [ ] `tests/sessionRotation.test.ts` — stubs for SESS-03 integration: /refresh jti rotation, reuse detection
- [ ] `tests/rotateKey.test.ts` — stubs for SESS-04 integration: /rotate-key endpoint, dual-key verify window

*Existing `tests/authRefresh.test.ts` covers base stateless /refresh behavior and must be updated to mock sessionsDb after Wave 1.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Server restart after key rotation loads prev key correctly from disk | SESS-04 | Requires process restart + disk state check | (1) Rotate key via POST /api/auth/rotate-key, (2) restart server, (3) verify prev-key-signed cookie still refreshes successfully |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-24 (V&V backfill, Phase 35)

Wave 0 scaffolds confirmed GREEN per 27-VERIFICATION.md; npm run test:ci 901/901.
