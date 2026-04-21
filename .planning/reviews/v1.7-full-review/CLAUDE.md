# Review: Claude (Opus 4.7) — EMD app v1.7 full review

Scope reviewed: `server/**` (all 20 files), `src/context/**`, `src/services/**`, `src/pages/{App,AdminPage,LoginPage,AuditPage,SettingsPage,OutcomesView}`, `src/components/outcomes/OutcomesView.tsx`, `.planning/PROJECT.md`, `.planning/STATE.md`, `config/settings.yaml`, `package.json`, `eslint.config.js`.

Note: no `.planning/REQUIREMENTS.md` exists at the top level (only per-milestone `milestones/v1.*-REQUIREMENTS.md`). Formal EMDREQ-* / K01–K11 traceability lives in `docs/Pflichtenheft.md`. The dimension-8 findings below cite PROJECT.md + docs/Pflichtenheft.md since that is the de facto requirements surface.

---

## Critical (3 findings)

### F-01 Audit view-open beacon is unauthenticated — every view-open is silently rejected as 401
- **File:** src/components/outcomes/OutcomesView.tsx:170-178
- **Problem:** The beacon uses raw `fetch('/api/audit/events/view-open', …)` with no `Authorization: Bearer` header. `server/authMiddleware.ts:157-161` requires a Bearer token on every `/api/*` route except the three `PUBLIC_PATHS`. The beacon handler (`server/auditApi.ts:149`) is inside `auditApiRouter` mounted at `/api/audit`, which is authenticated. Consequence: every Phase 11 CRREV-01 "view-open" beacon fires, is rejected at the middleware with 401, and the handler that writes the HMAC-hashed cohort row **never runs**. The per-view audit row documented in PROJECT.md ("Validated in v1.5 — Audit beacon on outcomes view open") is not actually being written in production. Because the auditMiddleware SKIP_AUDIT_PATHS set short-circuits on this path before the 401 is even captured, there is also no fallback row.
- **Fix:** Replace raw `fetch` with `authFetch` from `src/services/authHeaders.ts` (the same pattern every other page uses). Drop `credentials: 'include'` — JWTs travel in the header, not a cookie.

### F-02 Vite-dev `validateAuth` accepts forged tokens — full auth bypass in dev and any test harness that uses Vite plugins
- **File:** server/utils.ts:43-72 (definition); server/fhirApiPlugin.ts:31, server/issueApi.ts:132, server/settingsApi.ts:210/238/249
- **Problem:** `validateAuth` decodes a base64-encoded JSON token and trusts any `{ username, role }` that matches the hard-coded `KNOWN_USERS` table (utils.ts:75-83). There is no signature check — anyone can craft `btoa('{"username":"admin","role":"admin"}')` and obtain admin in dev mode. The file's own comment (line 41) concedes this: *"In production, use signed JWTs or server-side sessions."* The Vite dev plugins (`fhirApiPlugin`, `issueApiPlugin` dev branch, `settingsApiPlugin` dev branch) are the only auth guard during `npm run dev` — so a developer running dev with `npm run dev` has no real authentication. Additionally `KNOWN_USERS` has drifted from `data/users.json` / `initAuth` — it cannot detect admin-added users, and admins created via AdminPage will be rejected in dev.
- **Fix:** Either (a) delete the Vite dev plugins entirely and require `npm run start` for any non-public access (recommended — production server already handles JWT), or (b) have the dev plugins share `getJwtSecret()` + `jwt.verify()` from `initAuth.ts` so both paths use the same validation. The hard-coded `KNOWN_USERS` allowlist must go regardless.

### F-03 Default `cohortHashSecret` shipped in repo is a real, usable secret
- **File:** config/settings.yaml:11
- **Problem:** `cohortHashSecret: 'dev-cohort-hash-secret-please-replace-in-prod-xxxxxxxxxxxxxx'` is exactly 64 chars, so `hashCohortId.initHashCohortId` (`server/hashCohortId.ts:28-32`) passes the `length < 32` guard and happily uses it. Any deployment that inherits this file without editing it ships a known, public HMAC key — meaning anyone can compute cohortHash-to-cohortId rainbow tables for the 7-center roster and reverse the `cohortHash` values stored in `audit.db`. This defeats the Phase 11 CRREV-01 PII mitigation. Also the fail-fast length guard (`< 32`) is too permissive for a 256-bit HMAC key.
- **Fix:** (1) At startup, reject any secret in a small "known default" denylist and fail closed. (2) Auto-generate the secret on first launch the same way `jwt-secret.txt` is generated in `initAuth.ts:60-69`, and persist to `data/cohort-hash-secret.txt` with mode `0o600`, then reference it from settings.yaml only as a pointer (or drop it from settings.yaml entirely). (3) Raise the minimum length to 64 chars (256-bit hex) and log a warning if the value looks like the shipped placeholder.

---

## High (8 findings)

### F-04 `fhirLoader` re-exports `extractPatientCases`/`applyFilters` from `shared/`, but `OutcomesView.tsx:19` imports from the same service — meanwhile `outcomesAggregateApi.ts:31` imports directly from `shared/patientCases`. Mixed import graph.
- **File:** src/components/outcomes/OutcomesView.tsx:19 vs server/outcomesAggregateApi.ts:31 vs src/services/fhirLoader.ts:15
- **Problem:** Two parallel import chains for the same function. `shared/patientCases.ts` is the canonical source per Phase 12 AGG-02 ("shared/ module extracted"). Client code should import from `shared/` directly. The `fhirLoader.ts` re-export shim is described in comments as "backward compatibility" but new code (Phase 16 OutcomesView) still uses the shim, keeping it alive. Byte-parity tests exist for server/client math, but the extra layer invites drift.
- **Fix:** Remove the `export *` re-exports in `src/services/fhirLoader.ts:13-15` and migrate the remaining call-sites (AnalysisPage, CohortBuilderPage, OutcomesView) to import from `../../shared/patientCases`. Leaves `fhirLoader.ts` responsible only for HTTP bundle loading and center-shorthand caching.

### F-05 `isBypass` treats "has all configured centers" as admin — unsafe when center roster shrinks
- **File:** server/fhirApi.ts:74-82
- **Problem:** The bypass check returns true when `centers` is a superset of all `getValidCenterIds()`. But centers are mutable (admin can edit `data/centers.json`, and `_migrateRemovedCenters` in `initAuth.ts:277-295` actively rewrites them). If a site reduces its roster from 7 to 3, users previously assigned to the original 7 now automatically bypass all filtering — silently granting admin-level data access. There is no audit event when a user transitions from scoped to bypass.
- **Fix:** Remove the "all centers == admin bypass" heuristic. The intent (from PROJECT.md key decision list) is that only role=admin bypasses; the superset check is a legacy shortcut. Keep `if (role === 'admin') return true;` and drop the remaining loop. If some non-admin power users need global view, give them an explicit `global_viewer: true` flag on the user record.

### F-06 Audit database: `status_gte` filter has no upper bound and missing input validation for `fromTime`/`toTime` allows cross-user timestamp fishing via UNION-safe LIKE
- **File:** server/auditDb.ts:264-271 (`fromTime`, `toTime`) and 288-291 (`body_search`); server/auditApi.ts:66-72
- **Problem:** `filterFromTime` and `filterToTime` are written straight into the query with no format validation — any string is accepted, so `fromTime=abc` yields a WHERE that SQLite treats as text comparison, producing surprising result sets. `body_search` is concatenated with `%` wildcards against both `body` and `query` columns — admin-only, but it still allows arbitrary full-text search over redacted body bodies (which can still contain center IDs / cohort hashes). Non-admins get auto-scoped via `filters.user = req.auth!.preferred_username` (auditApi.ts:76-78) — good — but there is no defence against `body_search` passing a huge LIKE pattern that triggers a full table scan DoS.
- **Fix:** (a) ISO-8601 regex validate `fromTime`/`toTime` at the route boundary in `auditApi.ts:49-50`. (b) Limit `body_search` to e.g. 128 chars and reject `%`/`_` input (escape instead). (c) Reject `status_gte` outside `[100, 599]`. (d) For non-admins, gate `body_search` off entirely since their own rows already contain their own context.

### F-07 `sendError` in utils.ts logs internal error details including full Error — may leak secrets into stderr / audit log pipelines
- **File:** server/utils.ts:89-100; callers at settingsApi.ts:243/262/267, issueApi.ts:151, fhirApiPlugin.ts:72/92
- **Problem:** `console.error(`[server] ${publicMessage}:`, internalError)` logs the full error object. For settings write failures, this can include the full YAML body (which carries `cohortHashSecret` and `otpCode`) in the thrown error's message when js-yaml fails. Many deployment log aggregators (Docker stdout → central syslog) treat stderr as user-viewable. The redaction in `auditMiddleware.redactBody` covers the audit DB but not the stderr stream.
- **Fix:** Redact `internalError.message` before logging — strip anything matching `otpCode:`, `cohortHashSecret:`, `password`, `Bearer\s+\S+`. Better: log only `err.name` + `err.stack` truncated, never the message.

### F-08 `updateAuthConfig` re-reads settings after write but doesn't re-init `hashCohortId` or `outcomesAggregateCache` — stale secrets / TTLs persist
- **File:** server/settingsApi.ts:148; server/initAuth.ts:121-127
- **Problem:** Admin updates settings.yaml → `updateAuthConfig(parsed)` is called (settingsApi.ts:148). This refreshes `twoFactorEnabled`, `maxLoginAttempts`, `otpCode`. But `hashCohortId` secret and `outcomes.aggregateCacheTtlMs` are not re-read. Any admin rotating the cohort hash secret via the UI will silently continue using the old secret until process restart — and can think they've closed IN-01 when they haven't. FHIR cache is invalidated (`invalidateFhirCache`), but the aggregate cache is not — entries computed against the old cohort filters will still be served.
- **Fix:** Add `initHashCohortId(parsed)` and `initOutcomesAggregateCache(parsed)` calls right after `updateAuthConfig` in settingsApi.ts:148. Also call `_resetForTesting`-equivalent on the aggregate cache (or add a public `clear()` export) so stale entries don't survive the rotation.

### F-09 `decodeJwtPayload` in AuthContext trusts server-signed claims but `atob` will throw on malformed padding — UI reads `payload.role` without validating against enum
- **File:** src/context/AuthContext.tsx:72-92
- **Problem:** `userFromToken` accepts any string for `role` and casts to `UserRole`. If the server issues a role not in the 6-role enum (e.g. future `super_admin`), the UI shows it and makes routing decisions (`App.tsx:37 QualityRoute`, `App.tsx:30 AdminRoute`) against an unknown role that silently fails the `.includes()` check — user gets redirected to "/" with no diagnostic. Also the comment at 66-71 correctly notes this is cosmetic — but then the inactivity timer, `hasRole`, and route guards all rely on the client-decoded role. That is fine only because the server re-validates JWT on every API call; make that invariant explicit.
- **Fix:** Validate `payload.role` against the `UserRole` string-literal set; return `null` for unknown roles (forces re-login). Add a top-of-file banner comment restating the invariant: "All authz is server-enforced; this payload is UI-render only."

### F-10 `AdminPage` uses `alert()` for server errors — bypasses i18n + accessibility + testability
- **File:** src/pages/AdminPage.tsx:240, 288
- **Problem:** Two raw `alert(err.error ?? 'Failed to create user')` calls surface server-returned English strings to German users, are unstyled, block the event loop, and cannot be asserted in RTL tests. Every other page uses inline banners (`SettingsPage savedBanner`, `AuditPage error state`).
- **Fix:** Replace with an inline error state banner driven by `t('adminCreateError')` / `t('adminUpdateError')` + a detail field for the server's raw message. Add translations.

### F-11 `redactBody` parses then re-serialises user-submitted JSON — one-way mutation risk for non-auth routes
- **File:** server/auditMiddleware.ts:67-82
- **Problem:** For paths NOT in `REDACT_PATHS` the body is `JSON.stringify(body)` — but `body` may be an object, a string, or undefined. The `tryParseJson` fallback (line 95-101) converts `_capturedBody` from a raw string (e.g. YAML text from `/api/settings` PUT) into… a string again on parse failure. That's fine for settings, but for an unknown future endpoint that accepts text/plain, the audit log will store the whole payload including potentially any secret it carries. Currently only `/api/settings` uses text — and admin settings can contain `otpCode` / `cohortHashSecret`. Those are not in `REDACT_PATHS`.
- **Fix:** Add `/api/settings` to `REDACT_PATHS` and extend the redaction to walk YAML strings too (simple regex on `otpCode:` / `cohortHashSecret:`). Alternatively, redact any value under keys matching `/secret|password|otp|token/i` at any depth.

---

## Medium (11 findings)

### F-12 Doc drift: PROJECT.md says "Milestone v1.7 — In Progress", STATE.md says "v1.7 closed"
- **File:** .planning/PROJECT.md:102 vs .planning/STATE.md:6-7,49
- **Problem:** PROJECT.md line 102 claims v1.7 in progress with Phase 16 complete and "4 human UAT items pending"; STATE.md says v1.7 closed, phase 17 complete, and v1.8 planning. A reader running `/gsd-transition` tooling will hit the wrong branch depending on which doc loads first.
- **Fix:** Update PROJECT.md §Current State and §Active to reflect Phase 17 complete + v1.7 shipped, then list v1.8 (Keycloak OIDC) as the new active work. Add phase 17 bullet to "Validated in v1.7" list.

### F-13 `data/audit.db`, `data/users.json`, `data/audit.db-shm`, `data/audit.db-wal` appear in `git status` — audit DB being committed to repo
- **File:** git status shows `M data/audit.db`, `M data/audit.db-shm`, `M data/audit.db-wal`, `M data/users.json`
- **Problem:** Binary SQLite files are tracked by git. Every developer's audit events (including dev-mode password attempts, IP-address-less session data, and HMAC-hashed cohort ids under a possibly-default secret) get committed. `users.json` contains bcrypt hashes — not catastrophic but pointless to version.
- **Fix:** Add `data/*.db*` and `data/users.json` to `.gitignore`, `git rm --cached` the tracked files, seed them at runtime (seeding logic already exists in `server/index.ts:102-114`).

### F-14 Self-delete guard compares lowercase but case on disk may differ
- **File:** server/authApi.ts:378-382 vs 344 (username trimming on create)
- **Problem:** Self-delete guard lowercases both sides; fine. But `POST /users` stores `username.trim()` as-is (mixed case), and the subsequent find uses `.toLowerCase()`. So usernames stored as `Admin` and attempted as `admin` collide. Login already lowercases (line 108), so this is consistent — but `getQualityFlags(username)` in `dataDb.ts` uses raw username as a primary key, case-sensitive. A user who logs in as `ADMIN` vs `admin` (both hitting the same user record) gets two different per-user stores.
- **Fix:** Normalize once: lowercase `username.trim().toLowerCase()` at user-creation time in `authApi.ts:331` and re-key existing rows on migration. Or expose a `canonicalUsername` helper and use it everywhere `preferred_username` is used as a data-DB key.

### F-15 Token refresh absent — 10-minute JWT + 10-minute inactivity timer are coupled badly
- **File:** server/authApi.ts:65 (`expiresIn: '10m'`); src/context/AuthContext.tsx:63 (`INACTIVITY_TIMEOUT = 10 * 60 * 1000`)
- **Problem:** JWT and inactivity timer both tick 10 min. A user working continuously will hit JWT expiry at exactly the same moment they hit the inactivity warning — the first API call after minute 10 returns 401, `authFetch` wipes the session and redirects to login even though the user was actively working. There is no refresh-token flow (K10 N01 session management requirement). The auto-logout audit event is also lost since the client wipes the token before any /logout call.
- **Fix:** (a) Issue JWT with a 30-min lifetime; keep inactivity timer at 10 min; have the server issue a sliding refresh on `/api/auth/verify-token` or via a response header rotation. (b) Emit an explicit `POST /api/auth/logout` that the client hits before clearing sessionStorage so the audit row is captured.

### F-16 `fhirApi.getCachedBundles` cache never expires or refreshes — stale data on Blaze source
- **File:** server/fhirApi.ts:368-376
- **Problem:** The module-level `_bundleCache` is populated once per process. The only invalidation path is `invalidateFhirCache()` called from settingsApi on settings write (line 60-63). A Blaze data source updated with new patients will not be reflected until a settings write or process restart. There is no TTL and no force-refresh endpoint.
- **Fix:** Add a TTL (e.g. 5 min) to the cache entry, or expose `POST /api/fhir/refresh` admin-only. Document the current behaviour if intentional.

### F-17 Duplicated `lastLogin` update logic between /login and /verify
- **File:** server/authApi.ts:153-158 and 228-232
- **Problem:** Two copies of the `modifyUsers((u) => u.map(r => … lastLogin …))` block, identical except for variable name. Easy to drift.
- **Fix:** Extract `await updateLastLogin(username)` helper in initAuth.ts.

### F-18 Duplicated camelCase↔snake_case mapping for quality flags
- **File:** server/dataApi.ts:73-81 (GET) and 141-154 (PUT response)
- **Problem:** The same mapping from `QualityFlagRow` to client shape appears twice in the same file, 70 lines apart. Next column addition will miss one site.
- **Fix:** Extract `rowToClient(f)` + `clientToRow(f, existing)` helpers at top of file.

### F-19 `QualityCaseDetail`/`DocQualityPage`/`CaseDetailPage` — per-file `EMDREQ-` references predate current Pflichtenheft line numbers
- **File:** grep found EMDREQ-* references in 14 source files (see Grep result); spot-checked `src/context/AuthContext.tsx:7-10` (K10 N10.01) and `src/context/DataContext.tsx:136` (EMDREQ-QUAL-008)
- **Problem:** No guarantee the EMDREQ-QUAL-008 tag in DataContext.tsx:136 matches today's docs/Pflichtenheft.md. The Pflichtenheft is version 1.4 dated 2026-04-11 (per docs/Pflichtenheft.md:8-9); any renumbering since goes undetected.
- **Fix:** Add a test (mirroring the roster canary test in Phase 10) that greps `src/` for `EMDREQ-*` and asserts each ID is present in `docs/Pflichtenheft.md`. Run in CI.

### F-20 `REDACT_FIELDS` is a shallow Set — nested `challengeToken` in a wrapper object is not redacted
- **File:** server/auditMiddleware.ts:58, 75-80
- **Problem:** The sanitizer does a single-level spread and only checks top-level keys. A request body like `{ auth: { password: 'p' } }` (not currently used, but possible in future handlers) would store the password verbatim.
- **Fix:** Walk the object recursively; cap recursion at e.g. depth 5; redact by key name at every level.

### F-21 OutcomesView.tsx useEffect disables exhaustive-deps for the audit beacon — if searchParams changes mid-mount the beacon is stale
- **File:** src/components/outcomes/OutcomesView.tsx:179
- **Problem:** `// eslint-disable-line react-hooks/exhaustive-deps` suppresses the warning that `searchParams` should be a dep. React strict mode double-renders the effect, so in dev the beacon fires twice — producing duplicate audit rows. Comment says "once per mount" but the real intent is "once per cohort change".
- **Fix:** Either `[]` is truly intended (then document that cohort param changes don't re-beacon) or include `[searchParams]`. Also add a ref-guard to dedupe double-mount beacons.

### F-22 `MAX_EXPORT_ROWS = 100_000` in auditDb.ts:222 is silently truncating
- **File:** server/auditDb.ts:217-236
- **Problem:** `queryAuditExport` silently caps at 100 000 rows. Admin exporting a 2-year audit trail at moderate traffic will hit this, get a truncated file, and have no indication. The response from `/api/audit/export` (auditApi.ts:114) sets no `X-Truncated` header.
- **Fix:** Return `X-Total-Count` + `X-Truncated: true/false` headers. If truncated, also return the timestamp of the oldest row included so the admin can paginate.

---

## Low (9 findings)

### F-23 `dist/` directory committed previously? Check `.gitignore` vs build artefacts.
- **File:** /Users/kohlbach/Claude/EyeMatics-EDM-UX/emd-app (root)
- **Problem:** `ls` shows `dist/` as a sibling of `src/`. If this was a build output it should be in `.gitignore`.
- **Fix:** Verify `.gitignore` contains `dist/` and that no commit includes it.

### F-24 Hardcoded fallback in `fhirLoader.ts:77-85` is the v1.0 roster — not what `getCenterShorthand` falls back to if server `/api/fhir/centers` fails
- **File:** src/services/fhirLoader.ts:77-85
- **Problem:** The default `_centerShorthands` map is the correct 7-center v1.5 roster. But comments + PROJECT.md refer to this as the "built-in defaults" — it will silently rot if the real roster ever changes. The server has `DEFAULT_CENTERS` in `constants.ts:55-63`; two sources of truth.
- **Fix:** Generate `src/services/fhirLoaderDefaults.ts` from `data/centers.json` at build time, or have `loadCenterShorthands` retry once on failure rather than silently keeping defaults.

### F-25 `console.warn` / `console.log` scattered across server — no log levels
- **File:** server/fhirApi.ts:262/269/290/321/347/405; server/initAuth.ts:68/320/330/340; server/auditDb.ts:106/139
- **Problem:** No pino/winston/levels; operators can't suppress noise or increase verbosity.
- **Fix:** Introduce a thin logger wrapper (e.g. 10-line `server/log.ts` with `{debug,info,warn,error}` and LOG_LEVEL env gate via settings.yaml to follow the project rule "no env vars — settings.yaml only").

### F-26 `server/types.d.ts:1-14` vs `server/authMiddleware.ts:33-41` both augment `Express.Request` — F-17 comment says "single declaration" but there are two
- **File:** server/types.d.ts:5-11 (`_capturedBody`); server/authMiddleware.ts:34-41 (`auth`)
- **Problem:** The code comment in authMiddleware.ts:33 claims "Single declaration — all server files import authMiddleware transitively" but `_capturedBody` lives in a separate ambient `.d.ts`. Consistency matters for future reviewers.
- **Fix:** Merge into `server/types.d.ts` and drop the inline augmentation in authMiddleware.ts.

### F-27 `validateBody` in outcomesAggregateApi.ts:74-101 returns `null` for 10+ distinct failure modes — no telemetry on which validator failed
- **File:** server/outcomesAggregateApi.ts:74-101
- **Problem:** Debugging a client that sends a malformed request requires trial-and-error because the 400 message is "Invalid request body". Comment at line 132 says this is intentional (T-12-01 no enumeration), but for an authenticated endpoint returning a specific field name is not an enumeration risk.
- **Fix:** Return which field failed to authenticated requesters (still cheap to exploit? no — schema is known). Keep the generic message for pre-auth routes only.

### F-28 `i18n/translations.ts:loginDemoHint` exposes demo passwords in prod bundle per STATE.md:64
- **File:** src/i18n/translations.ts (loginDemoHint key); src/pages/LoginPage.tsx:154-158
- **Problem:** STATE.md line 64 explicitly flags this as [Phase 16] CR-01 still open. LoginPage already gates display on `import.meta.env.DEV`, but the translation string itself is statically included in the production bundle — any client with devtools can read the plaintext default passwords from the bundle.
- **Fix:** Replace the string with a runtime placeholder and only populate it when `import.meta.env.DEV` is true. Even simpler: change the demo passwords per-deployment via the first admin migration, not in source.

### F-29 `data/jwt-secret.txt` written with mode 0o600 on creation but file mode not re-verified on subsequent reads
- **File:** server/initAuth.ts:60-69
- **Problem:** If an admin copies the jwt-secret.txt with wrong permissions to another host, the server reads it without checking `fs.statSync(secretFile).mode & 0o077`. A world-readable secret file means any local user can forge JWTs.
- **Fix:** Log a warning (or refuse to start) if mode allows group/other read. Apply same check to the future `cohort-hash-secret.txt` from F-03.

### F-30 `SETTINGS_FILE` computed at module load time from `process.cwd()` — tests that chdir break silently
- **File:** server/constants.ts:105
- **Problem:** `path.resolve(process.cwd(), 'config', 'settings.yaml')` is fixed at import time. Tests that spin up multiple isolated instances cannot point at per-test settings files.
- **Fix:** Make `SETTINGS_FILE` a `getSettingsFile()` function, or allow override via an init call from index.ts.

### F-31 `AuditPage.tsx:97-102` filter state has 7 separate `useState` calls — consolidate into a single reducer
- **File:** src/pages/AuditPage.tsx:97-102
- **Problem:** 7 setters all drive one debounced fetch; a misbehaving state can force the effect to fire more often than needed. Debug-ability is poor.
- **Fix:** `useReducer` with a `{type:'SET_FILTER', key, value}` action, then one effect depending on the whole state object.

---

## Summary

- **Top 3 themes**
  1. **The audit trail has two Phase-11 regressions that defeat the core value** ("tamper-proof audit trail"): F-01 the view-open beacon never authenticates so CRREV-01 hashed-cohort rows are never written, and F-03 a placeholder HMAC secret in `config/settings.yaml` is long enough to satisfy the startup guard — sites that forget to rotate it ship a known HMAC key.
  2. **Dev vs prod auth are different code paths with incompatible guarantees.** F-02 Vite dev plugins rely on `validateAuth` which accepts any base64-forged token against a hardcoded user table — the file literally admits "In production, use signed JWTs". Any pen-test running against a dev harness will break in. The hardcoded `KNOWN_USERS` table has also drifted from `data/users.json`.
  3. **Doc/code drift is normalising.** PROJECT.md still says v1.7 is in progress while STATE.md declares it shipped (F-12). `data/*.db*` tracked in git (F-13). The `fhirLoader`→`shared/` shim keeps a second import chain alive (F-04). `REDACT_PATHS` doesn't cover `/api/settings` even though settings carry `cohortHashSecret`+`otpCode` (F-11).

- **Most important fix**
  **F-01 + F-03 together.** Wire the view-open beacon through `authFetch` (one-line change) and auto-generate `cohortHashSecret` to `data/cohort-hash-secret.txt` the same way `jwt-secret.txt` is handled — then the Phase-11 PII mitigation actually works in practice, and the default settings.yaml can't accidentally ship a real secret. Everything else is containable; these two are silent compromises of a core published invariant.
