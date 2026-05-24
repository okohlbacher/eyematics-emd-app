# Phase 31: Subcohort Support — Research

**Researched:** 2026-05-21
**Domain:** Frontend — React component state, name-convention parsing, tree rendering, inline form validation
**Confidence:** HIGH (all findings verified directly from the live codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-R1:** Subcohort identity = a `SavedSearch.name` containing exactly one `:`. Text before `:` is the parent name. 0 or 2+ colons are rejected at save time.
- **D-R2:** Subcohorts are regular `SavedSearch` objects — NO new field on the type. The colon convention is the only differentiator. `shared/types/fhir.ts` `SavedSearch` = `{id, name, createdAt, filters: CohortFilter}` stays as-is.
- **D-R3:** The "Split into subcohort" action pre-populates the save dialog with `ParentName:` so the user types only the sub identifier. Users may also type `ParentName:Sub` manually; the builder validates and rejects double colons.
- **D-R4:** In `CohortCompareDrawer` (and any future cohort dropdown), cohorts with subcohorts render as a collapsible tree: parent row (selects parent's OWN filter) → indented subcohort rows. Selecting the parent does NOT implicitly include subcohorts — each entry is independently selectable.
- **D-R5:** Max 4 cohorts in comparison (existing limit) counts each entry (parent or subcohort) individually.
- **D-01 (Validation surfacing):** Inline message under the name field. Hard errors block save (0 or 2+ colons, empty parent or sub, duplicate). Soft warning does NOT block save (orphan subcohort — parent name matches no existing `SavedSearch.name`).
- **D-02 (Tree behavior):** Parents with subcohorts render expanded by default; a chevron toggle collapses/expands. Cohorts with no subcohorts render flat exactly as today.
- **D-03 (Split affordance):** A per-row "Split" action on each saved cohort in `CohortBuilderPage`. Clicking pre-fills `saveName` with `ThatCohortName:`.
- **D-04 (Duplicate-name rule):** Trimmed, whitespace-normalized, case-insensitive full `Parent:Sub` string. `parseSubcohortName` trims whitespace around the colon and within each segment.

### Claude's Discretion

- Exact German i18n strings for the Split action, validation/warning messages, and tree labels (follow existing `t()` patterns).
- Visual styling of the chevron and indentation (reuse existing drawer/list styles).
- Whether `parseSubcohortName` lives alongside `isSubcohortName`/`groupByParent` helpers in the same `src/services/cohortNames.ts` module.
- Internal grouping/data-shape used to build the tree (derived at render time; no persisted structure).

### Deferred Ideas (OUT OF SCOPE)

- Multi-level nesting (`A:B:C`) — 2+ colons rejected.
- Implicit parent→subcohort union selection — each entry independently selectable (D-R4).
- Raising the max-4-comparison limit — D-R5 keeps existing limit.
- A dedicated active-cohort "Split" button (option B) — not chosen; per-row action selected.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KOH-003 | Users can split any saved cohort into named subcohorts (one level deep) via `ParentName:SubcohortName` naming convention. A subcohort is an ordinary `SavedSearch` whose name contains exactly one `:`; name validated (one colon, non-empty identifiers, no duplicate); orphan subcohorts allowed with non-blocking warning. | `parseSubcohortName` helper in `src/services/cohortNames.ts` + validation wired into `CohortBuilderPage.handleSave` + per-row Split button |
| KOH-004 | Subcohorts appear in a tree-grouped picker in `CohortCompareDrawer`: parent rows with indented subcohort rows. Selecting a parent applies parent's own saved filter; each entry independently selectable and counts toward existing max-4 limit. | Replace flat `savedSearches.map` at line 76 in `CohortCompareDrawer.tsx` with tree rendering; existing `toggle` / `isMaxReached` logic unchanged |
</phase_requirements>

---

## Summary

Phase 31 is a **frontend-only** change that adds one new service module (`src/services/cohortNames.ts`) and modifies two existing components (`CohortBuilderPage.tsx`, `CohortCompareDrawer.tsx`) plus the i18n file. No backend changes, no type-schema changes, no new dependencies.

The feature is implemented by a naming convention: a `SavedSearch` whose `.name` contains exactly one `:` is a subcohort. All grouping is derived at render time from the existing `savedSearches` array that both components already consume from `DataContext`. The `addSavedSearch` path remains unchanged — validation happens in `CohortBuilderPage` before calling `addSavedSearch`.

**Primary recommendation:** Implement in four discrete tasks — (1) `cohortNames.ts` service with unit tests, (2) save-dialog validation + duplicate check + soft orphan warning in `CohortBuilderPage`, (3) per-row Split button in `CohortBuilderPage`, (4) tree render in `CohortCompareDrawer` — then add i18n keys in Wave 0 alongside the test scaffolds.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Name parsing + validation logic | Frontend (service module) | — | Pure string logic; no API call; colocated with the UI that uses it |
| Save-dialog validation state | Frontend (CohortBuilderPage) | — | Validation runs on every `onChange`; result feeds button disabled + message render |
| Subcohort storage | Existing backend (`/api/data/saved-searches`) | — | `addSavedSearch` in DataContext already POSTs to the server; no change needed |
| Tree grouping | Frontend (CohortCompareDrawer) | — | Derived at render time from `savedSearches`; no server query |
| Selection counting (max-4) | Frontend (CohortCompareDrawer) | — | `selectedIds.length >= 4` check stays in the drawer; no change to logic |

---

## Standard Stack

### Core (verified from codebase)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (already in use) | 18.x | Component state, `useState`, `useEffect`, `useRef` | Project standard |
| Vitest | (see vitest.config.ts) | Unit + component tests | Project test runner (`npm run test:ci`) |
| @testing-library/react | (already in use) | Component rendering in jsdom | Established in `cohortCompareDrawer.test.tsx`, `cohortBuilderEntryPoints.test.tsx` |
| lucide-react | (already in use) | Icons: `GitBranch`, `ChevronDown`, `ChevronUp` already in the icon set | Already imported in `CohortBuilderPage.tsx`; `GitBranch` is in the standard lucide-react set |
| Tailwind v4 | (already in use) | Utility classes for styling | Project CSS framework |

[VERIFIED: direct codebase inspection — `CohortBuilderPage.tsx` imports, `vitest.config.ts`, `cohortCompareDrawer.test.tsx`]

### No New Dependencies

This phase introduces zero new npm dependencies. All required icons, styling utilities, and test infrastructure already exist.

---

## Architecture Patterns

### System Architecture Diagram

```
User types name / clicks Split button
         |
         v
  CohortBuilderPage (saveName state)
         |
         | onChange (every keystroke)
         v
  parseSubcohortName(name)            groupByParent(savedSearches)
  + duplicate check against           -- at render time in CohortCompareDrawer --
    savedSearches[]
         |
    Hard error? --YES--> disable Save button + show red inline message
         |
    Soft orphan? --YES--> keep Save button enabled + show amber inline message
         |
    Clean? -------YES--> Save button enabled (existing behavior)
         |
  handleSave() --> addSavedSearch() --> DataContext --> POST /api/data/saved-searches
                                                |
                                                v
                                    savedSearches[] (DataContext state)
                                                |
                               ┌────────────────┴────────────────┐
                               v                                   v
                    CohortBuilderPage                    CohortCompareDrawer
                    (saved-search list rows)             (tree render)
                    [Split button per row]               groupByParent() -->
                                                         parent rows + subcohort rows
                                                         chevron expand/collapse state
                                                         toggle() / isMaxReached unchanged
```

### Recommended Project Structure

```
src/
├── services/
│   └── cohortNames.ts        NEW — parseSubcohortName, isSubcohortName, groupByParent
├── pages/
│   └── CohortBuilderPage.tsx EDIT — add validation, Split button, saveName pre-fill
├── components/outcomes/
│   └── CohortCompareDrawer.tsx EDIT — replace flat map with tree render + chevron state
└── i18n/
    └── translations.ts       EDIT — 10 new keys (see Copywriting Contract)
tests/
└── cohortNames.test.ts       NEW — unit tests for parseSubcohortName
└── cohortCompareDrawer.test.tsx EDIT — add tree-render + subcohort selection tests
└── cohortBuilderEntryPoints.test.tsx EDIT — add Split button + validation state tests
```

### Pattern 1: parseSubcohortName — throw-only, no Result type

[VERIFIED: CLAUDE.md convention D-03 "throw-only (D-03). No Result types."; CONTEXT.md "throws on 0 or 2+ colons"]

```typescript
// src/services/cohortNames.ts

export interface SubcohortName {
  parent: string;
  sub: string;
}

/**
 * Parses a subcohort name string.
 * Returns { parent, sub } (both trimmed) if exactly one colon is present.
 * Throws if the name contains 0 or 2+ colons, or if either segment is empty after trim.
 */
export function parseSubcohortName(name: string): SubcohortName {
  // Normalize: collapse internal whitespace runs within the full string
  const parts = name.split(':');
  if (parts.length !== 2) {
    throw new Error(`Invalid subcohort name: expected exactly one colon, got ${parts.length - 1}`);
  }
  const parent = parts[0].trim();
  const sub = parts[1].trim();
  if (!parent) throw new Error('Parent segment must not be empty');
  if (!sub) throw new Error('Sub segment must not be empty');
  return { parent, sub };
}

/** Returns true if name contains exactly one colon (after trim). */
export function isSubcohortName(name: string): boolean {
  return name.split(':').length === 2;
}

/** Groups savedSearches into { parents, subcohorts, flat } at render time. */
export function groupByParent(searches: SavedSearch[]): { ... } {
  // Implementation: derive at render time, no persisted state
}
```

**Duplicate detection normalization** (D-04):
```typescript
// Normalize full name for comparison: trim, collapse internal whitespace, lowercase
function normalize(name: string): string {
  return name.replace(/\s*:\s*/g, ':').replace(/\s+/g, ' ').trim().toLowerCase();
}
```

### Pattern 2: Inline validation in CohortBuilderPage — current handleSave

[VERIFIED: `src/pages/CohortBuilderPage.tsx` lines 89-99 — read directly]

Current `handleSave` (lines 89-99) has **no validation** and **no colon handling**:

```typescript
// CURRENT — no colon check, no duplicate check
const handleSave = () => {
  if (!saveName.trim()) return;
  const s: SavedSearch = {
    id: crypto.randomUUID(),
    name: saveName.trim(),
    createdAt: new Date().toISOString(),
    filters: { ...filters },
  };
  addSavedSearch(s);
  setSaveName('');
};
```

After Phase 31, `handleSave` must:
1. Check `parseSubcohortName` result (or colon count) — hard-block on 0 colons in a `Parent:` context / 2+ colons.
2. Check normalized duplicate against `savedSearches`.
3. Only call `addSavedSearch` if no hard error.

The duplicate check and validation state is computed on `onChange` (live), not in `handleSave` — `handleSave` is guarded by the `disabled` button state.

**The save button currently uses `t('save')`** (line 493: `{t('save')}`). Per the UI-SPEC and D-01, it must switch to `t('cohortSaveSearch')` for this specific button only.

**The save-name input** (lines 479-495) is in a `<div className="flex gap-2">` wrapper. The validation message `<p>` goes directly after this `<div>`, with `mt-1` spacing. The save-filter section starts at line 474.

### Pattern 3: Per-row button group in CohortBuilderPage — exact insertion point

[VERIFIED: `src/pages/CohortBuilderPage.tsx` lines 205-229 — read directly]

Current button group per saved-search row (lines 205-229):
```tsx
<div className="flex gap-2">
  <button  // LineChart → /analysis (violet-600)
    type="button"
    onClick={() => navigate(`/analysis?tab=trajectories&cohort=${encodeURIComponent(s.id)}`)}
    className="p-1.5 text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded ..."
    aria-label={t('outcomesOpenForCohort')}
  >
    <LineChart className="w-4 h-4" />
  </button>
  <button  // Play → load search (blue-600)
    onClick={() => handleLoadSearch(s)}
    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
  >
    <Play className="w-4 h-4" />
  </button>
  <button  // Trash2 → delete (red-500)
    onClick={() => removeSavedSearch(s.id)}
    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
  >
    <Trash2 className="w-4 h-4" />
  </button>
</div>
```

The **Split button** (GitBranch, teal-600) inserts **between LineChart and Play** per the UI-SPEC:
```
[GitBranch — Split]  [LineChart — Analyze]  [Play — Load]  [Trash2 — Delete]
```

### Pattern 4: CohortCompareDrawer — flat map to tree

[VERIFIED: `src/components/outcomes/CohortCompareDrawer.tsx` lines 38-104 — read directly]

**Current flat render** (lines 76-104):
```tsx
{savedSearches.map((s) => {
  const isPrimary = s.id === primaryCohortId;
  const checked = isPrimary || selectedIds.includes(s.id);
  const disabled = isPrimary || (isMaxReached && !selectedIds.includes(s.id));
  const count = patientCounts[s.id] ?? 0;
  const label = isPrimary
    ? `${s.name} (N=${count} patients) · ${t('outcomesComparePrimaryLabel')}`
    : `${s.name} (N=${count} patients)`;
  return (
    <label key={s.id} className="flex items-center gap-2 text-sm">
      <input type="checkbox" aria-label={label} className="accent-blue-600"
        checked={checked} disabled={disabled} onChange={() => toggle(s.id)} />
      <span className={disabled && !isPrimary ? 'text-gray-400' : 'text-gray-800'}>
        {label}
      </span>
    </label>
  );
})}
```

**Existing `toggle` and `isMaxReached` logic** (lines 38-48) — unchanged:
```typescript
const isMaxReached = selectedIds.length >= 4;

const toggle = (id: string) => {
  if (id === primaryCohortId) return;
  const next = selectedIds.includes(id)
    ? selectedIds.filter((x) => x !== id)
    : isMaxReached
      ? selectedIds
      : [...selectedIds, id];
  onChange(next);
};
```

The tree render needs to:
1. Call `groupByParent(savedSearches)` to build groups.
2. Add `useState<Set<string>>` initialized to all parent names (expanded by default, D-02).
3. Render parent rows with chevron button + checkbox; subcohort rows with `pl-6` indentation.
4. Feed the same `toggle(id)` and `isMaxReached` logic — no change to selection mechanics.

The drawer container `<div className="p-6 pt-0 space-y-4 overflow-y-auto">` (line 71) uses `space-y-4` between top-level items. Within a tree group, use `space-y-1` for subcohort rows.

**Dark mode note:** The current drawer has no dark-mode classes on the background (`bg-white border-l border-gray-200`) — matches the UI-SPEC observation that dark mode uses `dark:` Tailwind prefixes on specific elements only, not the drawer shell.

### Pattern 5: i18n — t() function signature and interpolation

[VERIFIED: `src/i18n/translations.ts` line 898; `src/context/LanguageContext.tsx` lines 25-28]

The `t()` function signature:
```typescript
export function t(key: TranslationKey, locale: Locale): string {
  return translations[key][locale];
}
```

**The `t()` function does NOT perform interpolation.** Interpolated keys like `{parent}` or `{username}` require a manual `.replace()` at the call site — the established pattern is:
```typescript
t('outcomesCrossMode').replace('{count}', String(names.length))
// or
t('outcomesGridSliderLabel').replace('{n}', String(gridPoints))
```
[VERIFIED: `OutcomesSettingsDrawer.tsx:223,246`, `OutcomesView.tsx:669`]

**`cohortTreeSubcohortOf`** (`Subcohort of {parent}`) therefore needs `.replace('{parent}', parentName)` at the call site if used.

**TypeScript type safety:** Adding a new key to `translations` automatically adds it to `TranslationKey = keyof typeof translations`. Any typo in `t('newKey')` call sites becomes a compile error. [VERIFIED: `translations.ts` line 896]

**The existing `t('save')` key** on the Save button (CohortBuilderPage line 493) must be replaced with the new `t('cohortSaveSearch')` key for this button only. The `t('save')` key remains for all other uses. [VERIFIED: `translations.ts` line 6; UI-SPEC copywriting contract]

### Anti-Patterns to Avoid

- **Storing grouping state in DataContext:** Tree structure must be derived at render time in `CohortCompareDrawer`. DataContext holds only the flat `savedSearches[]` array. Adding grouping state to the store would couple persistence to a UI concept.
- **Adding a `type` or `parentId` field to `SavedSearch`:** D-R2 locks the type unchanged. The `:` in the name is the only differentiator.
- **Calling `parseSubcohortName` on names with no colon:** `parseSubcohortName` throws for names with 0 colons — it is only called when the name IS a subcohort. Use `isSubcohortName` first to guard.
- **Blocking save on orphan warning:** D-01 explicitly makes orphan a soft warning that does not block save.
- **Changing the max-4 logic:** `isMaxReached` stays `selectedIds.length >= 4`. D-R5 is explicit.
- **Using jest-dom matchers:** CLAUDE.md enforces no jest-dom; use `queryByText().not.toBeNull()` / `.toBeNull()` or `expect(element).toBeTruthy()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Colon-count parsing | Custom regex engine | Standard `str.split(':')` | `split(':').length - 1` gives colon count; O(n), no edge cases |
| Icon for Split action | Custom SVG | `GitBranch` from lucide-react (already installed) | Already in the icon library; matches existing button pattern |
| Duplicate detection | Fuzzy string match | Exact `normalize(a) === normalize(b)` (trim + lowercase + whitespace collapse) | D-04 specifies exact normalized match, not fuzzy |
| Tree expand/collapse | Redux or complex state | `useState<Set<string>>` with all parent IDs (expanded by default) | Simple local state; no cross-component sync needed |
| Validation timing | Debounce or blur | `onChange` on every keystroke (matches existing `disabled={!saveName.trim()}` pattern) | UI-SPEC requires live validation consistent with existing behavior |

---

## Common Pitfalls

### Pitfall 1: `isMaxReached` miscounting with tree

**What goes wrong:** The `isMaxReached = selectedIds.length >= 4` check stays unchanged. A parent cohort and its subcohorts each count independently — no special logic needed. The risk is accidentally adding special "parent implies subcohort" counting.
**Why it happens:** Natural intuition that selecting a parent should count more, but D-R4/D-R5 are explicit.
**How to avoid:** Leave `isMaxReached` and `toggle` completely unchanged. Only change the render loop.
**Warning signs:** Any modification to the `toggle` function or `isMaxReached` computation during implementation.

### Pitfall 2: Flat cohorts broken by tree render

**What goes wrong:** Cohorts with NO subcohorts accidentally get wrapped in a tree structure or lose their label/count/primary styling.
**Why it happens:** The grouping function must explicitly pass through flat cohorts (no subcohort match) using the same render path as today.
**How to avoid:** `groupByParent` returns three categories — `parents` (have subcohorts), `subcohorts` (belong to a parent), `flat` (no match either way). Flat cohorts render identically to the current code.
**Warning signs:** Existing `cohortCompareDrawer.test.tsx` tests fail (they use flat cohorts).

### Pitfall 3: `parseSubcohortName` called on non-subcohort names

**What goes wrong:** Calling `parseSubcohortName('CohortA')` throws, causing a crash in the save flow or grouping logic.
**Why it happens:** `parseSubcohortName` is designed for names with exactly one `:`. The validation flow must check colon count first.
**How to avoid:** In `CohortBuilderPage` validation, check `saveName.split(':').length` before calling `parseSubcohortName`. Use `isSubcohortName` guard. In `groupByParent`, only call `parseSubcohortName` on entries where `isSubcohortName(s.name)` returns true.

### Pitfall 4: `cohortSaveSearch` key not added to translations breaks TypeScript

**What goes wrong:** The `t()` call `t('cohortSaveSearch')` causes a TS compile error until the key is added to `translations.ts`.
**Why it happens:** `TranslationKey = keyof typeof translations` — the type is derived from the object, so missing keys are compile-time errors.
**How to avoid:** Add all 10 new i18n keys in Wave 0 before editing any component that uses them.
**Warning signs:** TypeScript errors on `t('cohortSaveSearch')` etc. before Wave 0 is complete.

### Pitfall 5: Cursor placement after Split pre-fill

**What goes wrong:** Setting `saveName` to `ParentName:` moves focus correctly but the cursor is at position 0 instead of after the colon.
**Why it happens:** React controlled inputs reset cursor position on re-render when `value` changes.
**How to avoid:** Per UI-SPEC, use `input.setSelectionRange(saveName.length, saveName.length)` inside a `useEffect` keyed on the `saveName` value change. Need a `useRef<HTMLInputElement>` on the name input. The `useEffect` fires after the DOM has updated, placing the cursor correctly.

### Pitfall 6: Orphan check comparing trimmed parent against untrimmed SavedSearch.name

**What goes wrong:** `parentIdentifier.toLowerCase() !== s.name.toLowerCase()` fails to match `" AMD Cohort 2026 "` stored in `savedSearches` against the parsed parent `"AMD Cohort 2026"`.
**Why it happens:** `addSavedSearch` stores `saveName.trim()` (current `handleSave` line 93 — `name: saveName.trim()`). So stored names are already trimmed. But the orphan check must also trim and lowercase the stored name for case-insensitivity.
**How to avoid:** Orphan check: `savedSearches.some(s => s.name.trim().toLowerCase() === parentIdentifier.toLowerCase())`.

---

## Code Examples

### Verified integration points

**Save button — current (must change text):**
```tsx
// CohortBuilderPage.tsx line 486-493 [VERIFIED]
<button
  onClick={handleSave}
  disabled={!saveName.trim()}
  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
>
  <Save className="w-3.5 h-3.5" />
  {t('save')}   {/* <- change to t('cohortSaveSearch') */}
</button>
```

**The input for the save name:**
```tsx
// CohortBuilderPage.tsx line 479-485 [VERIFIED]
<input
  type="text"
  placeholder={t('searchNamePlaceholder')}
  value={saveName}
  onChange={(e) => setSaveName(e.target.value)}
  className="flex-1 px-3 py-2 border rounded-lg text-sm ..."
/>
```

**Drawer: existing `space-y-4` container:**
```tsx
// CohortCompareDrawer.tsx lines 70-72 [VERIFIED]
<div
  className="p-6 pt-0 space-y-4 overflow-y-auto"
  style={{ maxHeight: 'calc(100vh - 120px)' }}
>
```

**Existing test pattern — no jest-dom, RTL queryByText:**
```typescript
// cohortCompareDrawer.test.tsx line 62 [VERIFIED]
expect(screen.getByText(/Cohort B \(N=17 patients\)/i)).toBeTruthy();
// NOT: expect(element).toBeInTheDocument()  ← no jest-dom
```

**Mock pattern for DataContext + LanguageContext in component tests:**
```typescript
// cohortBuilderEntryPoints.test.tsx lines 17-83 [VERIFIED]
vi.mock('../src/context/DataContext', () => ({ useData: vi.fn() }));
vi.mock('../src/context/LanguageContext', () => ({ useLanguage: vi.fn() }));
// Then:
(useData as ReturnType<typeof vi.fn>).mockReturnValue({ ...defaultDataMock });
(useLanguage as ReturnType<typeof vi.fn>).mockReturnValue({
  locale: 'en', setLocale: vi.fn(), t: (key: string) => t(key as any, 'en'),
});
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (see `vitest.config.ts`) |
| Config file | `vitest.config.ts` — default env `node`; component tests use `// @vitest-environment jsdom` per-file docblock |
| Quick run command | `npm run test:ci` |
| Full suite command | `npm run test:ci` (619/619 baseline must remain green) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KOH-003 / SC4 | `parseSubcohortName('C1:Male')` returns `{parent:'C1', sub:'Male'}` | unit | `npm run test:ci -- cohortNames` | ❌ Wave 0: `tests/cohortNames.test.ts` |
| KOH-003 / SC4 | `parseSubcohortName('NoColon')` throws | unit | `npm run test:ci -- cohortNames` | ❌ Wave 0 |
| KOH-003 / SC4 | `parseSubcohortName('A:B:C')` throws | unit | `npm run test:ci -- cohortNames` | ❌ Wave 0 |
| KOH-003 / SC4 | `parseSubcohortName` trims: `'C1 : Male '` → `{parent:'C1', sub:'Male'}` | unit | `npm run test:ci -- cohortNames` | ❌ Wave 0 |
| KOH-003 / SC4 | Duplicate detection: `'c1:male '` rejected when `'C1:Male'` exists | unit | `npm run test:ci -- cohortNames` | ❌ Wave 0 |
| KOH-003 / SC1 | Save dialog shows hard error for 2+ colons; Save button disabled | component | `npm run test:ci -- cohortBuilderEntryPoints` | ❌ Wave 0 (add to existing file) |
| KOH-003 / SC1 | Save dialog shows hard error for empty parent (`:Sub`) | component | `npm run test:ci -- cohortBuilderEntryPoints` | ❌ Wave 0 |
| KOH-003 / SC1 | Save dialog shows hard error for empty sub (`Parent:`) | component | `npm run test:ci -- cohortBuilderEntryPoints` | ❌ Wave 0 |
| KOH-003 / SC1 | Save dialog shows hard error for duplicate name | component | `npm run test:ci -- cohortBuilderEntryPoints` | ❌ Wave 0 |
| KOH-003 / SC5 | Orphan subcohort: save dialog shows soft amber warning; Save button still enabled | component | `npm run test:ci -- cohortBuilderEntryPoints` | ❌ Wave 0 |
| KOH-003 / SC5 | Split button pre-fills `saveName` with `ParentName:` | component | `npm run test:ci -- cohortBuilderEntryPoints` | ❌ Wave 0 |
| KOH-004 / SC2 | CohortCompareDrawer renders parent + subcohort rows in tree | component | `npm run test:ci -- cohortCompareDrawer` | ❌ Wave 0 (add to existing file) |
| KOH-004 / SC2 | Flat cohorts (no subcohort) render unchanged | component | `npm run test:ci -- cohortCompareDrawer` | ✅ (existing tests already cover flat render) |
| KOH-004 / SC3 | Selecting parent applies parent's own filter (parent ID passed to onChange) | component | `npm run test:ci -- cohortCompareDrawer` | ❌ Wave 0 |
| KOH-004 / SC3 | Selecting subcohort applies subcohort's own filter independently | component | `npm run test:ci -- cohortCompareDrawer` | ❌ Wave 0 |
| KOH-004 / D-R5 | max-4 counting: parent + subcohort each count individually | component | `npm run test:ci -- cohortCompareDrawer` | ❌ Wave 0 |

**Success criteria → test map:**

| SC | Description | Covered By |
|----|-------------|-----------|
| SC1 | Save `Cohort1:Male`; name validated; appears in drawer | `cohortNames.test.ts` (unit) + `cohortBuilderEntryPoints.test.tsx` (component) |
| SC2 | Drawer renders tree; flat cohorts unchanged | `cohortCompareDrawer.test.tsx` (component) |
| SC3 | Parent and subcohort selection independent | `cohortCompareDrawer.test.tsx` (component) |
| SC4 | `parseSubcohortName` unit-tested | `cohortNames.test.ts` (unit) |
| SC5 | Orphan subcohort: soft warning, save proceeds | `cohortBuilderEntryPoints.test.tsx` (component) |

### Sampling Rate

- **Per task commit:** `npm run test:ci` (full suite — 619 baseline + new tests; Phase 31 scope is small enough for full run)
- **Per wave merge:** `npm run test:ci`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/cohortNames.test.ts` — covers SC4 / KOH-003 `parseSubcohortName` unit tests
- [ ] New test cases in `tests/cohortBuilderEntryPoints.test.tsx` — covers SC1, SC5 (hard errors, soft warning, Split button)
- [ ] New test cases in `tests/cohortCompareDrawer.test.tsx` — covers SC2, SC3, D-R5 (tree render, independent selection, max-4 counting)

No new test framework install needed — Vitest + RTL already configured.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 31 is purely frontend code changes with no external CLI tools, databases, or services beyond what already runs for the dev server. All dependencies are already installed in `node_modules`.

---

## Security Domain

> `security_enforcement` key is absent from `.planning/config.json` — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (client-side only) | `parseSubcohortName` validation; duplicate detection |
| V6 Cryptography | no | — |

**V5 note:** The colon-convention validation is client-side only. The backend `POST /api/data/saved-searches` endpoint accepts any name string without colon validation — no backend change is in scope (D-R2), and the backend has no semantic knowledge of subcohort naming. This is an acceptable design: subcohort structure is a UI convention that does not affect data integrity or access control. A malformed name can be saved via direct API call but has no security consequence.

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via cohort name rendered in DOM | Tampering | React's JSX escapes interpolated strings by default — `{s.name}` is safe |
| Prototype pollution via name string | Tampering | Pure string operations; no `eval`, no dynamic property access |

---

## Runtime State Inventory

> Not applicable — this is a greenfield feature addition (new naming convention on existing data). No rename/refactor of stored strings. Existing `SavedSearch` records in `data/saved-searches.json` continue to work unchanged.

---

## Open Questions (RESOLVED)

1. **`GitBranch` icon availability in installed lucide-react version**
   - What we know: lucide-react is already imported in `CohortBuilderPage.tsx` (`import { ..., LineChart, Play, ... } from 'lucide-react'`). `GitBranch` is in the standard lucide-react icon set (available since early versions).
   - What's unclear: exact installed version of lucide-react is not confirmed (package.json not read).
   - Recommendation: The planner should add `import { GitBranch } from 'lucide-react'` and verify it compiles. If missing (unlikely), `Split` or `Scissors` are acceptable fallbacks. [ASSUMED: `GitBranch` available — low risk given lucide-react version history]

2. **Scroll-into-view for split pre-fill**
   - What we know: UI-SPEC says "Scrolls the save-name input into view if the filter panel is off-screen."
   - What's unclear: The filter panel is always rendered in the DOM (it's part of the 12-col grid, not hidden). On small viewports the save-name input may be below the fold.
   - Recommendation: Include `inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })` in the Split click handler; harmless if already visible.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `GitBranch` icon is available in the installed lucide-react package | Standard Stack / Code Examples | Minor — fallback icon needed; no functional impact |
| A2 | `data/saved-searches.json` server storage imposes no name-length limit that would block long `ParentName:SubcohortName` strings | Security Domain | Negligible — JSON file storage; no character-level constraints observed |

---

## Sources

### Primary (HIGH confidence)

All findings are VERIFIED directly from live source files in this session.

- `src/pages/CohortBuilderPage.tsx` — `handleSave` (lines 89-99), save-name input (lines 479-495), button group per row (lines 205-229), lucide-react imports (lines 2-16)
- `src/components/outcomes/CohortCompareDrawer.tsx` — flat `savedSearches.map` (lines 76-104), `toggle`/`isMaxReached` (lines 38-48), container classes (line 71)
- `src/context/DataContext.tsx` — `savedSearches` state, `addSavedSearch` (line 139-144), `removeSavedSearch` (line 146-151)
- `shared/types/fhir.ts` lines 159-173 — `CohortFilter` and `SavedSearch` type shapes (confirmed: `{id, name, createdAt, filters}` only)
- `src/i18n/translations.ts` — `t()` function signature (line 898), existing cohort keys (lines 136-171), interpolation pattern (`replace('{key}', value)`)
- `src/context/LanguageContext.tsx` — `t` wrapper type `(key: TranslationKey) => string` (no interpolation built in)
- `tests/cohortCompareDrawer.test.tsx` — test patterns (RTL, `expect(...).toBeTruthy()`, no jest-dom, `@vitest-environment jsdom`)
- `tests/cohortBuilderEntryPoints.test.tsx` — mock pattern for `useData`/`useLanguage`, render-with-router pattern
- `vitest.config.ts` — test environment configuration
- `CLAUDE.md` — throw-only errors, no jest-dom, camelCase, no env vars
- `31-CONTEXT.md` — all locked decisions D-R1..D-R5, D-01..D-04
- `31-UI-SPEC.md` — component contracts, 10 i18n keys, color tokens, accessibility contracts

### Secondary (MEDIUM confidence)

- `.planning/ROADMAP.md` §Phase 31 — success criteria SC1..SC5, requirements KOH-003/KOH-004
- `.planning/REQUIREMENTS.md` — KOH-003 and KOH-004 definitions

---

## Metadata

**Confidence breakdown:**
- Integration points (handleSave, savedSearches.map, button group): HIGH — code read directly
- Standard stack: HIGH — verified from imports and config files
- i18n pattern (no built-in interpolation): HIGH — verified from t() source
- Test patterns: HIGH — verified from existing test files
- Pitfalls: HIGH — derived from actual code structure

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (stable frontend; no external API dependencies)
