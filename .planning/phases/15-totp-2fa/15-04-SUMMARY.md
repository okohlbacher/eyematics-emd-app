---
phase: 15
plan: 04
subsystem: auth/totp-admin-ui
tags: [totp, 2fa, admin-reset, AdminPage, lucide-react]
requires: [totp-admin-reset, totp-i18n-keys]
provides: [admin-reset-totp-button, handleResetTotp]
affects: [src/pages/AdminPage.tsx]
tech-stack:
  added: []
  patterns: [handleDelete-mirror, conditional-button-totpEnabled, window-confirm-pattern]
key-files:
  created: []
  modified:
    - src/pages/AdminPage.tsx
decisions:
  - "handleResetTotp mirrors handleDelete exactly — same try/catch, same authFetch, same loadUsers() refresh, same alert(t('mutationErrorGeneric')) on failure"
  - "Reset 2FA button wrapped in inline-flex div alongside Delete button to preserve horizontal alignment in the actions cell"
  - "totpEnabled added to ServerUser interface as optional boolean (matches users.json schema from Plan 02)"
metrics:
  duration: "~10 minutes"
  completed: "2026-04-17"
  tasks: 1
  files: 1
---

# Phase 15 Plan 04: Admin Reset 2FA UI Summary

One-liner: AdminPage gains a ShieldOff + "Reset 2FA" amber button per user row (visible only when totpEnabled=true), wired to DELETE /api/auth/users/:username/totp with confirm dialog and table refresh.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add handleResetTotp handler + Reset 2FA button in AdminPage | 512a21a | src/pages/AdminPage.tsx |
| 2 | Human end-to-end verification of TOTP enrollment + admin reset | PENDING | — |

## Task 1 Details — AdminPage.tsx Changes (+50 lines, -17 lines)

**Edit 1 — ShieldOff import:** Added `ShieldOff` to the existing lucide-react destructured import in alphabetical order between `ShieldCheck` and `Stethoscope`.

**Edit 2 — ServerUser interface:** Added `totpEnabled?: boolean` field to mirror the users.json schema written by Plan 02.

**Edit 3 — handleResetTotp handler (after handleDelete, line 255):**
```typescript
const handleResetTotp = async (targetUsername: string) => {
  const confirmCopy = t('adminResetTotpConfirm').replace('{username}', targetUsername);
  if (!window.confirm(confirmCopy)) return;
  try {
    const resp = await authFetch(
      `/api/auth/users/${encodeURIComponent(targetUsername)}/totp`,
      { method: 'DELETE' },
    );
    if (!resp.ok) {
      alert(t('mutationErrorGeneric'));
      return;
    }
    await loadUsers();
  } catch {
    alert(t('mutationErrorGeneric'));
  }
};
```

**Edit 4 — Reset 2FA button in user row actions cell (before Delete button):**
- Wrapped existing delete button in `inline-flex items-center gap-2` div
- Added conditional Reset 2FA button: `{u.totpEnabled === true && (...)}` 
- Uses `ShieldOff` icon + `<span>{t('adminResetTotp')}</span>` visible label
- Style: `text-amber-600 hover:text-amber-800 inline-flex items-center gap-1`
- Includes `title` and `aria-label` attributes per UI-SPEC accessibility contract

## Verification Results

```bash
# All acceptance criteria grep checks
grep -q "ShieldOff" src/pages/AdminPage.tsx       # PASS
grep -q "handleResetTotp" src/pages/AdminPage.tsx  # PASS
grep -q "/totp" src/pages/AdminPage.tsx            # PASS
grep -q "u.totpEnabled === true" src/pages/AdminPage.tsx  # PASS
grep -q "adminResetTotp" src/pages/AdminPage.tsx   # PASS

# TypeScript — zero errors
npx tsc --noEmit -p tsconfig.app.json  # → (no output — clean)

# Vite production build — exit 0
npm run build  # → ✓ built in 303ms

# Test suite — no regressions
npm test -- --run  # → 465 passed | 5 skipped (470)
```

## Human Checkpoint (Task 2) — PENDING

The following 20-step end-to-end verification is awaiting human sign-off.

### How to Verify

1. Start dev server: `npm run dev`. Confirm zero compilation errors.
2. Ensure `public/settings.yaml` has `twoFactorEnabled: true`. Restart if changed.
3. Open http://localhost:5173 and log in as an UNENROLLED user (no `totpEnabled` in data/users.json).
4. Expected: TotpEnrollPage renders — amber Shield icon, "Set Up Two-Factor Authentication" heading, QR code image, "Can't scan?" details toggle, 6-digit input.
5. Open Google Authenticator / Authy and scan the QR code. Confirm it shows a rotating code labelled "EyeMatics:<username>".
6. Enter the 6-digit code and click "Activate Two-Factor Authentication".
7. Expected: RecoveryCodesPanel shows exactly 10 codes in a 2-column grid, amber warning banner, Copy all + Download buttons, checkbox, disabled Continue button.
8. Click "Copy all codes" — verify clipboard contains 10 codes separated by newlines; button briefly shows "Copied!".
9. Click "Download as .txt" — verify `recovery-codes.txt` downloads with 10 lines.
10. Try clicking Continue without checking the checkbox — it must remain disabled.
11. Check the checkbox — Continue becomes enabled. Click it.
12. Expected: normal app loads (landing page).
13. Log out; log back in with the same user. Enter a current 6-digit TOTP code. Expected: login succeeds.
14. Log out; log in again. At the OTP step, enter one of the saved recovery codes. Expected: login succeeds; Network tab shows `recoveryCodeUsed: true` in response body.
15. Log in as admin. Visit /admin. Find the test user's row. Expected: "Reset 2FA" button with ShieldOff icon and amber text is visible in the actions cell (BEFORE Delete).
16. Click "Reset 2FA". Expected: native confirm dialog with copy "Reset 2FA for <username>? They will be required to re-enroll on next login."
17. Click OK. Expected: table refreshes; Reset 2FA button disappears for that user.
18. Log out of admin; log in as the reset user. Expected: TotpEnrollPage appears again (re-enrollment forced).
19. Switch language to DE. Confirm German strings render (heading "Zwei-Faktor-Authentisierung einrichten", button "Zwei-Faktor-Authentisierung aktivieren").
20. As admin, visit /audit. Search recent events. Expected: `totp-enrolled`, `totp-recovery-used`, `totp-reset` entries; `totpSecret` and `enrollToken` fields appear as [REDACTED].

**Outcome:** PENDING — awaiting user sign-off.

## Phase 15 Close-Out Checklist

- [x] SEC-04 requirement satisfied: per-user TOTP via RFC 6238, ±1 window tolerance, QR enrollment flow, admin reset capability
- [x] SEC-05 requirement satisfied: bcrypt-hashed recovery codes (rounds=12), burned atomically on use, 10 per enrollment
- [x] Static otpCode fallback preserved for unenrolled users (D-07 — conditional branch in /verify)
- [x] Audit trail redacts totpSecret and enrollToken (server/authApi.ts — auditMiddleware sanitizes these fields)
- [x] Total new tests added across Phase 15: 16 new TOTP tests (Plans 01–03 stubs replaced by Plan 02 implementation)

## Test Suite State

```
Test Files  51 passed | 1 skipped (52)
     Tests  465 passed | 5 skipped (470)
  Duration  8.11s
```

(up from 447 passing before Phase 15 — 16 new TOTP tests added in Plan 02 + 2 previously-broken SEC-03 tests fixed)

## Deviations from Plan

**1. [Rule 2 - Missing Critical] Added `totpEnabled?: boolean` to ServerUser interface**
- **Found during:** Task 1
- **Issue:** The plan's task description referenced `u.totpEnabled === true` as a conditional guard on the JSX button, but the `ServerUser` TypeScript interface did not include this field. Without it, TypeScript would flag the property access as an error.
- **Fix:** Added `totpEnabled?: boolean` to `ServerUser` interface — matching the users.json schema added by Plan 02.
- **Files modified:** src/pages/AdminPage.tsx
- **Commit:** 512a21a

**2. [Rule 2 - Missing Critical] Wrapped actions cell buttons in flex container**
- **Found during:** Task 1 (UI layout review)
- **Issue:** The Reset 2FA button and Delete button in the same actions cell needed a flex wrapper to maintain horizontal alignment when the Reset 2FA button is conditionally rendered.
- **Fix:** Added `<div className="inline-flex items-center gap-2">` wrapper around both buttons in the actions cell.
- **Files modified:** src/pages/AdminPage.tsx
- **Commit:** 512a21a

## Known Stubs

None. All Plan 04 functionality is wired to real Plan 02 backend endpoint.

## Threat Surface Scan

No new network endpoints. The `DELETE /api/auth/users/:username/totp` endpoint was introduced in Plan 02 and threat-modeled there. Client-side threat mitigations applied:
- T-15-24 (tampering — wrong username): confirm dialog includes target username
- T-15-26 (spoofing — button shown to unenrolled users): `u.totpEnabled === true` conditional ensures button hidden for unenrolled users

## Self-Check

---
## Self-Check: PASSED

Files:
- FOUND: src/pages/AdminPage.tsx (modified — ShieldOff import, handleResetTotp handler, Reset 2FA button)

Commits:
- 512a21a: feat(15-04): add handleResetTotp handler and Reset 2FA button in AdminPage

---

## Post-Plan Bug Fix: LoginPage totp_enrollment_required handling

**Reported:** User could not log in as an unenrolled user — "Login failed" error appeared.

**Root cause:** `LoginPage.handleCredentials` had no explicit branch for `result.error === 'totp_enrollment_required'`. The error fell through to the generic `else` clause and called `setError(t('loginErrorFailed'))`, displaying a confusing "Login failed" banner before TotpEnrollPage rendered.

**Fix:** Added explicit `else if (result.error === 'totp_enrollment_required')` branch that calls `setError('')`. AuthContext has already set `requiresTotpEnrollment=true` which causes AppRoutes to render TotpEnrollPage — no navigation call is needed.

**Full flow verified correct (no additional changes required):**

- `completeTotpEnroll` in AuthContext correctly: clears `requiresTotpEnrollment`, clears `pendingEnrollToken`, stores session JWT in sessionStorage, sets token and user state.
- `TotpEnrollPage` → `RecoveryCodesPanel` correctly calls `completeTotpEnroll(token)` from the Continue button, gated behind the "I have saved" checkbox.
- `/api/auth/totp/confirm` returns a full session JWT via `signSessionToken()`, not a partial token.

**Commit:** b59b3ba — `fix(15): handle totp_enrollment_required in LoginPage, verify complete enrollment flow`

**Tests:** 16 passed (totpEnrollment.test.ts + totpAdmin.test.ts). `npx tsc --noEmit` clean.
