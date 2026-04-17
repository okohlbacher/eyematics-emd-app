# EyeMatics EMD Full Code Review

Date: 2026-04-11
Scope: All files under `src/` and `server/`
Focus areas: consistency, redundancy, security, docs/code alignment, comments, coding style, compactness, Pflichtenheft/Lastenheft alignment

Checked all files in scope. Findings below are issue-oriented; files without findings are omitted for brevity.

## CRITICAL

### 1. Raw `settings.yaml` is exposed to every authenticated user
- Severity: CRITICAL
- Area: SECURITY, DOCS/CODE ALIGNMENT
- File and line number: `server/settingsApi.ts:76-79`, `server/initAuth.ts:72-75`
- Description of the issue: `GET /api/settings` returns the full YAML file to any authenticated user. The same settings object is used to load `otpCode`, auth provider settings, and other server-side configuration. That means any logged-in user can retrieve security-sensitive configuration, including the shared OTP code if 2FA is enabled. This completely breaks confidentiality around authentication settings and makes the 2FA step bypassable.
- Suggested fix: Make `GET /api/settings` admin-only or split it into two endpoints: a redacted public settings view for non-sensitive UI configuration and a privileged admin settings view. Never return `otpCode`, Keycloak config, or other auth internals to non-admin clients.

### 2. The 2FA implementation is a shared static code, not a real second factor
- Severity: CRITICAL
- Area: SECURITY, REQUIREMENTS
- File and line number: `server/authApi.ts:4-7`, `server/authApi.ts:197-206`, `server/initAuth.ts:72-76`
- Description of the issue: The second step of login compares the submitted OTP against a single global `otpCode` loaded from settings. This is not per-user, not time-based, not device-bound, and not revocable per account. Combined with the `/api/settings` leak above, the “2FA” step offers almost no real security value and does not meet the spirit of secure OTP-based authentication.
- Suggested fix: Replace the shared code with a real second factor such as TOTP, WebAuthn, or Keycloak-native MFA. If that is out of scope for the demonstrator, remove the faux 2FA language from the requirements mapping and UI and document it as a demo-only step.

### 3. First-start seeded accounts are migrated to a known default password
- Severity: CRITICAL
- Area: SECURITY
- File and line number: `server/index.ts:99-113`, `server/initAuth.ts:239-244`
- Description of the issue: On first startup the server seeds multiple named user accounts without password hashes. During migration, every user missing `passwordHash` is assigned the same hardcoded password, `changeme2025!`. In practice this creates a predictable credential set for all demo accounts and would be a severe compromise if the instance is ever exposed beyond a tightly controlled local environment.
- Suggested fix: Do not seed multiple named accounts with implicit shared credentials. Create at most one bootstrap admin account with a random one-time password, force password rotation on first login, and keep demo users behind explicit fixture/bootstrap tooling that is disabled outside local development.

### 4. Saving settings from the frontend can silently erase unrelated server/auth configuration
- Severity: CRITICAL
- Area: SECURITY, DOCS/CODE ALIGNMENT, COMPACTNESS
- File and line number: `src/services/settingsService.ts:5-12`, `src/services/settingsService.ts:51-65`, `src/services/settingsService.ts:78-95`
- Description of the issue: The frontend `AppSettings` model only contains `twoFactorEnabled`, therapy thresholds, and `dataSource`. `loadSettings()` reads the server YAML into that partial model, and `persistSettings()` then serializes only that subset back to `/api/settings`. On any save, unrelated sections such as `provider`, `maxLoginAttempts`, `otpCode`, `server`, `audit`, and `keycloak` can be dropped from `settings.yaml`. This is a configuration-destruction bug with obvious security and operability consequences.
- Suggested fix: Never round-trip a partial client model into the full server config file. Move settings patching to the server, preserve unknown fields when writing YAML, and validate the complete schema before committing changes.

## HIGH

### 5. Keycloak mode has backend token validation but no frontend login flow
- Severity: HIGH
- Area: REQUIREMENTS, DOCS/CODE ALIGNMENT
- File and line number: `src/pages/LoginPage.tsx:112-133`, `src/context/AuthContext.tsx:167-231`, `server/authApi.ts:93-98`
- Description of the issue: When `provider=keycloak`, local login is correctly disabled on the server, but the frontend does not start an OpenID Connect login flow. The login page only shows an informational button/modal. That leaves the application without an actual way for a user to authenticate in Keycloak mode.
- Suggested fix: Implement a real OIDC authorization-code flow for Keycloak or explicitly remove Keycloak mode from the supported feature set until the client flow exists. The frontend and backend must ship together as one complete auth mode.

### 6. Keycloak JWT verification does not validate issuer or audience
- Severity: HIGH
- Area: SECURITY
- File and line number: `server/authMiddleware.ts:100-124`, `server/keycloakAuth.ts:30-38`
- Description of the issue: Keycloak tokens are verified with the fetched JWKS public key and `algorithms: ['RS256']`, but there is no `issuer` or `audience` validation. Any RS256 token signed by a trusted key from that realm can be accepted even if it was minted for a different client or context. That weakens authorization boundaries substantially.
- Suggested fix: Pass expected `issuer` and `audience` to `jwt.verify`, and validate client-specific claims consistently. Treat role and center claims as trusted only after issuer/audience validation succeeds.

### 7. The admin user list page is wired to the wrong response shape and will not populate
- Severity: HIGH
- Area: CODING STYLE, DOCS/CODE ALIGNMENT
- File and line number: `src/pages/AdminPage.tsx:85-89`, `server/authApi.ts:268-276`
- Description of the issue: The client casts `resp.json()` directly to `ServerUser[]` and calls `setUsers(data)`, but the server returns `{ users: [...] }`. As written, `users` state receives an object instead of an array, which breaks filtering, sorting, and rendering on the admin page.
- Suggested fix: Change the client contract to `const data = await resp.json() as { users: ServerUser[] }` and call `setUsers(data.users)`. Add a narrow runtime shape check before storing the response.

### 8. OCT images are fetched from a path that the production server explicitly blocks
- Severity: HIGH
- Area: REQUIREMENTS, DOCS/CODE ALIGNMENT
- File and line number: `src/hooks/useCaseData.ts:214-220`, `src/components/OctViewer.tsx:74-85`, `server/index.ts:201-204`
- Description of the issue: The client builds OCT image URLs under `/data/...`, and `OctViewer` uses those paths directly as `<img src>`. In production the server intentionally returns `403` for `/data` and instructs clients to use authenticated FHIR access instead. The result is that OCT viewing is broken outside the dev/local file path scenario.
- Suggested fix: Serve OCT images through an authenticated API endpoint, or fetch them as authenticated blobs and pass object URLs to the viewer. The frontend must not depend on a route the server forbids by design.

### 9. The Vite dev plugins use obsolete token parsing that is weaker and inconsistent with production auth
- Severity: HIGH
- Area: SECURITY, CONSISTENCY, CODE REDUNDANCY
- File and line number: `server/utils.ts:34-72`, `server/settingsApi.ts:123-155`, `server/issueApi.ts:129-149`, `server/fhirApiPlugin.ts:28-32`
- Description of the issue: The dev plugins for settings, issues, and FHIR still call `validateAuth`, which expects `Authorization: Bearer <base64(JSON({ username, role }))>`. Production uses signed JWTs via `authMiddleware`. This duplicates auth logic, weakens the dev security model, and is likely incompatible with the current frontend token format.
- Suggested fix: Remove the legacy `validateAuth` path and reuse the same JWT verification logic in dev that production uses. If that is not possible, disable these sensitive dev plugins rather than shipping a second weaker auth stack.

### 10. Dataset export is implemented even though the Pflichtenheft explicitly documents it as not covered
- Severity: HIGH
- Area: REQUIREMENTS, DOCS/CODE ALIGNMENT
- File and line number: `src/pages/CohortBuilderPage.tsx:69-102`, `src/pages/CohortBuilderPage.tsx:457-475`
- Description of the issue: The cohort builder offers CSV and JSON export of case-level datasets and even annotates the feature as `K08 N08.01`. The requirements documentation states that dataset download is only implemented in an adapted/legally restricted form and specifically notes that full dataset download is not covered. The current implementation directly exports patient-level pseudonymized data from the browser.
- Suggested fix: Remove case-level export, replace it with aggregate-only export, or gate it behind an explicit deployment flag and updated requirements documentation that reflects the legal basis for the export.

### 11. Therapy interrupter/breaker thresholds are not loaded centrally, so non-admin views can silently use stale defaults
- Severity: HIGH
- Area: REQUIREMENTS, CONSISTENCY
- File and line number: `src/services/settingsService.ts:72-75`, `src/pages/QualityPage.tsx:36-57`, `src/pages/SettingsPage.tsx:40-51`
- Description of the issue: `QualityPage` reads thresholds via `getSettings()`, which returns cached settings if loaded, otherwise static defaults. The only place that calls `loadSettings()` is `SettingsPage`, which is admin-only. That means a non-admin user can see therapy interrupter/breaker classifications based on hardcoded defaults rather than the configured server values.
- Suggested fix: Load settings centrally during app startup, or move therapy status calculation to the server or shared data bootstrap so all users operate on the same configured thresholds.

### 12. Auth-related settings are written to disk but not applied to the running server
- Severity: HIGH
- Area: DOCS/CODE ALIGNMENT, REQUIREMENTS
- File and line number: `server/settingsApi.ts:35-39`, `server/initAuth.ts:41-115`, `server/authApi.ts:48-50`, `server/authApi.ts:145-206`
- Description of the issue: Updating settings writes `settings.yaml` and invalidates the FHIR cache, but auth config is loaded once into module-level state during startup. The login limiter, `twoFactorEnabled`, and `otpCode` continue using the startup snapshot. The settings UI therefore implies an immediate effect that the running process does not actually deliver.
- Suggested fix: Either hot-reload auth settings safely after writes or make the restart requirement explicit in both UI and documentation. Do not show an unconditional success banner for runtime behavior that has not actually changed.

## MEDIUM

### 13. The login page applies its own attempt cap and ignores server lock timing
- Severity: MEDIUM
- Area: SECURITY, CONSISTENCY
- File and line number: `src/pages/LoginPage.tsx:14`, `src/pages/LoginPage.tsx:37-39`, `src/pages/LoginPage.tsx:52-64`, `src/pages/LoginPage.tsx:83-88`
- Description of the issue: The client tracks a local `attempts` counter and blocks after five failures regardless of the server’s real lockout state and `retryAfterMs`. It increments for network errors too. This can leave users locked out in the browser until refresh even when the server would accept another attempt.
- Suggested fix: Remove the client-side attempt counter entirely and rely on the server’s `429` plus `retryAfterMs`. The UI should reflect server state, not invent its own lock logic.

### 14. OTP failure sends the user back to the password step even though the comment says it satisfies OTP retry behavior
- Severity: MEDIUM
- Area: DOCS/CODE ALIGNMENT, REQUIREMENTS
- File and line number: `src/pages/LoginPage.tsx:77-82`
- Description of the issue: On invalid OTP, the page clears the challenge token and resets back to the credentials step. The inline comment claims this satisfies `N01.08`, but the Lastenheft’s alternative flow is “OTP fehlerhaft: zurück zu Schritt 3”, which is the OTP step, not the password step. The implementation is stricter than the documented behavior and the comment is misleading.
- Suggested fix: Keep the user on the OTP step until the challenge expires or the server says the account is locked. Update the comment and requirements mapping if the stricter flow is actually intended.

### 15. Therapy interrupter/breaker filtering is documented for cohort building but not implemented there
- Severity: MEDIUM
- Area: REQUIREMENTS, DOCS/CODE ALIGNMENT
- File and line number: `src/types/fhir.ts:159-166`, `src/pages/CohortBuilderPage.tsx:40-50`, `src/pages/CohortBuilderPage.tsx:197-408`
- Description of the issue: The cohort filter model contains diagnosis, gender, age, visus, CRT, and center filters only. The cohort builder UI implements the same set and no therapy interrupter/breaker controls. That conflicts with the requirements mapping that claims therapy-status filtering is available in the cohort view.
- Suggested fix: Either implement therapy status as part of `CohortFilter` and the cohort builder UI, or correct the requirements mapping so it points only to `QualityPage`, where the feature actually exists.

### 16. Frontend quality-flag updates collapse multiple flags into one logical key
- Severity: MEDIUM
- Area: CONSISTENCY, CODING STYLE
- File and line number: `server/dataDb.ts:12-14`, `server/dataDb.ts:113-137`, `src/context/DataContext.tsx:165-180`, `src/components/quality/QualityCaseDetail.tsx:223-223`, `src/components/quality/QualityCaseDetail.tsx:280-284`
- Description of the issue: The server explicitly supports multiple flags per case/parameter via a surrogate `id`, but the frontend still identifies and updates flags by `(caseId, parameter)` only. `updateQualityFlag` updates every matching parameter entry, and `QualityCaseDetail` only reads the first flag found for a parameter. This defeats the server’s newer data model and can overwrite or hide valid parallel findings.
- Suggested fix: Treat `QualityFlag.id` as the canonical identifier end-to-end. Update read, render, and mutation paths to work on individual flags rather than parameter-level grouping.

### 17. Settings writes are fire-and-forget, but the UI shows success immediately
- Severity: MEDIUM
- Area: CODING STYLE, DOCS/CODE ALIGNMENT
- File and line number: `src/pages/SettingsPage.tsx:62-75`, `src/pages/SettingsPage.tsx:100-114`, `src/pages/SettingsPage.tsx:122-126`, `src/services/settingsService.ts:78-95`
- Description of the issue: `updateSettings()` and `resetSettings()` do not return or await the `PUT /api/settings` result. Failures are only logged to the console inside `persistSettings()`, while the page immediately shows a saved banner and may reload data based on a settings change that never persisted.
- Suggested fix: Make settings persistence async, surface request failures in the UI, and only show success or reload dependent data after the server confirms the write.

### 18. Documentation-quality time filtering empties observations but keeps all patients in the denominator
- Severity: MEDIUM
- Area: REQUIREMENTS, CODING STYLE
- File and line number: `src/utils/qualityMetrics.ts:79-93`, `src/utils/qualityMetrics.ts:95-121`
- Description of the issue: `filterCasesByTimeRange()` removes observations outside the period but keeps every case. `computeMetrics()` then still counts all patients when computing completeness. For time-bounded views, that can understate or distort center quality metrics because patients with no observations in the selected period remain in the denominator.
- Suggested fix: Decide the intended semantics explicitly. If the filter is meant to represent the selected period only, remove cases without in-range observations before metric computation, or compute separate patient denominators per metric.

### 19. The audit page filters and exports only the first 500 server rows
- Severity: MEDIUM
- Area: REQUIREMENTS, COMPACTNESS
- File and line number: `src/pages/AuditPage.tsx:80-87`, `src/pages/AuditPage.tsx:102-125`
- Description of the issue: The page fetches `/api/audit?limit=500&offset=0` once, then applies time and method filters client-side and exports that truncated in-memory set. On larger audit logs, filters and CSV export become incomplete even though the UI still shows the server’s `total`.
- Suggested fix: Push filters down to the server endpoint, support pagination in the UI, and use the server-side export endpoint for complete exports rather than exporting the currently cached first page.

### 20. The production CSP allows inline scripts and styles without a demonstrated need
- Severity: MEDIUM
- Area: SECURITY
- File and line number: `server/index.ts:157-162`
- Description of the issue: Helmet is configured with `script-src 'unsafe-inline'` and `style-src 'unsafe-inline'`. That materially weakens XSS protection, which is especially relevant because the app keeps JWTs in `sessionStorage`. For a bundled React SPA, inline scripts are usually avoidable.
- Suggested fix: Remove `unsafe-inline` where possible. If specific inline content is required, move it to hashed/nonced content instead of broadly disabling CSP protections.

## LOW

### 21. The display-name fetch is wired to the wrong JSON shape, so names silently fall back to username
- Severity: LOW
- Area: CONSISTENCY, DOCS/CODE ALIGNMENT
- File and line number: `src/context/AuthContext.tsx:111-123`, `server/authApi.ts:252-260`
- Description of the issue: The client expects `/api/auth/users/me` to return `firstName` and `lastName` at the top level, but the server returns `{ user: { ... } }`. The effect therefore misses the name fields and usually falls back to the username.
- Suggested fix: Parse the actual response shape (`{ user: ... }`) and add a runtime guard. This also avoids false confidence from an incorrect type assertion.

### 22. The landing page displays a hardcoded user count of zero for every center
- Severity: LOW
- Area: REQUIREMENTS, DOCS/CODE ALIGNMENT
- File and line number: `src/pages/LandingPage.tsx:127-150`
- Description of the issue: The landing page includes a per-center user count column but hardcodes `usersAtCenter = 0` for all rows. That makes the UI look complete while knowingly presenting placeholder data.
- Suggested fix: Either fetch the actual count from the server or remove the column until the backend supports it. Placeholder operational numbers should not be rendered as real data.

### 23. Role-group constants are defined but never used, and access checks drift into ad-hoc inline logic
- Severity: LOW
- Area: CONSISTENCY, COMPACTNESS
- File and line number: `src/context/AuthContext.tsx:17-24`, `src/components/Layout.tsx:25-37`
- Description of the issue: `ADMIN_ROLES`, `CLINICAL_ROLES`, and `QUALITY_ROLES` are exported but have no consumers. Instead, navigation and access behavior use hardcoded inline role checks. This creates a false “single source of truth” and increases the chance that role policy drifts across files.
- Suggested fix: Either remove the unused constants or actually centralize role checks around them. Prefer one shared authorization helper instead of repeating raw role strings in multiple components.

### 24. Several comments describe behavior that no longer matches the code
- Severity: LOW
- Area: DOCS/CODE ALIGNMENT, COMMENTS
- File and line number: `server/index.ts:15-18`, `src/services/settingsService.ts:47-50`, `src/pages/SettingsPage.tsx:43`
- Description of the issue: `server/index.ts` still describes raw issue/settings handlers even though routers are mounted; `settingsService.ts` claims a direct fallback fetch of `public/settings.yaml` that is not implemented; `SettingsPage.tsx` says settings are loaded from YAML plus localStorage, but no localStorage path exists there. These are not runtime bugs by themselves, but they raise the maintenance cost of already security-sensitive code.
- Suggested fix: Update comments immediately when behavior changes, especially around auth/configuration paths. Delete historical notes that are no longer true rather than letting them become pseudo-documentation.

## Verification notes

- `npx tsc -b --pretty false`: passed
- `npx vitest run`: could not be relied on in this sandbox because multiple tests hit `listen EPERM 0.0.0.0`; the output still showed environment-level bind failures rather than a clean application-level pass/fail run
