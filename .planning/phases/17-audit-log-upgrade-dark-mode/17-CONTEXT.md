# Phase 17: Audit Log Upgrade & Dark Mode - Context

**Gathered:** 2026-04-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Two capability tracks delivered together:

1. **Audit log upgrade** — The `AuditPage` gets 5 new filter/search controls (user dropdown, action-category selector, date-range picker, cohort-hash text search, failures-only toggle). All filters are applied server-side; the filter panel updates the displayed log without a page reload.

2. **Dark mode** — A sun/moon/system theme toggle in the sidebar footer switches the entire application between Light, Dark, and System modes. The `dark` CSS class on `<html>` triggers full-app Tailwind `dark:` variants. All Recharts chart internals use explicit colors from a `useTheme()` hook. Theme persists in `localStorage` with no flash of unstyled content on load.

Out of scope: any new audit write paths, pagination UI (single server-filtered fetch suffices), changes to the existing `isRelevantEntry()` noise filter semantics, new chart types or metrics.

</domain>

<decisions>
## Implementation Decisions

### Audit filter architecture

- **D-01:** All five new filters are evaluated **server-side**. `AuditFilters` interface in `auditDb.ts` gains three new optional fields: `action_category?: 'auth' | 'data' | 'admin' | 'outcomes'`, `body_search?: string`, `status_gte?: number`. `buildWhereClause()` and `queryAudit()` are extended to apply them.

- **D-02:** Action-category maps to SQL path patterns in `buildWhereClause()`:
  - `'auth'` → `path LIKE '/api/auth/%'` (excluding user-management CRUD)
  - `'data'` → `path LIKE '/api/data/%'`
  - `'admin'` → `path LIKE '/api/auth/users/%'` or `path = '/api/settings'`
  - `'outcomes'` → `path LIKE '/api/outcomes/%'` or `path = '/api/audit/events/view-open'`
  Exact boundary definitions are Claude's discretion — planner should align these with the `describeAction()` categories already in `AuditPage.tsx`.

- **D-03:** Cohort-hash search is a LIKE substring: `body LIKE '%search%' OR query LIKE '%search%'` (case-insensitive via SQLite `LIKE` default behavior). Partial hash prefixes work.

- **D-04:** Single server-filtered fetch pattern — `AuditPage` fires `GET /api/audit?<params>` on every filter change (debounced; delay at Claude's discretion). Returns up to 500 matching rows. No pagination UI needed.

### Dark mode coverage

- **D-05:** **Full-app dark mode.** Every page gets `dark:` Tailwind variants. Base mapping:
  - Page background: `bg-gray-50` → `dark:bg-gray-900` (`#111827`)
  - White cards/panels: `bg-white` → `dark:bg-gray-800` (`#1f2937`)
  - Primary text: `text-gray-900` → `dark:text-gray-100`
  - Secondary text: `text-gray-500` → `dark:text-gray-400`
  - Borders: `border-gray-200` → `dark:border-gray-700`
  - Table headers: `bg-gray-50` → `dark:bg-gray-800`
  - Hover rows: `hover:bg-gray-50` → `dark:hover:bg-gray-700`
  - Status badges: existing color classes need `dark:` counterparts (planner decides exact dark badge colors)

- **D-06:** The sidebar (`bg-slate-800`) stays **unchanged** in both modes — it already reads as dark UI and fits both themes without modification.

- **D-07:** The canonical dark background for WCAG contrast validation is `#111827` (Tailwind `gray-900`). `DARK_EYE_COLORS` in `palette.ts` must pass WCAG 4.5:1 against this background; the existing `computeContrastRatio()` utility in `palette.ts` is used for the automated test assertion.

### Theme toggle & ThemeContext

- **D-08:** Theme toggle lives in the **sidebar footer**, added as a sibling button to the existing language (globe) switcher row at `Layout.tsx:91-97`. Minimal Layout structural change.

- **D-09:** Single **cycling icon button**: Sun (Light) → Moon (Dark) → Monitor (System) → back to Sun. One click advances the mode. Uses Lucide icons (`Sun`, `Moon`, `Monitor`). Current mode's icon is shown.

- **D-10:** A new `ThemeContext` (modeled on `LanguageContext.tsx` pattern) provides `theme: 'light' | 'dark' | 'system'` and `setTheme()` to all components. A `useTheme()` hook resolves the effective mode (for 'system', checks `window.matchMedia('(prefers-color-scheme: dark)')`).

- **D-11:** Theme preference stored in `localStorage` key `emd-theme`. `ThemeContext` reads it on mount and applies the `dark` class to `document.documentElement`. `System` mode listens to `prefers-color-scheme` changes via `addEventListener('change', ...)`.

### FOUC prevention

- **D-12:** An inline `<script>` block added to `index.html` `<head>` (before any CSS or JS loads) reads `localStorage.getItem('emd-theme')` and applies `document.documentElement.classList.add('dark')` synchronously if the stored preference is `'dark'`, or if the preference is `'system'` and `window.matchMedia('(prefers-color-scheme: dark)').matches`. This eliminates the flash of unstyled content before React hydrates.

### Claude's Discretion

- Exact `DARK_EYE_COLORS` hex values in `palette.ts` — Claude picks values passing WCAG 4.5:1 against `#111827` (reference: existing OD/OS/OD+OS family, but lightened)
- `COHORT_PALETTES` dark-mode variants — analogous to `DARK_EYE_COLORS`
- Debounce delay for audit filter refetch (suggest 300ms)
- i18n keys for new toggle tooltip labels (Light/Dark/System) and any new audit filter labels
- Exact dark badge color choices (`dark:bg-red-900/20 dark:text-red-400` style)
- Tailwind `darkMode: 'class'` config location (planner should find the Tailwind config file — may be `tailwind.config.ts` or PostCSS-based)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Audit subsystem
- `server/auditDb.ts` — `AuditFilters` interface (lines 35-43), `buildWhereClause()`, `queryAudit()` — primary extension targets
- `server/auditApi.ts` — `GET /api/audit` handler (line 42) — where new query params are parsed into `AuditFilters`
- `src/pages/AuditPage.tsx` — current filter UI, `describeAction()` category mapping (lines 31-56), fetch logic — primary frontend target

### Dark mode infrastructure
- `src/components/Layout.tsx` — sidebar structure, language switcher row (lines 90-97) — where toggle is added and where `dark:` class variants apply
- `src/components/outcomes/palette.ts` — `EYE_COLORS`, `COHORT_PALETTES`, `computeContrastRatio()` — where `DARK_EYE_COLORS` and `DARK_COHORT_PALETTES` will be added
- `src/context/LanguageContext.tsx` — pattern to replicate for `ThemeContext`
- `src/i18n/translations.ts` — existing i18n keys; new keys for toggle tooltips must be added here

### Phase history for context
- `.planning/phases/10-visual-ux-qa-preview-stability/10-CONTEXT.md` §Deferred — original dark mode deferral decision and why it was deferred (no infrastructure)
- `.planning/ROADMAP.md` §Phase 17 — 5 success criteria (AUDIT-01, VIS-01, VIS-02, VIS-03)

### Index.html (FOUC)
- `index.html` — where inline FOUC-prevention script is injected

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/auditDb.ts buildWhereClause()` — already builds parameterised SQL; extend with `action_category`, `body_search`, `status_gte` branches
- `src/context/LanguageContext.tsx` — `createContext + Provider + useLanguage()` pattern; `ThemeContext` follows the same shape
- `src/components/outcomes/palette.ts computeContrastRatio()` — reuse in the WCAG test for `DARK_EYE_COLORS`
- Lucide icons already in use (`Sun`, `Moon`, `Monitor` are available in the `lucide-react` package)

### Established Patterns
- **Context pattern**: `createContext` → `Provider` wraps `App` in `main.tsx` → `use*` hook for consumers — replicate for `ThemeContext`
- **Single config source**: settings are in `settings.yaml`; theme preference is client-only → `localStorage` is the right store (not `settings.yaml`)
- **i18n completeness test**: `tests/outcomesI18n.test.ts` pattern — new toggle label keys must pass the completeness test

### Integration Points
- `index.html` `<head>` — inline FOUC script goes here (before `<script type="module">`)
- `main.tsx` or `App.tsx` — `ThemeProvider` wraps the app (same level as `LanguageProvider`)
- `Layout.tsx:91-97` — language switcher row; add `<ThemeToggle />` sibling button
- `src/components/outcomes/OutcomesPanel.tsx` — consumes `palette.ts`; will need to call `useTheme()` to select `EYE_COLORS` vs `DARK_EYE_COLORS`

</code_context>

<specifics>
## Specific Ideas

- The dark background for WCAG validation is `#111827` exactly — this is the `gray-900` Tailwind value and is referenced in REQUIREMENTS.md VIS-03
- The sidebar `bg-slate-800` is intentionally left unchanged — it already looks dark and doesn't need theming
- Action-category filter should align its bucket definitions with `describeAction()` in `AuditPage.tsx` so the categories shown in the dropdown match the labels shown in the Action column

</specifics>

<deferred>
## Deferred Ideas

- Pagination UI for audit log — single server-filtered fetch of up to 500 rows is sufficient for now
- Dark mode for the `FeedbackButton` modal overlay (already references a dark background in its own code — `bg-black/40`)
- Per-user theme preference synced server-side — localStorage is sufficient for this phase

</deferred>

---

*Phase: 17-audit-log-upgrade-dark-mode*
*Context gathered: 2026-04-21*
