# Phase 31: Subcohort Support - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Let users split any saved cohort into named subcohorts, **one level deep**, using a
`ParentName:SubcohortName` naming convention. Subcohorts are ordinary `SavedSearch` objects
(no new type field) — the single `:` in the name is the only differentiator. They appear in a
tree-grouped picker wherever cohorts are selectable for comparison (`CohortCompareDrawer`).

**In scope:** name-convention parsing/validation, a `parseSubcohortName` helper with unit tests,
a "Split into subcohort" affordance in `CohortBuilderPage`, and tree rendering in
`CohortCompareDrawer`. **Out of scope:** new backend tables/fields, multi-level nesting,
implicit parent→subcohort union selection, changing the max-4-comparison limit.
</domain>

<decisions>
## Implementation Decisions

### Locked by ROADMAP (carry forward unchanged)
- **D-R1:** Subcohort identity = a `SavedSearch.name` containing exactly one `:`. Text before `:` is the parent name. 0 or 2+ colons are rejected at save time.
- **D-R2:** Subcohorts are regular `SavedSearch` objects — NO new field on the type (`shared/types/fhir.ts` `SavedSearch` = `{id, name, createdAt, filters: CohortFilter}` stays as-is). The colon convention is the only differentiator.
- **D-R3:** The "Split into subcohort" action pre-populates the save dialog with `ParentName:` so the user types only the sub identifier. Users may also type `ParentName:Sub` manually; the builder validates and rejects double colons.
- **D-R4:** In `CohortCompareDrawer` (and any future cohort dropdown), cohorts with subcohorts render as a collapsible tree: parent row (selects the parent's OWN filter) → indented subcohort rows. Selecting the parent does NOT implicitly include subcohorts — each entry is independently selectable.
- **D-R5:** Max 4 cohorts in comparison (existing limit) counts each entry (parent or subcohort) individually.

### New decisions from this discussion
- **D-01 (Validation surfacing):** Validation errors appear as an **inline message under the name field** in the save dialog. **Hard errors block save:** 0 or 2+ colons, empty parent or empty sub identifier (after trim), and duplicate name (see D-04). **Soft warning (does NOT block save):** orphan subcohort — a `Parent:` whose parent does not match any existing `SavedSearch` name shows a non-blocking inline warning, and save still proceeds (SC5: orphan subcohorts allowed for manual-entry workflows).
- **D-02 (Tree behavior):** In `CohortCompareDrawer`, parents that HAVE subcohorts render **expanded by default** with subcohorts indented beneath; a **chevron toggle** collapses/expands the group. Cohorts with no subcohorts render flat exactly as today (no chevron, no indentation).
- **D-03 (Split affordance):** A **per-row "Split" action on each saved cohort** in the CohortBuilderPage saved-searches list. Clicking pre-fills the save dialog name with `ThatCohortName:` (cursor after the colon). This is the chosen entry point (not a single active-cohort button).
- **D-04 (Duplicate-name rule):** Duplicates are detected on the **trimmed, whitespace-normalized, case-insensitive full `Parent:Sub` string**. `parseSubcohortName` trims whitespace around the colon and within each segment, so `C1:Male`, `c1:male `, and `C1 : Male` are treated as the same name and the second save is rejected as a duplicate.

### Claude's Discretion
- Exact German i18n strings for the Split action, validation/warning messages, and tree labels (follow existing `t()` patterns; add keys to `src/i18n/translations.ts`).
- Visual styling of the chevron and indentation (reuse existing drawer/list styles).
- Whether `parseSubcohortName` lives alongside a small `isSubcohortName`/`groupByParent` helper in the same `src/services/cohortNames.ts` module (SC4 requires `parseSubcohortName` returning `{parent, sub}` and throwing for 0/2+ colons; unit-tested).
- Internal grouping/data-shape used to build the tree for the drawer (derive from `savedSearches` at render time; no persisted structure).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase spec
- `.planning/ROADMAP.md` §"Phase 31: Subcohort Support" — goal, the 6 locked decisions, and the 5 success criteria (the authoritative spec)

### Files to create / edit
- `src/services/cohortNames.ts` — NEW: `parseSubcohortName(name) → {parent, sub}` (throws on 0 or 2+ colons; trims segments); plus any grouping helper. Unit-tested (SC4).
- `src/pages/CohortBuilderPage.tsx` — save dialog validation (D-01), the per-row "Split" action (D-03), duplicate check (D-04). Current `handleSave` (~line 89) has no validation and no colon handling.
- `src/components/outcomes/CohortCompareDrawer.tsx` — replace the flat `savedSearches.map` (~line 76) with tree rendering (D-02, D-R4).
- `src/i18n/translations.ts` — new DE+EN keys for split action, validation/warning messages, tree labels.

### Grounding references (read, do not change shape)
- `shared/types/fhir.ts:159-173` — `CohortFilter` and `SavedSearch` (`{id, name, createdAt, filters}`); re-exported via `src/types/fhir.ts` shim. NO new field (D-R2).
- `src/context/DataContext.tsx` — `savedSearches` state + `addSavedSearch`/`removeSavedSearch` (the store the builder and drawer both consume).

### Requirements note (FLAG for planning)
- ROADMAP cites **KOH-003, KOH-004** but neither exists in `.planning/REQUIREMENTS.md` (cohort builder code references an `EMDREQ-KOH-001..007` series instead). Reconcile during planning: either add KOH-003/KOH-004 to REQUIREMENTS.md with traceability, or map the phase to the correct existing EMDREQ-KOH IDs. The requirements-coverage gate will otherwise flag these as uncovered.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SavedSearch` / `CohortFilter` types (`shared/types/fhir.ts`) — reused unchanged; subcohorts are just `SavedSearch` with a colon in `name`.
- `DataContext` `savedSearches` + `addSavedSearch`/`removeSavedSearch` — the single source of cohorts; tree is derived from this list at render time.
- `CohortBuilderPage` save dialog (`saveName` state, `handleSave`) — extend with validation + the Split pre-fill.
- `CohortCompareDrawer` `savedSearches.map` (~line 76) — the flat render to convert into a parent/subcohort tree.
- `t()` i18n + `src/i18n/translations.ts` — bilingual DE/EN; add new keys here.

### Established Patterns
- Types imported in `src/` via the `src/types/fhir.ts` re-export shim; `shared/` imports from `shared/types/fhir.ts` directly.
- Throw-only error handling (D-03 project convention); `parseSubcohortName` throwing on invalid colon count fits this.
- camelCase TS identifiers; wire/DB/FHIR strings unchanged.
- Tests: Vitest, no jest-dom; `queryByText().not.toBeNull()` style.

### Integration Points
- Save flow: CohortBuilderPage → `parseSubcohortName`/validation → `addSavedSearch` (DataContext).
- Selection flow: CohortCompareDrawer reads `savedSearches`, groups by parent, renders tree; selection still feeds the existing max-4 comparison logic (each entry counts once, D-R5).
</code_context>

<specifics>
## Specific Ideas

- Inline-under-field validation with a distinct soft-warning style for orphan parents (save still allowed).
- Tree groups expanded by default with a chevron; flat cohorts unchanged.
- Per-saved-cohort-row "Split" button that pre-fills `ParentName:`.
- Duplicate detection on the normalized, case-insensitive full name.
</specifics>

<deferred>
## Deferred Ideas

- Multi-level nesting (`A:B:C`) — explicitly out of scope (one level deep; 2+ colons rejected).
- Implicit parent→subcohort union selection — rejected by D-R4 (each entry independently selectable).
- Raising the max-4-comparison limit — out of scope (D-R5 keeps the existing limit).
- A dedicated active-cohort "Split" button (option B) — not chosen; per-row action selected instead. Revisit only if users ask.
</deferred>

---

*Phase: 31-subcohort-support*
*Context gathered: 2026-05-21*
