# Phase 15: TOTP 2FA - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 15-totp-2fa
**Areas discussed:** None — all decisions at Claude's discretion

---

## Gray Areas Presented

| Option | Description | Selected |
|--------|-------------|----------|
| Enrollment trigger | When/how users get forced to enroll | — |
| Enrollment UI placement | Where QR code displays in the app | — |
| Recovery codes | How many, how shown, regeneratable? | — |
| Admin reset behavior | What "reset TOTP" means exactly | — |

**User's choice:** None selected — user deferred all implementation decisions to Claude.

**Notes:** User previously declined to generate a UI-SPEC for this phase, confirming minimal frontend changes are expected. All decisions in CONTEXT.md represent Claude's judgment for a production clinical security application, following Phase 14 PasswordChangePage patterns where applicable.

## Claude's Discretion

All areas:
- Enrollment trigger (D-01): forced on next login when twoFactorEnabled=true and not enrolled
- Enrollment UI (D-02): TotpEnrollPage full-page interstitial, same pattern as PasswordChangePage
- Recovery codes (D-03): 10 codes, shown once with copy/download, checkbox confirmation, not regeneratable
- Admin reset (D-04): "Reset 2FA" button in AdminPage user row, DELETE /api/auth/users/:username/totp
- LoginPage step (D-05): existing step='otp' reused, no structural change
- Library choice (D-09): otplib@13.4.0 + qrcode@1.5.4

## Deferred Ideas

- Recovery code regeneration after initial enrollment
- Self-service TOTP disable/re-enrollment (SEC-07 future requirement)
