# Frontend Code Review -- 2026-04-11

Reviewer: Claude Opus 4.6 (1M context)
Scope: All 51 TypeScript/TSX files in `src/` (8,524 LOC)
Stack: React 19, TypeScript 6, Recharts, React Router 7, Tailwind CSS 4

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2     |
| HIGH     | 7     |
| MEDIUM   | 14    |
| LOW      | 11    |

Overall the codebase is well-structured: JWT is stored in sessionStorage (not localStorage), all API calls go through `authFetch` with 401 interception, FHIR data is loaded server-side with center filtering, and the component hierarchy follows a clean decomposition. The main concerns are around route-level authorization gaps and optimistic-update failure handling.

---

## CRITICAL

### C-01: AuditPage is accessible to all authenticated users -- no role guard

**File:** `src/App.tsx:53` and `src/pages/AuditPage.tsx`
**Description:** The `/audit` route is wrapped only in `ProtectedRoute` (any logged-in user), not `AdminRoute`. The `ADMIN_ROLES` constant exists but is not applied. Any clinician, researcher, or data_manager can view the full audit log, which contains usernames, all API paths accessed, and HTTP methods -- a significant information disclosure.
**Impact:** Violates least-privilege. Audit logs reveal system usage patterns, user activity, and API surface to non-admin users.
**Fix:**
```tsx
// App.tsx -- wrap /audit in AdminRoute
<Route path="/audit" element={<AdminRoute><AuditPage /></AdminRoute>} />
```

### C-02: DocQualityPage has no role guard -- all roles can view cross-center benchmarking

**File:** `src/App.tsx:51` and `src/context/AuthContext.tsx:24`
**Description:** `QUALITY_ROLES` is defined as `['admin', 'clinic_lead', 'data_manager']` but never enforced anywhere. The `/doc-quality` route is accessible to all authenticated users including researchers and clinicians. This page shows per-center quality scores, completeness metrics, and plausibility ratings -- comparative benchmarking data that should be restricted.
**Impact:** Researchers and clinicians can see quality deficiencies of specific centers, which could influence research bias or violate data governance agreements between participating centers.
**Fix:** Create a `QualityRoute` guard using `QUALITY_ROLES` and wrap `/doc-quality`:
```tsx
function QualityRoute({ children }: { children: ReactNode }) {
  const { user, hasRole } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!hasRole(QUALITY_ROLES)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
```

---

## HIGH

### H-01: CLINICAL_ROLES constant is defined but never used for route protection

**File:** `src/context/AuthContext.tsx:21`
**Description:** `CLINICAL_ROLES` is exported but not consumed anywhere in the routing or UI. All six roles can access clinical data pages (`/cohort`, `/analysis`, `/case/:id`, `/quality`). While the server enforces center-based filtering, the client-side does no role-based restriction. If a new role were added that should not see clinical data, there is no client-side gate.
**Impact:** Defense-in-depth gap. Currently mitigated by server-side enforcement, but violates the documented stakeholder model.
**Fix:** Decide whether `admin` should see clinical data. If not, add a `ClinicalRoute` guard or at minimum document why it is intentionally omitted.

### H-02: Optimistic updates silently swallow server errors

**File:** `src/context/DataContext.tsx:141-212`
**Description:** `addSavedSearch`, `removeSavedSearch`, `addQualityFlag`, `updateQualityFlag`, `toggleExcludeCase`, `markCaseReviewed`, and `unmarkCaseReviewed` all follow the pattern: update local state immediately, fire-and-forget the server call, catch errors with `console.error` only. If the server call fails (network error, 403, 500), the UI shows success but the data is lost on next reload.
**Impact:** Users may flag quality issues, exclude cases, or save searches that are silently lost. In a clinical research context, this is a data integrity concern.
**Fix:** Implement one of:
1. Show a toast/snackbar on server error with a retry option
2. Revert local state on failure (pessimistic pattern)
3. Queue failed mutations for retry (offline-first)

### H-03: No JWT expiry check on the client side

**File:** `src/context/AuthContext.tsx:70-78` and `src/services/authHeaders.ts`
**Description:** `decodeJwtPayload` extracts the payload but never checks `exp`. A token stored in sessionStorage could theoretically be used after expiry until the server rejects it with 401. The client has no proactive token refresh or expiry warning.
**Impact:** Users may work on data for extended periods, then lose all unsaved state when the next API call triggers a 401 redirect. The inactivity timer (10 min) partially mitigates this but does not cover active-but-expired scenarios (e.g., token has a 30-minute server-side expiry, user is active at minute 25).
**Fix:** Check `exp` in `authFetch` or set up a periodic check. When nearing expiry, either refresh the token silently or warn the user.

### H-04: Race condition in DataContext -- loadCenterShorthands vs extractCenters

**File:** `src/context/DataContext.tsx:102-103`
**Description:** The comment says `loadCenterShorthands()` must complete before `extractCenters`, but `Promise.all` runs them concurrently. If `loadAllBundles()` resolves before `loadCenterShorthands()`, `extractCenters(b)` on line 112 will use the fallback hardcoded shorthands.
**Impact:** Center names may briefly show hardcoded values on first load. Mitigated by the `.catch(() => {})` allowing graceful degradation, but the ordering guarantee claimed in the comment is not actually enforced.
**Fix:** Either chain `loadCenterShorthands` before `loadAllBundles`, or accept the race and remove the misleading comment.

### H-05: Fullscreen OCT viewer has no keyboard dismiss and traps scrolling

**File:** `src/components/OctViewer.tsx:237-245`
**Description:** The fullscreen overlay has no `onKeyDown` handler for Escape, no `role="dialog"`, no `aria-modal`, and no focus trap. It also does not prevent body scrolling.
**Impact:** Keyboard-only users cannot dismiss the fullscreen view. Screen readers do not announce it as a modal.
**Fix:** Add Escape handler, `role="dialog"`, `aria-modal="true"`, and focus management similar to `FeedbackButton.tsx`.

### H-06: QualityFlagDialog modal lacks keyboard accessibility

**File:** `src/components/quality/QualityFlagDialog.tsx:36`
**Description:** The dialog overlay has no Escape key handler, no focus trap, no `role="dialog"`, and no `aria-modal` attribute. The backdrop click also does not dismiss.
**Impact:** Fails WCAG 2.1 SC 2.1.2 (No Keyboard Trap). Users cannot dismiss without clicking Cancel.
**Fix:** Add `role="dialog"`, `aria-modal="true"`, Escape handler, and backdrop click.

### H-07: AdminPage delete user has no confirmation dialog

**File:** `src/pages/AdminPage.tsx:230-239`
**Description:** `handleDelete` immediately sends a DELETE request with no confirmation. Accidental clicks permanently delete user accounts.
**Impact:** Irreversible destructive action without confirmation is a UX anti-pattern. In a clinical system with audit requirements, this is particularly concerning.
**Fix:** Add a `window.confirm()` or custom confirmation modal before deletion.

---

## MEDIUM

### M-01: Module-level mutable cache in fhirLoader.ts and settingsService.ts

**File:** `src/services/fhirLoader.ts:18` and `src/services/settingsService.ts:26`
**Description:** `cachedBundles` and `_cached` are module-level mutable variables. While this works in a single-page app, it creates implicit shared state outside React's lifecycle. In React 19 with concurrent features, this could theoretically lead to tearing.
**Impact:** Low risk currently, but fragile. If the app ever uses SSR or concurrent rendering, these would need to be refactored.
**Fix:** Consider moving cache into React context or using a lightweight state manager.

### M-02: displayName fetch in AuthContext has no abort controller

**File:** `src/context/AuthContext.tsx:106-123`
**Description:** The `useEffect` that fetches `/api/auth/users/me` does not return a cleanup function that aborts the fetch. If the user logs out quickly or the component re-renders, the `.then()` callback could call `setDisplayName` on an outdated state.
**Impact:** Minor -- could cause a React "setState on unmounted component" warning (though React 19 is more lenient about this).
**Fix:** Add `AbortController` to the fetch and abort in the cleanup.

### M-03: Login attempt counter is client-side only

**File:** `src/pages/LoginPage.tsx:37-38`
**Description:** The `attempts >= 5` check is purely client-side state. A page refresh resets it. The real rate limiting is server-side (429 response), but the client-side message is misleading -- it tells users they are locked out when they could simply refresh.
**Impact:** UX confusion. Not a security issue since the server enforces rate limiting independently.
**Fix:** Remove the client-side attempt limit or sync it with the server's `retryAfterMs` response.

### M-04: AnalysisPage parses filters from URL search params without validation

**File:** `src/pages/AnalysisPage.tsx:44-47`
**Description:** `JSON.parse(raw)` on the `filters` search parameter accepts any JSON. While there is no XSS risk (the data is used for filtering, not rendered as HTML), a malformed `filters` param could cause unexpected filtering behavior.
**Impact:** Low security risk, but could cause confusing results if a user manually crafts a URL with invalid filter values.
**Fix:** Validate the parsed object against the `CohortFilter` type with a runtime check.

### M-05: CohortBuilderPage JSON export includes full FHIR resources

**File:** `src/pages/CohortBuilderPage.tsx:89-101`
**Description:** `handleExportJson` exports conditions, observations, procedures, and medications for each patient. While this data is pseudonymized, it includes detailed clinical data in a downloadable file. There is no server-side export endpoint -- the data is already in client memory.
**Impact:** Once data is in the client, the user can export it freely. This is by design for researchers, but there is no audit log entry for client-side exports.
**Fix:** Route exports through a server endpoint (e.g., `POST /api/data/export`) that creates an audit trail. This aligns with the security-first approach documented in the project memory.

### M-06: Generated password shown in DOM and accessible via DevTools

**File:** `src/pages/AdminPage.tsx:265-286`
**Description:** The generated password is stored in React state and rendered in the DOM as plain text. It remains in memory until the 30-second auto-clear or manual dismiss. During that window, it is visible in React DevTools and the DOM.
**Impact:** Low risk in a controlled clinical environment, but violates the principle of minimizing credential exposure time.
**Fix:** Consider copying to clipboard automatically and never displaying it in the DOM, or use a "click to reveal" pattern.

### M-07: Inactivity timer includes mousemove -- overly sensitive

**File:** `src/context/AuthContext.tsx:154`
**Description:** `mousemove` is included in the activity events. Any mouse movement resets the 10-minute timer, meaning a user who leaves their mouse on a vibrating surface will never be logged out.
**Impact:** Reduces the effectiveness of the inactivity timeout as a security measure.
**Fix:** Remove `mousemove` from the events list. `mousedown`, `keydown`, `scroll`, and `touchstart` are sufficient indicators of intentional activity.

### M-08: ErrorBoundary does not report errors to the server

**File:** `src/components/ErrorBoundary.tsx:15`
**Description:** `componentDidCatch` only logs to `console.error`. In a clinical application, unhandled errors should be reported to the server for monitoring.
**Impact:** Errors in production go unnoticed unless someone checks the browser console.
**Fix:** Send error details to a server endpoint (e.g., `POST /api/errors`) in `componentDidCatch`.

### M-09: authFetch 401 handler uses window.location.href instead of React Router

**File:** `src/services/authHeaders.ts:26`
**Description:** On 401, `authFetch` sets `window.location.href = '/login'`, which causes a full page reload and loses all React state. This bypasses React Router's navigation.
**Impact:** Users lose any unsaved work (filters, form state) on session expiry without warning.
**Fix:** Use an event emitter or callback that triggers React Router navigation, preserving the SPA experience. The `AuthContext` already has a `performLogout` that could be used.

### M-10: No loading skeleton or Suspense boundaries

**File:** Multiple pages
**Description:** Pages show either a loading spinner or nothing while data loads. There are no skeleton screens or `React.Suspense` boundaries for a smoother perceived performance.
**Impact:** UX -- users see a flash of empty content or spinner on every navigation.
**Fix:** Add skeleton components for the main content areas.

### M-11: DocQualityPage builds casesByCenter with quadratic array copying

**File:** `src/pages/DocQualityPage.tsx:60-65`
**Description:** `[...existing, c]` inside the forEach creates a new array copy for every case. With N cases, this is O(N^2) array operations.
**Impact:** Performance degrades with large datasets. For 10,000 cases, this creates 10,000 intermediate arrays.
**Fix:**
```tsx
const map = new Map<string, PatientCase[]>();
cases.forEach((c) => {
  let arr = map.get(c.centerId);
  if (!arr) { arr = []; map.set(c.centerId, arr); }
  arr.push(c);
});
```

### M-12: Bundle cache is never invalidated on logout

**File:** `src/services/fhirLoader.ts:18-26`
**Description:** `cachedBundles` persists at module level. If user A logs out and user B logs in on the same browser tab, user B initially sees user A's cached FHIR bundles until `invalidateBundleCache()` is called by DataProvider.
**Impact:** Mitigated by the fact that `DataProvider` calls `invalidateBundleCache()` on mount (line 100), and `DataProvider` re-mounts on login because it is inside `ProtectedRoute`. However, the cache survives in module scope between mounts.
**Fix:** Call `invalidateBundleCache()` in `performLogout`.

### M-13: useCaseData hook has an eslint-disable for any type

**File:** `src/hooks/useCaseData.ts:19`
**Description:** `t: (key: any) => string` disables type safety for the translation function parameter. This means any string can be passed as a translation key without compile-time checking.
**Impact:** Typos in translation keys will not be caught at build time.
**Fix:** Use `TranslationKey` type: `t: (key: TranslationKey) => string`.

### M-14: Duplicate CustomTooltip component in doc-quality

**File:** `src/components/doc-quality/CenterComparisonChart.tsx:33-50` and `src/components/doc-quality/CenterDetailPanel.tsx:39-56`
**Description:** The `CustomTooltip` component is copy-pasted identically in both files.
**Impact:** Maintenance burden -- changes need to be made in two places.
**Fix:** Extract to a shared `doc-quality/CustomTooltip.tsx` component.

---

## LOW

### L-01: NavLink items in Layout.tsx do not have aria-current

**File:** `src/components/Layout.tsx:69-85`
**Description:** React Router's `NavLink` sets `aria-current="page"` by default, which is correct. However, the sidebar nav lacks an `aria-label="Main navigation"` on the `<nav>` element.
**Fix:** Add `aria-label` to the `<nav>` element.

### L-02: Table elements lack scope attributes on th elements

**File:** Multiple files (AdminPage, AuditPage, CohortBuilderPage, etc.)
**Description:** `<th>` elements do not have `scope="col"` or `scope="row"` attributes for screen reader column/row association.
**Fix:** Add `scope="col"` to all `<th>` elements in `<thead>`.

### L-03: SortHeader component defined inside render function

**File:** `src/pages/AdminPage.tsx:243-253`
**Description:** `SortHeader` is defined as a component inside the render body of `AdminPage`. It is recreated on every render, which means React cannot optimize reconciliation.
**Impact:** Minor performance cost. The component is simple enough that this is negligible.
**Fix:** Move `SortHeader` outside `AdminPage` or memoize it.

### L-04: LandingPage hardcodes usersAtCenter = 0

**File:** `src/pages/LandingPage.tsx:129`
**Description:** `const usersAtCenter = 0;` is hardcoded with a comment saying user counts are loaded in AdminPage. The table column displays 0 for all centers.
**Impact:** Misleading UI -- suggests no users are assigned to any center.
**Fix:** Either fetch user counts from an API endpoint or remove the column from the landing page table.

### L-05: OctViewer image onError handler sets empty src

**File:** `src/components/OctViewer.tsx:81`
**Description:** `target.src = ''` sets the image source to empty, then tries to set className to a flex layout string. But an `<img>` element with `src=""` will attempt to load the current page URL as an image in some browsers.
**Fix:** Set `src` to a data URI placeholder or hide the image element.

### L-06: getAge function does not handle empty/invalid birthDate

**File:** `src/services/fhirLoader.ts:100-107`
**Description:** If `birthDate` is an empty string (which is the fallback in `extractPatientCases`), `new Date('')` returns Invalid Date, and the function returns `NaN`.
**Impact:** `NaN` propagates to age displays and filter calculations.
**Fix:** Guard against empty/invalid dates and return 0 or null.

### L-07: Unused imports of LOINC constants in CenterDetailPanel

**File:** `src/components/doc-quality/CenterDetailPanel.tsx:18`
**Description:** `LOINC_CRT`, `LOINC_IOP`, `LOINC_VISUS` are imported and used only in the static plausibility reference table. This is not technically unused, but the values are hardcoded in the JSX rather than being used programmatically.
**Impact:** None -- this is actually correct usage for displaying LOINC codes in the reference table.

### L-08: ExportIssuesFull silently fails on error

**File:** `src/services/issueService.ts:55-59`
**Description:** If the export fails, only `console.error` is called. The user sees no feedback.
**Fix:** Throw the error or return a result that the caller can use to show an error message.

### L-09: FeedbackButton handleOpen is async but errors are only console.error'd

**File:** `src/components/FeedbackButton.tsx:77-99`
**Description:** Screenshot capture failure is silently caught. The modal still opens, which is correct behavior, but the user has no indication that the screenshot was not captured.
**Fix:** Minor -- could show a small note "Screenshot not available" in the modal.

### L-10: Multiple download helpers create/remove DOM elements with setTimeout

**File:** `src/utils/download.ts:14-18` and `src/services/issueService.ts:62-70`
**Description:** The pattern of creating an `<a>` element, clicking it, then removing it after 500ms is repeated. The 500ms is arbitrary and could fail on slow systems.
**Fix:** The download.ts utility already centralizes this. The duplicate in issueService.ts (line 62-70) should use `downloadBlob` from download.ts instead.

### L-11: Recharts tooltip components use inline anonymous functions

**File:** Multiple chart components
**Description:** Tooltip `content` and `formatter` props use inline arrow functions, creating new function references on every render.
**Impact:** Negligible -- Recharts handles this internally. Memoization would add complexity without measurable benefit.

---

## Positive Observations

1. **JWT in sessionStorage** -- Correct choice over localStorage for session tokens. Cleared on tab close.
2. **authFetch wrapper** -- Centralized auth header injection and 401 handling prevents scattered token management.
3. **Server-side center filtering** -- FHIR bundles are filtered server-side; the client receives only authorized data.
4. **Inactivity timeout with warning** -- 10-minute timeout with 1-minute warning follows clinical system best practices.
5. **2FA flow** -- Clean two-step login with challenge tokens and OTP verification.
6. **Proper error boundary** -- Global ErrorBoundary catches unhandled React errors.
7. **i18n with type-safe keys** -- `TranslationKey` type prevents most translation key typos (except where `any` is used).
8. **Clinical threshold constants** -- Centralized in `clinicalThresholds.ts` instead of magic numbers.
9. **Generated password auto-clear** -- 30-second timeout reduces credential exposure window.
10. **Pseudonymized data** -- Patient identifiers use `urn:eyematics:pseudonym` system, no real names in client state.
11. **Consistent component decomposition** -- CaseDetailPage properly extracted into focused sub-components.
12. **Context memoization** -- Both AuthContext and DataContext use `useMemo` for the context value, preventing unnecessary re-renders.

---

## Recommended Priority Actions

1. **Immediate:** Fix C-01 and C-02 (route guards for /audit and /doc-quality)
2. **Next sprint:** Address H-02 (optimistic update error handling) and H-03 (JWT expiry)
3. **Next sprint:** Fix H-05, H-06 (modal accessibility) and H-07 (delete confirmation)
4. **Backlog:** Address M-05 (server-side export audit), M-09 (SPA-friendly 401), M-12 (cache on logout)
