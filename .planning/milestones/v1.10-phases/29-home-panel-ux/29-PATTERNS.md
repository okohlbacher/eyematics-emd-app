# Phase 29: Home Panel UX - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 9 (2 new, 7 modified — including 4 new test files)
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/services/recentActivityStore.ts` | service | CRUD (localStorage) | `src/context/ThemeContext.tsx` | role-match (same localStorage idiom) |
| `src/hooks/useRecentActivity.ts` | hook | request-response (store wrapper) | `src/hooks/useCaseData.ts` | role-match (custom hook returning derived state) |
| `src/pages/LandingPage.tsx` | page (modified) | request-response | self (center-row pattern lines 176-228) | exact (same file, same row pattern) |
| `src/pages/QualityPage.tsx` | page (modified) | request-response | `src/pages/AnalysisPage.tsx` | exact (same useSearchParams read-on-mount pattern) |
| `src/context/AuthContext.tsx` | context (modified) | request-response | self (performLogout lines 132-145) | exact (insertion point identified) |
| `src/services/authHeaders.ts` | service (modified) | event-driven (BroadcastChannel) | self (bc.addEventListener lines 23-34) | exact (insertion point identified) |
| `src/i18n/translations.ts` | config (modified) | — | self (attention* keys lines 851-861) | exact (same key block, same structure) |
| `tests/recentActivityStore.test.ts` | test (new) | — | `tests/authHeaders.test.ts` | exact (vi.stubGlobal localStorage mock pattern) |
| `tests/landingPageAlerts.test.tsx` | test (new) | — | existing component tests using MemoryRouter | role-match |
| `tests/qualityPageDeepLink.test.tsx` | test (new) | — | existing component tests using MemoryRouter | role-match |
| `tests/jumpBackIn.test.tsx` | test (new) | — | existing component tests using MemoryRouter | role-match |

---

## Pattern Assignments

### `src/services/recentActivityStore.ts` (service, CRUD)

**Analog:** `src/context/ThemeContext.tsx`

**Storage key convention** (ThemeContext.tsx line 13):
```typescript
// ThemeContext uses the 'emd-' prefix convention
const STORAGE_KEY = 'emd-theme';

// recentActivityStore follows the same prefix, but per-username:
// (from CONTEXT.md D-01 — locked decision)
function storageKey(username: string): string {
  return `emd-recent:${username}`;
}
```

**localStorage read pattern** (ThemeContext.tsx lines 15-21):
```typescript
function readStored(): Theme {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch { /* ignore */ }
  return 'light';
}
```
Copy this pattern verbatim. For the store, the read function parses JSON and validates the array shape before trusting it. The outer `try/catch` silences both `localStorage.getItem` throws (private browsing) and `JSON.parse` failures.

**localStorage write pattern** (ThemeContext.tsx lines 49-51):
```typescript
const setTheme = useCallback((t: Theme) => {
  setThemeState(t);
  try { localStorage.setItem(STORAGE_KEY, t); } catch { /* ignore */ }
}, []);
```
Copy the inline try/catch form for the `record()` and `clear()` functions.

**DO NOT use** `src/context/LanguageContext.tsx` as the analog — its localStorage calls are unwrapped (no try/catch). ThemeContext is the only guarded pattern in the project.

**Record shape** (from UI-SPEC Component Inventory):
```typescript
export interface RecentActivityEntry {
  id: string;        // caseId or stable key for non-case views
  label: string;     // pseudonym or view name
  sub: string;       // "Quality review", "Outcomes", "Analysis"
  path: string;      // full route + query string, e.g. "/quality?therapy=breaker"
  visitedAt: number; // Date.now() timestamp
}
```

**Full store implementation skeleton** (from RESEARCH.md Code Examples — verified pattern):
```typescript
const MAX_ENTRIES = 5;

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
    const filtered = entries.filter((e) => e.id !== entry.id);  // dedupe
    const next = [{ ...entry, visitedAt: Date.now() }, ...filtered].slice(0, MAX_ENTRIES);
    localStorage.setItem(storageKey(username), JSON.stringify(next));
  } catch { /* ignore */ }
}

export function clear(username: string): void {
  try {
    localStorage.removeItem(storageKey(username));
  } catch { /* ignore */ }
}

/** Clear all emd-recent:* keys — used by cross-tab logout where username is unavailable */
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

---

### `src/hooks/useRecentActivity.ts` (hook, request-response)

**Analog:** `src/hooks/useCaseData.ts`

**Hook structure pattern** (useCaseData.ts lines 16-21):
```typescript
// useCaseData: named export, receives params, returns derived data object
export function useCaseData(
  patientCase: PatientCase | undefined,
  cases: PatientCase[],
  locale: string,
  t: (key: TranslationKey) => string,
) {
  // useMemo chains...
  return { cohortAvgVisus, cohortAvgCrt, ... };
}
```

For `useRecentActivity`, the hook calls `useAuth()` internally (no params), mirrors the `useState` + `useCallback` + `useEffect` composition pattern from ThemeContext:

**Username source** (AuthContext.tsx lines 23-27 — verified):
```typescript
// User interface has username: string — access via useAuth()
export interface User {
  username: string;
  role: UserRole;
  centers: string[];
}
// In the hook: const { user } = useAuth();
// Key: user?.username ?? ''  (null-safe — hook may render before auth resolves)
```

**Hook implementation skeleton** (from RESEARCH.md Code Examples — verified pattern):
```typescript
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

**Empty dependency array warning:** Recording `useEffect` in consuming pages MUST use `[]` (mount-only) or a stable identity dep (e.g. `caseId`) — never include the component's main render state. See RESEARCH.md Pitfall 4.

---

### `src/pages/LandingPage.tsx` (page, modified)

**Analog:** self — existing center-row pattern in the same file (lines 176-228)

**Center-row interactive row pattern** (LandingPage.tsx lines 176-228 — exact):
```typescript
// The center-row is the canonical interactive-row template in LandingPage.
// Jump Back In rows must replicate this exact accessibility pattern:
<div
  key={center.id}
  role="button"
  tabIndex={0}
  onClick={() => navigate('/doc-quality')}
  onKeyDown={(e) => e.key === 'Enter' && navigate('/doc-quality')}
  className="grid items-center gap-3.5 px-5 py-3.5 cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors"
  style={{
    gridTemplateColumns: '36px 1fr 90px 110px 16px',
    borderBottom: i < centers.length - 1 ? '1px solid var(--color-line)' : 'none',
  }}
>
  {/* content */}
  <ChevronRight className="w-3.5 h-3.5 text-[var(--color-ink-3)]" />
</div>
```

**Jump Back In row adaptation** (from UI-SPEC Interaction Contract):
- `gridTemplateColumns: '1fr auto'` (simpler — label + chevron only)
- `px-5 py-3` (slightly tighter than center-row's `py-3.5`)
- Primary label: `text-[13px] font-semibold text-[var(--color-ink)]`
- Sub-label: `text-[13px] text-[var(--color-ink-3)]` (regular weight, not semibold)
- `ChevronRight aria-hidden="true"` — identical to center-row
- Navigate via `navigate(entry.path)` — same `useNavigate` hook already imported

**Empty state block to preserve** (LandingPage.tsx lines 245-250):
```typescript
<div
  data-testid="jump-back-in-empty"
  className="py-3 text-center text-[12px] text-[var(--color-ink-3)]"
>
  {t('jumpBackInEmpty')}
</div>
```
Keep this as the `entries.length === 0` branch. Do NOT remove the `data-testid` (test anchor).

**Review button targets to change** (LandingPage.tsx lines 267, 281-285):
```typescript
// BEFORE (line 267):
<Button variant="ghost" size="sm" onClick={() => navigate('/cohort')}>
// AFTER:
<Button variant="ghost" size="sm" aria-label={t('reviewTherapyBreakers')} onClick={() => navigate('/quality?therapy=breaker')}>

// BEFORE (lines 281-285):
{canSeeDocQuality && (
  <Button variant="ghost" size="sm" onClick={() => navigate('/doc-quality')}>
// AFTER (remove gate per UI-SPEC — /quality is ProtectedRoute, not QualityRoute):
<Button variant="ghost" size="sm" aria-label={t('reviewFlaggedCases')} onClick={() => navigate('/quality?status=flagged')}>
```

**Imports to add** (alongside existing import of `useNavigate` on line 11):
```typescript
import { useRecentActivity } from '../hooks/useRecentActivity';
// ChevronRight already imported (line 3)
// useNavigate already imported (line 11)
```

---

### `src/pages/QualityPage.tsx` (page, modified)

**Analog:** `src/pages/AnalysisPage.tsx` (lines 52-59)

**useSearchParams import and read-on-mount pattern** (AnalysisPage.tsx lines 7-8, 52-59):
```typescript
// Import (line 8 in AnalysisPage):
import { useSearchParams } from 'react-router-dom';

// Inside component — useSearchParams MUST be called before any conditional return:
const [searchParams, setSearchParams] = useSearchParams();

// Read params via useMemo (fires once on mount; AnalysisPage.tsx:56-59):
const tab: AnalysisTab = useMemo(() => {
  const raw = searchParams.get('tab');
  return isAnalysisTab(raw) ? raw : 'aggregate';
}, [searchParams]);
```

**QualityPage adaptation** — replace the two `useState` initialisers (QualityPage.tsx lines 89-91) with lazy-initializer form:
```typescript
// Add before existing useState declarations (after line 82 navigate/locale/t):
const [searchParams] = useSearchParams();  // read-only — no setter needed

// Replace (current QualityPage.tsx:89):
const [filterStatus, setFilterStatus] = useState<QualityStatus | 'all'>('all');
// With:
const [filterStatus, setFilterStatus] = useState<QualityStatus | 'all'>(() => {
  const v = searchParams.get('status');
  // 'flagged' → map to 'in_progress': cases with open quality flag are caseStatus='in_progress'
  // See RESEARCH.md Pitfall 1 — 'flagged' is not a valid QualityStatus value
  return v === 'flagged' ? 'in_progress' : 'all';
});

// Replace (current QualityPage.tsx:91):
const [filterTherapy, setFilterTherapy] = useState<string>('all');
// With:
const [filterTherapy, setFilterTherapy] = useState<string>(() => {
  const v = searchParams.get('therapy');
  return v === 'breaker' || v === 'interrupter' ? v : 'all';
});
```

**Why lazy initializer, not useEffect** (from RESEARCH.md Pitfall 3 and AnalysisPage.tsx pattern):
- `useState(lazyFn)` reads the param exactly once at mount — zero re-render flash.
- `useEffect(() => setFilter(...), [])` causes a double-render (initial `'all'`, then param value).
- AnalysisPage uses `useMemo` over `searchParams`; QualityPage uses `useState` lazy initializer since the filter must remain mutable after mount (user can change it via the select).

**OutcomesView.tsx useSearchParams pattern** (lines 83-84 — alternate reference):
```typescript
// OutcomesView also uses [searchParams, setSearchParams] at component top:
const [searchParams, setSearchParams] = useSearchParams();
```
QualityPage only needs the read-only destructure `[searchParams]` (no setter) since URL params seed state once; subsequent filter changes go through existing `setFilterTherapy`/`setFilterStatus`.

**Import to add** (QualityPage.tsx line 4 — add `useSearchParams`):
```typescript
// Current line 4:
import { useNavigate } from 'react-router-dom';
// Add useSearchParams:
import { useNavigate, useSearchParams } from 'react-router-dom';
```

---

### `src/context/AuthContext.tsx` (context, modified)

**Analog:** self — `performLogout` function (lines 132-145)

**Current performLogout** (AuthContext.tsx lines 132-145 — exact):
```typescript
const performLogout = useCallback((auto = false) => {
  void auto; // auto-logout logged server-side via audit middleware
  void serverLogout();
  broadcastLogout();
  setUser(null);
  setToken(null);
  setInactivityWarning(false);
  sessionStorage.removeItem('emd-token');
  invalidateBundleCache();
}, []);
```

**Insertion point and ordering constraint** (from RESEARCH.md Integration Points §1):
- Call `recentActivityStore.clear(user?.username ?? '')` BEFORE `setUser(null)`
- Reason: `user` is in scope in the closure at that moment; after `setUser(null)` the ref is cleared
- The `user?.username` null-safe form handles the edge case where `performLogout` is called with no active user

**Modified performLogout:**
```typescript
const performLogout = useCallback((auto = false) => {
  void auto;
  void serverLogout();
  broadcastLogout();
  recentActivityStore.clear(user?.username ?? '');  // D-02: clear before setUser(null)
  setUser(null);
  setToken(null);
  setInactivityWarning(false);
  sessionStorage.removeItem('emd-token');
  invalidateBundleCache();
}, [user]);  // ADD user to dependency array since it's now read in the callback
```

**Import to add** (top of AuthContext.tsx):
```typescript
import * as recentActivityStore from '../services/recentActivityStore';
```

---

### `src/services/authHeaders.ts` (service, modified)

**Analog:** self — BroadcastChannel message handler (lines 23-34)

**Current handler** (authHeaders.ts lines 23-34 — exact):
```typescript
bc?.addEventListener('message', (e: MessageEvent) => {
  const msg = e.data as { type?: string; token?: string } | null | undefined;
  if (!msg || typeof msg.type !== 'string') return;
  if (msg.type === 'refresh-success' && typeof msg.token === 'string') {
    sessionStorage.setItem('emd-token', msg.token);
  } else if (msg.type === 'logout') {
    sessionStorage.removeItem('emd-token');
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }
});
```

**Insertion point and ordering constraint** (from RESEARCH.md Integration Points §1 and Pitfall 2):
- Call `recentActivityStore.clearAll()` BEFORE `sessionStorage.removeItem('emd-token')`
- Reason: `clearAll()` iterates `localStorage` keys — this is safe at any point; but the principle of clearing data before clearing the session credential is a logical ordering
- Use `clearAll()` (not `clear(username)`) because this module-level listener has no React context to read the username from; decoding the token from sessionStorage before removal is fragile
- This is a plain TypeScript module — no hooks allowed; `recentActivityStore` is a plain module import

**Modified logout branch:**
```typescript
} else if (msg.type === 'logout') {
  recentActivityStore.clearAll();  // D-02 cross-tab: clear before token removal
  sessionStorage.removeItem('emd-token');
  if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
}
```

**Import to add** (top of authHeaders.ts, after existing constants):
```typescript
import * as recentActivityStore from './recentActivityStore';
```

---

### `src/i18n/translations.ts` (config, modified)

**Analog:** self — `attention*` keys block (lines 851-861)

**Existing block structure to follow** (translations.ts lines 851-861):
```typescript
attentionNeeded: { de: 'Aufmerksamkeit erforderlich', en: 'Attention needed' },
attentionTherapyBreakers: { de: 'Therapie-Abbrecher', en: 'Therapy breakers' },
attentionTherapyBreakersSub: {
  de: 'Fälle mit Lücke > 365 Tagen prüfen',
  en: 'Review cases with gap > 365 days',
},
attentionImplausibleCrt: { de: 'Unplausible CRT-Werte', en: 'Implausible CRT readings' },
attentionImplausibleCrtSub: {
  de: 'Für Qualitätsprüfung markiert',
  en: 'Flagged for quality review',
},
review: { de: 'Prüfen', en: 'Review' },
```

**New keys to insert** (after `review` key, before the session management comment — line 861):
```typescript
reviewTherapyBreakers: {
  de: 'Therapie-Abbrecher prüfen',
  en: 'Review therapy breakers',
},
reviewFlaggedCases: {
  de: 'Markierte Fälle prüfen',
  en: 'Review flagged cases',
},
```

These keys are used as `aria-label` values on the two Review buttons (UI-SPEC Attention needed panel). The `review` key (line 861) provides the visible button text; the new keys provide screen-reader distinguishable labels.

**Verification:** `reviewTherapyBreakers` and `reviewFlaggedCases` are confirmed absent from `translations.ts` (file ends at line 885 with session TTL keys; neither key appears anywhere). Must be added.

---

## Test File Patterns

### `tests/recentActivityStore.test.ts` (new, node environment)

**Analog:** `tests/authHeaders.test.ts` (exact match — vi.stubGlobal, node environment, no jsdom)

**vi.stubGlobal localStorage mock** (authHeaders.test.ts lines 8-13, adapted for localStorage):
```typescript
// From authHeaders.test.ts — the project's canonical vi.stubGlobal pattern:
const storage: Record<string, string> = {};
vi.stubGlobal('sessionStorage', {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, val: string) => { storage[key] = val; },
  removeItem: (key: string) => { delete storage[key]; },
});

// For recentActivityStore.test.ts — adapt for localStorage with .length and .key():
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

**beforeEach reset pattern** (authHeaders.test.ts lines 18-20):
```typescript
beforeEach(() => {
  for (const key of Object.keys(storage)) delete storage[key];
});
```

**Test structure** (from RESEARCH.md Validation Architecture):
- No `// @vitest-environment jsdom` docblock — default node environment is sufficient
- Import pattern: `vi.stubGlobal` BEFORE importing the module under test (same as authHeaders.test.ts line 15)
- Test `record` dedupe + move-to-front, cap at 5, `clear`, `clearAll`, and localStorage throw swallowing

### `tests/landingPageAlerts.test.tsx`, `tests/qualityPageDeepLink.test.tsx`, `tests/jumpBackIn.test.tsx` (new, jsdom)

**Pattern:** `// @vitest-environment jsdom` docblock at top of file.

**Module-level mocking pattern** (from RESEARCH.md Test Conventions):
```typescript
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { username: 'test-user', role: 'researcher', centers: [] }, ... }),
  QUALITY_ROLES: ['admin', 'clinic_lead', 'data_manager'],
}));
vi.mock('../src/context/DataContext', () => ({
  useData: () => ({ activeCases: [], centers: [], cases: [], loading: false, ... }),
}));
vi.mock('../src/context/LanguageContext', () => ({
  useLanguage: () => ({ t: (k: string) => k, locale: 'en' }),
}));
vi.mock('../src/hooks/useRecentActivity', () => ({
  useRecentActivity: () => ({ entries: [], record: vi.fn(), clear: vi.fn() }),
}));
```

**RTL assertion convention** (CLAUDE.md — no jest-dom):
```typescript
// CORRECT:
expect(screen.queryByText('some text')).not.toBeNull();
expect(screen.queryByText('absent text')).toBeNull();
// WRONG (jest-dom not in this project):
// expect(screen.getByText('...')).toBeInTheDocument();
```

**MemoryRouter + initialEntries for deep-link tests** (qualityPageDeepLink):
```typescript
render(
  <MemoryRouter initialEntries={['/quality?therapy=breaker']}>
    {/* QualityPage with mocked deps */}
  </MemoryRouter>
);
```

---

## Shared Patterns

### localStorage try/catch idiom
**Source:** `src/context/ThemeContext.tsx` lines 15-21 (read) and 49-51 (write)
**Apply to:** `src/services/recentActivityStore.ts` — ALL localStorage calls
```typescript
// Read:
try {
  const raw = localStorage.getItem(key);
  // validate before using
} catch { /* ignore */ }

// Write:
try { localStorage.setItem(key, value); } catch { /* ignore */ }

// Remove:
try { localStorage.removeItem(key); } catch { /* ignore */ }
```

### useSearchParams read-on-mount
**Source:** `src/pages/AnalysisPage.tsx` lines 52-59 and `src/components/outcomes/OutcomesView.tsx` lines 83-84
**Apply to:** `src/pages/QualityPage.tsx`
- Call `useSearchParams()` at component top (before any conditional returns)
- Use `useState` lazy initializer `useState<T>(() => { ... })` to read params once at mount
- Do NOT use `useEffect` to seed filter state from URL params (causes double-render)

### Interactive row accessibility
**Source:** `src/pages/LandingPage.tsx` lines 180-186 (center-row pattern)
**Apply to:** Jump Back In rows within `LandingPage.tsx`
```typescript
role="button"
tabIndex={0}
onClick={() => navigate(entry.path)}
onKeyDown={(e) => e.key === 'Enter' && navigate(entry.path)}
className="... cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors"
```

### Import namespace pattern for plain-module services
**Source:** `src/context/AuthContext.tsx` line 3 (existing service imports)
**Apply to:** All files importing `recentActivityStore`
```typescript
import * as recentActivityStore from '../services/recentActivityStore';
// Allows recentActivityStore.clear(), recentActivityStore.clearAll(), etc.
```

### useCallback with correct dependencies
**Source:** `src/context/AuthContext.tsx` lines 132-145 (`performLogout` useCallback)
**Apply to:** Modified `performLogout` (now reads `user` — must add `user` to dep array)
```typescript
const performLogout = useCallback((auto = false) => {
  // ... reads user?.username
}, [user]);  // user is now a dependency
```

---

## No Analog Found

All files have analogs. No entries needed here.

---

## Metadata

**Analog search scope:** `src/context/`, `src/pages/`, `src/hooks/`, `src/services/`, `src/i18n/`, `tests/`
**Files scanned:** 11 source files read (ThemeContext.tsx, AnalysisPage.tsx, LandingPage.tsx, QualityPage.tsx, AuthContext.tsx, authHeaders.ts, translations.ts, OutcomesView.tsx, useCaseData.ts, authHeaders.test.ts — plus full context from CONTEXT.md, RESEARCH.md, UI-SPEC.md)
**Pattern extraction date:** 2026-05-21
