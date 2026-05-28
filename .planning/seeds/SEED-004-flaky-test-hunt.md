---
id: SEED-004
status: dormant
planted: 2026-05-28
planted_during: v1.12 (Phase 45 close)
trigger_when: at the start of the next milestone (v1.13), or whenever CI shows an intermittent test failure
scope: small
---

# SEED-004: Hunt the rare flaky test (Q-FLAKE)

## Why This Matters

During the v1.12 close, the full suite failed exactly once in ~38 `npm run test:ci` runs (1085/1086, ≈2–3%); green every other run. A flaky test erodes trust in the green gate and can mask real regressions. It is not order-dependent (shuffle ×3 clean) and `--no-isolate` is not a valid signal (the OutcomesPanel* mocks rely on per-file isolation). Prime suspects: a timing/async test (unrestored fake timers, setTimeout-based assertion) or a Date-boundary test.

## When to Surface

**Trigger:** first thing in v1.13, or any time CI reports an intermittent failure. Quick to attempt, high trust payoff.

## Scope Estimate

**Small.** Capture the failing test name (JUnit reporter + rerun-on-failure), or loop the timer-heavy suites individually (`for i in {1..50}; do npx vitest run tests/<suite>; done`) to localize, then fix the timer/state leak. Candidate suites: rotateKey, sessionRevoke, audit, authFetchRefreshSuite, outcomesAggregateCache, OutcomesPage.

## Breadcrumbs

- Hunt log: `.planning/v1.12-deferred-questions.md` (Q-FLAKE + "hunt results 2026-05-28")
- Timer-using suites: grep `useFakeTimers|setTimeout|Date.now` in `tests/`

## Notes

Not blocking v1.12 (product code verified; gates green on every other run). Bounded follow-up.
