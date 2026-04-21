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

## Milestone: v1.7 — Security, Performance & Cross-Cohort

**Shipped:** 2026-04-21
**Phases:** 4 (14–17) | **Plans:** 16

### What Was Built

- Phase 14: JWT algorithm pin (HS256), cohort hash secret auto-generation, forced password change on default credential, O(N+M) case extraction, FHIR bundle cache warming at startup, ARIA labels on all Recharts trajectory containers
- Phase 15: Per-user TOTP 2FA with QR enrollment, RFC 6238 ±1-window tolerance, one-time recovery codes, admin reset path, static OTP retained as pre-enrollment fallback
- Phase 16: Cross-cohort comparison — 1–4 cohort overlay on one `ComposedChart`, `?cohorts=` deep-link, COHORT_PALETTES (4-color WCAG 3:1+), VIS-04 spaghetti-plot hierarchy
- Phase 17: Audit log multi-dim filters (user, category, date range, body search, failures), Light/Dark/System ThemeContext, DARK_EYE_COLORS with automated 4.5:1 contrast test, Tailwind v4 `@variant dark` class-based strategy, FOUC prevention
- v1.7-full-review security pass: all C1–C5, H1–H7, M1–M8, L1–L10 findings resolved

### What Worked

- **Pre-flight full-review sweep**: Running a security-focused review in parallel with feature phases caught issues at seam boundaries (auth middleware × audit × forced-change) that a per-phase review would have missed
- **Backward-compat static OTP during TOTP rollout**: Keeping the static OTP as a pre-enrollment fallback meant zero user-visible breakage while enrollment capacity ramped
- **Automated contrast assertion for dark palette**: The VIS-03 test codifies the WCAG 4.5:1 requirement; future palette tweaks cannot silently regress it
- **Tailwind v4 migration caught at UAT**: The `@custom-variant` → `@variant` fix (17-05) was scoped as its own plan rather than retrofitted into 17-02, keeping the diff legible

### What Was Inefficient

- **Forced password change scope creep**: SEC-03 touched both backend middleware and frontend routing; the plan underestimated the frontend route-guard complexity and required an additional integration pass
- **Dark-mode sweep (17-04) touched many files**: A single plan to add `dark:` classes across all pages produced a wide diff that was hard to review piecemeal; next time, split by route/section
- **COHORT_PALETTES color choice iteration**: Initial 4-color selection failed one of the WCAG ratios on a secondary color; caught by VIS-03 test but cost a palette round-trip
- **Phase 18 (Keycloak) kept on roadmap despite being blocked**: Should have been explicitly moved to "deferred" at plan time rather than carried as "not started" through the milestone

### Patterns Established

- **`useTheme()` hook for chart internals**: Recharts color values come from the theme hook, never from Tailwind class strings — makes light/dark switching deterministic
- **Contrast test as palette contract**: Any new chart palette module ships with an accompanying WCAG-ratio test or it doesn't merge
- **Pre-enrollment fallback for auth rollouts**: New auth mechanisms should ship alongside their predecessor and retire the old path only after all users have migrated
- **URL params as first-class state**: Cross-cohort mode is fully driven by `?cohorts=`; reload/share restores exact view — continues the `?metric=` pattern from v1.6

### Key Lessons

1. Security hardening at milestone close (v1.7-full-review) caught more than a dozen latent issues across layers — consider making this a standing milestone gate rather than one-off
2. JWT algorithm pinning must be reviewed at every `jwt.verify()` site, not just the primary middleware — defense in depth only works when it's truly everywhere
3. Dark mode is not just CSS — it requires a theme-aware data layer (palette hooks, explicit color values in charts) and must be planned as an architectural change
4. Deferred items should be explicitly labeled and moved off the active roadmap at planning time — carrying "blocked" items as active work pollutes progress tracking

### Cost Observations

- Model mix: primarily claude-sonnet-4-6 with claude-opus-4-7 for the full-review security pass
- Sessions: Multiple sessions over 4 days (2026-04-17 → 2026-04-21)
- Notable: Running the full-review in parallel with Phase 17 execution meant fixes could land alongside feature work rather than queuing up behind it

---

## Cross-Milestone Trends

| Metric | v1.5 | v1.6 | v1.7 |
|--------|------|------|------|
| Tests at close | 313 | 429 | (tracked per-phase) |
| Phases | 3 | 4 | 4 |
| Plans | ~12 | 19 | 16 |
| Timeline | multi-day | 1 day | 4 days |
| Parallel execution | No | Yes (wave-based worktrees) | Yes + parallel full-review |
| Security review | No | No | Yes (v1.7-full-review, C/H/M/L) |

**Trend:** Parallel wave execution retained from v1.6. v1.7 added a parallel security review track that ran alongside feature phases rather than gating at milestone close — this should become a standing pattern. Milestone timelines lengthening (1 → 4 days) reflect security scope and UAT gates, not slower execution.
