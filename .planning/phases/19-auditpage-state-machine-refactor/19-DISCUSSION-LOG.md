# Phase 19: AuditPage State Machine Refactor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-04-23
**Phase:** 19-auditpage-state-machine-refactor
**Mode:** `--auto` — recommended defaults selected for all gray areas; no interactive Q&A.

---

## Module Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Roadmap-mandated paths (`src/pages/audit/{auditPageState,auditFormatters,useAuditData}.ts`) | Match success criterion #3 verbatim | ✓ |
| Flat layout under `src/pages/` | Slightly fewer directories, but breaks roadmap contract | |

**Auto-selected:** Roadmap-mandated paths. Roadmap success criteria #3 explicitly names them.

---

## Reducer Action Set

| Option | Description | Selected |
|--------|-------------|----------|
| Exactly 5 actions (`FILTER_SET`, `FILTERS_RESET`, `FETCH_START`, `FETCH_SUCCESS`, `FETCH_ERROR`) | Matches roadmap success criterion #4 | ✓ |
| Per-filter actions (`SET_USER`, `SET_CATEGORY`, …) | More verbose, redundant given keyed `FILTER_SET` | |

**Auto-selected:** 5-action discriminated union — roadmap mandates this exact set.

---

## Stale-Response Guard

| Option | Description | Selected |
|--------|-------------|----------|
| `requestEpoch` counter in reducer + AbortController for network cancel | Deterministic, testable in pure reducer; AbortController kept as optimization | ✓ |
| AbortController only | Already in current code; not testable in pure reducer test |  |

**Auto-selected:** `requestEpoch` is mandated by roadmap success criterion #4.

---

## Hook API Surface

| Option | Description | Selected |
|--------|-------------|----------|
| `{ state, dispatch, refetch }` | Page can dispatch directly; minimal wrapping | ✓ |
| `{ state, actions: { setFilter, resetFilters, refetch } }` | Wrapper actions per filter — more code, no behavior gain | |

**Auto-selected:** `{ state, dispatch, refetch }`. Less surface area, easier to mock in tests.

---

## Characterization Test Approach

| Option | Description | Selected |
|--------|-------------|----------|
| RTL behavior tests + reducer unit tests, two separate files | Mirrors existing `tests/audit*.test.ts` conventions | ✓ |
| Snapshot tests of rendered HTML | Brittle; doesn't catch behavior changes | |
| Reducer-only (skip RTL) | Misses 4-render-state and admin-gate coverage required by SC #1 | |

**Auto-selected:** RTL + reducer split. Highest fidelity to "byte-identical behavior" requirement.

---

## Commit Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Two commits: tests first, refactor second | Bisect-friendly, fulfills SC #2 explicitly | ✓ |
| Single squashed commit | Defeats characterization purpose | |

**Auto-selected:** Two commits — explicitly required by roadmap success criterion #2.

## Claude's Discretion
- Selector function names (`selectDistinctUsers`, etc.).
- Whether to add inline action-creator helpers.
- Test file colocation choices.

## Deferred Ideas
- AuditPage UI redesign, virtualization, centralized debounce hook, formatter-via-context.
