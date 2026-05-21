---
phase: 29-home-panel-ux
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - src/components/outcomes/OutcomesView.tsx
  - src/context/AuthContext.tsx
  - src/hooks/useRecentActivity.ts
  - src/i18n/translations.ts
  - src/pages/AnalysisPage.tsx
  - src/pages/LandingPage.tsx
  - src/pages/QualityPage.tsx
  - src/services/authHeaders.ts
  - src/services/recentActivityStore.ts
  - tests/LandingPage.test.tsx
  - tests/jumpBackIn.test.tsx
  - tests/landingPageAlerts.test.tsx
  - tests/qualityPageDeepLink.test.tsx
  - tests/recentActivityStore.test.ts
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-05-21
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Phase 29 adds a per-username localStorage recent-activity store + hook, wires the
home-panel "Review" buttons and "Jump Back In" rows to deep-link query params, and
clears recents on logout. The plumbing is mostly clean and the test suite is well
targeted, but the per-username isolation control (D-01) does **not** actually isolate
data between users on a shared machine, and the store deserializes untrusted
localStorage straight into a `navigate()` call and into rendered DOM without shape
validation. Both are correctness/security defects that warrant fixing before ship.
Several quality issues around the deep-link state machine and effect dependency
correctness are also called out.

The pseudonym data point matters here: `RecentActivityEntry.label` stores a patient
pseudonym (see `QualityPage.tsx:119` recording `selectedCase.pseudonym`), so the
isolation gap is a PHI-adjacent leak, not just a UX inconvenience.

## Critical Issues

### CR-01: Per-username recent-activity is NOT isolated — prior users' pseudonyms persist in shared-machine localStorage

**File:** `src/services/recentActivityStore.ts:18-47`, `src/context/AuthContext.tsx:133-149`
**Issue:**
The D-01 "per-username isolation" control only namespaces the *key*
(`emd-recent:<username>`). localStorage is origin-scoped and shared across every user
who logs into the app on the same browser profile. The data is keyed per user but is
**not cleared per user** on logout:

- `performLogout` (AuthContext.tsx:137) calls `recentActivityStore.clear(user?.username ?? '')`, which removes **only the logging-out user's** key.
- `clearAll()` (recentActivityStore.ts:50) is only invoked from the cross-tab `'logout'` BroadcastChannel handler (authHeaders.ts:35), i.e. in *sibling* tabs.

Net effect: after User A logs out normally in a single tab, `emd-recent:A` is removed,
but if User A had ever been recorded under any other key, or if the logout path fails,
the entries (which include patient **pseudonyms** in `label`) remain physically present
in localStorage and are trivially readable by the next user (User B) via DevTools, or by
any injected script. The hook re-hydrating per username (useRecentActivity.ts:23-26)
hides the data in the UI but does nothing to remove it from disk. This defeats the
stated isolation guarantee and is a confidentiality regression for pseudonymized
clinical data.

**Fix:**
Clear *all* recent-activity keys on every interactive logout, not just the current
user's, and clear on login as well so a fresh session never inherits stale state:
```ts
// AuthContext.performLogout — replace the single-user clear with a full purge
recentActivityStore.clearAll();
```
```ts
// AuthContext.login — after a successful token set, purge any other users' residue:
recentActivityStore.clearAll();
sessionStorage.setItem('emd-token', data.token);
```
If true cross-user persistence is desired, the data must instead be stored server-side
under the authenticated identity, never in shared-origin localStorage.

### CR-02: Untrusted localStorage is deserialized into `navigate(entry.path)` and rendered without validation

**File:** `src/services/recentActivityStore.ts:22-32`, `src/pages/LandingPage.tsx:247-269`
**Issue:**
`getEntries` parses the stored JSON, checks only `Array.isArray(parsed)`, then casts the
whole thing to `RecentActivityEntry[]` (`return parsed as RecentActivityEntry[]`). No
per-element shape validation is performed. localStorage is user-writable (DevTools) and
attacker-writable under any XSS foothold. The unvalidated values flow directly into:

- `navigate(entry.path)` (LandingPage.tsx:252-253) — `entry.path` is taken verbatim. A
  crafted value such as `"//evil.example/phish"` or a `javascript:`-style payload routed
  through the SPA router is an open-redirect / navigation-hijack primitive, and a
  non-string `path` will throw inside `navigate`.
- `entry.label` / `entry.sub` rendered into the DOM (LandingPage.tsx:262, 265). React
  escapes text content so this is not stored-XSS, but malformed (non-string / object)
  values will render `[object Object]` or break the row.
- `entry.id` used as a React `key` (LandingPage.tsx:249) and as the dedup identity
  (recentActivityStore.ts:37) — a missing/duplicate `id` corrupts dedup and list keys.

**Fix:**
Validate each element and reject entries whose `path` is not a same-origin app-relative
route:
```ts
function isValidEntry(e: unknown): e is RecentActivityEntry {
  if (!e || typeof e !== 'object') return false;
  const r = e as Record<string, unknown>;
  return (
    typeof r.id === 'string' &&
    typeof r.label === 'string' &&
    typeof r.sub === 'string' &&
    typeof r.path === 'string' &&
    r.path.startsWith('/') && !r.path.startsWith('//') &&
    typeof r.visitedAt === 'number'
  );
}
// in getEntries:
return Array.isArray(parsed) ? parsed.filter(isValidEntry) : [];
```

## Warnings

### WR-01: Deep-link filters never re-apply when QualityPage is already mounted

**File:** `src/pages/QualityPage.tsx:93-110`
**Issue:**
`filterStatus`, `filterTherapy`, and `showFilters` are seeded from `searchParams` via
lazy `useState` initializers, which run **only at first mount**. Because `/quality` is a
single route (App.tsx:59), navigating between query-param variants (e.g. from
`/quality?therapy=breaker` to `/quality?status=flagged`, or a Jump Back In row to
`/quality`) does **not** remount the component, so the seeded filters silently stop
updating. The home Review buttons happen to work only because the user is coming from a
different route (a real mount). Any in-app navigation that keeps QualityPage mounted
will land on stale filter state with a URL that disagrees with the UI.

**Fix:**
Either treat the URL as the source of truth via a `useEffect` keyed on the relevant
`searchParams` values (syncing state when they change), or derive the filter values from
`searchParams` directly instead of copying into local state. If the mount-only behavior
is genuinely intended, add a guard comment and a test asserting the no-remount case so
the limitation is explicit.

### WR-02: `useRecentActivity.record` ignores its caller-provided `visitedAt`, then the store overwrites it again

**File:** `src/hooks/useRecentActivity.ts:28-34`, `src/services/recentActivityStore.ts:38`
**Issue:**
`record` callers in QualityPage/AnalysisPage/OutcomesView pass
`Omit<RecentActivityEntry, 'visitedAt'>`, but the hook synthesizes
`{ ...entry, visitedAt: Date.now() }` (useRecentActivity.ts:30) and the store then
*overwrites* it a second time with `visitedAt: Date.now()` (recentActivityStore.ts:38).
The hook-level timestamp is dead — computed and immediately discarded. This is harmless
today but is a latent bug: any future caller that legitimately passes a `visitedAt`
(e.g. backfilling history) will have it silently clobbered.

**Fix:**
Pick one owner of the timestamp. Simplest: drop the timestamp from the hook and let the
store own it (it already does):
```ts
const record = useCallback(
  (entry: Omit<RecentActivityEntry, 'visitedAt'>) => {
    store.record(username, entry as RecentActivityEntry); // store sets visitedAt
    setEntries(store.getEntries(username));
  },
  [username],
);
```

### WR-03: AnalysisPage records recent activity even when the cohort is empty / page is a bare landing

**File:** `src/pages/AnalysisPage.tsx:82-89`
**Issue:**
The mount effect unconditionally records an "Analysis" entry with
`id: savedSearchId ?? 'analysis'`. OutcomesView guards this with
`if (!cohort || cohort.cases.length === 0) return;` (OutcomesView.tsx:165), but
AnalysisPage does not. Every visit to `/analysis` — including accidental or empty ones —
pushes an entry, evicting potentially more useful case-level entries from the 5-slot
cap. Inconsistent with the OutcomesView contract and likely to make Jump Back In noisy.

**Fix:**
Mirror the OutcomesView guard, or only record once the user has engaged with a non-empty
cohort:
```ts
useEffect(() => {
  if (cohort.length === 0) return;
  record({ /* ... */ });
}, []); // eslint-disable-line ...
```
(Note `cohort` is computed below the effect; reorder or move the guard accordingly.)

### WR-04: AnalysisPage record effect has stale-closure risk from empty deps + mutable reads

**File:** `src/pages/AnalysisPage.tsx:82-89`
**Issue:**
The effect runs once on mount with `[]` deps but reads `savedSearchId`,
`activeSavedSearch`, and `window.location` at that single moment. The disable comment
claims these are "stable at mount," but `savedSearchId` is derived from `searchParams`
and `activeSavedSearch` from `savedSearches`, which is async-loaded from DataContext. On
first mount `savedSearches` is frequently still `[]`, so `activeSavedSearch` is `null`
and the entry is labeled `t('navAnalysis')` even when a real cohort name would have
resolved a tick later — recording a misleading label. This is a correctness smell hiding
behind a broad eslint-disable.

**Fix:**
Key the effect on the resolved cohort identity (as OutcomesView does with
`[primaryCohortId]`) and guard until `savedSearches` has loaded, so the recorded label
reflects the resolved cohort rather than the mount-time race.

### WR-05: `clearAll` swallows errors and partially completes silently with no signal

**File:** `src/services/recentActivityStore.ts:50-59`
**Issue:**
`clearAll` iterates `localStorage.length` collecting keys, then removes them inside a
single `try/catch` that swallows everything. If `removeItem` throws partway through
(e.g. a security-restricted key), some `emd-recent:*` keys silently survive — and given
CR-01 these keys hold pseudonyms. A swallowed failure in a security-clearing routine is
exactly the case where silent failure is dangerous. Per project convention D-03
(throw-only) the localStorage guard is an accepted exception, but a security purge that
"mostly" succeeds should at least be observable.

**Fix:**
Remove each key in its own try/catch so one failure does not abort the rest, and surface
a non-fatal warning if any removal fails:
```ts
let failed = 0;
keysToRemove.forEach((k) => {
  try { localStorage.removeItem(k); } catch { failed++; }
});
if (failed) console.warn(`[recentActivity] clearAll: ${failed} key(s) not cleared`);
```

### WR-06: Jump Back In interactive rows are missing accessible roles/labels expected of buttons

**File:** `src/pages/LandingPage.tsx:247-269` (and centre rows at 181-193)
**Issue:**
The rows use `role="button" tabIndex={0}` with an `onKeyDown` that handles **only**
`Enter` (LandingPage.tsx:253). WAI-ARIA requires a `button` role to activate on **both**
Enter and Space; Space currently does nothing (and will scroll the page). The rows also
have no `aria-label`, so a screen reader announces only the concatenated label/sub text
with no indication that activating navigates somewhere — unlike the Attention panel
buttons which correctly carry `aria-label` (LandingPage.tsx:288, 302). The phase brief
explicitly flags accessibility of these new rows.

**Fix:**
Handle Space as well and give the row an accessible name:
```tsx
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(entry.path); }
}}
aria-label={`${entry.sub}: ${entry.label}`}
```
Apply the same Enter/Space fix to the centre rows (LandingPage.tsx:186).

## Info

### IN-01: Empty-username key (`emd-recent:`) is written/read when logged out

**File:** `src/hooks/useRecentActivity.ts:14`
**Issue:**
`username = user?.username ?? ''` means a logged-out render operates on the literal key
`emd-recent:`. `record('')` / `getEntries('')` will read and write a real
`emd-recent:` entry. This is currently unreachable (recording only happens on
authenticated pages) but is a foot-gun: the empty-string namespace is a shared bucket any
unauthenticated context would land in.
**Fix:** Early-return from `record`/`getEntries` when `username === ''`, or have the hook
no-op when there is no user.

### IN-02: `tests/recentActivityStore.test.ts` "silent failure" test contains dead code

**File:** `tests/recentActivityStore.test.ts:153-168`
**Issue:**
`Object.getOwnPropertyDescriptor(vi.stubGlobal.length ? localStorage : localStorage, 'setItem')`
evaluates a ternary whose branches are identical, and the result `originalSetItem` is
never used (line 167 only silences the unused var). This is confusing dead code that
adds nothing to the test.
**Fix:** Delete the `originalSetItem`/`void` lines; keep only the `ls['setItem']`
save/replace/restore.

### IN-03: Magic timing constants and 5-entry cap rely on bare literals

**File:** `src/services/recentActivityStore.ts:16`, `src/context/AuthContext.tsx:50-51`
**Issue:**
`MAX_ENTRIES = 5` is a named const (good), but the Jump Back In UI hard-codes no upper
bound and trusts the store; fine. Lower-priority: the relationship between the cap and
the panel rendering is implicit. No action required beyond noting the coupling.
**Fix:** Optional — export `MAX_ENTRIES` if the UI ever needs to reason about it.

### IN-04: `getEntries` is called twice per `record` (read-modify-write then re-read)

**File:** `src/hooks/useRecentActivity.ts:30-31`, `src/services/recentActivityStore.ts:34-41`
**Issue:**
`store.record` internally calls `getEntries` (a parse), then the hook immediately calls
`store.getEntries` again to refresh React state — two JSON parses per record. Correctness
is fine; this is a minor redundancy. (Performance is out of v1 scope; noted only as a
code-shape observation.)
**Fix:** Optional — have `store.record` return the new array so the hook can set state
without a second read.

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
