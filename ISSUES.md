# EyeMatics Clinical Demonstrator — Comprehensive Review Report

**Date:** 2026-04-09
**Scope:** All source files in `src/`, `server/`
**Reviewer:** Automated code review (Claude)

---

## Executive Summary

The codebase is well-structured for a clinical demonstrator with good React patterns, TypeScript typing, and i18n support. However, the review uncovered **2 critical**, **8 high**, **19 medium**, and **21 low/info** findings across security, code quality, coding style, and code duplication.

| Category | Critical | High | Medium | Low | Info | Total |
|----------|----------|------|--------|-----|------|-------|
| Security | 2 | 4 | 7 | 4 | — | 17 |
| Code Quality | — | 2 | 8 | 4 | 6 | 20 |
| Coding Style | — | — | 3 | 4 | 2 | 9 |
| Duplication | — | 2 | 5 | 7 | — | 14 |

---

## 1. Security

### SEC-01: Hardcoded Credentials in Client-Side Source Code
**Severity: CRITICAL**
**File:** `src/context/AuthContext.tsx`, lines 46–54

All usernames and passwords are hardcoded as a `DEFAULT_CREDENTIALS` constant embedded in the client-side React bundle. Any user can open browser DevTools and read every credential, including the admin account (`admin2025!`).

**Impact:** Complete authentication bypass — any visitor can extract all credentials from the JS bundle.
**Recommendation:** Move authentication to the server side with signed tokens (JWT) or server-side sessions.

---

### SEC-02: Unsigned Base64 Token — Authentication Forgery
**Severity: CRITICAL**
**Files:** `src/services/issueService.ts:4–16`, `src/services/settingsService.ts:32–42`, `server/utils.ts:39–68`

The "Bearer token" is just `base64(JSON({ username, role }))` with no cryptographic signature. Since usernames and roles are public knowledge (hardcoded in the client bundle), any visitor can forge a valid admin token:
```
btoa(JSON.stringify({ username: "admin", role: "admin" }))
```

**Impact:** Full impersonation of any user including admin.
**Recommendation:** Use signed JWTs (HS256/RS256) or server-side sessions.

---

### SEC-03: Hardcoded OTP Code — Two-Factor Bypass
**Severity: HIGH**
**File:** `src/context/AuthContext.tsx`, line 57

The OTP is a static hardcoded value `'123456'` shipped in the client bundle, making 2FA purely cosmetic.

**Impact:** Two-factor authentication provides zero additional security.
**Recommendation:** Implement server-side TOTP (RFC 6238) with per-user secrets.

---

### SEC-04: Client-Side-Only Login Rate Limiting
**Severity: HIGH**
**File:** `src/pages/LoginPage.tsx`, lines 14, 25–28

Brute-force protection is purely client-side React state. Refreshing the page resets the counter.

**Impact:** No effective brute-force protection.
**Recommendation:** Implement server-side rate limiting with exponential backoff.

---

### SEC-05: Session in sessionStorage Without Integrity Check
**Severity: HIGH**
**File:** `src/context/AuthContext.tsx`, lines 89–91, 176

The user object is stored as plain JSON in `sessionStorage`. Any script with page access can escalate privileges via `sessionStorage.setItem()`.

**Impact:** Privilege escalation through direct storage manipulation.
**Recommendation:** Pair client-side state with server-side session validation.

---

### SEC-06: Audit Log in Client-Side localStorage — Tamperable
**Severity: HIGH**
**File:** `src/services/auditService.ts`, lines 44–53

The entire audit trail is stored in `localStorage`. Any user can tamper with, delete, or forge entries from the browser console.

**Impact:** Complete audit trail compromise. Regulatory failure for clinical data handling.
**Recommendation:** Persist audit logs server-side in an append-only store.

---

### SEC-07: No Server-Side Authorization on Audit Page
**Severity: MEDIUM**
**File:** `src/App.tsx`, line 52

The `/audit` route uses `ProtectedRoute` but not `AdminRoute`. Non-admin users can view activity logs.

**Recommendation:** Wrap the audit route in `AdminRoute` or a role-based guard.

---

### SEC-08: Managed User Data in localStorage
**Severity: MEDIUM**
**File:** `src/context/AuthContext.tsx`, lines 93–95, 186, 214, 223

User management data is stored entirely in `localStorage`. Any browser user can add themselves as admin.

**Recommendation:** Persist user management server-side with authorization checks.

---

### SEC-09: Fixed Default Password for New Users
**Severity: MEDIUM**
**File:** `src/context/AuthContext.tsx`, line 162

Dynamically created users get the implicit password `changeme!` with no change mechanism.

**Recommendation:** Implement password management with mandatory initial password change.

---

### SEC-10: Any Admin Can Disable 2FA Globally
**Severity: MEDIUM**
**File:** `src/pages/SettingsPage.tsx`, lines 102–109

The 2FA toggle immediately disables 2FA for all users without re-authentication.

**Recommendation:** Require secondary confirmation before disabling 2FA.

---

### SEC-11: No Content-Security-Policy or Security Headers
**Severity: MEDIUM**
**File:** `vite.config.ts`

No CSP, `X-Frame-Options`, `X-Content-Type-Options`, or HSTS headers are configured.

**Recommendation:** Add security headers via middleware or reverse proxy configuration.

---

### SEC-12: Settings YAML Publicly Accessible
**Severity: MEDIUM**
**File:** `server/settingsApi.ts`, line 20

Settings are stored in `public/settings.yaml`, served statically without authentication. Could reveal internal FHIR server URLs.

**Recommendation:** Move settings outside `public/` and serve only through authenticated `/api/settings`.

---

### SEC-13: FHIR Proxy Without Authentication
**Severity: MEDIUM**
**File:** `vite.config.ts`, lines 9–14

The Vite dev proxy forwards all `/fhir` requests without authentication checks.

**Recommendation:** Add authentication middleware to the FHIR proxy.

---

### SEC-14: YAML Deserialization Safety
**Severity: LOW**
**Files:** `server/settingsApi.ts:96`, `src/services/settingsService.ts:74`

`yaml.load()` defaults to safe schema in v4, but the safety constraint is implicit.

**Recommendation:** Explicitly pass `{ schema: yaml.DEFAULT_SCHEMA }` to be resistant to future changes.

---

### SEC-15: No Input Length Limit on Issue Description
**Severity: LOW**
**File:** `server/issueApi.ts`, lines 62–74

No maximum length on `description` or `screenshot` fields. Could fill disk space.

**Recommendation:** Add max length (e.g., 10,000 chars for description) and rate-limit issue creation.

---

### SEC-16: Screenshot Data URI Handling
**Severity: LOW**
**File:** `src/components/FeedbackButton.tsx`, line 176

Currently safe via `<img>` tag rendering, but could become XSS vector if rendering context changes.

**Recommendation:** Validate screenshot values are well-formed `data:image/png;base64,...` on the server.

---

### SEC-17: Incomplete localStorage Cleanup Pattern
**Severity: LOW**
**File:** `src/context/AuthContext.tsx`, lines 107–114

Selective key cleanup is fragile — new keys added in future might be missed.

**Recommendation:** Use prefixed key pattern matching or maintain a centralized key registry.

---

## 2. Code Quality

### CQ-01: Unstable Function References in AuthContext
**Severity: HIGH**
**File:** `src/context/AuthContext.tsx`, lines 229–231

`login` and `hasRole` are not wrapped in `useCallback`, so the `useMemo` for context value recomputes on every render, triggering re-renders across all consumers.

**Recommendation:** Wrap `login` and `hasRole` in `useCallback`.

---

### CQ-02: Fire-and-Forget Settings Persistence
**Severity: HIGH**
**File:** `src/services/settingsService.ts`, lines 110–114, 129–135

`fetch()` calls to persist settings use `.catch(console.error)`. If the server save fails, the user sees a "saved" banner but settings are not actually persisted. On reload, old settings return.

**Recommendation:** Return the promise and show error feedback to the user on failure.

---

### CQ-03: Unsafe Type Assertion in `safeJsonParse`
**Severity: MEDIUM**
**File:** `src/utils/safeJson.ts`, line 7

`JSON.parse(json) as T` casts without runtime validation. Tampered localStorage data will satisfy TypeScript but not actual shape expectations.

**Recommendation:** For critical data (user sessions, settings), add runtime schema validation.

---

### CQ-04: Loose `string` Type for Gender
**Severity: MEDIUM**
**File:** `src/types/fhir.ts`, line 148

Gender is typed as `string` rather than a union type, leading to fragile equality checks scattered across components.

**Recommendation:** Define `type FhirGender = 'male' | 'female' | 'other' | 'unknown'`.

---

### CQ-05: Silent Failure in Screenshot Capture
**Severity: MEDIUM**
**File:** `src/components/FeedbackButton.tsx`, lines 81–92

If `toPng()` fails, the error is logged but the modal opens without informing the user.

**Recommendation:** Show a notice in the modal when screenshot capture fails.

---

### CQ-06: `getIssueCount` Silently Swallows Errors
**Severity: MEDIUM**
**File:** `src/pages/SettingsPage.tsx`, line 44

Errors are completely swallowed with `catch(() => {})`. Issue count silently stays at 0.

**Recommendation:** Log the error and/or show a "could not load" indicator.

---

### CQ-07: Missing Loading State for CaseDetailPage
**Severity: MEDIUM**
**File:** `src/pages/CaseDetailPage.tsx`

The page does not check `loading` state from `useData()`. Direct navigation while data loads shows "case not found" prematurely.

**Recommendation:** Check loading state and show a loading indicator.

---

### CQ-08: `displayName` Computed as IIFE on Every Render
**Severity: MEDIUM**
**File:** `src/context/AuthContext.tsx`, lines 196–204

Computed via an immediately-invoked function expression instead of `useMemo`.

**Recommendation:** Wrap in `useMemo` with dependencies `[user, managedUsers]`.

---

### CQ-09: `activeCases` Filter Uses Linear Search
**Severity: MEDIUM**
**File:** `src/context/DataContext.tsx`, line 85

`excludedCases.includes(c.id)` is O(n) per case. Should use a `Set` for O(1) lookups.

**Recommendation:** Convert `excludedCases` to a `Set` before filtering.

---

### CQ-10: `extractPatientCases` Does O(n²) Filtering
**Severity: MEDIUM**
**File:** `src/services/fhirLoader.ts`, lines 78–97

For each patient, all resources are filtered by patient reference — O(patients × resources).

**Recommendation:** Pre-group resources by patient reference using a `Map`.

---

### CQ-11: `eslint-disable` Suppressing Hooks Deps
**Severity: MEDIUM**
**File:** `src/pages/CaseDetailPage.tsx`, line 49

Audit `useEffect` intentionally omits dependencies but lacks explanatory comment.

**Recommendation:** Add a comment explaining the rationale, or use `useRef` for the user value.

---

### CQ-12: O(n²) Array Allocation in `casesByCenter`
**Severity: LOW**
**File:** `src/pages/DocQualityPage.tsx`, lines 290–296

Each case creates a new array via spread (`[...existing, c]`). Should use `push()`.

**Recommendation:** Use `existing.push(c)` instead of spread.

---

### CQ-13: ErrorBoundary Text Not Internationalized
**Severity: LOW**
**File:** `src/components/ErrorBoundary.tsx`, lines 22–28

Hardcoded English strings. Architecturally difficult to fix as it's a class component outside `LanguageProvider`.

**Recommendation:** Accept and document the limitation.

---

### CQ-14: `handleOpen` Not Guarded Against Double-Click
**Severity: LOW**
**File:** `src/components/FeedbackButton.tsx`, line 76

Async `handleOpen` on `onClick` can race if clicked rapidly during screenshot capture.

**Recommendation:** Add a guard checking `capturing` state.

---

### CQ-15: No Unit Tests
**Severity: INFO**
**Description:** No test files found. For clinical software, utilities and business logic should have test coverage.

**Recommendation:** Add unit tests for `fhirLoader`, `distributionBins`, `applyFilters`, `safeJson`.

---

### CQ-16: DataContext as God Object
**Severity: INFO**
**File:** `src/context/DataContext.tsx`

Holds 18 values including state, CRUD operations, and derived data — single point of coupling.

**Recommendation:** Consider splitting into smaller contexts or using state management library.

---

### CQ-17: `reloadData` Wrapper Adds No Value
**Severity: INFO**
**File:** `src/context/DataContext.tsx`, lines 79–81

`reloadData` is just a wrapper around `fetchData` with no additional logic.

**Recommendation:** Expose `fetchData` directly.

---

### CQ-18: No Pagination for Tables
**Severity: INFO**
**Description:** All table data renders at once. With large Blaze server datasets, this could cause performance issues.

**Recommendation:** Add pagination or virtualized lists for large tables.

---

### CQ-19: Tight Coupling Between AuthContext and settingsService
**Severity: INFO**
**File:** `src/context/AuthContext.tsx`, lines 168–169

`login()` calls `getSettings()` to check 2FA. If settings haven't loaded, defaults are used.

**Recommendation:** Inject 2FA setting as parameter or ensure settings load before auth flow.

---

### CQ-20: Server Plugins Only Work in Dev Mode
**Severity: INFO**
**Files:** `server/issueApi.ts`, `server/settingsApi.ts`

Server APIs use Vite's `configureServer` hook — no backend in production builds.

**Recommendation:** Document clearly. Acceptable for demonstrator.

---

## 3. Coding Style

### CS-01: German Strings as Error Type Identifiers
**Severity: MEDIUM**
**File:** `src/pages/QualityPage.tsx`, lines 296–302

Error type values are hardcoded German strings (`'Unplausibel'`, `'Fehlend'`, etc.) used as data identifiers in `QualityFlag.errorType`, persisted to localStorage.

**Recommendation:** Use English/code identifiers (`'implausible'`, `'missing'`, `'duplicate'`) and translate only at display time.

---

### CS-02: Magic Numbers Instead of Centralized Constants
**Severity: MEDIUM**
**Files:** `src/pages/QualityPage.tsx:238,248,259`, `src/pages/AnalysisPage.tsx:118`

CRT threshold `400`, visus thresholds `0.1` and `0.3` are hardcoded despite constants existing in `clinicalThresholds.ts` (`CRITICAL_CRT_THRESHOLD`, `CRITICAL_VISUS_THRESHOLD`, `VISUS_JUMP_THRESHOLD`).

**Recommendation:** Import and use centralized constants consistently.

---

### CS-03: `ALL_CENTERS` Hardcoded in AdminPage
**Severity: MEDIUM**
**File:** `src/pages/AdminPage.tsx`, line 10

Center list `['UKA', 'UKB', 'LMU', 'UKT', 'UKM']` is duplicated from `CENTER_SHORTHANDS` in `fhirLoader.ts`.

**Recommendation:** Derive center list from a shared constant.

---

### CS-04: Inconsistent Import Ordering
**Severity: LOW**
**Description:** Import grouping varies across files with no enforced pattern.

**Recommendation:** Adopt consistent order (React → third-party → internal → relative) and enforce with ESLint `import/order`.

---

### CS-05: Unused React Default Import
**Severity: LOW**
**File:** `src/components/case-detail/PatientHeader.tsx`, line 1

`import React from 'react'` — only used for `React.ReactNode` in one place. Unnecessary with JSX transform.

**Recommendation:** Remove or use `import type { ReactNode } from 'react'`.

---

### CS-06: Inline Styles Mixed with Tailwind
**Severity: LOW**
**Files:** `src/components/OctViewer.tsx:77`, `src/pages/CaseDetailPage.tsx:280`

Static values like `style={{ maxHeight: 380 }}` could use Tailwind arbitrary values.

**Recommendation:** Use `max-h-[380px]` for static values; reserve `style` for dynamic values.

---

### CS-07: Inconsistent Requirement Traceability Comments
**Severity: LOW**
**Description:** Formats vary (`EMDREQ-*` vs `K*` vs `N*`) with inconsistent coverage.

**Recommendation:** Standardize format and ensure coverage.

---

### CS-08: Sparse JSDoc on Public APIs
**Severity: INFO**
**File:** `src/services/fhirLoader.ts`

Major exported functions lack JSDoc documentation.

**Recommendation:** Add JSDoc to all exported functions in services and utilities.

---

### CS-09: Untyped Recharts Dot Props
**Severity: INFO**
**File:** `src/components/case-detail/VisusCrtChart.tsx`, lines 119–120

Recharts `dot` render prop typed as `Record<string, unknown>` with unsafe re-cast.

**Recommendation:** Define a proper interface or import Recharts' `DotProps`.

---

## 4. Code Duplication

### DUP-01: Duplicated `getAuthHeaders()` Function
**Priority: HIGH**
**Files:** `src/services/settingsService.ts:32–42`, `src/services/issueService.ts:4–16`

Same auth header construction logic in two files. The `issueService` version uses raw `JSON.parse` while `settingsService` uses `safeJsonParse` — an inconsistency that is itself a bug.

**Suggested refactoring:** Extract into `src/utils/auth.ts` as a shared utility using `safeJsonParse`.

---

### DUP-02: Duplicated User/Role Definitions (Client + Server)
**Priority: HIGH**
**Files:** `src/context/AuthContext.tsx:46–54`, `server/utils.ts:71–79`

Client `DEFAULT_CREDENTIALS` and server `KNOWN_USERS` must be kept in sync manually. Adding a user to one without the other silently breaks authentication.

**Suggested refactoring:** Create a shared `users.json` or `src/config/users.ts` imported by both.

---

### DUP-03: Duplicated Plausibility Range Constants — **Contains a Bug**
**Priority: HIGH (includes data inconsistency)**
**Files:** `src/config/clinicalThresholds.ts:12–14`, `src/pages/DocQualityPage.tsx:55–65`

`clinicalThresholds.ts` defines `CRT_RANGE = { min: 50, max: 800 }` but `DocQualityPage.tsx` hardcodes `v >= 100` — **the CRT minimum is inconsistent** (50 vs 100). This means the quality page and other app parts disagree on what constitutes a plausible CRT value.

**Suggested refactoring:** Import `VISUS_RANGE`, `CRT_RANGE`, `IOP_RANGE` from `clinicalThresholds.ts`.

---

### DUP-04: Hardcoded CRT Threshold `400`
**Priority: MEDIUM**
**Files:** `src/config/clinicalThresholds.ts:7` (`CRITICAL_CRT_THRESHOLD = 400`), `src/pages/AnalysisPage.tsx:118` (hardcoded `400`)

`CaseDetailPage.tsx` correctly uses the constant; `AnalysisPage.tsx` does not.

**Suggested refactoring:** Import `CRITICAL_CRT_THRESHOLD` in `AnalysisPage.tsx`.

---

### DUP-05: Hardcoded HbA1c Target `7.0`
**Priority: MEDIUM**
**Files:** `src/config/clinicalThresholds.ts:26` (`HBA1C_TARGET_THRESHOLD = 7.0`), `src/components/case-detail/ClinicalParametersRow.tsx:134` (hardcoded `7.0`)

**Suggested refactoring:** Import `HBA1C_TARGET_THRESHOLD`.

---

### DUP-06: Checkbox Filter Pattern Repeated 3× in CohortBuilderPage
**Priority: MEDIUM**
**File:** `src/pages/CohortBuilderPage.tsx`, lines 206–289

Identical checkbox-list-with-toggle pattern for diagnosis, gender, and center filters (~80 lines of repetition).

**Suggested refactoring:** Extract a `CheckboxFilterGroup` component.

---

### DUP-07: Range Input Pattern Repeated 3× in CohortBuilderPage
**Priority: MEDIUM**
**File:** `src/pages/CohortBuilderPage.tsx`, lines 292–418

Identical min/max range input pattern for age, visus, and CRT (~120 lines of repetition).

**Suggested refactoring:** Extract a `RangeInput` component.

---

### DUP-08: CSV Export Pattern Across 4 Pages
**Priority: MEDIUM**
**Files:** `CohortBuilderPage.tsx:76–93`, `QualityPage.tsx:185–206`, `AuditPage.tsx:99–109`, `DocQualityPage.tsx:345–365`

Same build-headers/map-rows/downloadCsv/audit-log pattern repeated.

**Suggested refactoring:** Create a `useExportCsv` hook wrapping download + audit logging.

---

### DUP-09: Diagnosis Code Extraction Pattern
**Priority: MEDIUM**
**Files:** `CohortBuilderPage.tsx:81,534`, `fhirLoader.ts:233–235`

Pattern `c.conditions.flatMap(cond => cond.code.coding.map(cd => cd.code))` repeated.

**Suggested refactoring:** Add `getDiagnosisCodes(conditions)` helper to `fhirLoader.ts`.

---

### DUP-10: Observation Date Extraction Pattern
**Priority: LOW**
**File:** `src/pages/CaseDetailPage.tsx` — 11+ instances

`o.effectiveDateTime?.substring(0, 10) ?? ''` repeated throughout.

**Suggested refactoring:** Add `getObservationDate(obs)` utility.

---

### DUP-11: Date-Map Merge Pattern in CaseDetailPage
**Priority: LOW**
**File:** `src/pages/CaseDetailPage.tsx`, lines 116–164

`combinedData` and `baselineData` both use identical date-map-merge pattern.

**Suggested refactoring:** Extract `mergeObservationsByDate()` utility.

---

### DUP-12: Condition Filtering by Category
**Priority: LOW**
**File:** `src/pages/CaseDetailPage.tsx`, lines 90–101

Same category filter pattern repeated 3× for ophthalmic/non-ophthalmic/adverse-event.

**Suggested refactoring:** Extract `filterConditionsByCategory(conditions, code)` helper.

---

### DUP-13: Card Wrapper CSS Pattern
**Priority: LOW**
**Description:** `"bg-white rounded-xl border border-gray-200 p-5"` repeated 30+ times across all pages.

**Suggested refactoring:** Create a `Card` component.

---

### DUP-14: Table Header Styling Pattern
**Priority: LOW**
**Files:** `CohortBuilderPage.tsx:500–521`, `LandingPage.tsx:109–124`, `AuditPage.tsx:212–222`

Identical `<th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">` pattern.

**Suggested refactoring:** Create a `TableHeader` component or shared class.

---

### DUP-15: YAML Dump Options
**Priority: LOW**
**File:** `src/services/settingsService.ts`, lines 109, 129, 145

`{ indent: 2, lineWidth: 120, noRefs: true }` repeated 3×.

**Suggested refactoring:** Extract `const YAML_DUMP_OPTIONS = { ... }`.

---

### DUP-16: Server Persist Pattern in settingsService
**Priority: LOW**
**File:** `src/services/settingsService.ts`

YAML dump + `fetch('/api/settings', PUT)` duplicated between `updateSettings` and `resetSettings`.

**Suggested refactoring:** Extract `persistToServer(settings)` helper.

---

### DUP-17: Language Toggle Button
**Priority: LOW**
**Files:** `src/pages/LoginPage.tsx:174–182`, `src/components/Layout.tsx:88–94`

Same toggle logic and JSX. Justified since LoginPage is outside Layout.

---

## 5. Top Priority Action Items

### Tier 1 — Critical / Must Fix
| # | Finding | Impact |
|---|---------|--------|
| 1 | SEC-01/02: Client-side credentials + forgeable tokens | Full auth bypass |
| 2 | DUP-03: CRT range inconsistency (50 vs 100) | **Data correctness bug** |
| 3 | CQ-01: Unstable AuthContext references | App-wide unnecessary re-renders |

### Tier 2 — High Priority
| # | Finding | Impact |
|---|---------|--------|
| 4 | SEC-03/04: Static OTP + client-side rate limiting | Security theater |
| 5 | SEC-06: Tamperable audit log | Clinical compliance failure |
| 6 | CQ-02: Silent settings save failure | Data loss without user awareness |
| 7 | DUP-01: Duplicated `getAuthHeaders()` with inconsistent safety | Maintenance risk + bug |
| 8 | DUP-02: Dual user definitions (client/server) | Sync failure risk |

### Tier 3 — Medium Priority (Refactoring)
| # | Finding | Impact |
|---|---------|--------|
| 9 | CS-01/02: Magic numbers, German identifiers | Maintainability |
| 10 | DUP-04/05: Unused clinical threshold constants | Consistency |
| 11 | DUP-06/07: Repeated filter UI patterns | ~200 lines of duplication |
| 12 | CQ-09/10: O(n²) filtering patterns | Performance at scale |

---

## Positive Observations

- **No XSS vectors:** No `dangerouslySetInnerHTML`, `eval()`, or `innerHTML` usage found. React's JSX escaping protects well.
- **Good TypeScript coverage:** Well-defined FHIR types in `src/types/fhir.ts` with typed translation keys.
- **Strong i18n architecture:** Typed `TranslationKey` system with full German/English bilingual support.
- **Well-extracted utilities:** `safeJsonParse`, `downloadCsv`, `distributionBins`, `usePageAudit`, `useLocalStorageState` demonstrate good refactoring practices.
- **Centralized clinical config:** `clinicalThresholds.ts` exists as single source of truth (just needs wider adoption).
- **Server-side input validation:** `issueApi.ts` and `settingsApi.ts` have proper body validation and size limits.
- **Proper error boundary:** Application root has an `ErrorBoundary` component.
- **Accessible modal:** FeedbackButton has focus trap, Escape-to-close, backdrop click, and ARIA attributes.
- **Self-aware documentation:** Inline comments acknowledge the demo nature of auth (e.g., `server/utils.ts` line 36).

---

*Report generated 2026-04-09 by automated code review (Claude).*
