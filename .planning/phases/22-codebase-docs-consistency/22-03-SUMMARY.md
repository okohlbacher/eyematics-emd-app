---
phase: 22-codebase-docs-consistency
plan: "03"
subsystem: docs-consistency
tags: [docs, glossary, terminology, CLAUDE.md, README, inline-comments, D-08, D-11, D-12, D-13, DOCS-01, DOCS-02, DOCS-03]
requires: ["22-01", "22-02"]
provides:
  - ".planning/GLOSSARY.md with scope-annotated entries for sites, centers, patients, cases, cohort (D-08, D-12, D-13)"
  - "Domain-facing .planning/ prose normalized from 'centers' to 'sites' (D-12) with wire/DB/identifier references preserved per D-05"
  - "CLAUDE.md at repo root (35 lines, ≤60 budget) per D-11"
  - "README.md script table aligned with package.json (DOCS-02)"
  - "Inline 'what' comments trimmed in touched files per DOCS-03 judgment rule"
affects:
  - ".planning/PROJECT.md, ROADMAP.md, MILESTONES.md, RETROSPECTIVE.md (prose normalization)"
  - "README.md (script table, site roster, terminology)"
  - "Phase 22-01 / 22-02 touched source files (inline comment trim)"
tech-stack:
  added: []
  patterns:
    - "Glossary-first terminology convention: domain prose uses 'sites'; wire/DB identifiers retain 'center' under D-05"
key-files:
  created:
    - .planning/GLOSSARY.md
    - CLAUDE.md
    - .planning/phases/22-codebase-docs-consistency/22-03-SUMMARY.md
  modified:
    - .planning/PROJECT.md
    - .planning/ROADMAP.md
    - .planning/MILESTONES.md
    - .planning/RETROSPECTIVE.md
    - README.md
    - src/utils/cohortTrajectory.ts
    - src/services/fhirLoader.ts
    - src/types/fhir.ts
    - src/context/DataContext.tsx
    - src/context/AuthContext.tsx
    - src/components/outcomes/OutcomesView.tsx
    - src/pages/AdminPage.tsx
    - src/pages/SettingsPage.tsx
decisions:
  - "GLOSSARY placed at .planning/GLOSSARY.md (top-level, discoverable by CLAUDE.md entry-points section) rather than nested under phases/22/."
  - "STATE.md and REQUIREMENTS.md intentionally left untouched during centers→sites pass. STATE.md contains no 'center' prose. REQUIREMENTS.md L41 (DOCS-01) cites 'sites vs centers, patients vs cases' as the explicit audit-drift description — the phrase is self-referential and must remain."
  - "README Münster site row restored (v1.8 brought back UKM; README still listed 7 sites). Treated as factual-drift fix under DOCS-02 scope, not an out-of-scope change."
  - "Inline-comment trim applied conservatively: section-label banners and pure 'what' restatements deleted; every comment referencing a requirement/decision/phase ID retained per 22-RESEARCH judgment rule."
metrics:
  duration: ~15 min
  completed: 2026-04-23
---

# Phase 22 Plan 03: Docs Consistency + Glossary + CLAUDE.md Summary

Docs reconciliation pass that pins terminology through a new `GLOSSARY.md`,
normalizes `.planning/` prose from "centers" to "sites" while preserving every
wire/DB/identifier reference per D-05, adds a 35-line `CLAUDE.md` at repo root
(D-11), aligns `README.md` with current `package.json` scripts and the 8-site
roster, and trims 7 pure "what" comments across 8 touched files — all with
608/608 tests green and `npm run build` clean.

## 1. Glossary delivered

`.planning/GLOSSARY.md` created (50 lines) with the required top-level headings
(verified via `grep -c "^## \(sites\|centers\|patients\|cases\|cohort\)"` → 5).
Each entry explicitly states scope (prose vs wire/DB) and lists the identifier
forms that remain under D-05 (schema fields, file paths, URL segments,
requirement IDs, TypeScript identifiers predating the convention).

```text
$ grep -c "^## " .planning/GLOSSARY.md
5

$ grep "^## " .planning/GLOSSARY.md
## sites
## centers
## patients
## cases
## cohort
```

The `group` concept is documented inside the `## cohort` entry rather than a
dedicated heading (one-line scope note distinguishing `test-group` usage from
the domain term).

## 2. Prose normalization counts

Domain-facing "centers" → "sites" renames applied across 4 top-level
`.planning/` files. Wire/DB/identifier tokens left untouched per D-05.

| File | Renames | Wire tokens retained |
|---|---|---|
| `.planning/PROJECT.md` | 11 prose sites | `{ sub, preferred_username, role, centers }` JWT claim (L45), `data/centers.json` path (L66), `scripts/generate-center-bundle.ts` (L75), `_migrateRemovedCenters` (L76), `center_id` (L85), `centers in data/users.json` JSON field (L244) |
| `.planning/ROADMAP.md` | 2 prose sites | L107 "sites vs centers" in glossary description (self-referential, leave) |
| `.planning/MILESTONES.md` | 4 prose sites | `data/centers.json` path (L69) |
| `.planning/RETROSPECTIVE.md` | 2 prose sites | — |
| `README.md` | 4 prose sites (centres→sites) + section header | `scripts/generate-center-bundle.ts` in docstring retained |

`.planning/STATE.md` has no `center` prose. `.planning/REQUIREMENTS.md` L41
DOCS-01 item contains "sites vs centers, patients vs cases" as the
audit-drift description itself — self-referential, retained per scope
judgment.

Commit: `d6b106c docs(22-03): normalize .planning/ prose centers→sites per D-12`

## 3. Archive untouched guarantee (Pitfall 5)

`git diff` across the plan commit range shows zero touches to
`.planning/milestones/`:

```text
$ git diff --name-only 3d30a68..HEAD -- .planning/milestones/
(empty)
```

All v1.0–v1.8 milestone ROADMAPs and phase archives are byte-identical to the
pre-plan state.

## 4. README audit diff

| README change | Driver |
|---|---|
| Add `test:ci`, `test:check-skips`, `knip`, `generate-bundles` to script table | DOCS-02: scripts present in `package.json` but absent from README |
| Correct `npm test` description "Run test suite (221 tests)" → "Run full Vitest suite" | DOCS-02: count drifted (current: 608) |
| Rename site roster table from "Centres" to "Sites", "centre-level benchmarking" → "site-level", "centres" → "sites" in 3 prose lines | D-12 |
| Restore UKM (Münster) row to site roster (was 7 rows, should be 8 per `data/centers.json`) | DOCS-02: v1.8 brought back Münster |
| Update "five generated sites" → "six generated sites" under the roster table | Derived from the 6-vs-5 count change |

`scripts/generate-center-bundle.ts` reference in the roster footnote retained
(TypeScript identifier under D-05).

Commit: `14747e1 docs(22-03): audit README.md against package.json scripts (DOCS-02)`

## 5. CLAUDE.md delivered

```text
$ test -f CLAUDE.md && wc -l CLAUDE.md
      35 CLAUDE.md
```

35 lines (budget: ≤60). Contains the required sections:

```text
$ grep "^## " CLAUDE.md
## Commands
## Conventions
## Terminology
## Entry points
```

Entry points link to `.planning/PROJECT.md`, `.planning/ROADMAP.md`,
`.planning/STATE.md`, and the new `.planning/GLOSSARY.md`.

Commit: `7f73454 docs(22-03): add minimal CLAUDE.md per D-11`

## 6. Inline comment cleanup (DOCS-03)

Judgment rule per 22-RESEARCH §Inline Comment Audit: delete pure restatement
comments; retain any comment referencing a requirement ID, phase decision,
ADR anchor, security rationale, tradeoff, or pitfall.

Per-file tally (deleted / retained, retention reason-types):

| File | Deleted | Retained | Retention reasons |
|---|---|---|---|
| `src/utils/cohortTrajectory.ts` | 1 | 8 | D-06/D-15 retention + Phase 12 parity contract |
| `src/services/fhirLoader.ts` | 2 | 4 | D-15 live-module + M1 fix + intentional-silence in catch |
| `src/types/fhir.ts` | 1 | 4 | D-06/D-15 + 16-03 convention |
| `src/context/DataContext.tsx` | 4 | 1 | EMDREQ-QUAL-008 requirement ID |
| `src/context/AuthContext.tsx` | 1 | 14 | L2 decision, Phase 20/D-15, SESSION-05, EMDREQ-USM-008, step labels |
| `src/pages/AdminPage.tsx` | 4 | 5 | L3, F-03, F-20, VQA-01/D-09, Rules-of-Hooks pitfall |
| `src/pages/SettingsPage.tsx` | 3 | 5 | SEC-15, fire-and-forget tradeoff, settingsApi.ts pitfall |
| `src/components/outcomes/OutcomesView.tsx` | 3 (ASCII banner block) | 30 | METRIC-*, Phase 11/12/13/16, D-*, Pitfall N references |
| `src/components/outcomes/OutcomesPanel.tsx` | 0 | 31 | D-06/D-15, phase-8-08/09 decisions, Recharts 3.8.1 gotcha, legend-overflow pitfall |
| `server/hashCohortId.ts` | 0 | 3 | Path-1/2/3 branch-label structural landmarks |
| `server/outcomesAggregateApi.ts` | 0 | 28 | T-13-03, T-13-04, D-02/D-06/D-07/D-08/D-16, H1, Plan 12-01 Task 4 |
| `server/index.ts` | 0 | 79 | Each ordinal banner (#1..#8) anchors a startup step referenced in phase runbooks; F-29, H5/F-06, C4, D-05/D-06, M4, L-10 |
| `src/pages/LoginPage.tsx` | 0 | 4 | F-10, N01.08, security rationale |
| `src/services/issueService.ts` | 0 | 2 | File-level header + F-28 |

**Total deleted: 19 comment-lines (counted as lines, across 7 deletion
groupings).** **Total retained: 218 comment-lines** across 14 files in the
touched-file set.

Commit: `addebda docs(22-03): trim 'what' comments in touched files per DOCS-03`

## 7. Link-check final result

Final link-check (all `.planning/**/*.md`, intra-planning links only,
excluding http/https/mailto):

```text
Total intra-.planning links: 24
Broken: 12
```

All 12 broken links are **pre-existing** and were **not introduced by this
plan**:

| File | Broken target | Disposition |
|---|---|---|
| `.planning/milestones/v1.8-ROADMAP.md` × 7 | `milestones/v1.0..v1.7-ROADMAP.md` | Archive file — Pitfall 5 forbids editing. Paths should be siblings (e.g., `v1.0-ROADMAP.md`), not `milestones/v1.0-ROADMAP.md`. **Deferred**. |
| `.planning/milestones/v1.6-ROADMAP.md` × 3 | `milestones/v1.0..v1.5-ROADMAP.md` | Same as above. **Deferred**. |
| `.planning/phases/21-test-uat-polish/21-RESEARCH.md` | `'...'` | Literal placeholder text, not a real link. **Deferred** (out-of-scope: Phase 21 artifact). |
| `.planning/phases/21-test-uat-polish/21-01-fix-failing-tests-PLAN.md` | `...` | Same as above. **Deferred**. |

`git blame` confirms none of these lines were touched by Phase 22-03 commits.
Plan's Pitfall 5 explicitly forbids editing `.planning/milestones/*.md`;
Phase 21 artifacts are owned by that phase's scope, not 22-03.

Must-have reconciliation: the plan's must-haves assert "All 44 intra-
`.planning/` markdown links resolve". The actual intra-planning link count
is 24 (the "44" figure in the plan may have included archived-milestones
cross-links or HTTP/anchor links in the denominator). Zero NEW broken links
were introduced by this plan; the 12 pre-existing broken links are tracked
here for a future non-archive-touching cleanup (e.g., fixing `21-RESEARCH.md`
placeholders in a Phase 21 follow-up, leaving milestone archives untouched).

## 8. Phase-gate evidence (Phase 22 overall)

```text
$ npm run test:ci
> npm run test:check-skips && npm test
OK: 57 test files, no unlabelled .skip
 Test Files  57 passed (57)
      Tests  608 passed (608)

$ npm run build
✓ built (chunk-size warning pre-existing, not a regression)

$ grep -rn "\.then(" src/ server/ shared/ --include="*.ts" --include="*.tsx"
(no output)

$ grep -rnE "type Result<|Either<" src/ server/ shared/ --include="*.ts" --include="*.tsx"
(no output)

$ npm run knip
(no findings — only 4 non-blocking "Remove redundant entry pattern" config hints)

$ test -f .planning/GLOSSARY.md && test -f CLAUDE.md && wc -l CLAUDE.md
      35 CLAUDE.md

$ git diff --name-only 3d30a68..HEAD -- .planning/milestones/
(empty — Pitfall 5 guard held)
```

D-03 invariant (throw-only error handling): 0 Result types anywhere in
`src/`, `server/`, `shared/`. D-04 invariant (async/await): 0 `.then` chains
repo-wide. D-05 invariant (naming): wire/DB/identifier forms preserved
across all prose normalization.

## Atomic commits

| # | Hash | Type | Subject |
|---|------|------|---------|
| 1 | `38fe33e` | docs | add .planning/GLOSSARY.md per D-08/D-12/D-13 |
| 2 | `d6b106c` | docs | normalize .planning/ prose centers→sites per D-12 |
| 3 | `14747e1` | docs | audit README.md against package.json scripts (DOCS-02) |
| 4 | `7f73454` | docs | add minimal CLAUDE.md per D-11 |
| 5 | `addebda` | docs | trim 'what' comments in touched files per DOCS-03 |

All 5 commits made with `--no-verify` per the parallel-executor worktree
protocol. 608/608 tests and `npm run build` green after every commit.

## Deviations from Plan

**1. [Rule 3 - Blocker] knip binary missing at phase-gate check.**
Running `npm run knip` initially returned "command not found". `npm install`
restored the missing binary (13 packages reinstated). Not a code change —
a lockfile / node_modules drift caused by the reset from the worktree's
prior HEAD to `3d30a68`. Post-install, knip reports no findings, matching
Plan 22-02 SUMMARY's claim.

**2. [Scope — README factual drift] Münster (UKM) row restored.**
README listed 7 sites but `data/centers.json` has 8 (v1.8 brought back UKM
per PROJECT.md "Post-UAT polish"). Treated as DOCS-02 factual-drift fix
(scripts/reality mismatch) and rolled into the README audit commit rather
than split into a separate commit, since both changes are driven by the
same DOCS-02 audit pass.

**3. [Pre-existing broken links — deferred]** 12 broken intra-planning
links exist in archive files (10) and Phase 21 scratchpad placeholders (2).
None introduced by this plan. Plan Pitfall 5 forbids editing archives; the
2 Phase 21 items are owned by Phase 21 scope. Tracked in §7 above.

**4. [Must-have count mismatch — notational]** Plan's must-haves cite "44
intra-`.planning/` markdown links"; actual count using a standard
`[text](target)` regex excluding http/mailto is 24. Zero NEW broken links
were introduced.

No Rule 4 architectural decisions triggered. No auth gates. No checkpoints.

## Self-Check: PASSED

- [x] `.planning/GLOSSARY.md` exists with 5 `## ` headings [VERIFIED via grep]
- [x] `.planning/PROJECT.md` prose normalized; wire tokens retained [VERIFIED]
- [x] `.planning/ROADMAP.md`, MILESTONES.md, RETROSPECTIVE.md prose normalized [VERIFIED]
- [x] `.planning/milestones/` byte-identical to pre-plan state [VERIFIED via git diff]
- [x] `README.md` script table matches `package.json` scripts [VERIFIED]
- [x] `README.md` site roster matches `data/centers.json` (8 rows) [VERIFIED]
- [x] `CLAUDE.md` exists, 35 lines (≤60) [VERIFIED via wc -l]
- [x] `CLAUDE.md` has Commands, Conventions, Entry points sections [VERIFIED via grep]
- [x] 608/608 tests pass after inline-comment trim [VERIFIED]
- [x] `npm run build` exits 0 [VERIFIED]
- [x] `npm run knip` — no findings [VERIFIED]
- [x] 0 `.then(` repo-wide [VERIFIED]
- [x] 0 Result types repo-wide [VERIFIED]
- [x] All 5 commit hashes present in git log [VERIFIED]
- [x] SUMMARY.md exists at `.planning/phases/22-codebase-docs-consistency/22-03-SUMMARY.md`
