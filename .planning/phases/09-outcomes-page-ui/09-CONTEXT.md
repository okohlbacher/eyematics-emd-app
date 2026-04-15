---
phase: 09
phase_name: outcomes-page-ui
milestone: v1.5
created: 2026-04-15
inherits_from:
  - .planning/phases/08-cohort-outcome-trajectories/08-CONTEXT.md
  - .planning/phases/08-cohort-outcome-trajectories/08-UI-SPEC.md
  - .planning/phases/08-cohort-outcome-trajectories/08-RESEARCH.md
  - .planning/phases/08-cohort-outcome-trajectories/08-03-PLAN.md  # reference, not inherited
reference_plan: .planning/phases/08-cohort-outcome-trajectories/08-03-PLAN.md
---

# Phase 9: Outcomes Page UI — Context

## Phase Boundary

**Scope:** Build the `/outcomes` route that composes Phase 8's trajectory math, audit beacon, and i18n bundle into the visible Outcomes analytics view — three Recharts panels (OD, OS, combined), summary cards, settings drawer, data preview with CSV export, custom tooltip, and empty states.

**In scope:**
- `src/pages/OutcomesPage.tsx`
- `src/components/outcomes/*.tsx` (6 co-located components)
- `src/App.tsx` route wiring
- `tests/OutcomesPage.test.tsx`

**Out of scope (deferred):**
- Any new data endpoints (`/api/*` data sources) — OUTCOME-09 mandates client-side aggregation over `useData().activeCases`
- New third-party dependencies — everything uses already-installed Recharts + existing helpers
- Extension of Phase 8's `Measurement` type — decided below to compute axis values locally instead

## Inherited Decisions (Locked in Phase 8 artifacts)

**All decisions in `.planning/phases/08-cohort-outcome-trajectories/08-CONTEXT.md` apply unchanged** — baseline definition, treatment-index source (SNOMED_IVI Procedures), Y-metric modes, interpolation grid defaults (120 points), missing-data handling (null not extrapolation), default scatter-off above 30 patients, authz inheritance from Phase 5, audit-beacon URL shape.

**UI/layout specification is `.planning/phases/08-cohort-outcome-trajectories/08-UI-SPEC.md` unchanged** — color palette (OD #3b82f6, OS #f59e0b, combined #8b5cf6), typography, spacing, copywriting contract (71 `outcomes*` i18n keys already shipped by 08-04), ARIA patterns, empty-state variants.

**Technical research is `.planning/phases/08-cohort-outcome-trajectories/08-RESEARCH.md` unchanged** — Recharts composition patterns, pitfalls, z-stack ordering inside ComposedChart, performance considerations (`isAnimationActive={false}` on Line/Area).

**Reference plan** is `.planning/phases/08-cohort-outcome-trajectories/08-03-PLAN.md` — the previous 08-03 plan produced before the phase split. Phase 9 planners SHOULD port its task structure verbatim (3 tasks → 3 Phase 9 plans), adjusting only the file paths in files_modified and renumbering.

## Implementation Decisions (Phase 9 specific)

### Plan structure (one-to-one port of old 08-03 tasks)

Three plans in Phase 9, matching the reference plan's task breakdown:

| Plan ID | Scope (from 08-03 tasks) | TDD cycle |
|---------|--------------------------|-----------|
| **09-01** | Task 1: Scaffold `OutcomesPage` + cohort resolution + audit beacon + `OutcomesEmptyState` + App.tsx route wiring + minimal RTL tests (cases 1-7 of the old test file) | RED → GREEN → REFACTOR |
| **09-02** | Task 2: `OutcomesSummaryCards` + `OutcomesPanel` + `OutcomesTooltip` + `OutcomesSettingsDrawer` + wire into page + tests (cases 8-12) | RED → GREEN → REFACTOR |
| **09-03** | Task 3: `OutcomesDataPreview` + CSV export via `downloadCsv`/`datedFilename` + wire into page + tests (cases 13-17) | RED → GREEN → REFACTOR |

**Wave structure:** All three plans depend sequentially (09-02 depends on 09-01 because it wires into the page scaffolded in 09-01; 09-03 depends on 09-02 for the same reason). No parallelization within Phase 9 — single-agent sequential execution per wave. 3 waves, 1 plan per wave.

### IQR band rendering (09-02)

**Primary approach:** single `<Area dataKey="iqrHigh" baseLine="iqrLow" fill={color} fillOpacity={0.15} stroke="none" />` — Recharts 3.8.1 supports the `baseLine` prop (confirmed by 08-RESEARCH.md A1). Transform `panel.medianGrid` into `iqrData = [{x, iqrLow: p25, iqrHigh: p75}]`.

**Fallback:** If a future Recharts upgrade breaks `baseLine`, fall back to the two-area mask (upper area = band color, lower area = white) documented in 08-RESEARCH.md L305-306. **Not implemented in Phase 9.** Fallback is a future-proofing note, not a current task.

### Measurement type / axis fields for CSV (09-03)

**Decision:** Compute `daysSinceBaseline` and `treatmentIndex` locally inside `OutcomesDataPreview.tsx` via a small helper that iterates `cohort.cases` without going through `computeCohortTrajectory`'s grid machinery.

**Rationale:**
- Does NOT touch `src/utils/cohortTrajectory.ts` (Phase 8 math module stays frozen)
- No double-aggregation cost (rejects the "call computeCohortTrajectory twice" alternative)
- Accepts small duplication of per-observation math (baseline lookup, treatment-index counting) in exchange for module-boundary stability
- The helper lives inside `OutcomesDataPreview.tsx` (not extracted to a shared util) so its scope is obviously bounded

**Helper signature:**
```typescript
// Inside OutcomesDataPreview.tsx
function flattenToRows(cases: PatientCase[]): Row[] {
  // For each patient × eye × LOINC_VISUS observation:
  //   - Look up earliest LOINC_VISUS observation for (patient, eye) → baseline date
  //   - Compute daysSinceBaseline = days between observation.date and baseline
  //   - Count SNOMED_IVI Procedure resources on (patient, eye) with date <= observation.date → treatment_index
  //   - Compute logMAR + Snellen via decimalToLogmar / decimalToSnellen from cohortTrajectory.ts
  // Returns flat Row[] ready for both table render and CSV export
}
```

### TDD discipline (all three plans)

Each of 09-01, 09-02, 09-03 follows:
1. **RED commit** — write `tests/OutcomesPage.test.tsx` (or extend it) with failing assertions for that plan's behavior, commit with `test(09-XX): ...`
2. **GREEN commit** — write the minimum component code to pass those tests, commit with `feat(09-XX): ...`
3. **REFACTOR + SUMMARY commit** — clean up duplication, tighten types, create the per-plan SUMMARY.md, commit with `docs(09-XX): ...`

No lighter cycle. The reverted 08-03 attempt successfully committed RED tests — the failure mode was scope creep during GREEN, not TDD overhead.

### Anti-pattern enforcement

`.planning/phases/09-outcomes-page-ui/.continue-here.md` captures two blocking anti-patterns from the 08-03 revert. Every Phase 9 executor agent must demonstrate understanding before acting (per execute-phase workflow `check_blocking_antipatterns` step).

**Anti-pattern 1: files_modified is the edit fence.**
An executor may only touch files listed in the plan's `files_modified` array. New services, hooks, utilities, or data files require a plan amendment, not silent inclusion. The reverted 08-03 attempt added 292K lines of synthetic center JSONs + `auditService.ts` + `usePageAudit.ts` + `useLocalStorageState.ts` + `safeJson.ts` + `settings.yaml` — none were in scope.

**Anti-pattern 2: commit every task atomically; never accumulate.**
If a plan has N tasks, commit after each one. Uncommitted work across multiple tasks is always at risk when an agent is killed, times out, or hits a tool failure. The reverted attempt burned ~80K tokens then lost everything because it tried to do all components in one uncommitted batch.

### Claude's Discretion (planner may decide without asking)

- Exact RTL test helpers and fixture shapes (reuse existing `tests/components.test.tsx` patterns where possible)
- Whether to use React.lazy for `OutcomesPage` in App.tsx (lazy is fine; direct import is fine)
- Drawer focus-trap implementation (native HTML focus behavior + Escape key handler is sufficient; do not introduce a focus-trap library)
- CSV export: use existing `src/utils/download.ts` helpers (`downloadCsv`, `datedFilename`) — no new export helpers
- i18n: use only keys already shipped by 08-04. If a key is missing, raise it as a Phase 9 gap and extend `src/i18n/translations.ts` in the same commit with a test update

## Canonical References

### Inherits from Phase 8
- `.planning/phases/08-cohort-outcome-trajectories/08-CONTEXT.md` (implementation decisions)
- `.planning/phases/08-cohort-outcome-trajectories/08-UI-SPEC.md` (visual contract + copywriting)
- `.planning/phases/08-cohort-outcome-trajectories/08-RESEARCH.md` (Recharts patterns, pitfalls)
- `.planning/phases/08-cohort-outcome-trajectories/08-03-PLAN.md` (reference plan, port task-by-task)

### Phase 8 artifacts Phase 9 consumes
- `src/utils/cohortTrajectory.ts` → `computeCohortTrajectory`, `decimalToLogmar`, `decimalToSnellen`, `eyeOf`, `defaultScatterOn`, types (`AxisMode`, `YMetric`, `SpreadMode`, `TrajectoryResult`, `PanelResult`, `PatientSeries`, `Measurement`, `GridPoint`)
- `server/auditApi.ts` → `GET /api/audit/events/view-open` endpoint (consumed via plain `fetch` with `credentials: 'include'`)
- `src/i18n/translations.ts` → 71 `outcomes*` keys shipped by 08-04
- `src/pages/CohortBuilderPage.tsx` → entry-point buttons shipped by 08-04 that navigate to `/outcomes?cohort=<id>`

### Existing code Phase 9 reuses
- `src/pages/AnalysisPage.tsx` L48-59 → `safePickFilter` pattern for URL-param JSON parsing (copy verbatim)
- `src/components/case-detail/VisusCrtChart.tsx` → reference for Recharts composition patterns
- `src/utils/download.ts` → `downloadCsv`, `datedFilename` helpers
- `src/config/clinicalThresholds.ts` → `CHART_COLORS` indices [0, 2, 4] for OD/OS/combined
- `src/context/DataContext.ts` → `useData()` returning `{ activeCases, savedSearches }`
- `src/context/LanguageContext.ts` → `useLanguage()` returning `{ locale, t }`
- `src/services/fhirLoader.ts` → `applyFilters(cases, filters)`

## Deferred Ideas

- **Visual IQR-band A/B test:** Future phase could compare baseLine approach vs two-area mask across Recharts versions. Not Phase 9.
- **Measurement type unification:** A future refactor phase may extend `Measurement` to carry both axis values, removing the local helper in `OutcomesDataPreview.tsx`. Not Phase 9 — would force 08-01 re-verification.
- **Shared aggregator cache:** If perf profiling later shows the `useMemo` re-runs too often, introduce a `useCohortAggregator` hook with stable reference equality. Not Phase 9.
- **Export PDF / PNG:** Visible on UI-SPEC wishlist but not in Phase 9 requirements.
- **Real-time cohort updates:** If a cohort's membership changes while the page is open, re-aggregate. Not Phase 9 (activeCases reference change triggers re-render today).

## Lessons Learned (from reverted 08-03 attempt)

1. **Parallel executor agents without strict files_modified enforcement can drift wildly** — one agent added 292K lines of synthetic data, new services, and new hooks while writing "just the RED tests." Phase 9's blocking anti-patterns close this gap.
2. **Killing an agent mid-Task-2 with uncommitted work costs the full session's token budget** — Phase 9 mandates task-atomic commits. If Task 2 has many sub-components, split into multiple commits inside Task 2 rather than one end-of-task commit.
3. **Splitting a commit after the fact (cherry-pick / revert gymnastics) is painful** — prevent, don't remediate. The files_modified fence is the prevention.
