---
phase: 22-codebase-docs-consistency
reviewed: 2026-04-23T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - knip.json
  - package.json
  - server/auditDb.ts
  - server/hashCohortId.ts
  - server/index.ts
  - server/outcomesAggregateApi.ts
  - server/types.d.ts
  - shared/fhirCodes.ts
  - src/components/outcomes/OutcomesPanel.tsx
  - src/components/outcomes/OutcomesView.tsx
  - src/components/outcomes/palette.ts
  - src/components/primitives/index.ts
  - src/context/AuthContext.tsx
  - src/context/DataContext.tsx
  - src/pages/AdminPage.tsx
  - src/pages/LoginPage.tsx
  - src/pages/SettingsPage.tsx
  - src/services/fhirLoader.ts
  - src/services/issueService.ts
  - src/services/outcomesAggregateService.ts
  - src/types/fhir.ts
  - src/utils/cohortTrajectory.ts
  - src/utils/dateFormat.ts
findings:
  critical: 0
  warning: 2
  info: 6
  total: 8
status: issues_found
---

# Phase 22: Code Review Report

**Reviewed:** 2026-04-23T00:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Phase 22 touches cross-cutting "codebase/docs consistency" surfaces — re-export
shims, dead-code annotations, server bootstrap, outcomes aggregation, and UI
pages. The changes are predominantly documentation (disposition comments on
retained shims per D-15) and type/import consistency. No critical correctness
or security defects were found. The two warnings concern an unguarded input in
`SettingsPage` that can NaN-poison persisted therapy thresholds, and a missing
centers-parity guard on cached outcomes responses. The info items record minor
smells (swallowed errors, minor localization gaps, a confirm() dialog used for
destructive admin actions).

The security-sensitive paths reviewed — `hashCohortId` (HMAC secret handling),
`outcomesAggregateApi` (cohort ownership check + hashed audit body), and
`AuthContext` (JWT decode with role allowlist validation) — all look correct
and match the documented threat model (T-11-02/03/05, T-12-01, T-13-03/04).

## Warnings

### WR-01: `handleSave` in SettingsPage silently coerces empty input to 0 and passes `{min > 0}` rule via stale state

**File:** `src/pages/SettingsPage.tsx:185-195, 134-136`
**Issue:** `handleInterrupterChange`/`handleBreakerChange` call `parseInt(value, 10)` and fall back to `0` on `NaN`. Because `validate(interrupter, breaker)` requires `interrupter > 0 && breaker > 0 && interrupter < breaker`, a 0 value is rejected — good. But the onChange immediately writes `0` into state and clears `validationError`. If the user then deletes the field and presses Save, Save sees the zero and blocks with the validation banner, which is fine. The real hazard is in `handleTwoFactorToggle`/`handleDataSourceTypeChange`/`handleBlazeUrlCommit`: they call `updateSettings(partial)` without including the current `interrupterDays`/`breakerDays`. If the server validator is tolerant of 0 on a partial update, a half-edited form leaves the rest of the settings state unvalidated in the UI while the server may persist stale or default values — state and server can silently diverge. The component never re-reads settings after a partial update, so the UI continues to show the unsaved 0 as though it were applied.
**Fix:** Either disable 2FA/data-source toggles while the therapy-days form is invalid, or re-hydrate `interrupterDays`/`breakerDays` from the server response after a partial update succeeds, e.g.:
```ts
const saved = await updateSettings({ twoFactorEnabled: next });
if (typeof saved?.therapyInterrupterDays === 'number') {
  setInterrupterDays(saved.therapyInterrupterDays);
  setBreakerDays(saved.therapyBreakerDays);
}
```
Alternatively, pass `null`/omit empty parseInt rather than coercing to 0 so the form visibly stays empty.

### WR-02: Cached aggregate response is keyed on `user` but not on `centers` — center-scope change without re-login returns stale rows

**File:** `server/outcomesAggregateApi.ts:167-178`
**Issue:** The cache key includes `user` (D-07/D-08) and the cohort parameters, but not `userCenters`. An admin who edits a user's center list via `PUT /api/auth/users/:name` does not force a session rotation of every cache entry keyed by that username. Until the affected user logs out and back in (or the TTL expires — default 30 min), their first aggregate call after the center change would hit a cached response computed under the old center filter. For regular users this is a no-op because `centers` is read from the JWT at request time and the JWT outlives the admin action, but the cache fingerprint is still wrong in principle: two requests from the same user with different `req.auth.centers` would be served the same body.
**Fix:** Include `userCenters` in the cache key (sorted for stability):
```ts
const cacheKey = JSON.stringify({
  cohortId, axisMode, yMetric, gridPoints, eye, spreadMode,
  includePerPatient, includeScatter, user, metric,
  centers: [...userCenters].sort(),
});
```
This is strictly additive and keeps the D-07/D-08 user-scoping invariant.

## Info

### IN-01: Empty-catch swallowing — multiple spots drop errors without a log

**File:** `src/services/fhirLoader.ts:103-105`, `src/pages/SettingsPage.tsx:57-59,68-70,75-77`, `src/pages/LoginPage.tsx:30-32`, `src/pages/AdminPage.tsx:121-124`
**Issue:** Several `catch {}` blocks silently drop errors in startup paths (`loadCenterShorthands`, `loadSettings`, `/api/auth/totp/status`, `/api/auth/config`, `/api/fhir/centers`). These are intentionally non-fatal (callers rely on defaults), but a silent drop makes it hard to diagnose "why is the 2FA toggle stuck at default" in the field.
**Fix:** At minimum `console.warn('[<module>] <what failed>:', err)` inside each catch — same pattern already used in `DataContext.tsx:101, 118, 142-176`. No behavior change.

### IN-02: `confirm()` used for destructive admin actions

**File:** `src/pages/AdminPage.tsx:266, 287`
**Issue:** `handleResetPassword` and `handleResetTotp` call `window.confirm()` for confirmation. The rest of the page uses inline React banners (see `actionError` at 361-371) and the dialog is not keyboard-testable or translated via the i18n layer consistently (the body is translated, but `confirm()` itself renders browser chrome). Per CLAUDE.md project feedback notes ("no client trust, server-side enforcement"), a confirm dialog is cosmetic only — the server should gate destructive writes via an admin-only route, which it already does. So this is a UX/testability smell only.
**Fix:** Replace with an inline confirm banner or a modal component in a follow-up; not a blocker for this phase.

### IN-03: `Array.isArray(payload.centers)` does not validate element type

**File:** `src/context/AuthContext.tsx:86`
**Issue:** `centers` is accepted from the JWT payload as `string[]` after an `Array.isArray` check, but individual elements are not type-checked. A malformed token containing `{centers: [1, 2, 3]}` would pass the guard and seed UI state with numbers. This is cosmetic (server enforces authz on every /api/* call) but inconsistent with the `VALID_ROLES` allowlist treatment of `role` right above.
**Fix:**
```ts
const centers = Array.isArray(payload.centers)
  ? payload.centers.filter((c): c is string => typeof c === 'string')
  : [];
```

### IN-04: Magic number `30_000` for password-banner clear

**File:** `src/pages/AdminPage.tsx:88`
**Issue:** The 30-second auto-clear for `generatedPassword` is inline. There's precedent for named timing constants (`INACTIVITY_TIMEOUT` in `AuthContext.tsx:49`).
**Fix:** Hoist to `const GENERATED_PASSWORD_TTL_MS = 30_000;` at module scope.

### IN-05: `getDiagnosisFullText` encodes locale strings in code; glossary work (Phase 22) may want these in i18n

**File:** `src/services/fhirLoader.ts:124-171`
**Issue:** Diagnosis labels for DE/EN are hard-coded in a switch. Phase 22 touches glossary/terminology docs. Moving these into `src/i18n/translations.ts` with codes-as-keys would make terminology audits easier and align with the rest of the UI's i18n flow. Not a bug.
**Fix:** Out of scope for this phase; log as follow-up only.

### IN-06: `OutcomesView.tsx` passes a literal 10-property default aggregate as fallback twice

**File:** `src/components/outcomes/OutcomesView.tsx:599, 619`
**Issue:** The same large empty-aggregate literal (`{ od: { patients: [], scatterPoints: [], ... }, os: {...}, combined: {...} }`) is inlined twice as a fallback to `aggregate ?? {...}`. Any future change to `PanelResult` shape requires updating both — a code-duplication smell.
**Fix:** Hoist to a module-level `EMPTY_TRAJECTORY: TrajectoryResult` constant and reuse. Trivial.

---

_Reviewed: 2026-04-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
