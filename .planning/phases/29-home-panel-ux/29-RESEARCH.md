# Phase 29: Home Panel UX — Research

**Researched:** 2026-05-21
**Domain:** React/TypeScript client-side UX — localStorage persistence, React Router v6 deep-links, auth session teardown integration
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (key scope):** The recent-activity store is keyed per-username in localStorage (`emd-recent:<username>`). On a shared clinical workstation, user A must never see the patient/case IDs that user B viewed.
- **D-02 (logout):** Recent-activity entries are cleared on logout. Wire the clear into the existing logout/sign-out path (coordinate with the session teardown from Phases 27–28; cross-tab logout via BroadcastChannel from Phase 20 should also clear recents).
- **D-03 (therapy-breaker alert):** Routes to `/quality?therapy=breaker`. QualityPage already derives `'breaker'` status from `therapyBreakerDays`. Add query-param read support so the link pre-selects the breaker filter.
- **D-04 (implausible-CRT / flagged alert):** Routes to `/quality?status=flagged`. QualityPage already filters by quality-flag status. Add query-param read support to pre-select flagged cases.
- **D-05 (query-param contract):** Both contracts are read on mount into QualityPage's existing filter state (`filterTherapy`, `filterStatus`). Reuse the `useSearchParams` pattern already established across the app.

### Claude's Discretion
- **Recent-record shape (UX-02):** Planner decides. Guidance: capture enough to restore the view (route path + view params already in URL). Scroll position NOT required. Keep minimal and serializable.
- **Recording trigger & list semantics (UX-02):** Planner decides. Reasonable defaults: record on opening case detail and quality-review views; most-recent-first; dedup + move-to-top; cap ~5 rows.
- **Role visibility of the flagged button (D-04):** `/quality` is ProtectedRoute (not QualityRoute). The button is currently gated by `canSeeDocQuality` (`LandingPage.tsx:281`). Planner must re-evaluate — recommendation in UI-SPEC is to remove the gate since all roles can reach `/quality`.

### Deferred Ideas (OUT OF SCOPE)
- Data-driven "Attention needed" alerts (real flagged-case counts, deep-link to a specific case)
- Persisting recent-activity across sessions / cross-device
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UX-01 | Home "Attention needed" panel — Review buttons route to the appropriate pre-filtered review area via a defined query contract | Deep-link targets locked: `/quality?therapy=breaker` and `/quality?status=flagged`. QualityPage filter state and `useSearchParams` pattern confirmed. Type mismatch on `?status=flagged` identified — see Pitfall 1. |
| UX-02 | Home "Jump Back In" panel — arrows route to the last-visited view for the patient/case | Logout integration points confirmed (single `performLogout` in AuthContext + BroadcastChannel handler in authHeaders). Username source confirmed (`user.username` from `useAuth()`). localStorage pattern from ThemeContext confirmed. |
</phase_requirements>

---

## Summary

Phase 29 makes the landing page home panel actionable. UX-01 adds deep-links from two static "Attention needed" Review buttons to `QualityPage` with pre-selected filters. UX-02 builds net-new client-side recent-activity infrastructure: a localStorage store keyed per-username, a hook, recording triggers on page mounts, and rendering in the "Jump Back In" panel.

All design decisions are locked in CONTEXT.md and UI-SPEC.md. This research uncovers the exact integration points and one important type mismatch that the planner must resolve for D-04.

**Primary recommendation:** Wire D-03/D-05 first (QualityPage query params — low risk), then build the store + hook (UX-02 core), then record triggers, then wire LandingPage rows, then fix the logout clear. The `?status=flagged` param value does NOT match the existing `QualityStatus` type — the planner must choose between extending the type or using `'in_progress'` as the mapped value.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Deep-link query-param read (D-03/D-05) | Frontend (QualityPage) | — | Filter state is local component state; URL params are read on mount via `useSearchParams` |
| Recent-activity persistence | Browser (localStorage) | Frontend service module | Store lives in `src/services/recentActivityStore.ts`; no server involvement |
| Recent-activity React integration | Frontend (hook + components) | — | `useRecentActivity` hook wraps the store; `LandingPage` consumes it |
| Recording triggers | Frontend (page mount effects) | — | `useEffect` on mount of QualityPage, AnalysisPage, OutcomesView |
| Logout clear (D-02) | Frontend (AuthContext) | authHeaders module | `performLogout` is the single explicit logout path; BroadcastChannel listener in authHeaders is the cross-tab path |
| Navigation targets | Frontend (React Router) | — | `navigate(entry.path)` in LandingPage rows; no new routes |

---

## Standard Stack

### Core (all already in the project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router-dom | v6 (in use) | `useSearchParams`, `useNavigate` | Already used across all pages for URL state |
| localStorage (Web API) | native | Persist recent-activity per-username | Already used by ThemeContext and LanguageContext in this project |
| React hooks (`useEffect`, `useState`) | React 18 | Store integration, recording triggers | Project convention |

### No new libraries needed
All capabilities are achievable with existing in-tree primitives and Web APIs already in use.

---

## Architecture Patterns

### System Architecture Diagram

```
LandingPage (home panel)
    |
    |--- [Attention needed tile]
    |        Review button → navigate('/quality?therapy=breaker')
    |        Review button → navigate('/quality?status=flagged')
    |
    |--- [Jump Back In tile]
             useRecentActivity() hook
                  |
                  recentActivityStore.ts (localStorage: emd-recent:<username>)
                       |
                       read on render → RecentActivityEntry[]
                       record(entry) ← called on mount from QualityPage, AnalysisPage, OutcomesView
                       clear(username) ← called from performLogout (AuthContext) + BroadcastChannel handler (authHeaders)

QualityPage (deep-link target)
    useSearchParams() on mount
        ?therapy=breaker → setFilterTherapy('breaker')
        ?status=flagged  → setFilterStatus('in_progress')  [see Pitfall 1]

AuthContext.performLogout()
    → void serverLogout()
    → broadcastLogout()        [BroadcastChannel: 'logout' to sibling tabs]
    → sessionStorage.removeItem('emd-token')
    → recentActivityStore.clear(username)   [ADD HERE — D-02]

authHeaders.ts BroadcastChannel listener  [msg.type === 'logout']
    → sessionStorage.removeItem('emd-token')
    → window.location.href = '/login'
    → recentActivityStore.clear(username)  [ADD HERE — D-02 cross-tab path]
                                           [needs username from sessionStorage token]
```

### Recommended Project Structure (new files only)
```
src/
├── services/
│   └── recentActivityStore.ts   # localStorage CRUD (new)
├── hooks/
│   └── useRecentActivity.ts     # React hook wrapping store (new)
```

### Pattern 1: useSearchParams read-on-mount (D-05)

The app already uses this pattern in `OutcomesView.tsx:83` and `AnalysisPage.tsx:52`. The pattern is: call `useSearchParams()` at component top, read params in `useMemo` or direct derivation, apply to local state.

For QualityPage the correct approach mirrors `AnalysisPage.tsx:56-59` — read param in a `useMemo` (or direct `useState` initializer) so it fires once on mount and does not re-execute on every render:

```typescript
// Source: src/pages/AnalysisPage.tsx:52-59 (existing pattern)
const [searchParams] = useSearchParams();

// Lazy-initialize filter state from URL param (fires once at mount)
const [filterTherapy, setFilterTherapy] = useState<string>(() => {
  const v = searchParams.get('therapy');
  return v === 'breaker' || v === 'interrupter' ? v : 'all';
});
const [filterStatus, setFilterStatus] = useState<QualityStatus | 'all'>(() => {
  const v = searchParams.get('status');
  // 'flagged' → map to 'in_progress' (cases with open quality flag)
  // OR extend QualityStatus to include 'flagged' as a virtual filter value
  return v === 'in_progress' ? 'in_progress' : 'all'; // see Pitfall 1
});
```

**Important:** `useSearchParams` is used at the top of QualityPage alongside its existing `useState` declarations. The `[searchParams]` destructure (read-only, no setter needed for this purpose) mirrors the `OutcomesView.tsx` pattern exactly.

### Pattern 2: localStorage try/catch idiom

Captured verbatim from `src/context/ThemeContext.tsx:15-20` and `src/context/ThemeContext.tsx:49-51`:

```typescript
// Source: src/context/ThemeContext.tsx:15-20 (read pattern)
function readStored(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch { /* ignore */ }
  return 'light';
}

// Source: src/context/ThemeContext.tsx:49-51 (write pattern)
const setTheme = useCallback((t: Theme) => {
  setThemeState(t);
  try { localStorage.setItem(STORAGE_KEY, t); } catch { /* ignore */ }
}, []);
```

`recentActivityStore.ts` must mirror this exact pattern: all `localStorage.getItem`, `localStorage.setItem`, `localStorage.removeItem` calls wrapped in `try/catch` that silently swallows errors. JSON parse failures also require a `try/catch`. Note that `LanguageContext.tsx:15-17` uses a simpler (unwrapped) pattern — do NOT follow it; follow ThemeContext's guarded pattern.

### Pattern 3: Per-username localStorage key

```typescript
// Source: CONTEXT.md D-01 (locked decision)
const storageKey = (username: string) => `emd-recent:${username}`;
```

This matches the project convention of prefixed keys: `'emd-theme'` (ThemeContext), `'emd-locale'` (LanguageContext).

### Anti-Patterns to Avoid
- **Re-reading params on every render:** Do NOT use `useEffect` with `[searchParams]` dependency to set filter state — this causes a render loop. Use `useState` initializer or read once on mount. [VERIFIED: codebase pattern in AnalysisPage.tsx]
- **Naked localStorage calls:** Never call `localStorage.*` without `try/catch` — the API throws in private-browsing mode or when storage is full. [VERIFIED: ThemeContext.tsx pattern]
- **Trusting `filterStatus` type for `'flagged'`:** `QualityStatus` union is `'unchecked' | 'in_progress' | 'reviewed'` — no `'flagged'` value. See Pitfall 1.
- **Cross-tab username for clear:** The BroadcastChannel 'logout' listener in `authHeaders.ts` fires before `AuthContext` state clears. The username must be read from sessionStorage (decode the token) at that moment — NOT from React state (which is inaccessible in the module-level listener).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL param parsing | Custom URL parsing | `useSearchParams()` from react-router-dom | Already in use across 3 pages; handles encoding/decoding |
| Cross-tab auth coordination | Custom storage events | `BroadcastChannel('emd-auth')` (already wired) | Phase 20 BroadcastChannel is already in `authHeaders.ts`; extend it |
| Client-side navigation | `window.location` | `navigate(path)` from `useNavigate()` | Preserves SPA history; `window.location.href` causes full reload |

---

## Critical Finding: `?status=flagged` Type Mismatch (UX-01 / D-04)

**This is the most important finding in this research.**

The UI-SPEC and CONTEXT.md specify that `/quality?status=flagged` should pre-select "flagged cases." However:

- `QualityStatus` type (in `shared/types/fhir.ts:175`) is: `'unchecked' | 'in_progress' | 'reviewed'`
- `filterStatus` state in `QualityPage` is typed `QualityStatus | 'all'`
- There is NO `'flagged'` value in this type
- The QualityCaseList filter `<select>` has options: `all`, `unchecked`, `in_progress`, `reviewed` — no `flagged`

Cases "flagged for quality review" are cases with at least one open `QualityFlag`. These map to `caseStatus = 'in_progress'` in the `caseStatus` useMemo (QualityPage:105: `flags.some(f => f.status === 'open')` → `'in_progress'`).

**The planner must choose one of two approaches:**

1. **Map `?status=flagged` to `'in_progress'`:** In the query-param read on mount, treat `status=flagged` as equivalent to `filterStatus = 'in_progress'`. The filter already captures "has open flag" as `in_progress`. Simple, no type change needed. But `'flagged'` as a URL value is slightly misleading (it actually shows `in_progress` cases, not all cases that ever had a flag).

2. **Extend `QualityStatus` with `'flagged'`:** Add `'flagged'` to the union type and implement a new filter branch in `filteredCases` that selects cases with any open `qualityFlag` (which is semantically identical to `in_progress` given the current `caseStatus` logic). Requires updating `shared/types/fhir.ts`, `QualityPage.tsx`, and `QualityCaseList.tsx` filter select. More surface area.

**Research recommendation:** Option 1 (map to `'in_progress'`) is safer, touches fewer files, and is semantically correct — `in_progress` IS the "has open quality flag" state. The URL param `flagged` describes the user's intent; the internal state can use the existing vocabulary.

[VERIFIED: `shared/types/fhir.ts:175`, `src/pages/QualityPage.tsx:89,105,140`, `src/components/quality/QualityCaseList.tsx:27,138`]

---

## Common Pitfalls

### Pitfall 1: `'flagged'` is not a valid `QualityStatus`
**What goes wrong:** Setting `filterStatus` to the string `'flagged'` silently fails the TypeScript type check and the filter logic at QualityPage:140 will never match any case (since no case has `caseStatus === 'flagged'`), resulting in an empty case list.
**Why it happens:** UI-SPEC uses `'flagged'` as the URL param value for the alert, but `QualityStatus` doesn't include it.
**How to avoid:** Map the URL param value `'flagged'` to the internal state value `'in_progress'` in the query-param read logic. Add a comment explaining the mapping.
**Warning signs:** Type error `Type '"flagged"' is not assignable to type 'QualityStatus | "all"'`; or case list shows 0 results when navigating from the home panel alert.

### Pitfall 2: Cross-tab clear needs username without React context
**What goes wrong:** The BroadcastChannel `'logout'` handler in `authHeaders.ts:28-34` is a module-level listener — it has no access to React context or `useAuth()`. If `recentActivityStore.clear(username)` is called there, the username must come from a non-React source.
**Why it happens:** `authHeaders.ts` is a plain TypeScript module, not a React component.
**How to avoid:** In the BroadcastChannel handler, decode the JWT from `sessionStorage.getItem('emd-token')` to extract the username (same decoding logic as `decodeJwtPayload` in `AuthContext.tsx:58-66`). Or alternatively, clear the storage key by iterating all `emd-recent:*` keys without needing to know the username. The `recentActivityStore.clearAll()` variant that removes any key matching `emd-recent:*` is simpler for the cross-tab case.
**Warning signs:** Cross-tab logout leaves stale recents visible on next login.

### Pitfall 3: `useState` initializer vs `useEffect` for URL param seeding
**What goes wrong:** Using `useEffect(() => { setFilterTherapy(...) }, [])` to read URL params causes a double-render flash (initial render with `'all'`, then re-render with the param value). Worse: if `useSearchParams` is not in the dependency array it may use a stale closure.
**Why it happens:** Applying an effect-after-render approach instead of lazy-initializer approach.
**How to avoid:** Use the `useState` lazy initializer pattern: `useState<string>(() => { const v = searchParams.get('therapy'); return v === 'breaker' || v === 'interrupter' ? v : 'all'; })`. This reads the param exactly once at initialization with no re-render flash. Requires `useSearchParams()` to be called before `useState` (it must be at the top of the component).
**Warning signs:** Brief flash of unfiltered case list before filter applies; or ESLint exhaustive-deps warnings.

### Pitfall 4: Recording trigger causes infinite render loop
**What goes wrong:** If `useRecentActivity.record()` triggers a state update that causes a re-render of the component calling it, and the `useEffect` for recording has the component's main state in its dependency array, the effect fires again — infinite loop.
**Why it happens:** Recording on every render or with wrong dependencies.
**How to avoid:** Recording `useEffect` must have an empty dependency array `[]` (fire once on mount) or a dependency that changes only when the view meaningfully changes (e.g., `caseId`). The `record()` call must not be in the render path.

### Pitfall 5: `canSeeDocQuality` gate removal — role regression
**What goes wrong:** Removing the `canSeeDocQuality` gate (currently only shows the button for `QUALITY_ROLES`) without verifying that all roles can meaningfully use `/quality` creates a confusing UX for roles that can load the page but see no cases (center-restricted roles).
**Why it happens:** `/quality` is `ProtectedRoute` so all logged-in users can reach it, but the page still filters by the user's assigned centers.
**How to avoid:** Per UI-SPEC and CONTEXT.md (Discretion note), the recommendation is to remove the gate since all roles can reach `/quality`. The planner should confirm this is the right call and document it. The center filtering already limits what cases are visible.

---

## Integration Points (exact file, function, line)

### 1. Logout clear hook (D-02)

**Explicit logout:** `src/context/AuthContext.tsx`, function `performLogout` (line 132).

```typescript
// src/context/AuthContext.tsx:132-145 (current)
const performLogout = useCallback((auto = false) => {
  void auto;
  void serverLogout();         // fire-and-forget
  broadcastLogout();           // BroadcastChannel to sibling tabs
  setUser(null);
  setToken(null);
  setInactivityWarning(false);
  sessionStorage.removeItem('emd-token');
  invalidateBundleCache();
  // ADD: recentActivityStore.clear(user?.username ?? '') — before setUser(null)
  //      capture username BEFORE setUser(null) clears it
}, []);
```

The `clear(username)` call must come BEFORE `setUser(null)` because `performLogout` has `user` in its closure (via the `useCallback` dependency). After `setUser(null)` the `user` ref is gone. The `username` is `user?.username` — available in the `performLogout` closure since `user` is in scope at that point.

**Cross-tab logout:** `src/services/authHeaders.ts`, BroadcastChannel message handler (lines 23-34).

```typescript
// src/services/authHeaders.ts:23-34 (current)
bc?.addEventListener('message', (e: MessageEvent) => {
  const msg = e.data as { type?: string; token?: string } | null | undefined;
  if (!msg || typeof msg.type !== 'string') return;
  if (msg.type === 'refresh-success' && typeof msg.token === 'string') {
    sessionStorage.setItem('emd-token', msg.token);
  } else if (msg.type === 'logout') {
    sessionStorage.removeItem('emd-token');
    // ADD: recentActivityStore.clearAll()  OR  recentActivityStore.clearByToken(token)
    //      before removing token from sessionStorage
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }
});
```

The `clearAll()` approach (remove all `emd-recent:*` keys) is recommended here because there is no React context to read the username from in this module-level listener. The username cannot be extracted from `sessionStorage` after `sessionStorage.removeItem('emd-token')`, so the clear must happen BEFORE the token removal.

[VERIFIED: `src/context/AuthContext.tsx:132-145`, `src/services/authHeaders.ts:23-34`]

### 2. Username source for localStorage key (D-01)

`user.username` from `useAuth()`. The `User` interface (AuthContext:23-27) has `username: string`. Components call `const { user } = useAuth()` to access it.

For `useRecentActivity` hook: call `const { user } = useAuth()` inside the hook. The store key is `emd-recent:${user?.username ?? ''}`. If user is null (logged out), the key is `emd-recent:` which is fine — it will be cleared on logout anyway.

[VERIFIED: `src/context/AuthContext.tsx:23-27,264`]

### 3. LandingPage current integration points (UX-01)

**Therapy-breaker button** (line 267):
```typescript
<Button variant="ghost" size="sm" onClick={() => navigate('/cohort')}>
```
Change target to `navigate('/quality?therapy=breaker')`. No role gate needed — `/quality` is `ProtectedRoute`.

**Implausible CRT button** (line 281-285):
```typescript
{canSeeDocQuality && (
  <Button variant="ghost" size="sm" onClick={() => navigate('/doc-quality')}>
```
Change target to `navigate('/quality?status=flagged')`. Remove `canSeeDocQuality` gate per UI-SPEC recommendation (all roles can reach `/quality`).

**Jump Back In empty state** (lines 238-250): Replace with conditional rendering:
- If `entries.length === 0`: keep existing `data-testid="jump-back-in-empty"` div
- If `entries.length > 0`: render rows per UI-SPEC row layout

[VERIFIED: `src/pages/LandingPage.tsx:267,281-285,238-250`]

### 4. QualityPage filter state state declarations (D-03/D-04/D-05)

Current state (lines 88-92):
```typescript
const [filterStatus, setFilterStatus] = useState<QualityStatus | 'all'>('all');
const [filterTherapy, setFilterTherapy] = useState<string>('all');
```

Add `useSearchParams` import and lazy initializers. The `useSearchParams` hook must be called at the top of the component (before any conditional returns — though QualityPage has no early returns currently). [VERIFIED: `src/pages/QualityPage.tsx:83-92`]

### 5. Recording trigger surfaces (UX-02)

Per UI-SPEC, record on mount of:
- `src/pages/QualityPage.tsx` — when `selectedCase` is set (not on initial load). Record shape: `id = selectedCase.id`, `label = selectedCase.pseudonym`, `sub = 'Quality review'` / `t('qualitySubLabel')`, `path = '/quality'` (or `/quality?therapy=breaker` if the filter is active).
- `src/pages/AnalysisPage.tsx` — on mount. Record shape: `id = cohortId || 'analysis'`, `label = savedSearch?.name || t('navAnalysis')`, `sub = 'Analysis'`, `path = current URL path + search`.
- `src/components/outcomes/OutcomesView.tsx` — on mount when a cohort is active (`activeCases.length > 0`). Record shape: `id = cohortId || 'outcomes'`, `sub = 'Outcomes'`, `path = current URL path + search`.

The `path` for restoration should be `window.location.pathname + window.location.search` at mount time — this captures the full URL the user is on, which already contains all view params (`?cohort=`, `?filter=`, `?tab=`, `?metric=`).

**QualityPage recording trigger note:** Recording on every mount of QualityPage would record "Quality review" even with no case selected. The better trigger is inside `setSelectedCase` (when a case is actually opened), or in a `useEffect` that depends on `selectedCase`. The record `path` should be `/quality` (not `/quality?therapy=breaker`) so it restores the review view without pre-filtering (user can re-apply filters). This is a discretionary planner decision.

---

## Code Examples

### recentActivityStore.ts skeleton

```typescript
// Source: Pattern derived from ThemeContext.tsx localStorage idiom [VERIFIED]
// File: src/services/recentActivityStore.ts

export interface RecentActivityEntry {
  id: string;        // caseId or stable key
  label: string;     // pseudonym or view name
  sub: string;       // "Quality review", "Outcomes", "Analysis"
  path: string;      // full route + query string
  visitedAt: number; // Date.now()
}

const MAX_ENTRIES = 5;

function storageKey(username: string): string {
  return `emd-recent:${username}`;
}

export function getEntries(username: string): RecentActivityEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(username));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as RecentActivityEntry[];
  } catch {
    return [];
  }
}

export function record(username: string, entry: RecentActivityEntry): void {
  try {
    const entries = getEntries(username);
    const filtered = entries.filter((e) => e.id !== entry.id);
    const next = [{ ...entry, visitedAt: Date.now() }, ...filtered].slice(0, MAX_ENTRIES);
    localStorage.setItem(storageKey(username), JSON.stringify(next));
  } catch { /* ignore */ }
}

export function clear(username: string): void {
  try {
    localStorage.removeItem(storageKey(username));
  } catch { /* ignore */ }
}

/** Clear all emd-recent:* keys — used by cross-tab logout handler where username is unavailable */
export function clearAll(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('emd-recent:')) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}
```

### useRecentActivity hook skeleton

```typescript
// File: src/hooks/useRecentActivity.ts
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as store from '../services/recentActivityStore';
import type { RecentActivityEntry } from '../services/recentActivityStore';

export function useRecentActivity() {
  const { user } = useAuth();
  const username = user?.username ?? '';

  const [entries, setEntries] = useState<RecentActivityEntry[]>(() =>
    store.getEntries(username)
  );

  const record = useCallback((entry: Omit<RecentActivityEntry, 'visitedAt'>) => {
    store.record(username, { ...entry, visitedAt: Date.now() });
    setEntries(store.getEntries(username));
  }, [username]);

  const clear = useCallback(() => {
    store.clear(username);
    setEntries([]);
  }, [username]);

  // Re-hydrate when user changes (login → different user)
  useEffect(() => {
    setEntries(store.getEntries(username));
  }, [username]);

  return { entries, record, clear };
}
```

---

## Test Conventions

### Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Environment | `node` (default); `jsdom` via per-file `// @vitest-environment jsdom` docblock |
| Config | `vitest.config.ts` root |
| Quick run | `npm run test:ci` |
| Baseline | 619/619 passing — must not regress |

### RTL assertion convention (from CLAUDE.md)
```typescript
// CORRECT — project convention
expect(screen.queryByText('some text')).not.toBeNull();
expect(screen.queryByText('absent text')).toBeNull();

// WRONG — no jest-dom in this project
// expect(screen.getByText('...')).toBeInTheDocument();
```

### localStorage mocking in tests
The project uses `vi.stubGlobal` for browser APIs in node-environment tests (see `tests/authHeaders.test.ts:8-13`). For localStorage:
```typescript
const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
});
```

For jsdom-environment tests (`// @vitest-environment jsdom`), `localStorage` is available natively but should be cleared in `beforeEach` via `localStorage.clear()`.

### BroadcastChannel in tests
Global `MockBroadcastChannel` is already installed by `tests/setup.ts`. Tests that test cross-tab behavior can use `MockBroadcastChannel._reset()` in `beforeEach` (already called by the setup's global `beforeEach`).

### Component testing pattern (jsdom)
Existing component tests (e.g. `OutcomesViewRouting.test.tsx`) mock `useData` and `useLanguage` at module level via `vi.mock(...)`. For LandingPage and QualityPage tests, mock `useAuth`, `useData`, `useLanguage`, and the new `useRecentActivity` hook at module level. Use `MemoryRouter` for router context.

---

## Validation Architecture

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | File | Notes |
|--------|----------|-----------|------|-------|
| UX-01 | Therapy-breaker button navigates to `/quality?therapy=breaker` | Integration (jsdom) | `tests/landingPageAlerts.test.tsx` (new) | MemoryRouter + navigate spy |
| UX-01 | Implausible-CRT button navigates to `/quality?status=flagged` | Integration (jsdom) | `tests/landingPageAlerts.test.tsx` (new) | |
| UX-01 | QualityPage reads `?therapy=breaker` on mount → `filterTherapy='breaker'` | Integration (jsdom) | `tests/qualityPageDeepLink.test.tsx` (new) | |
| UX-01 | QualityPage reads `?status=flagged` on mount → `filterStatus='in_progress'` | Integration (jsdom) | `tests/qualityPageDeepLink.test.tsx` (new) | |
| UX-01 | Unrecognized param falls back to `'all'` | Unit | `tests/qualityPageDeepLink.test.tsx` (new) | |
| UX-02 | `recentActivityStore.record` dedupes and moves to front | Unit (node) | `tests/recentActivityStore.test.ts` (new) | No jsdom needed |
| UX-02 | `recentActivityStore.record` caps at 5 entries | Unit (node) | `tests/recentActivityStore.test.ts` (new) | |
| UX-02 | `recentActivityStore.clear` removes key | Unit (node) | `tests/recentActivityStore.test.ts` (new) | |
| UX-02 | `recentActivityStore.clearAll` removes all `emd-recent:*` keys | Unit (node) | `tests/recentActivityStore.test.ts` (new) | |
| UX-02 | localStorage failure is silently swallowed | Unit (node) | `tests/recentActivityStore.test.ts` (new) | Stub `localStorage.setItem` to throw |
| UX-02 | Jump Back In panel shows empty state when no entries | Integration (jsdom) | `tests/jumpBackIn.test.tsx` (new) | |
| UX-02 | Jump Back In panel renders rows when entries exist | Integration (jsdom) | `tests/jumpBackIn.test.tsx` (new) | |
| UX-02 | Row click navigates to `entry.path` | Integration (jsdom) | `tests/jumpBackIn.test.tsx` (new) | |
| D-02 | `performLogout` clears recents before clearing user | Unit (jsdom or node) | `tests/recentActivityStore.test.ts` (new) | Can be a logic-level test |

### Wave 0 Gaps
- [ ] `tests/recentActivityStore.test.ts` — unit tests for the store (pure logic, no jsdom needed)
- [ ] `tests/landingPageAlerts.test.tsx` — UX-01 navigation targets
- [ ] `tests/qualityPageDeepLink.test.tsx` — UX-01 filter seeding from URL params
- [ ] `tests/jumpBackIn.test.tsx` — UX-02 panel rendering

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `?status=flagged` should map to `filterStatus='in_progress'` (not extend the type) | Pitfall 1, Code Examples | If planner extends the type, additional files need updating; filter logic changes |
| A2 | Recording trigger for QualityPage should fire when `selectedCase` is set, not on page mount | Integration Points §5 | If on page mount, every `/quality` visit records even with no case selected |
| A3 | `recentActivityStore.clearAll()` is the correct cross-tab logout strategy | Integration Points §1 | If username can be decoded from token before removal, `clear(username)` is more targeted |

---

## Open Questions

1. **`?status=flagged` mapping choice**
   - What we know: `QualityStatus` has no `'flagged'` value; cases with open flags are `'in_progress'`
   - What's unclear: Should the URL param vocabulary stay as `'flagged'` (user-facing intent) mapped to `'in_progress'` internally? Or should `'flagged'` be added to `QualityStatus`?
   - Recommendation: Map to `'in_progress'` (Option 1). Simpler, fewer files touched, semantically correct.

2. **QualityPage recording trigger — mount vs case-selected**
   - What we know: UI-SPEC says "record on mount of QualityPage (case detail selected)"
   - What's unclear: The UI-SPEC phrase "case detail selected" could mean "only when a case is actually selected" OR "the page where case detail is shown"
   - Recommendation: Record when `setSelectedCase` is called with a non-null case, via `useEffect` on `selectedCase`. This avoids recording `/quality` visits that end without any case interaction.

3. **`aria-label` i18n keys for Review buttons**
   - What we know: UI-SPEC specifies `aria-label={t('reviewTherapyBreakers')}` and `aria-label={t('reviewFlaggedCases')}`
   - What's unclear: These keys do NOT currently exist in `translations.ts` (the file ends at line 885 with session-TTL keys)
   - Recommendation: Add both keys in the Wave 0 / i18n task. Check `translations.ts` carefully — `attentionTherapyBreakers` exists (line 851) but `reviewTherapyBreakers` and `reviewFlaggedCases` do not. The planner must include a translations task.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 29 is purely client-side code/config changes. No external services, CLI tools, or databases are required beyond the project's own dev stack (`npm run dev`, `npm run test:ci`), which is confirmed operational (619/619 tests passing per CLAUDE.md baseline).

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not touched — auth flow unchanged |
| V3 Session Management | Partial | localStorage cleared on logout (D-01/D-02); no tokens stored in recents |
| V4 Access Control | Partial | Role gate removal for CRT button (D-04 Discretion); all roles reach ProtectedRoute |
| V5 Input Validation | Yes | URL params validated before use: unknown values fall back to `'all'` |
| V6 Cryptography | No | Not applicable |

**Security notes:**
- Recent-activity entries store only `path` strings and pseudonyms. They do NOT store clinical values, diagnoses, or raw patient data. Pseudonyms are already shown in the UI.
- Per-username localStorage key (D-01) prevents cross-user data leakage on shared workstations.
- Clear-on-logout (D-02) ensures no residual patient trail after sign-out.
- `path` values are app-internal routes — they cannot be used to exfiltrate data to external URLs.

---

## Sources

### Primary (HIGH confidence)
- `src/context/AuthContext.tsx` — `performLogout` (lines 132–145), `User` interface, `useAuth` hook, username source [VERIFIED]
- `src/services/authHeaders.ts` — BroadcastChannel handler (lines 23–34), cross-tab logout path [VERIFIED]
- `src/pages/QualityPage.tsx` — `filterStatus`, `filterTherapy` state (lines 88–91), `caseStatus` useMemo (lines 97–112), `filteredCases` filter (lines 137–146) [VERIFIED]
- `src/pages/LandingPage.tsx` — button targets (lines 267, 281–285), Jump Back In empty state (lines 238–250) [VERIFIED]
- `src/context/ThemeContext.tsx` — localStorage try/catch idiom (lines 15–20, 49–51) [VERIFIED]
- `shared/types/fhir.ts:175` — `QualityStatus` type union (no `'flagged'` value) [VERIFIED]
- `src/components/quality/QualityCaseList.tsx:27,138` — `filterStatus` prop type, filter select options [VERIFIED]
- `src/App.tsx:59,61` — `/quality` = ProtectedRoute, `/doc-quality` = QualityRoute [VERIFIED]
- `src/i18n/translations.ts:844–861` — existing i18n keys; `reviewTherapyBreakers` / `reviewFlaggedCases` NOT found [VERIFIED]
- `src/components/outcomes/OutcomesView.tsx:83` — `useSearchParams` deep-link pattern [VERIFIED]
- `src/pages/AnalysisPage.tsx:52–59` — `?tab=`/`?cohort=`/`?filters=` read-on-mount pattern [VERIFIED]
- `vitest.config.ts` — test environment (node default, jsdom per-file) [VERIFIED]
- `tests/setup.ts` — `MockBroadcastChannel` global shim [VERIFIED]
- `tests/authHeaders.test.ts` — `vi.stubGlobal` localStorage mock pattern [VERIFIED]

### Secondary (MEDIUM confidence)
- `src/context/LanguageContext.tsx` — localStorage pattern (NOT guarded — ThemeContext pattern is preferred) [VERIFIED]

---

## Metadata

**Confidence breakdown:**
- Logout integration points: HIGH — exact file, function, line numbers verified
- Username source: HIGH — `user.username` from `useAuth()` confirmed
- QualityPage filter vocabulary: HIGH — type verified in `shared/types/fhir.ts:175`
- `?status=flagged` type mismatch: HIGH — confirmed, `'flagged'` is not in `QualityStatus`
- localStorage idiom: HIGH — ThemeContext pattern read verbatim
- Test conventions: HIGH — existing test files confirm patterns
- i18n key gaps: HIGH — `translations.ts` read to end; `reviewTherapyBreakers` absent

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (stable codebase; 30-day horizon)
