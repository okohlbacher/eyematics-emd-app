# Claude Code Review -- EMD Full Review (2026-04-11)

Reviewer: Claude Opus 4.6 (1M context)
Scope: All files in `src/` and `server/` (67 files reviewed)
Branch: `main` at commit `4a134d2`

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 3     |
| HIGH     | 11    |
| MEDIUM   | 19    |
| LOW      | 14    |
| **Total** | **47** |

---

## CRITICAL

### C-01: Dead legacy auth bypass in `server/utils.ts` -- `validateAuth()` uses base64 tokens, not JWTs

- **File:** `server/utils.ts`, lines 43--83
- **Area:** SECURITY
- **Description:** The `validateAuth()` function parses tokens as `base64(JSON)` and checks against a hardcoded `KNOWN_USERS` list with static roles. This is the Vite dev-mode authentication path used by `fhirApiPlugin.ts`, `issueApi.ts` (plugin), and `settingsApi.ts` (plugin). Any user who can craft a `base64({"username":"admin","role":"admin"})` string has full admin access in dev mode. This function does NOT verify JWT signatures -- it is an entirely separate, insecure auth path. The `KNOWN_USERS` list is also frozen at 7 users and does not reflect runtime user management.
- **Impact:** In dev mode, any client can forge admin credentials trivially. If dev mode is ever accidentally exposed (common with `0.0.0.0` binds), this is a full authentication bypass.
- **Fix:** Replace `validateAuth()` with actual JWT verification using `jsonwebtoken.verify()` and the same `getJwtSecret()` used by the production auth middleware. Alternatively, import and reuse the production auth middleware logic.

### C-02: Static OTP code `123456` stored in plaintext in `config/settings.yaml`

- **File:** `config/settings.yaml`, line 4; `server/initAuth.ts`, line 75; `server/authApi.ts`, line 199
- **Area:** SECURITY
- **Description:** The OTP code is a fixed, well-known value (`123456`) stored in plaintext in the config file and compared with a simple string equality check (`otp !== otpCode`). This is not time-based, not per-user, and not rotated. The Pflichtenheft (EMDREQ-USM-005) requires 2FA via OTP but the implementation provides no actual second-factor security -- it is a shared static secret.
- **Impact:** 2FA is effectively theater. Any user who knows or guesses `123456` bypasses the second factor entirely.
- **Fix:** For the demonstrator scope, document this as a known limitation. For production readiness, integrate TOTP (RFC 6238) with per-user secrets using `otplib` or similar.

### C-03: Default password `changeme2025!` hardcoded for all migrated users

- **File:** `server/initAuth.ts`, line 243
- **Area:** SECURITY
- **Description:** When `_migrateUsersJson` runs, any user without a `passwordHash` receives `bcrypt.hashSync('changeme2025!', 12)`. All 7 seeded users (including `admin`) start with this password. There is no forced password change, no password expiry, and no mechanism to detect whether a user has changed from the default. Combined with the fact that the default users are documented and predictable, this means every fresh deployment has a known-credential admin account.
- **Impact:** Any fresh deployment is immediately vulnerable until the admin manually resets all passwords. There is no safeguard.
- **Fix:** Add a `mustChangePassword` flag to `UserRecord`. On login, if the flag is true, return a `password_change_required` response instead of a session token. Set this flag for all migrated users with the default password.

---

## HIGH

### H-01: `fhirApiPlugin.ts` lacks path-traversal protection on manifest entries

- **File:** `server/fhirApiPlugin.ts`, lines 37--49
- **Area:** SECURITY
- **Description:** Unlike the production `fhirApi.ts` (line 260, F-12 check), the Vite dev plugin reads files from `manifest.json` without validating that the resolved path stays within the data directory. A crafted `manifest.json` entry like `../../config/settings.yaml` would leak server configuration.
- **Fix:** Add the same path-traversal check from `fhirApi.ts` line 260: verify `filePath.startsWith(DATA_DIR + path.sep)`.

### H-02: `queryAuditExport()` returns unlimited rows with no pagination

- **File:** `server/auditDb.ts`, lines 208--219
- **Area:** SECURITY / PERFORMANCE
- **Description:** The admin audit export dumps the entire `audit_log` table into memory with no row limit. After months of operation with high traffic, this could produce a multi-gigabyte JSON response, causing OOM or server unresponsiveness.
- **Fix:** Add streaming JSON output (e.g., `better-sqlite3` iterate + `res.write`) or enforce a configurable maximum export size.

### H-03: Race condition in `DataContext.tsx` optimistic updates

- **File:** `src/context/DataContext.tsx`, lines 155--214
- **Area:** CODE QUALITY / CORRECTNESS
- **Description:** All mutation functions (`addQualityFlag`, `updateQualityFlag`, `toggleExcludeCase`, `markCaseReviewed`, `unmarkCaseReviewed`) perform optimistic local state updates and then fire-and-forget the server PUT request. If the server rejects the request (e.g., 403 from center validation), the UI state diverges from the server state permanently until a full reload. The `.catch()` only logs to console.
- **Fix:** On server error, revert the optimistic update by re-fetching the current state from the server, or use a transactional pattern where the UI waits for server confirmation.

### H-04: `AdminPage.tsx` user list response parsed incorrectly

- **File:** `src/pages/AdminPage.tsx`, line 88
- **Area:** CORRECTNESS
- **Description:** The response is typed as `ServerUser[]` but the actual API response from `GET /api/auth/users` is `{ users: ServerUser[] }` (see `authApi.ts` line 276). The `setUsers(data)` call sets the users state to the wrapper object, not the array. This likely causes a runtime error or empty table.
- **Fix:** Change to `const data = await resp.json() as { users: ServerUser[] }; setUsers(data.users);`.

### H-05: `settingsApi.ts` PUT handler reads raw body on an already-consumed stream

- **File:** `server/settingsApi.ts`, lines 86--112
- **Area:** CORRECTNESS
- **Description:** The `settingsApiRouter` is an Express Router. `PUT /api/settings` calls `readBody(req)` which reads the raw Node.js request stream. However, `index.ts` does NOT mount `express.json()` on `/api/settings`. While this means the stream is available, it also means `auditMiddleware` cannot capture `req.body` for settings PUT requests -- the body will only be available via `req._capturedBody` after `readBody()` completes, but the audit middleware's `finish` handler may fire before or during that read. This is fragile and inconsistent with other routes.
- **Fix:** Mount `express.json({ limit: '1mb' })` on `/api/settings` for consistency, or use a `text()` body parser for `text/yaml` content type. Then read from `req.body` instead of `readBody()`.

### H-06: No CSRF protection on mutation endpoints

- **File:** `server/index.ts` (global)
- **Area:** SECURITY
- **Description:** All state-changing API endpoints (POST, PUT, DELETE) rely solely on Bearer token authentication. Since the JWT is stored in `sessionStorage` (not cookies), traditional CSRF via form submission is mitigated. However, `authFetch` in `authHeaders.ts` adds the token from `sessionStorage` to every request, and if an XSS vulnerability exists (see H-07), the token can be extracted and replayed.
- **Fix:** This is acceptable for a demonstrator but should be noted. For production, consider `SameSite` cookie-based tokens or CSRF tokens on mutation endpoints.

### H-07: CSP allows `'unsafe-inline'` for both scripts and styles

- **File:** `server/index.ts`, lines 159--160
- **Area:** SECURITY
- **Description:** The Content-Security-Policy allows `'unsafe-inline'` for both `scriptSrc` and `styleSrc`. This significantly weakens XSS protection -- any injected inline script will execute. While Tailwind CSS may require inline styles, inline scripts should use nonces or hashes.
- **Fix:** Remove `'unsafe-inline'` from `scriptSrc`. Use nonce-based CSP for any necessary inline scripts. `'unsafe-inline'` in `styleSrc` is acceptable for Tailwind but could be tightened with `'unsafe-hashes'` if specific hashes are known.

### H-08: `LoginPage.tsx` client-side attempt counter is bypassable

- **File:** `src/pages/LoginPage.tsx`, lines 37--39
- **Area:** SECURITY / REDUNDANCY
- **Description:** The login page maintains a client-side `attempts` counter and blocks at 5. This is a purely cosmetic check that can be bypassed by refreshing the page (state resets) or calling the API directly. The server-side rate limiting (`rateLimiting.ts`) is the real protection.
- **Fix:** Remove the client-side attempt counter entirely. Rely on the server's 429 response for lockout UX. The current code creates a false sense of security and confuses the lockout logic (client shows "too many attempts" even if the server has not locked the account).

### H-09: Audit log `path` filter uses SQL `LIKE` with unescaped user input

- **File:** `server/auditDb.ts`, line 244
- **Area:** SECURITY
- **Description:** `params['filterPath'] = '%' + filters.path + '%'` -- while the query uses parameterized statements (preventing SQL injection), the `LIKE` pattern wildcards `%` and `_` in the user's input are not escaped. A user could craft a path filter with `%` to match unintended rows, or use `_` as a single-character wildcard. This is a low-severity information disclosure.
- **Fix:** Escape `%` and `_` in `filters.path` before wrapping with `%`: `filters.path.replace(/%/g, '\\%').replace(/_/g, '\\_')`.

### H-10: `server/utils.ts` `readBody()` accumulates string data without encoding validation

- **File:** `server/utils.ts`, lines 12--32
- **Area:** SECURITY
- **Description:** `readBody()` concatenates chunks as `chunk.toString()` (default UTF-8) without verifying `Content-Type` charset. Malformed multi-byte sequences could cause unexpected parsing behavior. The `data += chunk.toString()` pattern also creates intermediate strings on each chunk, which is memory-inefficient for large bodies.
- **Fix:** Use `Buffer.concat()` to accumulate chunks, then decode once at the end. Validate `Content-Type` charset matches expectations.

### H-11: Missing `autocomplete="off"` and `autocomplete="new-password"` on login form

- **File:** `src/pages/LoginPage.tsx`, lines 140--159
- **Area:** SECURITY
- **Description:** The password field does not set `autocomplete="current-password"` or `autocomplete="off"`. Browser password managers may cache credentials for this demonstrator, which handles pseudonymized medical research data.
- **Fix:** Add `autoComplete="off"` to the password input, or per Pflichtenheft security requirements, prevent credential caching.

---

## MEDIUM

### M-01: Duplicated center filtering logic between `fhirApi.ts` and `fhirApiPlugin.ts`

- **File:** `server/fhirApi.ts` lines 107--159; `server/fhirApiPlugin.ts` lines 51--69
- **Area:** REDUNDANCY
- **Description:** The production router has comprehensive center filtering (handles both local bundles and Blaze synthetic bundles with Patient.meta.source cascading). The Vite plugin has a simplified version that only checks Organization entries and uses `return true` for bundles without an Organization entry -- leaking all Blaze synthetic bundle data to any authenticated user regardless of center assignment.
- **Fix:** Extract the filtering logic into a shared function and import it in both files.

### M-02: `loadUsers()` reads from disk on every API call

- **File:** `server/initAuth.ts`, lines 121--130
- **Area:** PERFORMANCE
- **Description:** Every call to `loadUsers()` reads `data/users.json` from disk and parses it. This includes every login attempt, user lookup, and admin operation. For a demonstrator with 7 users this is negligible, but it is architecturally inconsistent with the write-lock pattern in `saveUsers()`.
- **Fix:** Cache the user list in memory (like `_jwtSecret`) and invalidate on write. The `saveUsers()` function already serializes writes -- extend it to update the cache.

### M-03: `DataContext.tsx` `activeCases` computed with `Array.includes()` on every render

- **File:** `src/context/DataContext.tsx`, lines 136--139
- **Area:** PERFORMANCE
- **Description:** `activeCases` is computed as `cases.filter(c => !excludedCases.includes(c.id))`. With `O(n*m)` complexity where `n=cases` and `m=excludedCases`, this becomes slow with large datasets. This is inside `useMemo` but recalculates on every `excludedCases` change.
- **Fix:** Convert `excludedCases` to a `Set` before filtering: `const excluded = new Set(excludedCases); cases.filter(c => !excluded.has(c.id))`.

### M-04: `useCaseData.ts` uses `eslint-disable @typescript-eslint/no-explicit-any` for the `t` parameter

- **File:** `src/hooks/useCaseData.ts`, lines 19--20
- **Area:** CODING STYLE
- **Description:** The `t` parameter is typed as `(key: any) => string` with an ESLint disable comment. This undermines TypeScript's type safety for translation keys throughout the hook.
- **Fix:** Import `TranslationKey` from `i18n/translations` and type `t` as `(key: TranslationKey) => string`.

### M-05: Inconsistent error response format between auth routes and data routes

- **File:** Various server files
- **Area:** CONSISTENCY
- **Description:** Auth routes (`authApi.ts`) return `{ error: string }`. Data routes (`dataApi.ts`) return `{ error: string }`. Issue routes (`issueApi.ts`) return `{ error: string }`. However, the `GET /api/auth/users` endpoint returns `{ users: [...] }` while `GET /api/issues` returns the array directly (no wrapper object). Similarly, audit export returns `[...]` directly while audit query returns `{ entries, total, limit, offset }`.
- **Fix:** Standardize all GET list responses to use a wrapper object pattern: `{ items: [...], total?: number }`.

### M-06: `QualityPage.tsx` calls `getSettings()` synchronously inside `getTherapyStatus()`

- **File:** `src/pages/QualityPage.tsx`, line 37
- **Area:** CORRECTNESS / CONSISTENCY
- **Description:** `getTherapyStatus()` is called for every case inside `useMemo`. Each call invokes `getSettings()` which returns the cached settings or defaults. If `loadSettings()` has not completed (e.g., on first render), default values are used silently. This is technically correct but the function should accept thresholds as parameters rather than reaching into a global singleton.
- **Fix:** Pass `therapyInterrupterDays` and `therapyBreakerDays` as parameters to `getTherapyStatus()` instead of reading from the global settings cache.

### M-07: `server/index.ts` startup comment says "3. initAuth" but the section also seeds `users.json`

- **File:** `server/index.ts`, lines 93--114
- **Area:** DOCS/CODE ALIGNMENT
- **Description:** The section header says "NOTE: initAuth handles users.json creation/migration" but the code immediately below manually seeds `users.json` if absent (lines 102--114). The comment says "The manual users.json seeding block from the original index.ts is removed" -- but it clearly was not removed.
- **Fix:** Update the comment to accurately reflect the current behavior: "Seed a minimal users.json if absent, so initAuth has users to migrate."

### M-08: Missing `delete` confirmation dialog in `AdminPage.tsx`

- **File:** `src/pages/AdminPage.tsx`, line 524
- **Area:** CODE QUALITY
- **Description:** The delete button directly calls `handleDelete()` without any confirmation. Accidental clicks permanently delete user accounts. The translations file has a `removeConfirm` key (`"username" entfernen?`) but it is not used anywhere in the codebase.
- **Fix:** Add a `window.confirm(t('removeConfirm').replace('{username}', u.username))` guard, or better yet, a modal confirmation dialog.

### M-09: `settingsService.ts` `persistSettings()` is fire-and-forget

- **File:** `src/services/settingsService.ts`, lines 78--87
- **Area:** CODE QUALITY
- **Description:** `persistSettings()` calls `authFetch()` with `.catch()` that only logs. If the server rejects the settings (e.g., validation fails in `parseAndValidateYaml`), the client's cached `_cached` value diverges from the server's actual settings permanently.
- **Fix:** Return the promise from `persistSettings` and handle errors in the callers. On failure, reload settings from the server to resync.

### M-10: Hardcoded English strings in several components

- **File:** `src/pages/AdminPage.tsx` line 269 ("User created successfully"), `src/pages/AuditPage.tsx` line 186 ("Export JSON"), line 261 ("Method"), line 265 ("Path"), line 269 ("Status"), `src/pages/LandingPage.tsx` line 129 (`usersAtCenter` is always 0)
- **Area:** CONSISTENCY / REQUIREMENTS
- **Description:** Several UI strings are hardcoded in English despite the app having a full i18n system. This violates the bilingual (de/en) requirement. Additionally, `usersAtCenter` in `LandingPage.tsx` is hardcoded to `0` with a comment "user counts loaded server-side in AdminPage" -- this renders a misleading zero in the UI.
- **Fix:** Move all hardcoded strings to `translations.ts`. Either implement user count per center or remove the column.

### M-11: `SETTINGS_FILE` constant defined twice

- **File:** `server/constants.ts` line 103; `server/index.ts` line 52
- **Area:** REDUNDANCY
- **Description:** `SETTINGS_FILE` path is defined in `constants.ts` as a relative path and in `index.ts` as a resolved absolute path. `fhirApi.ts` and `settingsApi.ts` import from `constants.ts` and resolve it themselves. This creates three places where the path is computed.
- **Fix:** Define the resolved absolute path once in `constants.ts` (or make it a function that accepts the CWD) and import everywhere.

### M-12: `fetchAllPages()` has no timeout or maximum page limit

- **File:** `server/fhirApi.ts`, lines 275--304
- **Area:** PERFORMANCE / SECURITY
- **Description:** When loading from Blaze, `fetchAllPages()` follows `next` links indefinitely. A malicious or misconfigured FHIR server could return infinite pages, causing the server to loop forever and accumulate unbounded memory.
- **Fix:** Add a maximum page count (e.g., 100) and a per-request timeout using `AbortController`.

### M-13: `LandingPage.tsx` always shows `usersAtCenter = 0`

- **File:** `src/pages/LandingPage.tsx`, line 129
- **Area:** DOCS/CODE ALIGNMENT
- **Description:** The landing page table has a "Users" column that always displays `0`. The column header uses the translation key `adminUsersCount`, suggesting it should show actual user counts per center, but the implementation is a hardcoded zero.
- **Fix:** Either fetch and display actual per-center user counts (requires a new API endpoint), or remove the column to avoid displaying misleading data.

### M-14: `issueService.ts` `getIssueCount()` fetches all issues just to count them

- **File:** `src/services/issueService.ts`, lines 45--48
- **Area:** PERFORMANCE
- **Description:** `getIssueCount()` fetches the full issue list (including all metadata) just to return `.length`. With many issues containing large screenshot base64 strings, this transfers unnecessary data.
- **Fix:** The GET endpoint already strips screenshots, but a dedicated count endpoint (`GET /api/issues/count`) would be more efficient. Alternatively, accept the current behavior for the demonstrator scope.

### M-15: `server/index.ts` CSP `connectSrc` is `'self'` only, but Blaze proxy may need external connections

- **File:** `server/index.ts`, line 163
- **Area:** CONSISTENCY
- **Description:** The CSP `connectSrc` is set to `["'self'"]`. If the frontend ever needs to connect to external services (e.g., Keycloak for SSO redirect), the CSP will block those connections.
- **Fix:** When `provider=keycloak`, dynamically add the Keycloak issuer URL to `connectSrc`.

### M-16: `server/auditApi.ts` computes `limit` and `offset` twice

- **File:** `server/auditApi.ts`, lines 52--59 and lines 61
- **Area:** REDUNDANCY
- **Description:** Lines 52--59 compute `limit` and `offset` from query params, then line 61 passes them to `queryAudit()` which re-clamps them internally (auditDb.ts lines 175--176). The clamping logic is duplicated.
- **Fix:** Remove the clamping in `auditApi.ts` and let `queryAudit()` handle it, or vice versa.

### M-17: `DataContext.tsx` `fetchData` silently catches `loadCenterShorthands()` errors

- **File:** `src/context/DataContext.tsx`, line 103
- **Area:** CODE QUALITY
- **Description:** `loadCenterShorthands().catch(() => {})` swallows all errors silently. If the center API is down, the app uses hardcoded fallback shorthands without any user-visible indication that the mapping may be stale.
- **Fix:** At minimum, log the error to console. Consider showing a non-blocking warning banner.

### M-18: `getAge()` does not handle invalid or missing birth dates

- **File:** `src/services/fhirLoader.ts`, lines 100--107
- **Area:** CORRECTNESS
- **Description:** `getAge('')` creates `new Date('')` which is `Invalid Date`. The arithmetic then produces `NaN`, which propagates to age filters, CSV exports, and quality metrics silently.
- **Fix:** Add an early return: `if (!birthDate) return -1;` (or a sentinel value) and handle it in callers.

### M-19: `server/settingsApi.ts` Vite plugin authentication for GET uses non-admin check but returns 401

- **File:** `server/settingsApi.ts`, line 126
- **Area:** CONSISTENCY
- **Description:** The Vite plugin GET handler calls `validateAuth(req)` (no role required) but returns 401 on failure. The PUT handler calls `validateAuth(req, 'admin')` but returns 403. However, the GET handler for an unauthenticated user should also return 401, not 403 -- this is actually correct. But the inconsistency is that the production router GET handler does not check auth at all (it relies on the global `authMiddleware`), while the Vite plugin manually checks. This is correct behavior but the Vite plugin should ideally mirror the production middleware more closely.
- **Fix:** No code change needed, but add a comment explaining why the Vite plugin must explicitly check auth.

---

## LOW

### L-01: Unused imports and unnecessary type assertions

- **File:** `server/fhirApi.ts` line 24 (`import type {} from './authMiddleware.js'`); `server/issueApi.ts` line 22 (same pattern)
- **Area:** CODING STYLE
- **Description:** Several files use `import type {} from './authMiddleware.js'` solely to trigger the `declare global` augmentation. While this works, it is non-obvious and could be replaced with a triple-slash reference directive or a more explicit comment.
- **Fix:** Add a comment: `// Side-effect import: activates Express.Request.auth type augmentation`.

### L-02: `CLINICAL_TERMS_DE` contains a redundant self-mapping

- **File:** `src/utils/clinicalTerms.ts`, lines 40--41
- **Area:** REDUNDANCY
- **Description:** `'Diabetes mellitus Typ 2': 'Diabetes mellitus Typ 2'` maps a German string to itself. This is a no-op in the lookup.
- **Fix:** Remove the self-mapping entries.

### L-03: `ErrorBoundary.tsx` error message always in English

- **File:** `src/components/ErrorBoundary.tsx`, lines 22--25
- **Area:** CONSISTENCY
- **Description:** The error boundary renders "Application Error" and "Reload" in English regardless of the selected locale. Since `ErrorBoundary` is a class component, it cannot use `useLanguage()`.
- **Fix:** Accept locale as a prop or use a context consumer pattern to translate the error UI.

### L-04: `AnalysisPage.tsx` filters parsed from URL without validation

- **File:** `src/pages/AnalysisPage.tsx`, lines 43--47
- **Area:** CODE QUALITY
- **Description:** `JSON.parse(raw)` on URL search params with no schema validation. While this is client-side only and the data is user-controlled, malformed JSON will silently fall back to empty filters.
- **Fix:** Add basic shape validation after parsing.

### L-05: `OctViewer.tsx` image `onError` handler sets empty `src`

- **File:** `src/components/OctViewer.tsx`, lines 80--84
- **Area:** CODE QUALITY
- **Description:** On image load error, `target.src = ''` and `target.className = '...'`. Setting `src` to empty string may trigger another error event in some browsers, causing an infinite loop.
- **Fix:** Use a data URI placeholder: `target.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'`.

### L-06: `AuditPage.tsx` hardcodes `limit=500` in the API call

- **File:** `src/pages/AuditPage.tsx`, line 81
- **Area:** CODE QUALITY
- **Description:** The audit page fetches exactly 500 entries and then applies client-side filtering. For large audit logs, only the most recent 500 entries are ever visible. There is no pagination UI.
- **Fix:** Add server-side filtering (the API supports `fromTime`, `toTime`, `method` params) and a "Load more" / pagination control.

### L-07: `CohortBuilderPage.tsx` gender display uses 'W'/'M' but i18n has 'Female'/'Male'

- **File:** `src/pages/CohortBuilderPage.tsx`, line 539
- **Area:** CONSISTENCY
- **Description:** The cohort table displays `c.gender === 'female' ? 'W' : 'M'` (German abbreviations) regardless of the selected locale. The filter section correctly uses `t('female')` / `t('male')`.
- **Fix:** Use locale-aware abbreviations or the full translated terms.

### L-08: `QualityFlagDialog.tsx` error types are hardcoded in German

- **File:** `src/components/quality/QualityFlagDialog.tsx`, line 16
- **Area:** CONSISTENCY
- **Description:** The `ErrorTypeValue` type and the values sent to the server ('Unplausibel', 'Fehlend', etc.) are German strings. While the labels use `t()` for display, the values stored in the database are always German.
- **Fix:** Use language-neutral keys (e.g., 'implausible', 'missing') as the stored values and translate only for display.

### L-09: `server/rateLimiting.ts` has no cleanup of stale entries

- **File:** `server/rateLimiting.ts`, lines 14--41
- **Area:** COMPACTNESS
- **Description:** The `loginAttempts` Map grows without bound. Failed login attempts for usernames that never log in successfully remain in memory forever. This is a minor memory leak.
- **Fix:** Add a periodic cleanup (e.g., every hour) that removes entries older than 24 hours, or use a TTL-based cache.

### L-10: `server/index.ts` SPA fallback catches API 404s for unimplemented methods

- **File:** `server/index.ts`, line 234
- **Area:** CONSISTENCY
- **Description:** The SPA fallback `app.get('/{*path}', ...)` only catches GET requests, which is correct. However, POST/PUT/DELETE to undefined `/api/` routes will return Express's default 404 HTML, not a JSON error.
- **Fix:** Add a catch-all JSON 404 handler for `/api/*` before the SPA fallback: `app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }))`.

### L-11: `server/dataApi.ts` `validateCaseCenters` error message leaks case IDs

- **File:** `server/dataApi.ts`, lines 53--58
- **Area:** SECURITY
- **Description:** Error messages include the specific case ID that failed validation (e.g., "Case pat-123 not in user's permitted centers"). This confirms to the caller that the case exists, even if they should not know about it (IDOR information leak).
- **Fix:** Return a generic error: "One or more case IDs are not accessible" without specifying which ones.

### L-12: `src/services/fhirLoader.ts` module-level cache is shared across all users

- **File:** `src/services/fhirLoader.ts`, lines 18--19
- **Area:** COMMENTS
- **Description:** The `cachedBundles` module-level variable caches the server-filtered bundles. Since center filtering is server-side, if a different user logs in without a page reload, stale bundles from the previous user's center scope would be served. The `invalidateBundleCache()` is called in `fetchData()` which runs on mount, but not on user change.
- **Fix:** Add a comment documenting this assumption, or invalidate the cache in `AuthContext` on logout.

### L-13: Several component files lack JSDoc/comment headers

- **File:** `src/pages/AnalysisPage.tsx`, `src/pages/CohortBuilderPage.tsx`, `src/pages/CaseDetailPage.tsx`, `src/pages/QualityPage.tsx`, `src/pages/DocQualityPage.tsx`
- **Area:** COMMENTS
- **Description:** These pages implement key Pflichtenheft requirements (EMDREQ-ANL-*, EMDREQ-KOH-*, EMDREQ-FALL-*, EMDREQ-QUAL-*) but have no file-level JSDoc explaining which requirements they fulfill.
- **Fix:** Add a brief comment header mapping the page to its Pflichtenheft requirements, matching the pattern used in server files.

### L-14: `src/pages/LandingPage.tsx` has a blank line after destructuring hooks

- **File:** `src/pages/LandingPage.tsx`, line 20
- **Area:** CODING STYLE
- **Description:** There are two consecutive blank lines (lines 19--20) after the hook calls. This is inconsistent with the single-blank-line convention used elsewhere.
- **Fix:** Remove the extra blank line.

---

## Requirements Cross-Check (Pflichtenheft / Lastenheft)

| Requirement | Status | Notes |
|---|---|---|
| EMDREQ-USM-001 (User creation) | Implemented | `POST /api/auth/users` with role + centers |
| EMDREQ-USM-002 (User deletion) | Implemented | `DELETE /api/auth/users/:username` |
| EMDREQ-USM-003 (Unique ID) | Implemented | Case-insensitive duplicate check |
| EMDREQ-USM-004 (Authorization) | Implemented | 6-role model with center-based filtering |
| EMDREQ-USM-005 (2FA) | Partially | Fixed OTP, not TOTP (see C-02) |
| EMDREQ-USM-006 (Failed login handling) | Implemented | Exponential backoff rate limiting |
| EMDREQ-USM-007 (Active logout) | Implemented | `Layout.tsx` logout button |
| EMDREQ-USM-008 (Inactivity timeout) | Implemented | 10 min with 1 min warning |
| EMDREQ-DAT-001 (Landing page) | Implemented | `LandingPage.tsx` |
| EMDREQ-DAT-002 (Center display) | Implemented | Center table on landing page |
| EMDREQ-DAT-003 (Data per center) | Implemented | Patient count per center |
| EMDREQ-DAT-004 (Data freshness) | Implemented | `lastUpdated` timestamp |
| EMDREQ-KOH-001 (Filter params) | Implemented | Diagnosis, gender, age, visus, CRT, center |
| EMDREQ-KOH-002 (Filter criteria) | Implemented | Range + multi-select filters |
| EMDREQ-KOH-003 (Cohort display) | Implemented | Filtered table with navigation |
| EMDREQ-KOH-004 (Save searches) | Implemented | Server-persisted saved searches |
| EMDREQ-KOH-005 (Sort saved searches) | Implemented | Sort by name/date |
| EMDREQ-KOH-006 (Re-execute searches) | Implemented | Load + apply saved filters |
| EMDREQ-KOH-007 (Export) | Implemented | CSV + JSON export |
| EMDREQ-ANL-001 (Center distribution) | Implemented | Bar chart in `AnalysisPage.tsx` |
| EMDREQ-ANL-002 (Temporal trends) | Implemented | Visus quarterly trend |
| EMDREQ-FALL-* (Case detail) | Implemented | Full case detail with clinical params |
| EMDREQ-QUAL-* (Quality review) | Implemented | Quality flags, exclusions, review status |
| K06/N06.01 (Therapy thresholds) | Implemented | Configurable interrupter/breaker days |
| K10/N10.01 (Role-based access) | Implemented | 6 roles match Pflichtenheft Section 3.2.2 |
| Audit log (implied by data protection) | Implemented | SQLite append-only log with retention |

### Gap: Pflichtenheft Section 2.4 vs. Implementation

The Pflichtenheft states "Es wird eine einheitliche Nutzerrolle bereitgestellt" (a single user role is provided), but the implementation has 6 roles. Section 3.2.2 clarifies the 6-role model. This internal inconsistency in the Pflichtenheft should be resolved -- Section 2.4 should reference 3.2.2.

### Gap: `DocQualityPage.tsx` access control

The Pflichtenheft does not explicitly define which roles may access the Documentation Quality Benchmarking page. The frontend `QUALITY_ROLES` constant (`AuthContext.tsx` line 24) defines `['admin', 'clinic_lead', 'data_manager']` as authorized roles, but the route `/doc-quality` in `App.tsx` does not enforce this -- any authenticated user can access it. Server-side, the data is not restricted either (all users get the same quality metrics).

---

## Architecture Observations (non-findings)

1. **Server-side center enforcement:** Well-implemented. The FHIR proxy is admin-only, and `/api/fhir/bundles` filters by JWT centers. Data writes validate case ownership against the FHIR cache.

2. **Audit immutability:** Correctly implemented. No write/delete endpoints exist for audit data. The middleware logs before auth, capturing 401s.

3. **Atomic file writes:** `initAuth.ts` uses temp-file + rename for `users.json`. Good crash safety.

4. **JWT secret management:** Stored in `data/jwt-secret.txt` with 0o600 permissions, auto-generated on first run. Correct.

5. **Settings as single source:** `config/settings.yaml` is the sole configuration file. Server reads at startup and on API request. Consistent with the project convention.
