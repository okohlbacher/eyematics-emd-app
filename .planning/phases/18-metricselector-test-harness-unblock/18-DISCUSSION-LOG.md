# Phase 18: metricSelector Test Harness Unblock - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 18-metricselector-test-harness-unblock
**Areas discussed:** Helper scope, Keyboard test, Commit sequence, Event library, Helper API, Router wrapping

---

## Helper Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Mocks + render + defaults | Helper exports vi.mock factories + renderOutcomesView(url, options) + default mock state. Each test still calls vi.mock() referencing exported factories. Maximum dedup. | ✓ |
| Render + defaults only | Helper exports renderOutcomesView + seedDefaults only. 7 vi.mock blocks remain duplicated. | |
| Render only | Thin render wrapper; each test owns its own mocks. | |

**User's choice:** Mocks + render + defaults (Recommended)

---

## Keyboard Test Scope (MSEL-05)

| Option | Description | Selected |
|--------|-------------|----------|
| ArrowR/L cycling + URL write | Arrow keys advance/retreat + wrap-around + URL ?metric= updates. Matches handler at OutcomesView.tsx:211-219. | ✓ |
| ArrowR/L cycling only | aria-selected move only; no URL assertions. | |
| Full a11y suite | Home/End/Tab/Space/Enter — would require production changes. | |

**User's choice:** ArrowR/L cycling + URL write (Recommended)

---

## Commit Sequence

| Option | Description | Selected |
|--------|-------------|----------|
| Two commits: extract then unskip | Commit 1 refactor-only (OutcomesViewRouting migrated, still green). Commit 2 unskips metricSelector + keyboard test. | ✓ |
| One atomic commit | Everything in one commit. | |
| Three commits | Add helper, migrate, unskip — split three ways. | |

**User's choice:** Two commits: extract then unskip (Recommended)

---

## Event Library

| Option | Description | Selected |
|--------|-------------|----------|
| fireEvent | Matches existing test suite; synchronous; no new dep. | ✓ |
| userEvent | More realistic keyboard; requires @testing-library/user-event; inconsistent with rest of suite. | |
| Mix | userEvent for keyboard only. | |

**User's choice:** fireEvent (Recommended)

---

## Helper API Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Options object with overrides | renderOutcomesView(url, { activeCases?, savedSearches?, locale?, settings?, postAggregate?, cohortTrajectoryResult? }) with defaults applied when omitted. | ✓ |
| Builder pattern | createHarness().withCases(n).withSettings({...}).render(url). | |
| Global setters + render | setActiveCases() / setSettings() mutate shared state; render last. | |

**User's choice:** Options object with overrides (Recommended)

---

## Router Wrapping

| Option | Description | Selected |
|--------|-------------|----------|
| Always wrap with MemoryRouter + Routes | Uniform <MemoryRouter><Routes><Route path="/analysis" element={<OutcomesView/>}/></Routes></MemoryRouter>. Exercises route matching. | ✓ |
| Plain MemoryRouter (no Routes) | Simpler; matches current metricSelector.test.tsx; doesn't exercise route matching. | |
| Optional withRoutes flag | Caller picks per test. | |

**User's choice:** Always wrap with MemoryRouter + Routes (Recommended)

---

## Claude's Discretion

- Internal naming of helper factories / builders.
- Whether `buildCase` / `buildCases` are exported from helper or duplicated.
- Whether `fetchSpy` (audit beacon guard) lives in helper or per-test beforeEach.
- Precise `useData` mockReturnValue shape (must match current interface).

## Deferred Ideas

- userEvent migration for whole suite (future test-infra phase).
- Home/End/Space/Enter keyboard support in OutcomesView (future a11y phase; requires production change).
- Provider-tree rendering instead of hook mocks (out of scope; mocks are the established pattern).
