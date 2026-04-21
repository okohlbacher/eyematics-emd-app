---
status: complete
phase: 15-totp-2fa
source: [15-01-SUMMARY.md, 15-02-SUMMARY.md, 15-03-SUMMARY.md, 15-04-SUMMARY.md]
started: 2026-04-20T00:00:00.000Z
updated: 2026-04-21T10:50:00.000Z
---

## Current Test

number: 12
name: All tests complete
expected: All 12 tests passed.
awaiting: done

## Tests

### 1. Unenrolled user sees TotpEnrollPage on login
expected: |
  Log in with a user that has no totpEnabled flag in data/users.json
  (e.g. admin or a freshly created user). After entering credentials,
  instead of reaching the dashboard you should see a full-page
  interstitial with: amber Shield icon, heading "Set Up Two-Factor
  Authentication" (EN) or "Zwei-Faktor-Authentisierung einrichten" (DE),
  a QR code image, a "Can't scan?" / "Manuelle Eingabe" collapsible, and
  a 6-digit code input field. No dashboard nav, no sidebar.
result: pass

### 2. QR code scans in authenticator app + manual key visible
expected: |
  On the TotpEnrollPage, the QR code image is rendered (not broken).
  Expanding "Can't scan?" reveals a monospace string — the manual TOTP
  key. Opening Google Authenticator or Authy and scanning the QR (or
  entering the manual key) adds an entry labelled "EyeMatics:<username>"
  with a rotating 6-digit code.
result: pass

### 3. Valid TOTP code confirms enrollment → RecoveryCodesPanel
expected: |
  Enter the current 6-digit code from the authenticator app and click
  "Activate Two-Factor Authentication". The QR page is replaced by the
  Recovery Codes panel showing exactly 10 codes in a 2-column grid
  (format XXXX-XXXX), an amber warning banner, a "Copy all codes" button,
  a "Download as .txt" button, a checkbox, and a greyed-out "Continue"
  button.
result: pass

### 4. Recovery codes: copy and download work
expected: |
  Clicking "Copy all codes" writes 10 newline-separated codes to the
  clipboard; the button briefly shows "Copied!" feedback.
  Clicking "Download as .txt" triggers a browser download of
  "recovery-codes.txt" containing exactly 10 lines (one code per line).
result: pass

### 5. Continue button gated by checkbox
expected: |
  The "Continue" button remains disabled and unclickable as long as the
  "I have saved these codes somewhere safe" checkbox is unchecked.
  Checking the checkbox enables the button immediately.
result: pass

### 6. Checking checkbox + Continue → dashboard (not login page)
expected: |
  After checking the checkbox and clicking Continue, the normal app loads
  at the landing/dashboard page. You should NOT be sent back to the login
  page. The enrolled user's name/role is shown in the header as expected.
result: pass

### 7. Enrolled user logs in with TOTP code
expected: |
  Log out and log back in with the same user. After entering credentials
  you are prompted for a 2FA code (not redirected to TotpEnrollPage).
  Entering the current 6-digit TOTP code from the authenticator app
  succeeds and you reach the dashboard.
result: pass

### 8. Recovery code accepted once and burned
expected: |
  Log out and log in again. At the 2FA prompt enter one of the 10 saved
  recovery codes (9-char format XXXX-XXXX). Login should succeed.
  Attempting to use the same code a second time should fail (the code is
  burned after first use). The remaining 9 codes should still work.
result: pass

### 9. Admin sees Reset 2FA button for enrolled users only
expected: |
  Log in as admin and visit /admin (User Management). Find the user who
  just enrolled TOTP. Their row should show a "Reset 2FA" button with an
  amber ShieldOff icon, positioned before the Delete button in the
  actions cell. A user who has never enrolled (totpEnabled not set) should
  NOT show a Reset 2FA button.
result: pass

### 10. Admin reset forces re-enrollment
expected: |
  Click "Reset 2FA" for the enrolled user. A confirm dialog appears:
  "Reset 2FA for <username>? They will be required to re-enroll on next
  login." Click OK. The table refreshes and the Reset 2FA button
  disappears for that user. Log out; log in as the reset user — the
  TotpEnrollPage should appear again (re-enrollment forced), not the 2FA
  code prompt.
result: pass

### 11. German i18n strings on enrollment page
expected: |
  Switch language to DE (globe icon on login page). Log in as an
  unenrolled user. Verify the TotpEnrollPage shows German strings:
  heading "Zwei-Faktor-Authentisierung einrichten", subtitle beginning
  with "Scannen Sie", button "Zwei-Faktor-Authentisierung aktivieren",
  and the collapsible label "Manuelle Eingabe anzeigen".
result: pass

### 12. Audit log shows TOTP events with secrets redacted
expected: |
  As admin, visit /audit. After performing the enrollment, recovery-code
  login, and admin reset steps above, you should see entries for
  totp-enrolled, totp-recovery-used, and totp-reset. Any totpSecret or
  enrollToken fields in those log entries should appear as [REDACTED],
  not as the actual values.
result: pass

## Summary

total: 12
passed: 12
issues: 0
skipped: 0
pending: 0

## Gaps

[none yet]
