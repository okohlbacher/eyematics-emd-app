---
phase: 12
slug: server-side-outcomes-pre-aggregation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-16
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Populated by the planner — this draft captures the infrastructure the planner should reference.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x (already present — `tests/` dir, 358 tests across 34 files) |
| **Config file** | `vite.config.ts` + vitest pickup; no separate vitest config |
| **Quick run command** | `npx vitest run {pattern}` (e.g. `npx vitest run tests/aggregate`) |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~2 seconds for full suite (current baseline) |

---

## Sampling Rate

- **After every task commit:** `npx vitest run {task-specific pattern}`
- **After every plan wave:** `npm test -- --run` (full suite)
- **Before `/gsd-verify-work`:** Full suite must be green (≥ current 358/358 baseline, adjusted upward by new tests)
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| *(to be filled by planner — per task in 12-01..12-0N PLAN.md)* | — | — | — | — | — | — | — | — | ⬜ pending |

Planner guidance — suggested coverage:
- **Shared module extraction** (Wave 1): unit test `shared/cohortTrajectory.ts` pure-math parity with the current `src/utils` version on a fixed 50-patient seed.
- **Cache module** (Wave 2): unit tests for TTL expiry, explicit invalidation, user-scoping, cache-key determinism.
- **Handler** (Wave 2): endpoint tests — 200/404/403, center-filter enforcement, perPatient/scatter opt-in, body size cap.
- **Byte-parity test** (Wave 2, AGG-02): seed synthetic cohort → run shared function server-side → HTTP POST → `JSON.stringify` string equality on `median`, `iqrLow`, `iqrHigh` arrays.
- **Audit event test** (Wave 2, AGG-05): DB row assertion that body contains `cohortHash` and NOT `cohortId`.
- **Client routing test** (Wave 3, AGG-03): mock settings below + above threshold → assert server endpoint called vs client compute path taken.
- **Cache invalidation test** (Wave 2, AGG-04): mutate saved search → assert cache entry dropped.

---

## Wave 0 Requirements

- [ ] `tests/cohortTrajectoryShared.test.ts` — parity stubs for the extracted shared module (extraction precondition per RESEARCH.md Finding #1)
- [ ] `tests/outcomesAggregateApi.test.ts` — HTTP endpoint stubs for AGG-01 handler
- [ ] `tests/outcomesAggregateCache.test.ts` — cache behavior stubs for AGG-04
- [ ] `tests/outcomesAggregateParity.test.ts` — byte-parity seed + harness for AGG-02
- [ ] `tests/outcomesAggregateAudit.test.ts` — audit row assertion for AGG-05
- [ ] `tests/OutcomesViewRouting.test.tsx` — client routing test for AGG-03 (may extend existing `tests/OutcomesPage.test.tsx` fixtures)
- [ ] `npm install compression @types/compression` — planner's Wave 0 task (RESEARCH.md Finding #3)

*The planner will mark Wave 0 tasks `autonomous: true` where pure test-file creation, and `autonomous: false` for steps that require npm install + commit verification.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Computing on server…" UX indicator visible when threshold exceeded | AGG-03 (D-14 from CONTEXT.md) | Visual UX polish — perception-of-latency | Seed or configure a cohort > threshold. Open /analysis?tab=trajectories. Observe loading indicator appears briefly, disappears on response. |
| Cache hit is "measurably faster" than cold path in real use | AGG-04 success criterion #4 | Automated test proves it exists; human confirms it feels responsive | Open a large cohort. Time first load vs second load. Second should feel noticeably snappier even before the headline test asserts it. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (7 test files + compression install listed above)
- [ ] No watch-mode flags (use `--run` for all vitest commands)
- [ ] Feedback latency < 5 s
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills the per-task map

**Approval:** pending
