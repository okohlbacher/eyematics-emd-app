# Phase 31: Subcohort Support - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 31-subcohort-support
**Areas discussed:** Validation surfacing, Tree behavior, Split affordance, Duplicate-name rule
**Mode:** interactive (standard)

---

## Validation error surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Inline message + soft orphan warning | Inline under name field; hard errors block (0/2+ colons, empty segment, duplicate); orphan-parent = non-blocking inline warning, save proceeds | ✓ |
| Toast on save attempt | Errors + orphan warning as toasts on save click | |
| Disable save while invalid | Save button disabled until valid; tooltip explains (awkward for soft orphan warning) | |

**User's choice:** Inline message + soft orphan warning.
**Notes:** Aligns with SC5 (orphan subcohorts allowed for manual-entry workflows).

---

## Tree expand/collapse behavior (CohortCompareDrawer)

| Option | Description | Selected |
|--------|-------------|----------|
| Expanded by default + chevron | Parents with subcohorts expanded, indented; chevron collapses; flat cohorts unchanged | ✓ |
| Collapsed by default + chevron | Parents collapsed until expanded | |
| Always expanded, no toggle | Pure indentation, no collapse control | |

**User's choice:** Expanded by default + chevron.
**Notes:** Maximizes subcohort discoverability in a comparison context.

---

## "Split into subcohort" affordance (CohortBuilderPage)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-row action on each saved cohort | "Split" button on each saved-search row; pre-fills `ThatCohort:` | ✓ |
| Single button on the active cohort | One button tied to the loaded/built cohort | |
| Both | Both entry points | |

**User's choice:** Per-row action on each saved cohort.
**Notes:** Most direct since a subcohort derives from a specific parent.

---

## Duplicate-name strictness (SC1)

| Option | Description | Selected |
|--------|-------------|----------|
| Case-insensitive, normalized full name | Trimmed/normalized full `Parent:Sub`, case-insensitive; `parseSubcohortName` trims segments | ✓ |
| Case-sensitive exact match | Exact full-string match after outer trim | |
| Unique sub within parent only | Only sub identifier unique under its parent | |

**User's choice:** Case-insensitive, normalized full name.
**Notes:** Prevents confusing near-duplicates (`C1:Male` vs `c1:male ` vs `C1 : Male`).

---

## Claude's Discretion

- German i18n strings for new UI (split action, validation/warning messages, tree labels).
- Chevron/indentation styling; reuse existing drawer/list styles.
- Whether to co-locate `isSubcohortName`/`groupByParent` helpers with `parseSubcohortName` in `src/services/cohortNames.ts`.
- Render-time grouping data shape for the tree.

## Deferred Ideas

- Multi-level nesting (out of scope).
- Implicit parent→subcohort union selection (rejected by ROADMAP D-R4).
- Raising the max-4-comparison limit (out of scope).
- Active-cohort "Split" button (option B) — not chosen.

## Flagged

- ROADMAP cites KOH-003/KOH-004 but neither exists in REQUIREMENTS.md (code references EMDREQ-KOH-001..007). Reconcile during planning.
