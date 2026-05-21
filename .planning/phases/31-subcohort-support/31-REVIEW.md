---
phase: 31-subcohort-support
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/services/cohortNames.ts
  - src/pages/CohortBuilderPage.tsx
  - src/components/outcomes/CohortCompareDrawer.tsx
  - src/i18n/translations.ts
  - tests/cohortNames.test.ts
  - tests/cohortBuilderEntryPoints.test.tsx
  - tests/cohortCompareDrawer.test.tsx
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
  critical_resolved: 1
  warning_resolved: 2
  open: 6
status: criticals_resolved
resolved:
  - CR-01 (commit d4ff9d5)
  - WR-01 (commit d4ff9d5)
  - WR-02 (commit d4ff9d5)
---

> **Resolution note (2026-05-21, commit d4ff9d5):** The BLOCKER CR-01 and its root causes
> WR-01/WR-02 are fixed. `isSubcohortName` now requires non-empty trimmed segments (true guard),
> `groupByParent` defensively skips unparseable names and uses the shared `normalizeCohortName`
> for parent linking. A regression test (`groupByParent` "does not throw on empty-segment names")
> locks the fix. Remaining open items: WR-03 (validation distinguishes empty-parent/sub by matching
> the thrown Error message — brittle under localization), WR-05 (drawer Escape listener not gated on
> `open`), and the 3 INFO items — all advisory, non-blocking.

# Phase 31: Code Review Report

**Reviewed:** 2026-05-21
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 31 adds subcohort support via a `ParentName:SubcohortName` naming convention. The core
parsing/grouping service (`cohortNames.ts`), inline save-dialog validation (`CohortBuilderPage`),
and the tree-grouped picker (`CohortCompareDrawer`) are mostly sound. Throw-only error handling
(D-03) is respected, the drawer correctly applies only each cohort's own filter (verified in
`OutcomesView.tsx` lines 360–377 / 382–388 — no accidental subcohort union), the setState-in-effect
issue was avoided via the lazy `useState(() => new Set())` initializer, and ARIA wiring
(`aria-invalid`, `aria-describedby`, `role="alert"`/`status`, `aria-expanded`) is present.

However, there is one BLOCKER: `groupByParent` calls `parseSubcohortName` unconditionally on any
name with exactly one colon, and `parseSubcohortName` throws on empty segments. Because saved
searches are loaded from the server (`DataContext` line 105) and are not all created through the
new client-side validation, a persisted name like `":Male"` or `"C1:"` will throw during drawer
render and crash the entire compare drawer. Several WARNING-level robustness and consistency issues
also follow from the gap between the client-side validation rules and the service-layer assumptions.

## Critical Issues

### CR-01: `groupByParent` crashes the drawer on empty-segment subcohort names

**File:** `src/services/cohortNames.ts:124-138` (triggered from `src/components/outcomes/CohortCompareDrawer.tsx:52`)

**Issue:**
`groupByParent` iterates all saved searches, and for every name where `isSubcohortName(s.name)` is
true (exactly one colon) it calls `parseSubcohortName(s.name)` at line 127. But `isSubcohortName`
only counts colons — it does **not** validate non-empty segments. A name such as `":Male"` or
`"C1:"` passes the `isSubcohortName` guard yet causes `parseSubcohortName` to throw
("parent segment must not be empty" / "sub segment must not be empty"). That exception is uncaught
in `groupByParent` and bubbles up through `CohortCompareDrawer` render (line 52), throwing during
React render and crashing the whole drawer (white screen / error boundary).

This is reachable in practice: `savedSearches` is loaded from `/api/data/saved-searches`
(`DataContext.tsx` line 105) and is not guaranteed to have passed the new Phase 31 client
validation. Any pre-existing, server-seeded, or externally created search with an empty segment
around a single colon detonates the drawer. The doc comment on `isSubcohortName` even calls it a
"guard before calling parseSubcohortName" — but it is an insufficient guard for exactly this case.

**Fix:** Make the grouping loop tolerant of malformed names instead of trusting the colon-count
guard. Either widen `isSubcohortName` to require non-empty trimmed segments, or guard the parse:

```ts
for (const s of searches) {
  if (!isSubcohortName(s.name)) continue;

  let parent: string;
  try {
    ({ parent } = parseSubcohortName(s.name));
  } catch {
    continue; // malformed (empty segment) → treat as flat, do not crash render
  }

  const parentEntry = byNormalizedName.get(parent.toLowerCase());
  if (!parentEntry) continue;
  // ...
}
```

Preferred: tighten `isSubcohortName` so its contract actually matches what callers rely on:

```ts
export function isSubcohortName(name: string): boolean {
  const parts = name.split(':');
  return parts.length === 2 && parts[0].trim() !== '' && parts[1].trim() !== '';
}
```

Note this second option changes the existing test `isSubcohortName('A:B:C') === false` semantics
only for empty-segment cases, which the current tests do not cover — add a test for `':B'` and
`'A:'` returning false.

## Warnings

### WR-01: `isSubcohortName` is documented as a parse guard but does not validate segments

**File:** `src/services/cohortNames.ts:61-67`

**Issue:** The JSDoc states "Use this as a guard before calling parseSubcohortName (Pitfall 3)",
but the function only checks colon count, not empty segments. Every caller that follows the
documented pattern (`if (isSubcohortName(x)) parseSubcohortName(x)`) is exposed to the throw in
CR-01. This is the root cause behind CR-01 and should be fixed at the source so future callers are
safe by construction.

**Fix:** Tighten `isSubcohortName` to also require non-empty trimmed segments (see CR-01), or rename
it / document it explicitly as "colon-count only, NOT a safety guard for parseSubcohortName".

### WR-02: Duplicate / parent-match normalization is inconsistent across modules

**File:** `src/services/cohortNames.ts:83-89, 113-118` and `src/pages/CohortBuilderPage.tsx:118-120`

**Issue:** Three different normalization rules are in play for what is conceptually the same
"is this the same name" comparison:
- `normalizeCohortName` (line 83): collapses whitespace around colon, collapses internal whitespace
  runs, trims, lowercases — used by `isDuplicateName`.
- `groupByParent` (line 117): only `trim().toLowerCase()` for the parent-name lookup map — does
  **not** collapse internal whitespace runs.
- CohortBuilderPage orphan check (line 119): `s.name.trim().toLowerCase() === parent.toLowerCase()`
  — also only trim+lowercase.

Consequence: a parent named `"My  Cohort"` (two internal spaces) and a subcohort `"My Cohort:Male"`
(one space) will be flagged as a duplicate-collision-free orphan by the page, and `groupByParent`
will fail to link them, yet `isDuplicateName` would treat `"My  Cohort"` and `"My Cohort"` as
duplicates. The duplicate-detection rule and the parent-linking rule disagree, which produces
confusing UX (a name is rejected as duplicate of one search but won't link to it as a parent).

**Fix:** Use `normalizeCohortName` consistently. In `groupByParent` build the map with
`normalizeCohortName(s.name)` keys and look up `normalizeCohortName(parent)` (or a parent-only
normalize that collapses internal whitespace). In CohortBuilderPage's orphan check, compare with
the same normalization helper rather than ad-hoc `trim().toLowerCase()`.

### WR-03: Inline validation relies on parsing the thrown error message string

**File:** `src/pages/CohortBuilderPage.tsx:99-110`

**Issue:** The validation distinguishes empty-parent vs empty-sub by string-matching the thrown
Error message (`msg.includes('parent segment')` / `msg.includes('sub segment')`). This couples the
UI to the exact wording of `parseSubcohortName`'s English error text. If that message is ever
reworded or localized, the branch silently falls through to the generic
`cohortNameTooManyColons` message (line 109), producing a misleading error for an empty-segment
name. This is brittle control flow built on a human-readable string.

**Fix:** Don't infer the failure mode from the message. Since `colonCount === 1` is already known,
check the segments directly:

```ts
const [rawParent, rawSub] = trimmed.split(':');
if (!rawParent.trim()) return { hasHardError: true, isHardError: true, validationMsg: t('cohortNameEmptyParent') };
if (!rawSub.trim())   return { hasHardError: true, isHardError: true, validationMsg: t('cohortNameEmptySub') };
const parent = rawParent.trim();
```

This removes the try/catch-on-message entirely and makes the empty-segment detection deterministic.

### WR-04: Validation logic runs in an IIFE on every render instead of `useMemo`

**File:** `src/pages/CohortBuilderPage.tsx:84-138`

**Issue:** The validation block is an immediately-invoked function expression evaluated on every
render. It calls `savedSearches.map((s) => s.name)` and `isDuplicateName` (which normalizes every
existing name) twice per render path, plus `savedSearches.some(...)`. While not a v1 performance
concern per se, the larger correctness risk is that this is the only piece of derived state in the
component not memoized, making it easy to accidentally introduce inconsistency or a re-render loop
in future edits. It also recomputes regardless of whether `saveName` or `savedSearches` changed.

**Fix:** Wrap in `useMemo(() => { ... }, [saveName, savedSearches, t])` so the dependencies are
explicit and the derived validation object is stable across unrelated re-renders.

### WR-05: Drawer keydown Escape handler is global and active even when closed

**File:** `src/components/outcomes/CohortCompareDrawer.tsx:31-37`

**Issue:** The `keydown` listener is registered on `window` unconditionally — its effect dependency
array is `[onClose]` and does not include `open`. The drawer is always mounted (visibility is
controlled by the `translate-x-full` class, line 102), so pressing Escape anywhere on the
OutcomesView page calls `onClose()` even when the drawer is not open. This can swallow Escape from
other components (e.g. a different modal/menu on the same page) and fire a redundant close.

**Fix:** Gate the listener on `open`:

```ts
useEffect(() => {
  if (!open) return;
  const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
  window.addEventListener('keydown', h);
  return () => window.removeEventListener('keydown', h);
}, [open, onClose]);
```

Also consider `aria-hidden`/`inert` on the `<aside>` when closed so the off-screen checkboxes are
not reachable by screen readers and tab order (currently they remain in the accessibility tree).

## Info

### IN-01: `crypto.randomUUID()` used without a fallback

**File:** `src/pages/CohortBuilderPage.tsx:169`

**Issue:** `crypto.randomUUID()` is only available in secure contexts (HTTPS / localhost). If the
app is ever served over plain HTTP on a non-localhost origin, this throws and the save silently
fails. Likely fine given the deployment model, but worth noting since it is the id source for every
new cohort.

**Fix:** If non-secure-context deployment is possible, add a UUID fallback; otherwise document the
secure-context requirement.

### IN-02: `subcohortIdSet` is recomputed redundantly with grouping data

**File:** `src/components/outcomes/CohortCompareDrawer.tsx:55-59`

**Issue:** `subcohortIdSet` is rebuilt by iterating `subcohortsByParentId`, but `groupByParent`
already produces a `subcohorts` array (returned but unused here). The component could destructure
`subcohorts` and build the set from it (or `groupByParent` could expose the set directly), avoiding
the extra nested loop and the divergent re-derivation.

**Fix:** `const { parents, subcohorts, subcohortsByParentId } = groupByParent(savedSearches);` then
`const subcohortIdSet = new Set(subcohorts.map((s) => s.id));`.

### IN-03: `cohortTreeSubcohortOf` translation key added but unused

**File:** `src/i18n/translations.ts:168` (`cohortTreeSubcohortOf`)

**Issue:** The key `cohortTreeSubcohortOf` (`'Subcohort of {parent}'`) was added in this phase but is
not referenced in any of the reviewed source files (the drawer renders subcohorts purely by
indentation, with no per-row "subcohort of X" label). This is dead i18n that `npm run knip` may or
may not catch depending on config. Either wire it into the subcohort row (would also improve screen
-reader context for indented rows) or remove it.

**Fix:** Use it as additional `aria` context on subcohort rows in `renderLabel`, or delete the key.

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
