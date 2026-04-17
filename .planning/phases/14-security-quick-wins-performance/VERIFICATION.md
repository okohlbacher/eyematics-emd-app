---
phase: 14-security-quick-wins-performance
verified: 2026-04-17T12:35:00Z
status: passed
score: 12/12
overrides_applied: 0
---

# Phase 14: Security Quick Wins & Performance — Verification Report

**Phase Goal:** SEC-01 (JWT algorithm pin), SEC-02 (cohort hash auto-generation), SEC-03 (forced password change), PERF-01 (O(N+M) patient case extraction), PERF-02 (startup cache warm), A11Y-01 (OutcomesPanel ARIA)
**Verified:** 2026-04-17T12:35:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A token signed with alg:none or RS256 is rejected with 401 on verifyLocalToken | VERIFIED | `authMiddleware.ts:59` — `jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] })`. Rejects anything not HS256. |
| 2 | data/cohort-hash-secret.txt is auto-created on fresh startup with 64-char hex secret | VERIFIED | `hashCohortId.ts:55-57` — `crypto.randomBytes(32).toString('hex')` + `fs.writeFileSync(secretFile, _secret, { encoding: 'utf-8', mode: 0o600 })` |
| 3 | initHashCohortId falls back to settings.yaml value when file does not yet exist | VERIFIED | `hashCohortId.ts:49-52` — settings fallback path present before auto-generate |
| 4 | Users with bcrypt('changeme2025!') hash have mustChangePassword: true after startup scan | VERIFIED | `initAuth.ts:347-358` — `_migrateUsersJson` scans `bcrypt.compareSync(DEFAULT_PASSWORD, user.passwordHash)` and sets `mustChangePassword: true` |
| 5 | POST /login for mustChangePassword user returns { mustChangePassword: true, changeToken } | VERIFIED | `authApi.ts:146-154` — gate present before session token issuance |
| 6 | POST /api/auth/change-password accepts changeToken + newPassword and returns { token } | VERIFIED | `authApi.ts:266-317` — full route implementation with changeToken verify, password validation, bcrypt hash, session JWT |
| 7 | /api/auth/change-password is in PUBLIC_PATHS | VERIFIED | `authMiddleware.ts:47` — `'/api/auth/change-password'` in PUBLIC_PATHS array |
| 8 | Frontend intercepts mustChangePassword and renders full-page PasswordChangePage | VERIFIED | `AuthContext.tsx:220-225` detects `data.mustChangePassword && data.changeToken`; `App.tsx:42-47` — `AppRoutes()` checks `mustChangePassword` before `<Routes>` |
| 9 | extractPatientCases uses O(N+M) Map pre-grouping — no .filter() inside patients.map() | VERIFIED | `patientCases.ts:71-75` — 5 Maps built before `patients.map()`; map body uses `.get(ref) ?? []` (lines 88-92). No `.filter()` calls inside the map closure. |
| 10 | getCachedBundles() is called at server startup in a non-fatal IIFE after startPurgeInterval() | VERIFIED | `index.ts:142-156` — IIFE placed directly after `startPurgeInterval()` with try/catch; `getCachedBundles` imported at line 44 |
| 11 | Server starts normally even when Blaze is unavailable at startup | VERIFIED | IIFE catch block calls `console.warn` — does not rethrow; server continues past the IIFE |
| 12 | Every rendered OutcomesPanel has a container element with role="img" and non-empty aria-label | VERIFIED | `OutcomesPanel.tsx:123-124` — `role="img"` and `aria-label={\`${t(titleKey)} — ${panel.summary.patientCount} ${t('outcomesCardPatients')}\`}` on non-empty-state outer div |

**Score:** 12/12 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/authMiddleware.ts` | `{ algorithms: ['HS256'] }` in verifyLocalToken; `/api/auth/change-password` in PUBLIC_PATHS; change-password purpose token rejected | VERIFIED | Line 59: algorithm pin. Line 47: PUBLIC_PATHS entry. Line 60: `payload.purpose === 'change-password'` rejection. Keycloak RS256 path at lines 101–103 untouched. |
| `server/authApi.ts` | `{ algorithms: ['HS256'] }` in /verify challenge handler; mustChangePassword gate in /login; POST /change-password route | VERIFIED | Line 192: HS256 pin on /verify. Lines 146–154: login gate. Lines 266–317: /change-password route. |
| `server/hashCohortId.ts` | `initHashCohortId(dataDir, settings)` with file-first, fallback, auto-gen; `cohort-hash-secret.txt`; `mode: 0o600` | VERIFIED | Signature at line 37. File path at line 38. Mode at line 56. All three behaviors implemented. |
| `server/index.ts` | `initHashCohortId(DATA_DIR, settings)` call site; `getCachedBundles` import + IIFE | VERIFIED | Confirmed via grep: `initHashCohortId(DATA_DIR, settings)` present; `getCachedBundles` imported at line 44 and called in IIFE at line 148. |
| `server/initAuth.ts` | `UserRecord.mustChangePassword?: boolean`; `_migrateUsersJson` scan against 'changeme2025!' | VERIFIED | Line 29: `mustChangePassword?: boolean`. Lines 347–358: bcrypt scan loop in `_migrateUsersJson`. |
| `shared/patientCases.ts` | `groupBySubject` helper + 5 Map lookups replacing 5 `.filter()` calls | VERIFIED | Lines 48–59: `groupBySubject<T>`. Lines 71–75: 5 pre-built Maps. Lines 88–92: Map.get in patients.map body. |
| `src/pages/PasswordChangePage.tsx` | Full-page password change form | VERIFIED | File exists at `src/pages/PasswordChangePage.tsx`. Renders form using `pendingChangeToken` from `useAuth()`. |
| `src/context/AuthContext.tsx` | `mustChangePassword` state; `must_change_password` in LoginResult; `changePassword()` | VERIFIED | Lines 44–47: LoginResult union with `must_change_password` variant. Lines 111–112: state vars. Lines 254–275: `changePassword()`. Lines 282–285: all three included in context value. |
| `src/App.tsx` | Import PasswordChangePage; pre-router mustChangePassword gate | VERIFIED | Line 17: import. Lines 42–47: `AppRoutes()` renders `<PasswordChangePage />` before `<Routes>` when `mustChangePassword` is true. |
| `src/components/outcomes/OutcomesPanel.tsx` | `role="img"` and `aria-label` on chart container div | VERIFIED | Lines 123–124: `role="img"` and `aria-label` on the outer data-testid div (non-empty-state path only, as specified). |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `authMiddleware.ts verifyLocalToken` | `jwt.verify options` | `{ algorithms: ['HS256'] }` third argument | WIRED | Line 59: argument present |
| `authApi.ts /verify handler` | `jwt.verify options` | `{ algorithms: ['HS256'] }` third argument | WIRED | Line 192: argument present |
| `hashCohortId.ts initHashCohortId` | `data/cohort-hash-secret.txt` | `fs.existsSync → fs.readFileSync → fallback → crypto.randomBytes + writeFileSync` | WIRED | Full file-first → fallback → auto-gen chain at lines 40–58 |
| `server/index.ts` | `fhirApi.getCachedBundles` | `void (async IIFE) after startPurgeInterval()` | WIRED | Lines 142–156 confirm sequencing |
| `POST /api/auth/login success` | `{ mustChangePassword, changeToken } response` | `user.mustChangePassword check before returning token` | WIRED | Lines 146–154 |
| `AuthContext login()` | `PasswordChangePage` | `mustChangePassword state → conditional render in App.tsx AppRoutes()` | WIRED | AuthContext sets state; App.tsx renders before Routes |
| `OutcomesPanel.tsx chart container div` | `aria-label attribute` | `role='img' aria-label={...} on wrapping div` | WIRED | Lines 123–124 confirmed |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `OutcomesPanel.tsx` | `panel.summary.patientCount` | `PanelResult` prop from parent | Yes — prop propagated from cohort aggregation pipeline | FLOWING |
| `AuthContext.tsx changePassword()` | `data.token` | POST `/api/auth/change-password` | Yes — `signSessionToken()` issues real JWT from user record | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `groupBySubject` helper exists in patientCases.ts | `grep 'groupBySubject' shared/patientCases.ts` | Found at lines 48, 71–75, 88–92 | PASS |
| No `.filter()` inside `patients.map()` body | Checked source lines 77–94 | Only `Map.get() ?? []` inside map; `.filter()` only appears in `resourcesOfType` and `applyFilters` — both outside `patients.map()` | PASS |
| `{ algorithms: ['HS256'] }` at verifyLocalToken | Checked `authMiddleware.ts:59` | Present | PASS |
| `{ algorithms: ['HS256'] }` at /verify challenge handler | Checked `authApi.ts:192` | Present | PASS |
| Keycloak RS256 path unchanged | Checked `authMiddleware.ts:101-103` | `{ algorithms: ['RS256'] }` still present, untouched | PASS |
| `mustChangePassword?: boolean` in UserRecord | Checked `initAuth.ts:29` | Present | PASS |
| `role="img"` on OutcomesPanel outer div | Checked `OutcomesPanel.tsx:123` | Present on non-empty-state path | PASS |
| 449 tests pass | `npm test` | `449 passed \| 5 skipped` — 5 skipped are pre-existing in `metricSelector.test.tsx` | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SEC-01 | 14-01 | JWT algorithm pin to HS256 on all local verify call sites | SATISFIED | `{ algorithms: ['HS256'] }` at `authMiddleware.ts:59` and `authApi.ts:192`; Keycloak RS256 unchanged |
| SEC-02 | 14-01 | Cohort hash secret auto-generation at startup | SATISFIED | `hashCohortId.ts` file-first with `mode: 0o600`; `index.ts` call site updated |
| SEC-03 | 14-03 | Forced password change for default-credential users | SATISFIED | Startup scan in `_migrateUsersJson`; `/login` gate; `/change-password` route; frontend `PasswordChangePage` |
| PERF-01 | 14-02 | O(N+M) patient case extraction via Map pre-grouping | SATISFIED | `groupBySubject` helper + 5 Maps before `patients.map()` |
| PERF-02 | 14-02 | FHIR bundle cache warm at server startup | SATISFIED | Non-fatal IIFE after `startPurgeInterval()` in `index.ts` |
| A11Y-01 | 14-03 | ARIA role and label on OutcomesPanel chart container | SATISFIED | `role="img"` and `aria-label` on outer div at `OutcomesPanel.tsx:123-124` |

---

## Anti-Patterns Found

No blockers or significant warnings detected.

Notes:
- The empty-state `OutcomesPanel` path (line 90–103) does not carry `role="img"` or `aria-label`. This is intentional per the plan: "Empty-state panels (no data) do not need aria-label (they contain no chart, already have text content)." Not a stub — the chart-bearing path is correctly annotated.
- `modifyUsers` in the `/change-password` route is called as `await` but the return value is unused. This is non-fatal and consistent with the rest of the codebase's pattern for mutation-only calls.

---

## Human Verification Required

None. All must-haves are verifiable programmatically and the test suite confirms behavioral correctness (449/449 passing).

---

## Gaps Summary

No gaps. All six requirements (SEC-01, SEC-02, SEC-03, PERF-01, PERF-02, A11Y-01) are fully implemented, wired, and covered by passing tests.

---

_Verified: 2026-04-17T12:35:00Z_
_Verifier: Claude (gsd-verifier)_
