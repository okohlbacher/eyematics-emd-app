# Full Review Summary — EMD v1.7

Reviewers: **Claude (Opus 4.7)** + **Codex**. Gemini aborted (quota exhausted).
Sources: `CLAUDE.md` (31 findings), `CODEX.md` (12 findings). Deduped + ranked below.

Legend: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low · **(C)** cited by Claude, **(X)** cited by Codex

---

## 🔴 CRITICAL (5)

### C1 — View-open audit beacon is unauthenticated (C-F01, X-F03)
`src/components/outcomes/OutcomesView.tsx:170` — raw `fetch('/api/audit/events/view-open', …)` with no Bearer token. `authMiddleware` returns 401 before the handler runs, and `auditMiddleware` SKIP_AUDIT_PATHS suppresses the fallback row. **Phase 11 CRREV-01 audit rows have never been written.**
Fix: swap to `authFetch`; drop `credentials: 'include'`.

### C2 — Phase 14 forced-password-change control is not implemented (X-F01)
Roadmap/PROJECT.md claim SEC-03 is shipped. No `mustChangePassword` field, no `/change-password` route, no UI. Default `changeme2025!` remains usable indefinitely.
Fix: either ship the end-to-end flow or revert the shipped claim in docs.

### C3 — Phase 15 TOTP + recovery codes are not implemented (X-F02)
Milestone/PROJECT.md claim per-user TOTP, QR, recovery codes shipped. Code still uses a shared static `settings.otpCode`. No `totpSecret`/`totpEnabled` on `UserRecord`. LoginPage still hard-caps to 6-digit OTP.
Fix: reconcile docs immediately, then implement or revert.

### C4 — Default `cohortHashSecret` in `config/settings.yaml:11` bypasses length guard (C-F03)
Placeholder `'dev-cohort-hash-secret-please-replace-in-prod-xxxxxxxxxxxxxx'` is 64 chars → passes `length >= 32` check. Any deployment inheriting this ships a **known** HMAC key, enabling rainbow-table reversal of audit cohort hashes.
Fix: auto-generate `data/cohort-hash-secret.txt` like `jwt-secret.txt`; add a known-default denylist.

### C5 — Vite-dev `validateAuth` accepts forged base64 tokens (C-F02)
`server/utils.ts:43` does no signature check. `btoa('{"username":"admin","role":"admin"}')` = admin. `KNOWN_USERS` is hardcoded and drifted from `data/users.json`. Affects `fhirApiPlugin`, dev branches of `issueApi`/`settingsApi`.
Fix: delete dev plugins OR have them share `getJwtSecret()` + `jwt.verify()`.

---

## 🟠 HIGH (7)

### H1 — `isBypass` treats "has all centers" as admin (C-F05)
`server/fhirApi.ts:74-82` — any user assigned to every center silently bypasses filtering. Roster shrinks → over-grant.
Fix: remove superset heuristic; only `role === 'admin'` bypasses.

### H2 — HS256 algorithm pin missing on two `jwt.verify()` sites (X-F04)
`server/authMiddleware.ts:59` and `server/authApi.ts:180-187` lack `{ algorithms: ['HS256'] }`. Algorithm confusion attack surface.
Fix: add explicit allowlist; add negative tests.

### H3 — Dev `/api/settings` GET leaks raw secrets to non-admin (X-F05)
`server/settingsApi.ts:236-242` — Vite plugin path returns `readSettings()` verbatim, skipping the admin redaction that the production router does.
Fix: reuse the same redaction in the plugin.

### H4 — `/api/settings` missing from audit `REDACT_PATHS` (C-F11)
`server/auditMiddleware.ts` — settings PUT body (YAML containing `otpCode`/`cohortHashSecret`) gets stored in audit DB.
Fix: add `/api/settings` to `REDACT_PATHS`; redact keys matching `/secret|password|otp|token/i` recursively (also addresses C-F20).

### H5 — Cold-start write-path fails until bundles cache warms (X-F06)
`server/dataApi.ts:49` — `validateCaseCenters()` uses an empty case-to-center map until first `/api/fhir/bundles` request. Early writes → 403.
Fix: warm `getCachedBundles()` in `server/index.ts` startup.

### H6 — Audit `fromTime`/`toTime`/`body_search` input validation (C-F06)
`server/auditDb.ts:264-271, 288-291` — no ISO-8601 regex, no length cap on `%`-wildcarded LIKE → surprising scans / DoS vector.
Fix: validate at route boundary in `auditApi.ts`; cap `body_search` ≤ 128 chars; escape `%`/`_`.

### H7 — SettingsPage claims save success before promise resolves (X-F10)
`src/pages/SettingsPage.tsx:62-125` — calls `updateSettings()` without awaiting, immediately shows "saved" banner. Persistence errors silently swallowed.
Fix: await; surface failures; banner only on resolve.

---

## 🟡 MEDIUM (8)

### M1 — PROJECT.md ↔ STATE.md ↔ ROADMAP.md milestone status drift (C-F12, X-F11)
PROJECT.md says v1.7 in progress; STATE.md + ROADMAP.md say shipped.
Fix: update PROJECT.md to reflect v1.7 shipped + v1.8 active.

### M2 — `data/*.db*` and `data/users.json` tracked in git (C-F13)
`git status` shows modified binaries. Bcrypt hashes + per-developer audit state get committed.
Fix: `.gitignore` + `git rm --cached`; rely on runtime seeding.

### M3 — `extractPatientCases` still O(N·M) despite PERF-01 claim (X-F07)
`shared/patientCases.ts:55` — repeated `filter()` inside `patients.map(...)`.
Fix: build subject-indexed maps once.

### M4 — `updateAuthConfig` doesn't re-init `hashCohortId` / aggregate cache (C-F08)
Admin rotating `cohortHashSecret` via UI → stale secret until restart. Aggregate cache not invalidated.
Fix: call `initHashCohortId(parsed)` + clear aggregate cache in `settingsApi.ts:148`.

### M5 — `sendError` logs full error object (may include secrets) (C-F07)
`server/utils.ts:89-100` — YAML parse errors for settings PUT leak body to stderr.
Fix: redact message; prefer `err.name` + truncated stack.

### M6 — JWT 10-min lifetime coincides with inactivity timer; no refresh (C-F15)
Active user loses session at exactly 10 min; no `/logout` audit row.
Fix: 30-min JWT + sliding refresh; explicit `/api/auth/logout`.

### M7 — Keycloak UI is a stub, but `provider=keycloak` disables local login (X-F08)
`server/authApi.ts:93-99` blocks local login; `LoginPage.tsx:99` only shows an info button. Flipping the flag locks users out.
Fix: block `provider=keycloak` until redirect flow ships (aligns with v1.7 deferral).

### M8 — Duplicated mapping / lastLogin logic (C-F17, C-F18)
`authApi.ts:153-158 & 228-232` (lastLogin), `dataApi.ts:73-81 & 141-154` (quality-flag row↔client).
Fix: extract helpers.

---

## ⚪ LOW (10)

L1 — `fhirLoader` re-exports shim keeps two import chains alive (C-F04)
L2 — `decodeJwtPayload` doesn't validate role enum (C-F09)
L3 — `AdminPage` uses `alert()` for errors (C-F10)
L4 — `AuditPage` 7 useState → useReducer (C-F31)
L5 — `MAX_EXPORT_ROWS=100k` silently truncates (C-F22)
L6 — `fhirApi._bundleCache` no TTL (C-F16)
L7 — `console.*` scattered; no log levels (C-F25)
L8 — `fhirLoader.ts:9` header comment says "5 centers" (roster is 7) (X-F12)
L9 — Demo passwords ship in prod bundle via `loginDemoHint` string (C-F28)
L10 — `jwt-secret.txt` mode not re-verified on read (C-F29)

Remaining Claude findings (F-14/F-19/F-20/F-21/F-23/F-24/F-26/F-27/F-30) and Codex F-09 are rolled into the themes above or documented in the raw reviews.

---

## Themes

1. **Documentation materially overstates security posture.** Phase 14 SEC-03 (forced password change) and Phase 15 TOTP/recovery codes are in the roadmap + PROJECT.md as shipped, but no implementation exists. Plus PROJECT.md/STATE.md/ROADMAP.md disagree on v1.7 status.
2. **Audit trail has silent regressions.** View-open beacon never writes rows (C1), `/api/settings` bodies land in the audit DB unredacted (H4), default HMAC secret is a known string (C4).
3. **Dev ≠ Prod auth guarantees.** Dev plugins use an unsigned base64 check (C5) and return unredacted settings to any user (H3).

## Recommended first fix
**C1 (one-line change)** unblocks the primary audit invariant. Then tackle C2/C3/C4/C5 together — they're all "docs claim X, code does Y" with real security impact.
