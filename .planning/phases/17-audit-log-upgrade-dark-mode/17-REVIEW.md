---
phase: 17-audit-log-upgrade-dark-mode
reviewed: 2026-04-21T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - index.html
  - src/App.tsx
  - src/components/Layout.tsx
  - src/components/ThemeToggle.tsx
  - src/components/outcomes/OutcomesPanel.tsx
  - src/components/outcomes/palette.ts
  - src/context/ThemeContext.tsx
  - src/i18n/translations.ts
  - src/index.css
  - src/pages/AdminPage.tsx
  - src/pages/AnalysisPage.tsx
  - src/pages/AuditPage.tsx
  - src/pages/LoginPage.tsx
  - server/auditDb.ts
  - server/auditApi.ts
  - tests/audit.test.ts
  - tests/auditApi.test.ts
  - tests/outcomesI18n.test.ts
  - tests/outcomesPalette.contrast.test.ts
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 17: Code Review Report

**Reviewed:** 2026-04-21
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Reviewed all 19 files changed in Phase 17 (audit log upgrade and dark-mode infrastructure). The new theme system (`ThemeContext`, `ThemeToggle`, `index.html` FOUC script, Tailwind dark-mode config) is correctly implemented end-to-end. The audit API filter additions (`action_category`, `body_search`, `status_gte`) are correctly parameterised against SQL injection. The WCAG contrast gate tests for dark-mode chart colors are sound.

Four warnings require attention before ship: a missing dark-mode class on one chart container produces a visual regression in dark mode; a logic error in the cross-cohort color resolver can emit stale light-mode colors in dark mode; `handleExportJson` silently drops network errors with no user feedback; and the server-side purge interval is never cleared, accumulating timers on hot-reload.

Five info items cover hardcoded demo credentials in i18n strings, `console.error` left in `AdminPage`, use of `window.alert` for an error case, the `DARK_EYE_COLORS` type being weaker than `EYE_COLORS`, and a silently-discarded GET route category in the audit relevance filter.

---

## Warnings

### WR-01: Missing dark-mode classes on the Age-vs-Visus chart container

**File:** `src/pages/AnalysisPage.tsx:321`
**Issue:** The "Age vs Visual Acuity" scatter chart wrapper is the only chart container in `AnalysisPage` without `dark:bg-gray-800` and `dark:border-gray-700`. In dark mode the panel will render with a white background, breaking visual consistency. Every other chart card on the same page (lines 224, 240, 278, 305) correctly includes the dark variants.
**Fix:**
```tsx
// line 321 — current
<div className="bg-white rounded-xl border border-gray-200 p-5 col-span-2">

// corrected
<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 col-span-2">
```

---

### WR-02: Cross-cohort color resolver uses wrong reference palette in dark mode

**File:** `src/components/outcomes/OutcomesPanel.tsx:106-108`
**Issue:** The `seriesColor` override check compares the incoming `color` prop against the theme-resolved `eyeColors` to decide whether the caller passed an "explicit cohort-compare color" or a plain eye color. In dark mode `eyeColors` is `DARK_EYE_COLORS`. A parent that stored an eye color from `EYE_COLORS` (light palette) and later passes it as `color` will fail the equality check (light hex != dark hex), causing the old light-mode color to be used in the chart instead of the correct dark-mode color. This applies when switching themes without re-mounting the parent.
**Fix:** The resolver should compare against both palettes, or callers should never pass raw eye-color constants as the `color` prop:
```tsx
// Current
const seriesColor = color !== eyeColors.OD && color !== eyeColors.OS && color !== eyeColors['OD+OS']
  ? color
  : resolvedColor;

// Fixed — guard against stale light-mode colors too
import { EYE_COLORS, DARK_EYE_COLORS } from './palette';
const ALL_EYE_HEX = new Set([
  ...Object.values(EYE_COLORS),
  ...Object.values(DARK_EYE_COLORS),
]);
const seriesColor = ALL_EYE_HEX.has(color) ? resolvedColor : color;
```

---

### WR-03: `handleExportJson` silently swallows network errors — no user feedback

**File:** `src/pages/AuditPage.tsx:159-163`
**Issue:** `handleExportJson` is called from a button click and uses `authFetch` without a `try/catch`. If the network call throws (e.g. server down, timeout), the error is silently discarded and the download never starts. The user receives no indication that the export failed.
**Fix:**
```tsx
const handleExportJson = async () => {
  try {
    const resp = await authFetch('/api/audit/export');
    if (!resp.ok) {
      // Surface a minimal error; a toast/banner would be ideal
      console.error('[AuditPage] Export failed:', resp.status);
      return;
    }
    const blob = await resp.blob();
    downloadBlob(blob, datedFilename('audit-export', 'json'));
  } catch (err) {
    console.error('[AuditPage] Export network error:', err);
    // Optionally: setError(err instanceof Error ? err.message : 'Export failed');
  }
};
```

---

### WR-04: `startPurgeInterval` never clears its `setInterval` — timer accumulates on hot-reload

**File:** `server/auditDb.ts:152-155`
**Issue:** `startPurgeInterval` registers an interval via `setInterval` with no handle stored and no way to cancel it. In development with hot-reload (e.g. `nodemon`/`tsx --watch`) each reload re-calls `startPurgeInterval`, accumulating multiple simultaneous purge timers. While harmless in production (single startup), this causes spurious "DB not initialised" errors in dev/test because the old interval fires after the test's DB is torn down.
**Fix:**
```ts
let _purgeTimer: ReturnType<typeof setInterval> | null = null;

export function startPurgeInterval(): void {
  if (_purgeTimer !== null) clearInterval(_purgeTimer);
  purgeOldEntries();
  _purgeTimer = setInterval(purgeOldEntries, 24 * 60 * 60 * 1000);
}

/** Exported for test teardown only */
export function stopPurgeInterval(): void {
  if (_purgeTimer !== null) { clearInterval(_purgeTimer); _purgeTimer = null; }
}
```

---

## Info

### IN-01: Hardcoded demo credentials in i18n translation strings

**File:** `src/i18n/translations.ts:64-65`
**Issue:** `loginDemoHint` embeds plaintext credentials (`admin/admin`, `forscher1/changeme2025!`) in the translation bundle. These strings are bundled into the JS artifact and visible in network DevTools. If this codebase ever moves toward a staging or production deployment, this text should be removed or gated behind a dev-only flag.
**Fix:** Remove the credential hint or conditionally render it only when `import.meta.env.DEV` is true (Vite exposes this):
```tsx
// In LoginPage.tsx instead of using t('loginDemoHint') unconditionally:
{import.meta.env.DEV && (
  <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-4">
    {t('loginDemoHint')}
  </p>
)}
```

---

### IN-02: `console.error` left in production code paths in `AdminPage`

**File:** `src/pages/AdminPage.tsx:96, 238, 249`
**Issue:** Three `console.error` calls remain in production code paths (`loadUsers`, `handleAdd`, `handleDelete`). In a clinical demonstrator these may expose internal error structures to the browser console. The error at line 238 from `handleAdd` is also the only user-visible error path — it falls through to `alert()` (see IN-03), so the `console.error` is duplicative noise.
**Fix:** Either remove the `console.error` calls or replace with structured logging behind a `DEV`-only guard. For user-facing errors, surface them via inline state (see IN-03).

---

### IN-03: `window.alert()` used for user-creation error feedback in `AdminPage`

**File:** `src/pages/AdminPage.tsx:234`
**Issue:** When the server returns a non-OK response during user creation, the code calls `alert(err.error ?? 'Failed to create user')`. This is the only usage of `window.alert` in the codebase. It blocks the browser event loop, is not theme-aware, and is inconsistent with the rest of the application which uses inline error banners. In dark mode the native `alert` dialog will appear visually jarring.
**Fix:** Add an inline error state similar to `loadError`:
```tsx
// Add state
const [createError, setCreateError] = useState<string | null>(null);

// Replace alert() with
setCreateError(err.error ?? 'Failed to create user');

// Render inline near the form buttons
{createError && (
  <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>
)}
```

---

### IN-04: `DARK_EYE_COLORS` has a weaker type than `EYE_COLORS`

**File:** `src/components/outcomes/palette.ts:56-60`
**Issue:** `EYE_COLORS` uses `as const` which narrows values to literal string types and produces the `EyeKey` union type. `DARK_EYE_COLORS` is typed as `{ OD: string; OS: string; 'OD+OS': string }` — values are widened to `string`. This means TypeScript cannot enforce that dark-mode callers pass only valid hex strings at the type level, and `Object.values(DARK_EYE_COLORS)` returns `string[]` rather than the narrowed literal array.
**Fix:**
```ts
export const DARK_EYE_COLORS = {
  OD: '#93c5fd',
  OS: '#fca5a5',
  'OD+OS': '#c4b5fd',
} as const satisfies Record<EyeKey, string>;
```

---

### IN-05: Audit relevance filter silently discards all GET requests except three allowlisted paths

**File:** `src/pages/AuditPage.tsx:67-77`
**Issue:** `isRelevantEntry` returns `false` for every GET that is not `/api/settings`, `/api/audit*`, or `/api/fhir/bundles`. If new meaningful GET endpoints are added server-side (e.g. `GET /api/auth/users` for admin listing), their audit rows will silently disappear from the client-side view with no warning. The filter is applied client-side after a server-side fetch, so the discarded entries still count toward the `total` returned by the server — causing a count mismatch (`filteredEntries.length !== total`) that the UI interprets as "filtered" when the user has applied no filters.
**Fix:** Either push the relevance filter to the server (add an `only_meaningful=true` flag to `queryAudit`) so `total` is consistent, or document the intended behaviour in a code comment so future route additions are not silently hidden.

---

_Reviewed: 2026-04-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
