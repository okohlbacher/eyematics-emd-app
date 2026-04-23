---
phase: 22-codebase-docs-consistency
created: 2026-04-23
goal: "src/, server/, and shared/ have single-source-of-truth utilities with one canonical pattern per concern, no dead code, tightened types, and .planning/ + README + inline docs match the shipped codebase"
requirements: [CONSIST-01, CONSIST-02, CONSIST-03, CONSIST-04, DOCS-01, DOCS-02, DOCS-03]
ui_hint: no
---

# Phase 22: Codebase & Docs Consistency — Context

## Domain Boundary

Internal quality sweep: deduplication, pattern alignment, dead-code removal, type narrowing, and documentation reconciliation. **No user-visible product changes.** The Phase 21 safety net (608/608 tests, zero skips, 5 UAT-AUTO items) is the regression floor — every refactor commit must keep `npm run test:ci` green.

## Decisions

### D-01 — Dedup target: strict `shared/`
Any utility/helper used by both `src/` and `server/` MUST live in `shared/`. Eliminates the "which module owns this?" ambiguity and matches the existing pattern (cohortTrajectory, fhirCodes, patientCases, etc. already live there). Single-boundary helpers may remain in `src/lib/` or `server/` local modules, but cross-boundary code has exactly one home.

**Implication for planner:** When dedup candidates cross the src/server boundary, target = `shared/`. No new `src/utils/` or `server/utils/` barrel modules.

### D-02 — Duplicate threshold: exact + near-duplicate ≥80%
Merge identical functions AND near-identical ones with ≥80% structural similarity and same intent. Covers copy-paste drift (same logic, renamed variables, slightly reordered branches). Under 80% similarity → treat as distinct.

**Implication for researcher:** Use a similarity heuristic (AST structural compare or `jscpd`-style). Surface candidates with similarity scores in RESEARCH.md. Planner picks which to merge.

### D-03 — Error handling: throw-only
All error paths throw; callers handle or propagate. Matches existing `server/*` idiom. Result-types are banned in new code. Existing Result-type usages (if any) are migrated during the same pass that touches those files.

**Implication for planner:** `CONSIST-02` includes an audit for Result-pattern usages and a migration step. Errors carry descriptive messages; use typed `Error` subclasses only where callers need to discriminate (e.g., `AuthError` vs generic).

### D-04 — Async style: strict async/await
All new and touched code uses async/await. `.then` chains in files touched during Phase 22 are rewritten to async/await. `Promise.all` / `Promise.race` remain allowed (they orchestrate, not continuate).

**Implication for planner:** A `.then`-chain audit is part of `CONSIST-02`; files not otherwise touched stay as-is (scope-control).

### D-05 — Naming: camelCase with FHIR + HTTP wire exceptions
All TS identifiers are camelCase **except**:
- FHIR resource field names (from the HL7 FHIR spec — e.g., `resourceType`, `birthDate` are camelCase per spec; keep whatever the spec mandates)
- HTTP header names (`x-csrf-token`, `content-type`, etc.)
- Raw SQL column names (kept verbatim to match DB schema)

Violations in files touched during Phase 22 are corrected. Untouched files stay for scope control.

### D-06 — Dead-code: aggressive delete
Delete all `ts-prune` unused exports. Delete commented-out code blocks. Delete stale feature-flag branches. Trust git history for recovery. Retention requires an inline `// retained: <concrete reason>` comment — vague justifications are deleted.

**Implication for planner:** `CONSIST-03` runs `ts-prune` (or equivalent — `knip`) once at start, produces the delete list, executes it as a single atomic commit per module. Edge cases (public API exports with no current callers but documented external use) surface for human review.

### D-07 — Type narrowing: touched-file scope
`any` and broad `unknown` types are narrowed in files already being modified for CONSIST-01..03. Files not otherwise touched stay. Duplicated type definitions are consolidated into `shared/types/` (or nearest shared module).

**Implication for planner:** No separate "type-narrowing pass" over the whole codebase. Type work rides along with dedup/pattern/dead-code work.

### D-08 — Docs scope: full audit + glossary
`DOCS-01..03` covers: `.planning/` files (PROJECT.md, ROADMAP.md, archived milestone ROADMAPs), README.md, CLAUDE.md, **and** inline JSDoc. A new `.planning/GLOSSARY.md` normalizes terminology (sites vs centers, patients vs cases, cohort vs group, etc.). Every intra-`.planning/` link must resolve. Inline "what" comments are deleted in favor of "why" comments.

### D-09 — Plan shape: 3 plans in sequential waves
- **Plan 22-01** — Dedup + pattern alignment (CONSIST-01, CONSIST-02). Wave 1.
- **Plan 22-02** — Dead-code removal + type narrowing (CONSIST-03, CONSIST-04). Wave 2. Depends on 22-01 (narrows types on the deduped surface; runs ts-prune on the already-consolidated module set).
- **Plan 22-03** — Docs reconciliation + glossary (DOCS-01, DOCS-02, DOCS-03). Wave 3. Depends on 22-02 (docs must describe the post-dedup, post-prune codebase).

Sequential because each wave operates on the previous wave's output. No parallel execution.

### D-10 — Refactor safety net
After every atomic dedup/pattern/rename commit, `npm run test:ci` must exit 0 with 608/608 passing and zero skips. Commits that fail this invariant are reverted and rewritten. This is the enforcement mechanism for "keeping the safety net intact."

## Specifics

- **"sites" vs "centers":** User's domain vocabulary — glossary must pick one and propagate. (Decide during planning or defer to user.)
- **"patients" vs "cases":** Same — glossary decides.
- **Commit granularity within a plan:** One commit per dedup target (merged function + all call sites in one commit) so any single merge can be reverted independently. Multiple dedups per commit break this invariant — avoid.

## Deferred Ideas

- Broader type-system tightening (strict mode flip, no implicit `any` at config level) — scope creep, belongs in Phase 23 or later
- `jscpd`-as-CI-gate — would catch future duplication but adds tooling; reconsider after Phase 22 data shows real recurrence
- Module boundary enforcement via ESLint `import/no-restricted-paths` — Phase 23 lint scope, not Phase 22

## Canonical Refs

- `.planning/ROADMAP.md` — Phase 22 Success Criteria (5 criteria, authoritative)
- `.planning/REQUIREMENTS.md` — CONSIST-01..04, DOCS-01..03 specs
- `.planning/PROJECT.md` — terminology baseline for glossary work
- `.planning/phases/21-test-uat-polish/21-VERIFICATION.md` — the 608/608 safety net this phase must preserve
- `shared/` directory — existing dedup landing zone pattern
- HL7 FHIR spec — authoritative for FHIR field naming (no local URL; follow upstream)

## Next Steps

- `/gsd-plan-phase 22` — produce RESEARCH.md + 3 plans per D-09
