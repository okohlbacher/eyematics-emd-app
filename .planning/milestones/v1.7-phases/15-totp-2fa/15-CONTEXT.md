# Phase 15: TOTP 2FA - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the shared static `otpCode` (settings.yaml `otpCode: '123456'`) with per-user RFC 6238 TOTP secrets. Each `UserRecord` gains a `totpSecret` (base32-encoded) and a set of bcrypt-hashed one-time recovery codes. The existing static OTP path is preserved as a fallback for users who have not yet enrolled, maintaining backward compatibility during the transition window. An admin can reset any user's TOTP enrollment from the AdminPage.

This phase does NOT change the global `twoFactorEnabled` flag semantics — TOTP is only required when that flag is true. TOTP is per-user within that global gate.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
The user deferred all implementation decisions to Claude. The following represent reasonable defaults for a production clinical security application:

- **D-01: Enrollment trigger** — When `twoFactorEnabled: true` and the user has authenticated (password valid) but `user.totpEnabled` is false: the backend returns `{ requiresTotpEnrollment: true, enrollToken: <3-min JWT, purpose='totp-enroll'> }` instead of the full session token. The frontend renders a full-page enrollment screen (similar to the Phase 14 PasswordChangePage pattern). Enrollment is therefore forced-on-next-login for any user under a twoFactorEnabled=true deployment, rather than voluntary self-service.

- **D-02: Enrollment UI placement** — A full-page `TotpEnrollPage` component (same fullscreen pattern as `PasswordChangePage`) shown when `requiresTotpEnrollment` is detected in login response. Displays: (1) QR code generated via `qrcode` npm package, (2) manual key entry fallback, (3) 6-digit confirmation field. Enrollment is confirmed by the user entering one valid TOTP code. On success: recovery codes screen shown before issuing full session JWT.

- **D-03: Recovery codes** — 10 recovery codes, each 8 alphanumeric chars (e.g., `ABCD-1234`). Shown once after enrollment confirmation in a modal/panel with copy-all and download-as-txt buttons. The user must check a "I have saved my recovery codes" checkbox before the modal can be dismissed. Codes are stored as bcrypt-hashed values in `UserRecord.totpRecoveryCodes: string[]`. Using a recovery code burns it (remove from array). Codes are NOT regeneratable after enrollment — admin must reset and user re-enrolls to get fresh codes.

- **D-04: Admin reset** — AdminPage gains a "Reset 2FA" button (visible only when `user.totpEnabled === true`) in the user row actions. On click: confirm dialog ("This will force {username} to re-enroll on next login"). API: `DELETE /api/auth/users/:username/totp`. Clears `totpSecret`, `totpEnabled`, `totpRecoveryCodes` from the UserRecord. User is NOT logged out of existing sessions (JWTs are stateless) but will be forced to re-enroll on their next login attempt (because the server sees `totpEnabled: false`).

- **D-05: LoginPage OTP step** — The existing `step='otp'` flow in LoginPage is reused. The only change: if the user has `totpEnabled: true`, the 2FA label in the UI uses the existing `login2faTitle` key (already "Authenticator Code" in the i18n). No structural LoginPage change needed — the input field accepts either TOTP codes or recovery codes transparently (backend distinguishes them).

- **D-06: Recovery code usage at /verify** — POST /verify first tries TOTP validation. If that fails, checks if the `otp` value matches any non-burned recovery code (bcrypt.compareSync against each). If recovery code matches: burn it (remove from array), issue session JWT, include `{ recoveryCodeUsed: true }` in response so frontend can warn the user to save new codes (or in this case, note that codes are depleted).

- **D-07: Per-user vs global gate** — `twoFactorEnabled` in settings.yaml stays as the global gate. When `twoFactorEnabled: false`, the 2FA step is skipped entirely (as before). When `twoFactorEnabled: true`, enrolled users use TOTP, non-enrolled users use the static `otpCode` fallback.

- **D-08: New fields on UserRecord** — Add to `UserRecord` interface in `server/initAuth.ts`:
  - `totpSecret?: string` — base32-encoded TOTP secret (absent = not enrolled)
  - `totpEnabled?: boolean` — true only after successful enrollment confirmation
  - `totpRecoveryCodes?: string[]` — bcrypt-hashed recovery codes (burned codes removed)

- **D-09: TOTP library** — Use `otplib@13.4.0` (ESM-compatible, actively maintained). For QR code generation: `qrcode@1.5.4` (generates data URL, no native deps). Both are server-side or build-time; no browser crypto needed.

- **D-10: TOTP window tolerance** — ±1 period (±30s) to account for NTP drift. `otplib` `Authenticator.options.window = 1`.

- **D-11: Enrollment endpoint** — New API routes:
  - `POST /api/auth/totp/enroll` — generates secret + QR URI, returns `{ qrDataUrl, manualKey, enrollToken }` (enrollToken gates the confirmation step)
  - `POST /api/auth/totp/confirm` — verifies submitted TOTP code against pending secret, activates `totpEnabled: true`, generates + returns recovery codes
  - `DELETE /api/auth/users/:username/totp` — admin only, resets TOTP (extends existing userCrud routes)

- **D-12: Audit log entries** — TOTP enrollment confirmed → audit event `totp-enrolled`. TOTP reset by admin → `totp-reset`. Recovery code used → `totp-recovery-used`. These follow the existing `auditMiddleware` pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authentication & Auth API
- `server/authApi.ts` — Current POST /login and POST /verify flow; where twoFactorEnabled gate sits; signSessionToken helper; modifyUsers pattern
- `server/initAuth.ts` — UserRecord interface (must add totpSecret, totpEnabled, totpRecoveryCodes); getAuthConfig; loadUsers; modifyUsers
- `server/authMiddleware.ts` — PUBLIC_PATHS (must add new TOTP enrollment routes)

### Phase 14 Password Change (same pattern to replicate for enrollment)
- `server/authApi.ts` POST /change-password — enrollToken validation pattern; same purpose-check flow
- `src/pages/PasswordChangePage.tsx` — Full-page interstitial pattern to replicate for TotpEnrollPage
- `src/context/AuthContext.tsx` — mustChangePassword state; changePassword() function; same pattern for requiresTotpEnrollment / enrollTotp()

### Frontend Integration Points
- `src/pages/LoginPage.tsx` — Existing step='otp' flow; where to insert requiresTotpEnrollment redirect
- `src/pages/AdminPage.tsx` — User row actions; where to add "Reset 2FA" button + DELETE call
- `src/i18n/translations.ts` — Existing OTP/2FA keys to reuse or extend

### Requirements
- `.planning/REQUIREMENTS.md` — SEC-04 (TOTP RFC 6238 enrollment), SEC-05 (recovery codes bcrypt-hashed, burned on use)

### Test Patterns
- `tests/mustChangePassword.test.ts` — Template for backend TOTP tests (same setup pattern: create temp dir, initAuth, mock users)
- `tests/authMiddlewareLocal.test.ts` — Pattern for testing new purpose-checked JWT paths

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PasswordChangePage.tsx` — Fullscreen interstitial component; TotpEnrollPage should follow the same layout (Lock icon → title → subtitle → form)
- `AuthContext.tsx mustChangePassword + changePassword()` — Exact same pattern for `requiresTotpEnrollment` + `enrollTotp()` state/function
- `authApi.ts POST /change-password` — Purpose-checked JWT validation pattern; enrollToken endpoint replicates this
- `server/userCrud routes` — `DELETE /api/auth/users/:username` exists; add `DELETE /api/auth/users/:username/totp` alongside it

### Established Patterns
- **Full-page interstitial gate**: `if (mustChangePassword) return <PasswordChangePage />` in App.tsx — replicate with `if (requiresTotpEnrollment) return <TotpEnrollPage />`
- **Purpose-checked JWTs**: `purpose: 'change-password'` pattern in Phase 14 — use `purpose: 'totp-enroll'` for enrollment token
- **modifyUsers() for writes**: async, serialized, writes to users.json — use for enrolling and resetting TOTP
- **auditMiddleware redact list**: `REDACT_FIELDS` in auditMiddleware.ts — add `totpSecret`, `enrollToken` to the redact set
- **Recovery codes display**: No existing component for this; new simple list component with copy-all button

### Integration Points
- `server/authApi.ts POST /login` — After Phase 14 mustChangePassword gate, add `requiresTotpEnrollment` gate (same position, same return shape)
- `server/authApi.ts POST /verify` — Replace `otp !== otpCode` static comparison with: if `user.totpEnabled` → TOTP verify via otplib, else → static otpCode fallback
- `src/App.tsx AppRoutes()` — Add `if (requiresTotpEnrollment) return <TotpEnrollPage />` after the mustChangePassword check

</code_context>

<specifics>
## Specific Ideas

- Phase 14 PasswordChangePage pattern is the template for TotpEnrollPage — same fullscreen lock-screen feel, same App.tsx gate mechanism
- Recovery codes display must include a "I have saved my recovery codes" confirmation checkbox before the user can proceed to get their session JWT
- The QR code should use `otpauth://totp/EyeMatics:{username}?secret={base32secret}&issuer=EyeMatics` URI format so authenticator apps show a meaningful label
- `qrcode.toDataURL()` generates a PNG data URL suitable for an `<img>` tag — no file I/O needed

</specifics>

<deferred>
## Deferred Ideas

- Self-service TOTP disable/re-enrollment from user settings page — SEC-07 in REQUIREMENTS.md (Future Requirements), explicitly deferred
- Recovery code regeneration after initial enrollment — deferred for simplicity; admin reset + re-enroll is the recovery path

</deferred>

---

*Phase: 15-totp-2fa*
*Context gathered: 2026-04-17 — all decisions at Claude's discretion*
