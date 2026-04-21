# Review: Codex

## Critical (2 findings)
### F-01 Phase 14's forced-password-change control is documented as shipped but missing from the codebase
- **File:** .planning/ROADMAP.md:52
- **Problem:** Phase 14 says users on the migrated default password `changeme2025!` are forced through a password-change flow before accessing the app, but the implementation has no such field, route, or UI. `server/initAuth.ts:20-29` defines `UserRecord` without `mustChangePassword`, `_migrateUsersJson()` in `server/initAuth.ts:302-345` only adds a bcrypt hash for `changeme2025!`, `server/authApi.ts:92-160` issues a normal login/challenge response with no forced-change branch, and there is no `change-password` route or `PasswordChangePage` anywhere under `src/` or `server/`. The result is that a known default credential remains usable indefinitely while the roadmap and phase docs say the mitigation is complete.
- **Fix:** Either implement SEC-03 end to end now (startup detection, `/api/auth/change-password`, login gate, frontend interstitial) or mark Phase 14/SEC-03 as incomplete everywhere and remove the shipped claim until the code exists.

### F-02 Phase 15 TOTP/recovery-code delivery is marked complete, but auth still uses the old shared static OTP flow
- **File:** .planning/ROADMAP.md:68
- **Problem:** Phase 15 claims per-user TOTP enrollment, QR codes, recovery codes, and admin reset are complete, but the running auth stack is still the pre-TOTP design. `server/authApi.ts:147-205` always returns a generic `challengeToken` and validates OTP by direct comparison with `settings.otpCode`; `server/initAuth.ts:20-35` has no `totpSecret`, `totpEnabled`, or recovery-code fields; `src/context/AuthContext.tsx:170-233` only understands `token` or `challengeToken`; and `src/pages/LoginPage.tsx:169-176` still hard-caps the OTP input to six characters with placeholder `123456`. This is not a partial implementation gap; the milestone docs materially overstate the security posture of the codebase.
- **Fix:** Reconcile the docs with reality immediately, then either merge the missing Phase 15 work (per-user TOTP state, enroll/confirm/reset endpoints, recovery-code burn flow, frontend enrollment gate) or revert the milestone/project status back to "not shipped".

## High (4 findings)
### F-03 Outcomes "view open" audit events are never authenticated, so the handler-written audit row never executes
- **File:** src/components/outcomes/OutcomesView.tsx:170
- **Problem:** The beacon posts to `/api/audit/events/view-open` with `credentials: 'include'` but no Bearer token. The server still protects that route behind `authMiddleware` (`server/index.ts:207-220`, `server/authMiddleware.ts:148-170`), and `auditMiddleware` explicitly skips that path because the handler is supposed to write the row itself (`server/auditMiddleware.ts:50-53,133-135`). In practice, authenticated SPA users send an unauthenticated request, get a 401 before the route handler runs, and record nothing for the intended CRREV-01 audit event.
- **Fix:** Send the JWT in the beacon request, or create a dedicated authenticated helper for keepalive beacons. Add an integration test that proves `/analysis?tab=trajectories...` actually creates the hashed `view-open` audit row.

### F-04 Phase 14's HS256 pin was not actually applied to local JWT verification paths
- **File:** server/authMiddleware.ts:59
- **Problem:** The roadmap says all `jwt.verify()` call sites were pinned to `algorithms: ['HS256']`, but the local bearer-token verification in `server/authMiddleware.ts:57-67` and the challenge-token verification in `server/authApi.ts:180-187` still call `jwt.verify()` without an algorithms allowlist. That leaves the code out of sync with SEC-01 and with the documented threat model around algorithm confusion.
- **Fix:** Pass `{ algorithms: ['HS256'] }` to every local `jwt.verify()` call, then add negative tests for `alg: none`, `HS512`, and RS256-signed tokens against both the session-token and challenge-token paths.

### F-05 The Vite dev `/api/settings` path leaks raw secrets to any authenticated user
- **File:** server/settingsApi.ts:236
- **Problem:** The production router strips `otpCode`, `maxLoginAttempts`, `provider`, and `audit.cohortHashSecret` for non-admin GET requests (`server/settingsApi.ts:102-121`), but the dev plugin version returns `readSettings()` verbatim after only checking that the caller is authenticated (`server/settingsApi.ts:236-242`). `.planning/PROJECT.md:187` treats `npm run dev` as a first-class supported path, so this is not a harmless test-only shortcut: any logged-in non-admin in dev can read the global OTP and audit hash secret.
- **Fix:** Reuse the same sanitization logic in the Vite plugin GET handler, not a separate raw-file response. A regression test should hit `/api/settings` in both production-router and dev-plugin modes as a non-admin and assert identical redaction.

### F-06 Cold starts can break case-scoped write endpoints because the case index stays empty until someone loads bundles manually
- **File:** server/dataApi.ts:49
- **Problem:** `validateCaseCenters()` rejects any case ID missing from `getCaseToCenter()` (`server/dataApi.ts:49-62`), but `getCaseToCenter()` returns an empty `Map` until `getCachedBundles()` has run (`server/fhirApi.ts:197-204,368-375`). `server/index.ts` never warms that cache at startup. On a fresh server, authorized writes to quality flags, excluded cases, or reviewed cases can therefore 403 with "One or more case IDs are not accessible" until some unrelated request happens to populate the cache.
- **Fix:** Warm `getCachedBundles()` during startup, or make write-path validation lazily populate the cache before rejecting unknown case IDs. Add a cold-start integration test that exercises a write endpoint before the first `/api/fhir/bundles` call.

## Medium (4 findings)
### F-07 PERF-01 is still unmet: patient-case extraction repeatedly scans full resource arrays per patient
- **File:** shared/patientCases.ts:55
- **Problem:** Phase 14 says `extractPatientCases` was rewritten to O(N+M) pre-grouping, but the current implementation still does repeated `find()`/`filter()` passes inside `patients.map(...)` (`orgs.find`, then `conditions.filter`, `observations.filter`, `procedures.filter`, `imaging.filter`, `medications.filter`). On larger synthetic bundles this remains proportional to patients multiplied by each resource collection, not the claimed pre-grouped linear pass.
- **Fix:** Build subject-indexed maps once for observations/procedures/conditions/imaging/medications and an org lookup map once for organizations, then assemble each `PatientCase` with O(1) lookups instead of repeated full-array scans.

### F-08 Keycloak mode is configurable, but the frontend has no real authentication path for it
- **File:** src/pages/LoginPage.tsx:99
- **Problem:** When the provider is `keycloak`, the backend disables local login (`server/authApi.ts:93-99`) and bearer validation expects externally issued RS256 tokens, but the login UI only shows an informational button that toggles a help box (`src/pages/LoginPage.tsx:99-120`). There is no redirect, popup, token exchange, or fallback local flow. A deployment that flips `provider=keycloak` can therefore lock users out entirely.
- **Fix:** Either hard-block `provider=keycloak` until a real OIDC redirect flow exists, or implement the redirect/token acquisition path before exposing Keycloak mode as a usable setting.

### F-09 The review prompt and archived requirements both point to a missing current requirements file
- **File:** .planning/reviews/v1.7-full-review/PROMPT.md:17
- **Problem:** The review prompt instructs reviewers to align against `.planning/REQUIREMENTS.md`, and `.planning/milestones/v1.6-REQUIREMENTS.md:6` says that same file contains the current requirements, but the repository has no `.planning/REQUIREMENTS.md`. That breaks traceability for EMDREQ-* references and forces reviewers to infer the active source of truth from scattered milestone/phase documents.
- **Fix:** Restore a real `.planning/REQUIREMENTS.md` or update every pointer and archive notice to the actual canonical file. The review prompt should never reference a non-existent requirements artifact.

### F-10 The settings UI reports success before persistence finishes, even when the service silently rolls the cache back on failure
- **File:** src/pages/SettingsPage.tsx:68
- **Problem:** `handleSave`, `handleTwoFactorToggle`, `handleDataSourceTypeChange`, and `handleBlazeUrlCommit` call `updateSettings(...)` without awaiting it, then immediately show the "saved" banner or reload dependent data (`src/pages/SettingsPage.tsx:62-125`). Meanwhile `updateSettings()` catches persistence errors internally and reloads from the server (`src/services/settingsService.ts:102-110`). The result is optimistic UI that can claim a save succeeded even when the PUT was rejected or failed.
- **Fix:** Await `updateSettings()` in the page, surface failures explicitly, and only show the success banner or trigger dependent reloads after the promise resolves successfully.

## Low (2 findings)
### F-11 Current-state docs disagree about whether v1.7 is still in progress or already complete
- **File:** .planning/ROADMAP.md:131
- **Problem:** `.planning/ROADMAP.md:124-131` says phases 14-17 are complete and "v1.7 complete", while `.planning/PROJECT.md:102-108` still says milestone v1.7 is "In Progress" and keeps v1.7 items under "Active". That contradiction makes milestone status unreliable before even getting to the deeper phase-level mismatches above.
- **Fix:** Pick one source of truth for milestone state and update the other document immediately after each phase transition/milestone close, as the evolution rules in `PROJECT.md` already require.

### F-12 FHIR API comments still describe the old 5-center bypass model
- **File:** server/fhirApi.ts:9
- **Problem:** The file-level security comment says users with all "5 org-* centers" bypass filtering, but the shipped roster has 7 centers and the actual bypass logic checks the configured center set dynamically (`server/fhirApi.ts:74-81`). This is a low-level consistency issue, but it makes security comments unreliable in an already doc-drifted area.
- **Fix:** Update the file header to describe the current 7-center/config-driven model and avoid hard-coded roster counts in comments.

## Summary
- Top 3 themes
- The planning artifacts materially overstate shipped security work: forced password change, TOTP 2FA, and some Phase 14 guarantees are not present in the code.
- Audit and settings security have live operational gaps: the outcomes audit beacon is unauthenticated, and the dev settings endpoint exposes raw secrets to non-admins.
- Several "performance complete" claims are also inaccurate: cache warming is not wired, cold-start writes can fail, and `extractPatientCases` still performs repeated full-array scans.
- Most important fix
- Correct the security posture first: stop claiming Phase 14/15 protections are shipped, then implement or revert the missing controls before anyone relies on the current documentation.
