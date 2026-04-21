---
phase: 15
slug: totp-2fa
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-17
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest@4.1.4 |
| **Config file** | `vite.config.ts` (vitest block in same file) |
| **Quick run command** | `npx vitest run tests/totpEnrollment.test.ts tests/totpAdmin.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/totpEnrollment.test.ts tests/totpAdmin.test.ts`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 0 | SEC-04, SEC-05 | — | Test stubs created | scaffold | `npx vitest run tests/totpEnrollment.test.ts` | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 1 | SEC-04 | — | POST /login returns requiresTotpEnrollment + enrollToken when unenrolled | unit | `npx vitest run tests/totpEnrollment.test.ts` | ❌ W0 | ⬜ pending |
| 15-02-02 | 02 | 1 | SEC-04 | — | POST /totp/enroll validates enrollToken purpose | unit | `npx vitest run tests/totpEnrollment.test.ts` | ❌ W0 | ⬜ pending |
| 15-02-03 | 02 | 1 | SEC-04 | — | POST /totp/confirm verifies TOTP code, activates enrollment | unit | `npx vitest run tests/totpEnrollment.test.ts` | ❌ W0 | ⬜ pending |
| 15-03-01 | 03 | 1 | SEC-04 | — | POST /verify with enrolled user: TOTP code accepted | unit | `npx vitest run tests/totpEnrollment.test.ts` | ❌ W0 | ⬜ pending |
| 15-03-02 | 03 | 1 | SEC-04 | — | POST /verify with non-enrolled user: static OTP fallback still works | unit | `npx vitest run tests/totpEnrollment.test.ts` | ❌ W0 | ⬜ pending |
| 15-04-01 | 04 | 1 | SEC-05 | — | Recovery codes returned as plaintext once, stored as bcrypt hashes | unit | `npx vitest run tests/totpEnrollment.test.ts` | ❌ W0 | ⬜ pending |
| 15-04-02 | 04 | 1 | SEC-05 | — | Valid recovery code passes POST /verify, is burned (removed from array) | unit | `npx vitest run tests/totpEnrollment.test.ts` | ❌ W0 | ⬜ pending |
| 15-04-03 | 04 | 1 | SEC-05 | — | Used recovery code cannot be reused | unit | `npx vitest run tests/totpEnrollment.test.ts` | ❌ W0 | ⬜ pending |
| 15-05-01 | 05 | 1 | SEC-04 | — | DELETE /users/:username/totp admin only; clears TOTP fields | unit | `npx vitest run tests/totpAdmin.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/totpEnrollment.test.ts` — stubs for SEC-04 (enrollment flow) and SEC-05 (recovery codes)
- [ ] `tests/totpAdmin.test.ts` — stubs for SEC-04 (admin TOTP reset)
- [ ] `npm install otplib@13.4.0 qrcode@1.5.4 && npm install --save-dev @types/qrcode@1.5.6` — required before Wave 1 tasks

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| QR code renders correctly in enrollment UI | SEC-04 | Visual check | Open enrollment page, verify QR code renders and can be scanned by authenticator app |
| Recovery codes display correctly at enrollment | SEC-05 | Visual check | Complete enrollment, verify codes are shown once with copy/download affordance |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
