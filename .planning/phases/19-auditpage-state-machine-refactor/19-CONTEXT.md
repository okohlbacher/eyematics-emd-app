# Phase 19: AuditPage State Machine Refactor - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Mode:** `--auto` (recommended defaults selected for all gray areas)

<domain>
## Phase Boundary

Refactor `src/pages/AuditPage.tsx` (337 LOC, 10 `useState` hooks + a `useEffect` fetch + `useMemo` derivations) into a `useReducer`-driven state machine split across:
- `src/pages/audit/auditPageState.ts` — reducer, action types, initial state, selectors
- `src/pages/audit/auditFormatters.ts` — pure helpers (`describeAction`, `describeDetail`, `isRelevantEntry`, `statusBadgeClass`)
- `src/pages/audit/useAuditData.ts` — hook wrapping reducer + debounced fetch + AbortController + `requestEpoch` stale-guard
- `src/pages/AuditPage.tsx` — thin presentational component that only consumes the hook

Behavior must remain byte-identical to v1.7 (6-dim filter, 300ms debounce, cancel-on-unmount, admin-gated controls, 4 render states, CSV/JSON export). **Characterization tests land in a separate commit BEFORE the reducer swap** so any post-refactor diff is caught as a regression.

In scope: pure-frontend refactor of one page. **Out of scope:** server changes, new filters, audit schema changes, dark-mode tweaks, AuditPage UI redesign.
</domain>

<decisions>
## Implementation Decisions

### Module Layout
- **D-01:** Files exactly as roadmap mandates: `src/pages/audit/auditPageState.ts`, `auditFormatters.ts`, `useAuditData.ts`. Directory is new (`src/pages/audit/` does not exist yet).
- **D-02:** `AuditPage.tsx` stays at `src/pages/AuditPage.tsx` (path unchanged — preserves router import) and becomes a pure render component that calls `useAuditData()` and maps state to JSX.

### Reducer Shape
- **D-03:** Single discriminated-union action type with exactly 5 variants (no extras for v1.8): `FILTER_SET` (payload: `{ key: keyof AuditFilters, value: AuditFilters[K] }`), `FILTERS_RESET`, `FETCH_START` (payload: `{ epoch: number }`), `FETCH_SUCCESS` (payload: `{ epoch, entries, total }`), `FETCH_ERROR` (payload: `{ epoch, error }`).
- **D-04:** State shape: `{ filters: AuditFilters, entries: ServerAuditEntry[], total: number, loading: boolean, error: string | null, requestEpoch: number }`. `distinctUsers` and `filteredEntries` are **selectors** (pure functions in `auditPageState.ts`), not stored in state — matches the existing `useMemo` derivation.
- **D-05:** `requestEpoch` stale-response guard: every `FETCH_START` increments `requestEpoch`; `FETCH_SUCCESS` / `FETCH_ERROR` are no-ops when `payload.epoch !== state.requestEpoch`. Replaces the AbortController-only approach with deterministic, testable ordering (AbortController is still kept as a network-cancel optimization, but the reducer guard is the source of truth).

### Hook Surface
- **D-06:** `useAuditData()` returns `{ state, dispatch, refetch }`. `state` is the full reducer state (consumer destructures); `dispatch` is exposed so the page can fire `FILTER_SET` / `FILTERS_RESET` directly without a wrapper-action explosion. `refetch` is for the explicit "Reload" button if any (currently none — included only if needed by characterization tests).
- **D-07:** Debounce (300 ms) and AbortController live **inside the hook**, not in the page or reducer. Reducer stays pure.

### Characterization Tests (commit BEFORE refactor)
- **D-08:** New file `tests/auditPageCharacterization.test.tsx` using existing RTL + `vi.mock('../src/services/auditApi')` pattern (same as `tests/audit.test.ts`). Covers: (a) all 4 render states (loading, error, empty, populated), (b) admin-gated CSV/JSON export buttons (admin role visible, non-admin hidden), (c) filter change triggers debounced refetch, (d) unmount during in-flight fetch cancels (no state-update warning), (e) `isRelevantEntry` filtering hides health-check rows, (f) `describeAction` / `describeDetail` outputs for each known method/path pair.
- **D-09:** Reducer-only unit test: new file `tests/auditPageReducer.test.ts`. Covers all 5 action variants + the `requestEpoch` stale-response guard (FETCH_SUCCESS arriving with stale epoch is a no-op).
- **D-10:** Two commits, in order: (1) `test(19): characterization tests for AuditPage v1.7 behavior`, (2) `refactor(19): migrate AuditPage to useReducer state machine`. Bisect-friendly.

### Behavior Preservation
- **D-11:** `describeAction`, `describeDetail`, `isRelevantEntry`, `statusBadgeClass` move VERBATIM (no signature change, no logic edit) from `AuditPage.tsx` to `auditFormatters.ts`. They become re-exported from the page only if any other module already imports them (none do — confirmed via grep).
- **D-12:** No new dependencies. No new settings.yaml keys. No i18n string changes.

### Claude's Discretion
- Selector function names (`selectDistinctUsers`, `selectFilteredEntries`) — bikeshed-free, planner picks final names.
- Whether to colocate `tests/auditPageReducer.test.ts` with characterization or split — both fine; planner decides.
- Internal action-creator helpers (e.g., `setFilter(key, value)` thin wrappers) — only if it materially improves readability; default no.

### Folded Todos
None — no STATE.md todo items match Phase 19 scope (the only pending todo is the Phase 20 `tokenVersion` migration check).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & Project
- `.planning/ROADMAP.md` §"Phase 19: AuditPage State Machine Refactor" — 4 success criteria (AUDIT-01..04), goal statement, dependency note re: Phase 20 `describeAction` merge conflict
- `.planning/STATE.md` §"Accumulated Context" — locked decision: characterization tests land BEFORE reducer swap

### Source Files Being Refactored
- `src/pages/AuditPage.tsx` — current 337 LOC implementation; entire file in scope
- `src/services/auditApi.ts` — fetch helper consumed by current `useEffect` (no changes; just re-imported by `useAuditData.ts`)
- `src/types/audit.ts` (or wherever `ServerAuditEntry`, `AuditFilters` live) — type definitions reused as-is

### Existing Test Patterns to Mirror
- `tests/audit.test.ts`, `tests/auditApi.test.ts`, `tests/auditMiddleware.test.ts` — current audit test conventions (RTL, vi.mock, `npx vitest run`)
- `tests/helpers/renderOutcomesView.tsx` — helper-extraction pattern from Phase 18; mirror for any AuditPage render helper if it shrinks duplication

### Prior-Phase Refs Carrying Forward
- `.planning/milestones/v1.7-phases/17-audit-log-upgrade-dark-mode/17-04-PLAN.md` §"Audit filters (AUDIT-01)" — describes the 6-dim filter contract that must remain byte-identical
- `.planning/PROJECT.md` §"Core Value" / §"Key Decisions" — security-first (audit immutability), config-in-settings.yaml (no env vars), no client trust
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/services/auditApi.ts` — already returns typed fetch result; no rewrite needed.
- `vi.mock` + RTL pattern in `tests/audit*.test.ts` — direct template for new characterization test.
- React 19 `use()` / hooks already standard in this codebase.

### Established Patterns
- Hooks own their fetch + cancellation (see `src/hooks/useCaseData.ts`); `useAuditData.ts` mirrors this convention.
- Pure helpers extracted to sibling files next to the page (see `src/components/case-detail/` co-location).
- 300 ms debounce already used in current AuditPage `useEffect` — no new utility needed; either inline `setTimeout`/`clearTimeout` or import existing debounce util if one exists in `src/utils/`.

### Integration Points
- React Router: `AuditPage` is mounted at `/audit` (admin-guarded) — no router changes.
- AuthContext: existing `useAuth().role === 'admin'` gate stays in `AuditPage.tsx` for the export buttons (NOT in the hook — keep auth concerns at the render layer).
- i18n: `useTranslation()` calls stay in `AuditPage.tsx` and `auditFormatters.ts` (formatters take a `t` function as parameter, as they do today).
</code_context>

<specifics>
## Specific Ideas

- "byte-identical" v1.7 behavior is the hard contract — characterization tests are the spec, not the existing source code.
- Bisect-friendly commit split (test commit → refactor commit) is mandatory, not nice-to-have. A single squashed commit defeats the purpose.
- `requestEpoch` is the canonical stale-guard mechanism for v1.8+ async hooks (set the precedent here; Phase 20 silent-refresh may reuse the pattern).
</specifics>

<deferred>
## Deferred Ideas

- **AuditPage UI redesign** — out of scope for v1.8; would be a v1.9+ phase if surfaced.
- **Audit row virtualization** — would only matter at >5 k entries; not requested. Backlog.
- **Replace 300 ms debounce with a centralized hook** (`useDebouncedCallback`) — only if a second consumer appears; YAGNI for now.
- **Unify formatter `t` parameter into a context** — would require refactoring all i18n call sites; not justified here.

### Reviewed Todos (not folded)
None.
</deferred>

---

*Phase: 19-auditpage-state-machine-refactor*
*Context gathered: 2026-04-23*
