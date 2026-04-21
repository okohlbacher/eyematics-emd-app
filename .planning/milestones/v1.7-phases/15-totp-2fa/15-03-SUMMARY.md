---
phase: 15
plan: 03
subsystem: auth/totp-frontend
tags: [totp, 2fa, enrollment, recovery-codes, frontend, i18n]
requires: [totp-login-gate, totp-enroll-endpoint, totp-confirm-endpoint]
provides: [totp-enroll-page, recovery-codes-panel, totp-auth-context, totp-app-gate, totp-i18n]
affects: [src/context/AuthContext.tsx, src/App.tsx, src/pages/LoginPage.tsx, src/i18n/translations.ts]
tech-stack:
  added: []
  patterns: [mustChangePassword-mirror, full-page-interstitial, enrollment-lifecycle, recovery-codes-panel]
key-files:
  created:
    - src/pages/TotpEnrollPage.tsx
    - src/components/RecoveryCodesPanel.tsx
  modified:
    - src/context/AuthContext.tsx
    - src/App.tsx
    - src/pages/LoginPage.tsx
    - src/i18n/translations.ts
decisions:
  - "Translations use single-object-per-key {de, en} format matching existing codebase — not separate language blocks"
  - "i18n keys added to Phase 15 section at end of translations.ts (grouped, not alphabetical — preserves readability)"
  - "Task 2 committed after Task 3 i18n addition due to TypeScript key-existence check (correct ordering)"
  - "Import sort lint fixed in TotpEnrollPage (lucide before react) and App.tsx (alphabetical pages)"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-17"
  tasks: 3
  files: 6
---

# Phase 15 Plan 03: TOTP Frontend Enrollment Summary

One-liner: AuthContext TOTP lifecycle (3 new functions + 2 new state fields), TotpEnrollPage + RecoveryCodesPanel components mirroring Phase 14 PasswordChangePage pattern, App.tsx enrollment gate, LoginPage OTP length 6→9 for recovery codes, and 21 i18n keys (DE + EN) per UI-SPEC.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend AuthContext with TOTP enrollment state + functions | bd34162 | src/context/AuthContext.tsx |
| 2 | Create TotpEnrollPage + RecoveryCodesPanel components | 719489a | src/pages/TotpEnrollPage.tsx, src/components/RecoveryCodesPanel.tsx |
| 3 | Wire App.tsx gate + LoginPage OTP length + i18n keys | ce7d900 | src/App.tsx, src/pages/LoginPage.tsx, src/i18n/translations.ts |

## New File Sizes

| File | Lines |
|------|-------|
| src/pages/TotpEnrollPage.tsx | 162 |
| src/components/RecoveryCodesPanel.tsx | 114 |

## Modified File Diff Counts

| File | Net change |
|------|-----------|
| src/context/AuthContext.tsx | +77 lines (new state, 3 functions, interface extension, provider value) |
| src/App.tsx | +7 lines (import + gate block) |
| src/pages/LoginPage.tsx | +1 line (maxLength 6→9 + placeholder update) |
| src/i18n/translations.ts | +37 lines (21 i18n keys with DE + EN) |

## Build Output (last 5 lines)

```
dist/index.html                   0.45 kB │ gzip:   0.29 kB
dist/assets/index-BaK3GZZT.css   41.42 kB │ gzip:   8.11 kB
dist/assets/index-DHec801D.js   971.68 kB │ gzip: 273.97 kB

✓ built in 328ms
```

## Test Results

```
 Test Files  51 passed | 1 skipped (52)
      Tests  465 passed | 5 skipped (470)
```
No regressions — same counts as Plan 02 close.

## Implementation Notes

### AuthContext additions (Task 1)
- `requiresTotpEnrollment: boolean` + `pendingEnrollToken: string | null` — exact mirror of `mustChangePassword` + `pendingChangeToken`
- `login()` gate: after `mustChangePassword` check, before `challengeToken` branch — `data.requiresTotpEnrollment && data.enrollToken` → `setRequiresTotpEnrollment(true)`, return `{ ok: false, error: 'totp_enrollment_required', enrollToken }`
- `startTotpEnroll()`: fetches `POST /api/auth/totp/enroll`, refreshes `pendingEnrollToken` from response
- `confirmTotpEnroll(otp)`: fetches `POST /api/auth/totp/confirm`; does NOT clear `requiresTotpEnrollment` yet (waits for checkbox gate)
- `completeTotpEnroll(token)`: clears enrollment flags, writes token to sessionStorage, sets user — activates session
- `performLogout()`: resets all TOTP state alongside existing mustChangePassword reset

### TotpEnrollPage (Task 2)
- Two-phase: `loading` → `scan` → `recovery`
- `useEffect` on mount calls `startTotpEnroll()`, transitions to `scan` on success
- QR `<img>` + collapsible `<details>` for manual key
- OTP input: `maxLength={9}`, `inputMode="numeric"`, `autoFocus`, aria-label
- Error mapping: `jwt expired` / `token_expired` → `totpEnrollErrorExpired`; `confirm_failed` / `invalid_otp` → `totpEnrollErrorInvalid`; otherwise → `totpEnrollErrorGeneric`
- Phase 'recovery': renders `<RecoveryCodesPanel>` inside same card layout

### RecoveryCodesPanel (Task 2)
- Props: `{ codes: string[], token: string }`
- 10 codes in `grid grid-cols-2 gap-2` with `role="list"` / `role="listitem"`
- Copy all: `navigator.clipboard.writeText(codes.join('\n'))` + 2s "Copied!" feedback
- Download: `new Blob([codes.join('\n')], { type: 'text/plain' })` → anchor click → `URL.revokeObjectURL()`
- Checkbox: `id="saved-codes"` / `htmlFor="saved-codes"`, `saved` state starts `false`
- Continue: `disabled={!saved}`, `aria-disabled`, calls `completeTotpEnroll(token)`

### App.tsx (Task 3)
- Gate order: `mustChangePassword` → `requiresTotpEnrollment` → `<Routes>`

### LoginPage.tsx (Task 3)
- OTP input: `maxLength={6}` → `maxLength={9}`, `placeholder="123456"` → `placeholder={t('loginOtpPlaceholder')}`
- No structural change — backend distinguishes TOTP (6-digit) vs recovery codes (9-char XXXX-XXXX) transparently

### i18n (Task 3)
- 21 keys added to `src/i18n/translations.ts` in Phase 15 section
- Each key has both `de` and `en` values in single object (existing codebase pattern)
- All DE strings match UI-SPEC.md Copywriting Contract verbatim

## Downstream Readiness

- **Plan 04** (AdminPage Reset 2FA): `adminResetTotp`, `adminResetTotpConfirm`, `adminResetTotpSuccess` i18n keys already present — Plan 04 only needs to add UI + `handleResetTotp` handler
- **Phase end-to-end**: Plans 01–03 cover all TOTP enrollment flow. Once Plan 04 lands, the full phase is testable end-to-end

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] i18n keys required before Task 2 TypeScript compilation**
- **Found during:** Task 2 verification (tsc check)
- **Issue:** TotpEnrollPage and RecoveryCodesPanel reference 16+ i18n keys that don't exist in translations.ts yet (the TypeScript `t()` function is typed to only accept known keys). Committing Task 2 with zero TS errors required the translations to exist first.
- **Fix:** Added all 21 i18n keys (Task 3 work) before running the Task 2 TypeScript verification. Task 2 was then committed (only the two component files), followed by a separate Task 3 commit (App.tsx + LoginPage.tsx + translations.ts).
- **Impact:** None — all acceptance criteria satisfied; commit order is semantically correct (translations must exist before components that reference them).

**2. [Rule 1 - Fix] Import sort order in TotpEnrollPage.tsx and App.tsx**
- **Found during:** Task 3 lint check
- **Issue:** `simple-import-sort` detected incorrect import ordering in TotpEnrollPage.tsx (lucide after react; components after context) and App.tsx (TotpEnrollPage alphabetically before QualityPage but was placed after PasswordChangePage).
- **Fix:** Reordered imports to match project convention: lucide-react before react, components before context, pages alphabetically.
- **Files modified:** src/pages/TotpEnrollPage.tsx, src/App.tsx
- **Commit:** ce7d900 (App.tsx fix folded into Task 3 commit)

## Known Stubs

None — all components are fully wired to real AuthContext functions and i18n keys. Recovery codes display shows whatever `codes[]` the server returns (no hardcoding). Plan 04 (Admin reset) is the only remaining stub surface (the `adminResetTotp*` keys are present but no UI exists yet for them).

## Threat Surface Scan

No new network endpoints introduced in this plan. Frontend-only changes. Threat mitigations T-15-17 through T-15-22 implemented as planned:
- T-15-17 (enrollToken to localStorage): `pendingEnrollToken` lives in React `useState` only — no `localStorage.setItem` calls in AuthContext or TotpEnrollPage
- T-15-19 (TotpEnrollPage reachable without gate): `if (requiresTotpEnrollment)` in App.tsx — flag is set only by `/login` response parsing, not by any direct URL access
- T-15-21 (enrollToken expiry): `startTotpEnroll` refreshes token from `/enroll` response; error displays `totpEnrollErrorExpired` on JWT expiry
- T-15-22 (session token before enrollment complete): `completeTotpEnroll` is the only path to `sessionStorage.setItem('emd-token', ...)` — called only from RecoveryCodesPanel Continue button

## Self-Check

### Files

- [x] FOUND: src/pages/TotpEnrollPage.tsx
- [x] FOUND: src/components/RecoveryCodesPanel.tsx
- [x] FOUND: src/context/AuthContext.tsx (modified)
- [x] FOUND: src/App.tsx (modified)
- [x] FOUND: src/pages/LoginPage.tsx (modified)
- [x] FOUND: src/i18n/translations.ts (modified)

### Commits

- [x] FOUND: bd34162
- [x] FOUND: 719489a
- [x] FOUND: ce7d900

---
## Self-Check: PASSED
