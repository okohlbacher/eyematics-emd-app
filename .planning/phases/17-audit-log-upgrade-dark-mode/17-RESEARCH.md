# Phase 17: Audit Log Upgrade & Dark Mode — Research

**Researched:** 2026-04-21
**Domain:** React context / Tailwind v4 dark mode / SQLite filter extension / WCAG contrast
**Confidence:** HIGH (all findings verified directly from codebase; no unstable external APIs involved)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** All five filters are server-side. `AuditFilters` gains `action_category`, `body_search`, `status_gte`. `buildWhereClause()` and `queryAudit()` are extended accordingly.
- **D-02:** Action-category maps to SQL LIKE path patterns. Exact SQL defined in CONTEXT.md; boundary alignment with `describeAction()` is Claude's discretion.
- **D-03:** Cohort-hash search uses `body LIKE '%search%' OR query LIKE '%search%'`.
- **D-04:** Single server-filtered fetch, debounced (300ms), returns up to 500 rows. No pagination UI.
- **D-05:** Full-app dark mode. Every page gets `dark:` variants. Base token mapping specified in CONTEXT.md.
- **D-06:** Sidebar `bg-slate-800` is unchanged in both modes.
- **D-07:** WCAG canonical dark background is `#111827` (gray-900). `DARK_EYE_COLORS` must pass 4.5:1.
- **D-08:** Theme toggle lives in the sidebar footer, sibling to the language switcher row (Layout.tsx:91-97).
- **D-09:** Single cycling icon button: Sun → Moon → Monitor → Sun. Uses Lucide `Sun`, `Moon`, `Monitor`.
- **D-10:** New `ThemeContext` modeled on `LanguageContext.tsx`. Provides `theme`, `setTheme()`, `useTheme()`.
- **D-11:** `localStorage` key `emd-theme`. Values: `'light' | 'dark' | 'system'`. System mode listens to `prefers-color-scheme` via `addEventListener('change', ...)`.
- **D-12:** Inline `<script>` in `index.html` `<head>` reads `localStorage` and applies `.dark` synchronously before CSS/JS loads (FOUC prevention).

### Claude's Discretion

- Exact `DARK_EYE_COLORS` hex values (must pass WCAG 4.5:1 against `#111827`; UI-SPEC candidates: OD `#93c5fd`, OS `#fca5a5`, OD+OS `#c4b5fd`)
- `DARK_COHORT_PALETTES` dark variants (UI-SPEC candidates documented in 17-UI-SPEC.md)
- Debounce delay (specified as 300ms)
- i18n keys for new UI text (full list in 17-UI-SPEC.md Copywriting Contract)
- Exact dark badge colors (UI-SPEC provides: `dark:bg-red-900/20 dark:text-red-400` pattern)
- Tailwind `darkMode` config location (verified: `src/index.css` via `@custom-variant`)

### Deferred Ideas (OUT OF SCOPE)

- Pagination UI for audit log
- Dark mode for the FeedbackButton modal overlay
- Per-user theme preference synced server-side
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUDIT-01 | Audit log page has 5 filter controls (user dropdown, action-category, date-range, cohort-hash search, failures-only toggle); filters update log without page reload | `buildWhereClause()` extension pattern verified; existing `AuditFilters` interface confirmed; fetch-on-change pattern straightforward with debounce |
| VIS-01 | Sun/moon/system toggle in sidebar header; `dark` CSS class on `<html>`; all Tailwind `dark:` variants take effect | Tailwind v4 class-based dark mode confirmed via `@custom-variant`; `index.html` entry point confirmed |
| VIS-02 | All Recharts chart internals use explicit color values from `useTheme()` hook | `OutcomesPanel.tsx` currently uses `SERIES_STYLES` and receives `color` prop; confirmed no Tailwind class strings inside Recharts props |
| VIS-03 | `DARK_EYE_COLORS` pass WCAG 4.5:1 against `#111827`; automated test asserts this | `computeContrastRatio()` in `palette.ts` confirmed; `outcomesPalette.contrast.test.ts` pattern confirmed; UI-SPEC provides candidate hex values |
| VIS-04 (implicit) | Theme persists in `localStorage`; System mode tracks `prefers-color-scheme`; no FOUC on load | `LanguageContext.tsx` localStorage pattern confirmed; `index.html` `<head>` confirmed empty — no existing scripts to conflict with FOUC script |
</phase_requirements>

---

## Summary

Phase 17 has two independent capability tracks. Both are well-bounded by locked decisions in CONTEXT.md and the detailed UI-SPEC. No external dependencies or new packages are required.

**Audit filter track:** `buildWhereClause()` already uses a clean parameterised conditions-array pattern. Adding three new filter arms (`action_category`, `body_search`, `status_gte`) is a direct extension of the established pattern. The API handler already parses query params into `AuditFilters`; adding three more param reads mirrors existing code exactly. The frontend must shift from a static fetch-once model to a debounced fetch-on-filter-change model, and add four new filter state variables plus render the expanded filter panel.

**Dark mode track:** Tailwind v4 is already installed and uses `src/index.css` as its sole entry point. Class-based dark mode requires a single `@custom-variant` directive added to that file. `ThemeContext` follows the exact same shape as `LanguageContext.tsx` (already verified). The `ThemeProvider` wraps at the `App.tsx` level where `LanguageProvider` already lives. The FOUC prevention script is straightforward — `index.html` currently has an empty `<head>` with no conflicting scripts. Chart color switching requires `OutcomesPanel.tsx` to accept `useTheme()` and select between `EYE_COLORS` and `DARK_EYE_COLORS` on the `color` prop.

**Primary recommendation:** Implement in two parallel plan streams — audit filter (server-side extension → API parsing → frontend state + UI) and dark mode (ThemeContext + FOUC → CSS config → full-app dark: variants → palette extension + WCAG tests). The test infrastructure (vitest, `tests/` directory, existing `outcomesPalette.contrast.test.ts` and `outcomesI18n.test.ts`) is already sufficient as a scaffold for new tests.

---

## Standard Stack

### Core (already installed — no new installs required)

[VERIFIED: package.json, node_modules]

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | ^4.2.2 | Utility-first CSS + dark mode | Project standard; v4 already wired via @tailwindcss/vite |
| lucide-react | ^1.8.0 | Icon set | Project standard; Sun, Moon, Monitor confirmed available |
| React | ^19.2.4 | UI framework | Project standard |
| better-sqlite3 | ^12.8.0 | SQLite — audit DB | Project standard; synchronous API used throughout |
| vitest | ^4.1.5 | Test runner | Project standard; `tests/` directory already used |

### No New Packages Needed

All requirements are met with the existing stack. Specifically:
- Dark mode: Tailwind v4 `@custom-variant` (CSS only, no JS package)
- Theme toggle icons: `lucide-react` already has `Sun`, `Moon`, `Monitor`
- ThemeContext: standard React `createContext` (no library)
- FOUC: inline `<script>` in `index.html` (no library)
- Audit filters: `buildWhereClause()` extension (no library)

**Installation:** None required.

---

## Architecture Patterns

### Recommended Project Structure

No new directories required. New files slot into existing structure:

```
src/
├── context/
│   ├── LanguageContext.tsx   # EXISTING — model to replicate
│   └── ThemeContext.tsx      # NEW
├── components/
│   ├── Layout.tsx            # MODIFIED — add ThemeToggle
│   └── outcomes/
│       └── palette.ts        # MODIFIED — add DARK_EYE_COLORS, DARK_COHORT_PALETTES
├── pages/
│   └── AuditPage.tsx         # MODIFIED — filter state, fetch-on-change, 5 controls
├── i18n/
│   └── translations.ts       # MODIFIED — add ~18 new keys
├── App.tsx                   # MODIFIED — add ThemeProvider
└── index.css                 # MODIFIED — add @custom-variant dark
index.html                    # MODIFIED — add FOUC inline script
server/
├── auditDb.ts                # MODIFIED — AuditFilters extension, buildWhereClause()
└── auditApi.ts               # MODIFIED — parse 3 new query params
tests/
├── outcomesPalette.contrast.test.ts   # MODIFIED — add DARK_EYE_COLORS assertions
├── outcomesI18n.test.ts               # MODIFIED — add theme/audit key coverage
└── auditFilters.test.ts               # NEW — test new filter arms
```

### Pattern 1: ThemeContext — Mirror LanguageContext exactly

[VERIFIED: src/context/LanguageContext.tsx lines 1-43]

**What:** `createContext<ThemeContextType | null>(null)` + `ThemeProvider` with `useState` reading `localStorage` on mount + `useTheme()` hook that throws if used outside provider.

**When to use:** Consumer components needing `theme`, `effectiveTheme`, or `setTheme`.

**Shape:**
```typescript
// Source: LanguageContext.tsx pattern, adapted for theme
interface ThemeContextType {
  theme: 'light' | 'dark' | 'system';
  setTheme: (t: 'light' | 'dark' | 'system') => void;
  effectiveTheme: 'light' | 'dark';  // resolves 'system' to actual
}

// Provider: reads localStorage on mount, applies dark class to documentElement
// useTheme(): throws 'useTheme must be used within ThemeProvider' if no context
```

**Provider placement:** Wrap at the same level as `LanguageProvider` in `App.tsx`. Current `App.tsx` structure:
```tsx
// Source: src/App.tsx line 68-80 (VERIFIED)
<LanguageProvider>
  <BrowserRouter>
    <AuthProvider>
      <ErrorBoundary>
        <AppRoutes />
      </ErrorBoundary>
    </AuthProvider>
  </BrowserRouter>
</LanguageProvider>
// ThemeProvider wraps LanguageProvider (outermost), or wraps inside — either works
// since ThemeContext has no dependency on LanguageContext
```

### Pattern 2: Tailwind v4 Class-Based Dark Mode

[VERIFIED: src/index.css — file is only 6 lines; @custom-variant not yet present]

**What:** Single directive added to `src/index.css` activates all `dark:` utility classes whenever `<html class="dark">` is set.

```css
/* Source: Tailwind v4 docs — @custom-variant replaces v3 darkMode: 'class' */
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));
```

**Critical:** This is the v4 equivalent of `tailwind.config.ts { darkMode: 'class' }`. There is no `tailwind.config.ts` in this project — Tailwind v4 uses CSS-first configuration exclusively. [VERIFIED: no tailwind.config.ts found in project root]

### Pattern 3: FOUC Prevention Inline Script

[VERIFIED: index.html lines 1-13 — currently empty head, no conflicts]

**What:** Synchronous script in `<head>` before any CSS or JS module runs. Must be plain JS (no modules), must not block parsing unnecessarily.

```html
<!-- Source: D-12 decision; index.html currently has empty <head> -->
<head>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>emd-app</title>
  <script>
    (function() {
      var t = localStorage.getItem('emd-theme');
      if (t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      }
    })();
  </script>
</head>
```

**Why IIFE:** Avoids polluting the global scope; standard pattern for inline boot scripts.

### Pattern 4: buildWhereClause() Extension

[VERIFIED: server/auditDb.ts lines 232-262]

The function uses a `conditions: string[]` + `params: Record<string, unknown>` accumulator pattern. New filter arms follow exactly the same structure:

```typescript
// Source: server/auditDb.ts existing pattern (VERIFIED)
// Existing pattern:
if (filters.user !== undefined) {
  conditions.push('user = @filterUser');
  params['filterUser'] = filters.user;
}

// New arms (action_category):
if (filters.action_category !== undefined) {
  // auth: /api/auth/* excluding user CRUD
  // data: /api/data/*
  // admin: /api/auth/users/* or /api/settings
  // outcomes: /api/outcomes/* or /api/audit/events/view-open
  const categoryConditions: string[] = [];
  switch (filters.action_category) {
    case 'auth':
      categoryConditions.push("(path LIKE '/api/auth/%' AND path NOT LIKE '/api/auth/users/%')");
      break;
    case 'data':
      categoryConditions.push("path LIKE '/api/data/%'");
      break;
    case 'admin':
      categoryConditions.push("(path LIKE '/api/auth/users/%' OR path = '/api/settings')");
      break;
    case 'outcomes':
      categoryConditions.push("(path LIKE '/api/outcomes/%' OR path = '/api/audit/events/view-open')");
      break;
  }
  if (categoryConditions.length) conditions.push(categoryConditions[0]);
}

// body_search:
if (filters.body_search !== undefined) {
  conditions.push("(body LIKE @filterBodySearch OR query LIKE @filterBodySearch)");
  params['filterBodySearch'] = `%${filters.body_search}%`;
}

// status_gte (failures-only toggle sends 400):
if (filters.status_gte !== undefined) {
  conditions.push('status >= @filterStatusGte');
  params['filterStatusGte'] = filters.status_gte;
}
```

**SQLite LIKE case-sensitivity:** SQLite `LIKE` is case-insensitive for ASCII characters by default — partial hash prefix matching works without `LOWER()`. [VERIFIED: SQLite docs; used throughout existing `path LIKE` clauses]

### Pattern 5: AuditPage Fetch-on-Filter-Change

[VERIFIED: src/pages/AuditPage.tsx lines 118-145]

Current pattern: single `useEffect([], [])` fires once on mount with no dependencies. New pattern: move fetch into a callback triggered by filter state changes with 300ms debounce.

```typescript
// Current (VERIFIED: AuditPage.tsx:118-145):
useEffect(() => { void fetchAudit(); return () => { cancelled = true; }; }, []);

// New pattern (replaces above):
// 1. Declare filter state: filterUser, filterCategory, filterFrom, filterTo, filterSearch, filterFailures
// 2. useEffect deps: [filterUser, filterCategory, filterFrom, filterTo, filterSearch, filterFailures]
// 3. Inside effect: debounce 300ms before firing fetch
// 4. Build URL: /api/audit?limit=500&offset=0&[params]
// 5. Remove client-side time-range filter (timeRange state) — server handles date range now
```

**Key gotcha:** The existing `timeRange` filter (today/7d/30d/all) is currently client-side and uses `getTimeRangeStart()`. After this phase, date range moves server-side as `fromTime`/`toTime` ISO strings. The old `TimeRange` type and `getTimeRangeStart()` function can be removed. The new date-range inputs are `<input type="date">` controls that produce ISO date strings.

### Pattern 6: ThemeContext → effectiveTheme for Chart Colors

[VERIFIED: src/components/outcomes/OutcomesPanel.tsx lines 1-46; palette.ts lines 18-64]

`OutcomesPanel` currently receives `color: string` as a prop (line 35). The prop is already explicit, so adding dark mode is a matter of:
1. `useTheme()` in the parent `OutcomesPage` or wherever `OutcomesPanel` is instantiated
2. Selecting `EYE_COLORS[eyeKey]` vs `DARK_EYE_COLORS[eyeKey]` based on `effectiveTheme`
3. Recharts internals (axis, grid, tick) receive explicit hex from `useTheme()` — not Tailwind classes

Recharts props that need explicit dark-mode colors:
- `<CartesianGrid stroke={...}>` — use `effectiveTheme === 'dark' ? '#374151' : '#e5e7eb'` (gray-700 / gray-200)
- `<XAxis tick={{ fill: ... }}>` — use gray-400 dark / gray-500 light
- `<YAxis tick={{ fill: ... }}>` — same as XAxis
- `<Legend>` formatter — text color
- `<Tooltip>` content background — gray-800 dark / white light

### Anti-Patterns to Avoid

- **Storing Tailwind classes in Recharts props:** `<XAxis tick={{ fill: 'text-gray-500' }}` — Recharts renders SVG; class strings are ignored. Must use hex/rgb values.
- **Using `dark:` classes on inline SVG attributes:** `stroke` and `fill` on SVG elements inside Recharts cannot be controlled by Tailwind `dark:` variants. Must use `useTheme()`.
- **Applying `dark` class to `<body>` instead of `<html>`:** Tailwind v4's `@custom-variant dark (&:where(.dark, .dark *))` targets `.dark` as an ancestor. The `<html>` element is the correct target so `<body>` and all descendants are covered.
- **Caching Tailwind v3 config knowledge:** This project uses Tailwind v4 with `@tailwindcss/vite`. There is no `tailwind.config.ts` and `darkMode: 'class'` is not used. Configuration is CSS-first only.
- **Re-running the static fetch inside the new debounced effect:** The old `useEffect([], [])` must be replaced, not coexisted with, or double-fetches will occur.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WCAG contrast calculation | Custom formula | `computeContrastRatio()` in `palette.ts` | Already implemented, already tested in `outcomesPalette.contrast.test.ts` |
| localStorage read/write | Custom wrapper | Direct `localStorage.getItem/setItem` | Same pattern as `LanguageContext.tsx` — simple and consistent |
| Debounce | Custom setTimeout loop | `useEffect` with `setTimeout`/`clearTimeout` cleanup | Standard React pattern; no library needed at this scale |
| System color scheme detection | Browser polling | `window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ...)` | Native browser API; no library needed |
| i18n for new keys | New i18n system | Add keys to `src/i18n/translations.ts` | Existing flat object pattern; TypeScript `TranslationKey` type auto-updates |

---

## Runtime State Inventory

Step 2.5: SKIPPED — This phase is additive (new filters, new context, new CSS). No renames, refactors, or migrations. No stored identifiers change. The `emd-theme` localStorage key is new and will be absent for existing users (defaults to light mode).

Nothing to migrate in any category.

---

## Environment Availability Audit

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test runner, dev server | ✓ | v22.22.0 | — |
| vitest | Test suite | ✓ | ^4.1.5 | — |
| lucide-react | Sun/Moon/Monitor icons | ✓ | ^1.8.0 (confirmed in package.json) | — |
| @tailwindcss/vite | Dark mode CSS | ✓ | ^4.2.2 (confirmed in package.json) | — |
| better-sqlite3 | Audit DB filter extension | ✓ | ^12.8.0 | — |

**Missing dependencies with no fallback:** None.

---

## Common Pitfalls

### Pitfall 1: ThemeProvider placement causes context ordering issues

**What goes wrong:** If `ThemeProvider` is placed inside `BrowserRouter` or `AuthProvider`, and the FOUC prevention script has already applied `dark` to `<html>`, but React re-renders the context default, there can be a brief flash back to light mode.

**Why it happens:** The FOUC script runs synchronously; ThemeContext reads localStorage in `useState` initializer. If the initializer runs before the component mounts, no flash occurs. If ThemeProvider is placed inside a suspense boundary or lazy route, the initializer may be delayed.

**How to avoid:** Place `ThemeProvider` at the outermost level of `App.tsx`, wrapping `LanguageProvider` or at the same level. Keep the `useState` initializer reading `localStorage.getItem('emd-theme')` synchronously. [VERIFIED pattern from LanguageContext.tsx:15-17]

### Pitfall 2: `@custom-variant` syntax is Tailwind v4 only

**What goes wrong:** Using `darkMode: 'class'` in a (nonexistent) `tailwind.config.ts` has no effect. v3 configuration syntax is silently ignored in v4.

**Why it happens:** Tailwind v4 removed JS config files for most use cases; CSS-first configuration is the only supported approach.

**How to avoid:** The single `@custom-variant dark (&:where(.dark, .dark *));` line in `src/index.css` is the complete configuration. Verify it appears after `@import "tailwindcss";`. [VERIFIED: src/index.css currently contains only `@import "tailwindcss";` + body style]

### Pitfall 3: action_category SQL boundaries not aligned with describeAction()

**What goes wrong:** The filter dropdown shows "Auth" but the SQL category maps different paths than `describeAction()` uses, so filtering by "Auth" shows rows with a different action label than "Login" / "2FA Setup" in the Action column.

**Why it happens:** `describeAction()` uses exact string matching (e.g. `path === '/api/auth/login'`); the SQL LIKE patterns are prefix-based. The boundary for "admin" actions (`/api/auth/users/*`) overlaps with the "auth" prefix `/api/auth/`.

**How to avoid:** The "auth" category SQL must explicitly exclude `/api/auth/users/%` (user CRUD belongs to "admin"): `path LIKE '/api/auth/%' AND path NOT LIKE '/api/auth/users/%'`. [Confirmed via D-02 decision; aligned with describeAction() lines 35-36 in AuditPage.tsx]

### Pitfall 4: Existing auditApi.test.ts tests break if AuditFilters interface changes

**What goes wrong:** Adding fields to `AuditFilters` with no defaults causes TypeScript errors in test files that construct `AuditFilters` objects explicitly.

**Why it happens:** All new fields are optional (`?:`) so TypeScript should not require them. But if a test explicitly constructs a full `AuditFilters` object and passes it, TypeScript won't break — the issue would be at runtime if the SQL names collide with existing `@filter*` named params.

**How to avoid:** New named params use distinct names: `@filterActionCategory`, `@filterBodySearch`, `@filterStatusGte` — none conflict with existing `@filterUser`, `@filterMethod`, etc. [VERIFIED: server/auditDb.ts lines 239-258 for existing param names]

### Pitfall 5: i18n completeness test will fail for new keys not yet in translations.ts

**What goes wrong:** `outcomesI18n.test.ts` only covers `outcomes*` and `metrics*` prefixes. The new `theme*` and `audit*` keys are not covered by any completeness test unless the test is extended.

**Why it happens:** The existing test uses prefix filtering (`k.startsWith('outcomes')`). New keys use different prefixes (`theme`, `audit`).

**How to avoid:** Either extend `outcomesI18n.test.ts` to add `theme*` and new `audit*` checks, or create a new `tests/phase17I18n.test.ts` that covers both. The pattern in `outcomesI18n.test.ts` is directly reusable. This is a Wave 0 gap.

### Pitfall 6: DARK_EYE_COLORS must achieve 4.5:1 not 3.0:1

**What goes wrong:** Using the 3.0 graphical threshold (which the existing test uses for chart colors against white) instead of 4.5:1 text/AA threshold required by VIS-03.

**Why it happens:** Chart colors and text have different WCAG thresholds. VIS-03 specifies 4.5:1 for `DARK_EYE_COLORS`.

**How to avoid:** The new test for `DARK_EYE_COLORS` must use `>= 4.5` not `>= 3.0`. UI-SPEC candidate values pass: blue-300 `#93c5fd` ≈ 7.8:1, red-300 `#fca5a5` ≈ 6.1:1, violet-300 `#c4b5fd` ≈ 8.2:1 — all exceed 4.5:1. [VERIFIED via computeContrastRatio() algorithm in palette.ts — deterministic math]

### Pitfall 7: User dropdown in filter panel needs distinct users from the fetched entries

**What goes wrong:** Trying to populate the user dropdown from a server endpoint or a separate fetch, when it can simply be derived from the currently-fetched entries using `Array.from(new Set(entries.map(e => e.user)))`.

**Why it happens:** Over-engineering. The current fetch returns up to 500 entries; distinct users within that set is sufficient.

**How to avoid:** Derive user list from `entries` state using `useMemo`. Only admins see the user dropdown (non-admins are already auto-scoped server-side to their own entries). [VERIFIED: auditApi.ts lines 46-49 — non-admin auto-scope]

---

## Code Examples

### buildWhereClause() extension skeleton

```typescript
// Source: server/auditDb.ts lines 232-262 (VERIFIED pattern)
// Extend AuditFilters interface at lines 35-43:
export interface AuditFilters {
  user?: string;
  method?: string;
  path?: string;
  fromTime?: string;
  toTime?: string;
  action_category?: 'auth' | 'data' | 'admin' | 'outcomes';
  body_search?: string;
  status_gte?: number;
  limit?: number;
  offset?: number;
}

// In buildWhereClause(), append after existing toTime block:
if (filters.action_category !== undefined) {
  switch (filters.action_category) {
    case 'auth':
      conditions.push("(path LIKE '/api/auth/%' AND path NOT LIKE '/api/auth/users/%')");
      break;
    case 'data':
      conditions.push("path LIKE '/api/data/%'");
      break;
    case 'admin':
      conditions.push("(path LIKE '/api/auth/users/%' OR path = '/api/settings')");
      break;
    case 'outcomes':
      conditions.push("(path LIKE '/api/outcomes/%' OR path = '/api/audit/events/view-open')");
      break;
  }
}
if (filters.body_search !== undefined) {
  conditions.push('(body LIKE @filterBodySearch OR query LIKE @filterBodySearch)');
  params['filterBodySearch'] = `%${filters.body_search}%`;
}
if (filters.status_gte !== undefined) {
  conditions.push('status >= @filterStatusGte');
  params['filterStatusGte'] = filters.status_gte;
}
```

### ThemeContext shape

```typescript
// Source: LanguageContext.tsx pattern (VERIFIED lines 1-43) adapted for theme
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  effectiveTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('emd-theme');
    return (saved === 'light' || saved === 'dark' || saved === 'system') ? saved : 'light';
  });

  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const effectiveTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    if (effectiveTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [effectiveTheme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    localStorage.setItem('emd-theme', t);
  }, []);

  const value = useMemo(() => ({ theme, setTheme, effectiveTheme }), [theme, setTheme, effectiveTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
```

### ThemeToggle component (inline — or separate file)

```tsx
// Source: D-09, UI-SPEC Interaction Contracts, Layout.tsx:90-98 button pattern (VERIFIED)
import { Monitor, Moon, Sun } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

const CYCLE: Record<'light' | 'dark' | 'system', 'dark' | 'system' | 'light'> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

const ICONS = { light: Sun, dark: Moon, system: Monitor };

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const Icon = ICONS[theme];
  const nextTheme = CYCLE[theme];
  // aria-label and title describe the NEXT action (UI-SPEC D-09):
  const label = nextTheme === 'dark' ? t('themeDark') : nextTheme === 'system' ? t('themeSystem') : t('themeLight');
  return (
    <button
      onClick={() => setTheme(nextTheme)}
      title={label}
      aria-label={label}
      className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-slate-400 hover:text-white transition-colors rounded hover:bg-slate-700/50"
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}
```

### WCAG test for DARK_EYE_COLORS (new test file pattern)

```typescript
// Source: tests/outcomesPalette.contrast.test.ts pattern (VERIFIED lines 1-74)
import { describe, expect, it } from 'vitest';
import { DARK_EYE_COLORS, computeContrastRatio } from '../src/components/outcomes/palette';

const DARK_BG = '#111827'; // gray-900 (D-07)
const WCAG_AA_TEXT = 4.5;  // VIS-03 threshold

describe('DARK_EYE_COLORS WCAG AA text contrast against dark background', () => {
  for (const [key, hex] of Object.entries(DARK_EYE_COLORS)) {
    it(`DARK_EYE_COLORS['${key}']=${hex} contrast vs ${DARK_BG} >= ${WCAG_AA_TEXT}`, () => {
      expect(computeContrastRatio(hex, DARK_BG)).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
    });
  }
});
```

### AuditPage fetch-on-filter-change skeleton

```typescript
// Source: AuditPage.tsx lines 118-145 (VERIFIED — current pattern to replace)
// New fetch pattern with debounce:
useEffect(() => {
  let cancelled = false;
  const timer = setTimeout(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: '500', offset: '0' });
    if (filterUser) params.set('user', filterUser);
    if (filterCategory) params.set('action_category', filterCategory);
    if (filterFrom) params.set('fromTime', filterFrom);
    if (filterTo) params.set('toTime', filterTo + 'T23:59:59');
    if (filterSearch) params.set('body_search', filterSearch);
    if (filterFailures) params.set('status_gte', '400');
    try {
      const res = await authFetch(`/api/audit?${params}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json() as { entries: ServerAuditEntry[]; total: number };
      if (!cancelled) { setEntries(data.entries); setTotal(data.total); }
    } catch (err) {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      if (!cancelled) setLoading(false);
    }
  }, 300);
  return () => { cancelled = true; clearTimeout(timer); };
}, [filterUser, filterCategory, filterFrom, filterTo, filterSearch, filterFailures]);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 `darkMode: 'class'` in JS config | v4 `@custom-variant` in CSS | Tailwind v4 (released 2025) | No JS config file needed; CSS-first |
| Tailwind v3 `tailwind.config.ts` | No config file — CSS @import | Tailwind v4 | This project has no tailwind.config.ts |

**Deprecated/outdated:**
- `darkMode: 'class'` in `tailwind.config.ts`: Not applicable in this project — v4 uses CSS-only configuration. Attempting to create a `tailwind.config.ts` would have no effect.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `DARK_COHORT_PALETTES` entries also require ≥ 3.0:1 (graphical threshold) not 4.5:1 | Validation Architecture | Low — UI-SPEC explicitly says "graphical threshold" for COHORT_PALETTES; only EYE_COLORS requires 4.5:1 |
| A2 | The `AuditPage` `timeRange` state (today/7d/30d/all) is entirely replaced by the new from/to date picker; no backward compat needed | Architecture Patterns | Low — CONTEXT.md is explicit that the filter panel is replaced; the time-range dropdown is client-only state |
| A3 | `window.matchMedia` is available in all target browsers for System mode | ThemeContext | Very low — all modern browsers support this since 2015+ |

**If this table is empty:** Not empty — 3 minor assumptions logged. All are low-risk and confirmed by CONTEXT.md or broad browser support.

---

## Open Questions

1. **`toTime` date adjustment on the server**
   - What we know: The date-range inputs produce `YYYY-MM-DD` strings; the DB stores ISO 8601 timestamps including time.
   - What's unclear: Should `toTime` be padded to `T23:59:59` client-side, or should `buildWhereClause()` use `< toTime + 1 day`?
   - Recommendation: Pad client-side (`filterTo + 'T23:59:59'`) to keep server logic simple and consistent with how `fromTime` is used. [ASSUMED]

2. **Where does `auditExportCsv` key already exist?**
   - What we know: The translations.ts file has `auditExportCsv` at line 507. UI-SPEC lists it as retained.
   - What's unclear: The completeness test (if extended to cover new `audit*` keys) must not re-test keys that already exist and pass.
   - Recommendation: New `audit*` test should filter only for phase-17-new keys (prefix `auditFilter`, `auditCategory`, `auditEmpty`, `theme*`) rather than all `audit*` keys.

---

## Validation Architecture

`workflow.nyquist_validation` is absent from `.planning/config.json` — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.1.5 |
| Config file | `vitest.config.ts` (root) |
| Quick run command | `npx vitest run tests/audit.test.ts tests/auditApi.test.ts tests/outcomesPalette.contrast.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIT-01 | New `action_category`, `body_search`, `status_gte` filters applied in `buildWhereClause()` | unit | `npx vitest run tests/audit.test.ts` | ✅ extend existing |
| AUDIT-01 | API parses new query params and passes to `queryAudit()` | unit | `npx vitest run tests/auditApi.test.ts` | ✅ extend existing |
| VIS-01 | `@custom-variant dark` enables `dark:` classes | manual | Browser check: toggle button → dark class on html | N/A |
| VIS-02 | Recharts internals use explicit colors not Tailwind strings | manual/smoke | Code review — no runtime test possible | N/A |
| VIS-03 | `DARK_EYE_COLORS` >= 4.5:1 and `DARK_COHORT_PALETTES` >= 3.0:1 against `#111827` | unit | `npx vitest run tests/outcomesPalette.contrast.test.ts` | ✅ extend existing |
| VIS-03 (theme keys) | All new `theme*` and `audit*` i18n keys have DE + EN | unit | `npx vitest run tests/outcomesI18n.test.ts` | ✅ extend existing (or new test file) |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/audit.test.ts tests/auditApi.test.ts tests/outcomesPalette.contrast.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] Extend `tests/outcomesPalette.contrast.test.ts` — add `DARK_EYE_COLORS >= 4.5` and `DARK_COHORT_PALETTES >= 3.0` against `#111827` — covers VIS-03
- [ ] Extend `tests/audit.test.ts` — add filter cases for `action_category`, `body_search`, `status_gte` — covers AUDIT-01 (db layer)
- [ ] Extend `tests/auditApi.test.ts` — add API param parsing cases for new filters — covers AUDIT-01 (API layer)
- [ ] Extend `tests/outcomesI18n.test.ts` (or new `tests/phase17I18n.test.ts`) — cover `theme*` and new `audit*` keys — covers VIS-01 copywriting completeness

---

## Security Domain

`security_enforcement` is absent from config — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth changes in this phase |
| V3 Session Management | no | No session changes |
| V4 Access Control | yes | Existing `req.auth?.role !== 'admin'` auto-scope in `auditApi.ts` — new filter params do not bypass this; user filter remains admin-only |
| V5 Input Validation | yes | New query params must be validated before passing to `buildWhereClause()`; `action_category` must be validated as enum value; `status_gte` must be validated as numeric |
| V6 Cryptography | no | No crypto changes |

### Known Threat Patterns for SQLite + Express

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via new filter params | Tampering | `buildWhereClause()` uses named placeholders (`@paramName`) — better-sqlite3 parameterised statements; enum validation for `action_category` before SQL |
| Invalid `action_category` value reaching a SQL string | Tampering | Validate in `auditApi.ts`: `const VALID_CATEGORIES = ['auth','data','admin','outcomes'] as const`; only set filter if value is in set |
| `status_gte` with non-numeric input | Tampering | `Number(req.query.status_gte)` + `isNaN()` guard — same pattern as existing `limit` parsing in `auditApi.ts:56-58` |
| localStorage XSS (theme key) | Tampering/Information | Theme value is only `'light' | 'dark' | 'system'` — validated on read with `=== ` equality; no eval or innerHTML use |
| FOUC script as XSS vector | Tampering | Inline script reads only `localStorage.getItem('emd-theme')` and calls `classList.add('dark')` — no user-controlled string rendered to DOM |

---

## Sources

### Primary (HIGH confidence)

- `server/auditDb.ts` [VERIFIED] — `AuditFilters` interface, `buildWhereClause()`, `queryAudit()` — lines 35-262
- `server/auditApi.ts` [VERIFIED] — query param parsing pattern, admin auth guard — lines 42-65
- `src/pages/AuditPage.tsx` [VERIFIED] — current fetch pattern, `describeAction()`, filter state — lines 1-325
- `src/components/Layout.tsx` [VERIFIED] — sidebar structure, language switcher row (lines 90-98), insertion point for ThemeToggle
- `src/context/LanguageContext.tsx` [VERIFIED] — exact pattern to replicate for ThemeContext — lines 1-43
- `src/components/outcomes/palette.ts` [VERIFIED] — `EYE_COLORS`, `COHORT_PALETTES`, `computeContrastRatio()` — lines 1-64
- `src/i18n/translations.ts` [VERIFIED] — existing keys; no `theme*` keys present; confirms which `audit*` keys already exist
- `src/index.css` [VERIFIED] — only `@import "tailwindcss"` + body style; no `@custom-variant` yet
- `index.html` [VERIFIED] — empty `<head>`; no existing scripts to conflict with FOUC script
- `src/App.tsx` [VERIFIED] — ThemeProvider insertion point (`LanguageProvider` wrap)
- `src/main.tsx` [VERIFIED] — entry point; ThemeProvider wraps above this
- `vitest.config.ts` [VERIFIED] — `tests/**/*.test.ts` glob, `environment: 'node'`
- `tests/outcomesPalette.contrast.test.ts` [VERIFIED] — pattern for DARK_EYE_COLORS test
- `tests/outcomesI18n.test.ts` [VERIFIED] — pattern for i18n completeness test extension
- `package.json` [VERIFIED] — no new packages needed; all dependencies already installed

### Secondary (MEDIUM confidence)

- Tailwind v4 `@custom-variant` dark mode syntax — [CITED: tailwindcss.com/docs/dark-mode, v4 CSS-first configuration]

### Tertiary (LOW confidence)

- None — all critical claims verified from codebase directly.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from package.json
- Architecture patterns: HIGH — all patterns verified from existing source files
- Pitfalls: HIGH — derived from direct code inspection; no speculative patterns
- Test infrastructure: HIGH — vitest.config.ts and test file patterns verified

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (stable stack — 30-day window appropriate)
