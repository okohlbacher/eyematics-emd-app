# Phase 21: Test & UAT Polish - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Green the 3 pre-existing failing tests (outcomesPanelCrt ×2, OutcomesPage audit beacon ×1), enforce zero-skipped-tests policy (except documented platform-impossible cases like MSEL-04), and convert 5 Phase 20 human-verification items into automated vitest tests.

**No product code changes.** Scope is restricted to:
- `tests/**` (add/modify tests, helpers, setup files)
- `package.json` (only if absolutely needed for mock/polyfill; justify in plan)
- Source files ONLY when TEST-01..03 root-cause shows the source is wrong (drift from documented contract)

**Out of scope:** New features, refactors, Playwright E2E harness (MSEL-04 gap stays deferred).

</domain>

<decisions>
## Implementation Decisions

### Mock Strategy
- **D-01:** Extend existing `vi.stubGlobal('fetch', vi.fn())` pattern for all UAT-AUTO tests. `authFetchRefresh.test.ts` already uses this pattern (25 instances) — stay consistent. **No msw dependency.** Rationale: zero new deps, consistency with authFetchRefresh.test.ts which is the canonical reference for refresh-flow tests.
- **D-02:** `vi.mock()` factories for modules live at the consumer test-file site (Vitest hoisting constraint, per Phase 18 D-06). Shared factories may be exported from `tests/helpers/*.tsx` but `vi.mock()` calls stay in the test file.

### BroadcastChannel Testing
- **D-03:** jsdom lacks `BroadcastChannel`. Add a minimal in-memory shim in `tests/setup.ts` (single-process, Map-backed) — no npm dep. The shim must faithfully simulate the cross-tab message-broadcast semantics: posting on one instance fires `message` events on all OTHER instances of the same channel name in the same process (NOT the poster itself).
- **D-04:** UAT-AUTO-02 tests instantiate two BroadcastChannel instances with the same channel name to simulate two tabs; assert single-flight lock behavior.

### Fake Timers + System Clock
- **D-05:** Use `vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'Date'] })` for idle-logout (UAT-AUTO-04) and absolute-cap (UAT-AUTO-05). Combine with `vi.setSystemTime(ms)` for clock advancement.
- **D-06:** `afterEach` MUST call `vi.useRealTimers()` to avoid leaking fake timers across tests. Follow the pattern already in `authFetchRefresh.test.ts` if it uses fake timers there; otherwise establish the pattern fresh in the new file.

### 3-Failing-Tests Fix Posture
- **D-07:** Root-cause FIRST, decide SECOND. Read source + test + git-blame for each failing case. If source drifted from documented v1.5/v1.6 contract → fix source (regression). If test assertion was incorrect from day 1 → fix test (assertion bug). Document the decision per-test in the plan and commit message.
- **D-08:** TEST-01 and TEST-02 (outcomesPanelCrt visus absolute [0,2]) are suspected visus y-domain regression from v1.6 Phase 13 (CRT metric introduction). Start with `git log -p src/components/outcomes/OutcomesPanel.tsx` + metric-switch logic. TEST-03 (audit beacon POST) suspected Phase 11 hardening drift — check `useAudit` / beacon POST body shape.
- **D-09:** If source fix is required, keep it minimal and scoped — no refactoring. A bug fix doesn't need surrounding cleanup.

### Zero-Skipped-Tests Policy (TEST-04)
- **D-10:** `describe.skip` and `it.skip` forbidden in `tests/**` except with a `SKIP_REASON:` comment on the line above, citing either: (a) platform impossibility (e.g., MSEL-04 literal browser back/forward in jsdom), or (b) a tracked deferred item with ticket reference.
- **D-11:** Add a lightweight grep-based CI gate (or lint rule) that fails the build if any `.skip` lacks a SKIP_REASON comment. Grep-based is acceptable for this milestone; a proper ESLint rule is v1.9 Phase 23 scope.

### Plan Structure (user selection)
- **D-12:** 3 plans grouped by theme:
  - **21-01:** Fix 3 failing tests + zero-skipped-tests policy gate (TEST-01, TEST-02, TEST-03, TEST-04) — highest priority; unblocks CI
  - **21-02:** authFetch refresh suite (UAT-AUTO-01 silent-refresh smoke, UAT-AUTO-02 BroadcastChannel multi-tab, UAT-AUTO-03 audit DB silence) — single file `tests/authFetchRefreshSuite.test.ts` or extend `authFetchRefresh.test.ts`
  - **21-03:** Session-timer suite (UAT-AUTO-04 idle-logout, UAT-AUTO-05 absolute-cap) — fake-timer-heavy tests, likely `tests/sessionTimers.test.tsx`

### Dependencies
- **D-13:** Plan 21-01 has no dependencies on 21-02/03. Plan 21-02 should land before 21-03 (same timer-mock pattern, 21-02 establishes the mock fixtures). Sequential 21-01 → 21-02 → 21-03 is safest; 21-01 may run parallel to 21-02.

### Claude's Discretion
- Specific test file naming (e.g., `authFetchRefreshSuite.test.ts` vs splitting)
- Whether to extend existing `authFetchRefresh.test.ts` or create a sibling file (optimize for readability)
- Exact shape of the BroadcastChannel shim (minimal; just enough for post + listen across instances)
- Grep patterns for the zero-skip CI gate

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — v1.9 requirements; see TEST-01..04, UAT-AUTO-01..05
- `.planning/ROADMAP.md` — Phase 21 goal + success criteria
- `.planning/PROJECT.md` — core value, current state (v1.8 shipped)

### Prior Phase Context (for pattern continuity)
- `.planning/milestones/v1.8-phases/18-metricselector-test-harness-unblock/18-01-render-helper-extract-SUMMARY.md` — Vitest `vi.mock()` hoisting constraint (Pitfall #3) and shared test-helper pattern
- `.planning/milestones/v1.8-phases/19-auditpage-state-machine-refactor/19-02-SUMMARY.md` — `auditFormatters.ts` + `auditPageState.ts` split; characterization-first pattern
- `.planning/milestones/v1.8-phases/20-jwt-refresh-flow-session-resilience/20-HUMAN-UAT.md` — the 5 manual items to automate (UAT-AUTO-01..05)
- `.planning/milestones/v1.8-phases/20-jwt-refresh-flow-session-resilience/20-04-SUMMARY.md` — authFetch single-flight refresh + BroadcastChannel + AuthContext logout wiring

### Test Reference Files
- `tests/authFetchRefresh.test.ts` — canonical pattern for fetch stubbing; 25 `vi.stubGlobal` instances; model for UAT-AUTO-01..03
- `tests/helpers/renderOutcomesView.tsx` — 14-symbol shared helper; model for future test helpers
- `tests/setup.ts` (if exists) or `vitest.config.ts` — where to add BroadcastChannel shim
- `tests/outcomesPanelCrt.test.tsx` — TEST-01, TEST-02 failure site
- `tests/OutcomesPage.test.tsx` — TEST-03 failure site

### Source Files Likely Relevant
- `src/components/outcomes/OutcomesPanel.tsx` + metric y-domain logic — TEST-01/02 root-cause site
- `src/hooks/useAudit.ts` (or equivalent) — TEST-03 root-cause site
- `src/utils/authFetch.ts` + `src/context/AuthContext.tsx` — UAT-AUTO-01..03 source under test
- `src/utils/idleLogout.ts` (or session-timer code) — UAT-AUTO-04/05 source under test

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tests/helpers/renderOutcomesView.tsx`: 14-symbol shared helper factory pattern — extend this pattern for authFetch/session test helpers if needed
- `tests/authFetchRefresh.test.ts`: canonical fetch-stubbing patterns (25 call sites); copy-paste-adapt for UAT-AUTO-01..03
- `vi.mock()` + `vi.stubGlobal()` idioms already pervasive — no new mocking library needed

### Established Patterns
- Vitest 4.x + RTL; no jest-dom — assertions use `queryByText().not.toBeNull()` / `.toBeNull()` (Chai/Vitest native)
- `vi.mock()` calls live at test-file site (hoisting constraint, per Phase 18 Pitfall #3)
- `utils/download` must be `vi.mock`ed in RTL tests to avoid jsdom `URL.createObjectURL` errors (per Phase 19 decision)
- No jest-dom = no `toBeInTheDocument()` — don't reach for it

### Integration Points
- `tests/setup.ts` (or equivalent) is where BroadcastChannel shim goes
- `vitest.config.ts` is where test runner settings live
- CI script (`npm test` / `npm run test:ci`) is where zero-skip grep gate hooks in

### Deliberate Non-Choices
- **No msw** — D-01. Keeps mock consistent with 25 existing call sites.
- **No fake-indexeddb / no jest-dom upgrade** — out of scope; scope is fixing tests, not tooling migration.
- **No Playwright** — MSEL-04 stays deferred per v1.9 out-of-scope.

</code_context>

<specifics>
## Specific Ideas

- For UAT-AUTO-02 (BroadcastChannel), the shim should be shared across tests via `tests/setup.ts` so any test can instantiate `new BroadcastChannel('emd-auth')` without per-file setup.
- For UAT-AUTO-04 (idle-logout), the 10-min timer value is almost certainly hardcoded in source; tests should import the constant rather than duplicating the magic number.
- For UAT-AUTO-05 (absolute-cap), `auth.refreshTokenTtlMs` / `auth.refreshAbsoluteCapMs` are `settings.yaml` keys — tests likely need to mock `getAuthSettings()` or equivalent.

</specifics>

<deferred>
## Deferred Ideas

- **Playwright / Cypress E2E harness** — MSEL-04 browser-back/forward gap stays deferred to a future milestone. v1.9 out-of-scope.
- **ESLint rule for `.skip` without SKIP_REASON** — v1.9 Phase 23 scope (DEPS-02 lint tightening). Plan 21-01 uses grep-based gate only.
- **msw migration** — out of scope this milestone; all new tests use `vi.stubGlobal('fetch')`.
- **jest-dom assertions** — out of scope; stick with `queryByText().not.toBeNull()`.

</deferred>

---

*Phase: 21-test-uat-polish*
*Context gathered: 2026-04-23*
