# Retrospective

Living retrospective across milestones. Each milestone gets a section. Cross-milestone trends updated at each close.

---

## Milestone: v1.6 — Outcomes Polish & Scale

**Shipped:** 2026-04-17
**Phases:** 4 | **Plans:** 19 | **Commits:** 116

### What Was Built

- Phase 10 (Visual/UX QA): WCAG-verified palette module, IQR band guard, tooltip format + suppression, all-eyes-filtered empty state, admin center filter with roster-change canary, stable composite row keys
- Phase 11 (PII hardening): HMAC-SHA256 cohort ID hashing, POST beacon with keepalive, hashCohortId utility reused across phases
- Phase 12 (Server aggregation): `POST /api/outcomes/aggregate` with JWT-center filtering, user-scoped TTL cache, byte-parity with client path, `shared/` module extraction, >1000-patient auto-routing
- Phase 13 (New metrics): CRT trajectory (LOINC LP267955-5), treatment-interval histogram (6 bins), responder classification (configurable ETDRS threshold), metric selector with `?metric=` deep-link, per-metric CSV export, 60 metrics* i18n keys with automated completeness test

### What Worked

- **Wave-based parallel execution** (Phase 13): Wave 0 (scaffold) → Wave 1 (3 parallel metric implementations) → Wave 2 (integration + test) kept individual agent context budgets small and produced clean diffs
- **TDD RED-scaffold pattern**: Wave 0 created `describe.skip` RED tests that Wave 1 activated — prevented test drift and gave each plan a clear acceptance surface
- **shared/ module extraction upfront** (Phase 12, Plan 12-01): Moving cohort math to `shared/` before the aggregation handler meant Plans 12-02/12-03/12-04 all shared the same import paths with zero ambiguity
- **METRIC-06 test-driven design**: Seeding 60 i18n keys in Wave 0 and enforcing completeness via automated test (Plan 13-06) caught the `metricsSettingsNoControls` dangling reference immediately when 13-05 landed

### What Was Inefficient

- **Orphan-style worktree merges**: Worktrees created via `isolation: "worktree"` only contain files committed by the subagent. Standard `git merge` fails with "modify/delete" conflicts for all pre-existing files. Direct file copy + manual commit was the workaround — but this wasn't documented in the workflow and caused confusion during Wave 1 integration
- **METRIC-05 missed by 13-05 agent**: The OutcomesDataPreview per-metric CSV flatteners were in the plan but the agent didn't implement them. The gsd-verifier caught it, but it required an additional manual fix pass
- **13-05 agent didn't commit**: The agent produced correct code changes in the worktree working directory but failed to commit them, so the integration had to be done manually by copying files
- **metricSelector.test.ts JSX in .ts file**: The Wave 0 scaffold created JSX in a `.ts` file — caused parse errors when activated. Should always use `.tsx` for test files containing React component renders

### Patterns Established

- **Direct file copy pattern for orphan worktrees**: `cp $WT/path/file.ext main/path/file.ext` then commit — reliable for plans that only add new files (disjoint file sets)
- **VALID_METRICS allowlist on both server and client**: Server body validation + client URL param validation both use the same set of valid metric strings — prevents dangling metric params from reaching computation logic
- **`bodySiteEye()` dual-SNOMED helper inline**: Production SNOMED codes (362503005/362502000) and test fixture codes (24028007/8966001) — inline helper in each module that needs it to avoid shared-module coupling
- **Verifier as mandatory gap catcher**: Running gsd-verifier after execution caught the METRIC-05 gap that would have shipped silently otherwise

### Key Lessons

1. Worktree branches are orphan-style — document this prominently in execute-phase so agents know to commit atomically and the orchestrator knows to use direct copy
2. Always `.tsx` for test files that render React components — catch at scaffold time, not activation time
3. Plan explicit acceptance criteria for "agent must commit" — a plan that produces code without committing it is incomplete by definition
4. gsd-verifier is worth running even when all plans appear complete — it caught a real gap (METRIC-05) that all plan SUMMARYs claimed as done

### Cost Observations

- Model: claude-sonnet-4-6 throughout
- Sessions: 2 (plan+execute in one session, context overflow required continuation)
- Notable: Wave-based parallel execution with 5 worktree agents was the most efficient approach; plan quality gates (gsd-plan-checker) caught 2 BLOCKERs before any code was written

---

## Cross-Milestone Trends

| Metric | v1.5 | v1.6 |
|--------|------|------|
| Tests at close | 313 | 429 |
| Test files | 27 | 47 |
| Phases | 3 | 4 |
| Plans | ~12 | 19 |
| Timeline | multi-day | 1 day (2026-04-16→17) |
| Parallel execution | No | Yes (wave-based worktrees) |

**Trend:** Test coverage growing proportionally to features. Parallel wave execution cut the wall-clock time for Phase 13 significantly vs sequential execution.
