# Phase 36: Architecture Review & Compaction - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning
**Mode:** Auto-generated (review/process phase; one human approval gate before applying remediations)

<domain>
## Phase Boundary

Final v1.11 milestone gate. Three movements:
1. **Adversarial review (ARCH-01):** run an adversarial full-codebase architecture review with the **CODEX CLI** (`codex` 0.128.0, confirmed available) covering architecture, separation of concerns, and overall design. Produce a severity-classified findings report under `.planning/reviews/v1.11-arch-review/`.
2. **Compaction plan (ARCH-02):** synthesize the findings into a prioritized compaction plan with concrete file references per finding (dead code, redundant abstractions, duplicated logic, oversized modules, SoC violations).
3. **Approved remediation + close-out (ARCH-03 / VVBACK-05):** apply ONLY user-approved remediations, keep `npm run test:ci` green (zero failures), `npm run knip` with no new dead code, `npm run lint` passing, no behavior regressions; then update deferred-debt tracking (STATE.md, PROJECT.md, MILESTONES.md) to reflect milestone closure.

This phase modifies product source only for approved compaction remediations — never speculative rewrites.

</domain>

<decisions>
## Implementation Decisions

### Review tooling (locked by ROADMAP)
- Reviewer: CODEX CLI (`codex`), adversarial full-codebase pass. Findings written under `.planning/reviews/v1.11-arch-review/` (e.g. `FINDINGS.md` + a `COMPACTION-PLAN.md`).
- Review is READ-ONLY — it produces findings, applies nothing.

### Approval gate (the key human decision)
- After the compaction plan is produced, PAUSE and present the prioritized findings to the user for explicit approval **before** any code is deleted or restructured. Apply only approved items. This is the one mandatory checkpoint — compaction is irreversible-ish and must not be auto-applied wholesale.
- Default risk posture: **conservative** — clear dead code, safe de-duplication, and lint/knip hygiene are low-risk and recommended for approval; large module restructures / SoC refactors are surfaced but default to DEFER unless the user opts in.

### Known baseline inputs (seed the review)
- knip currently reports 2 unused exported types: `Encounter` and `Consent` interfaces in `shared/types/fhir.ts` (added Phase 34, intentionally not wired into `PatientCase` per D-01/D-02). Compaction must resolve the "no NEW dead code" criterion — options: drop the `export` keyword, consume the types in the generator/loader typing, or add a justified knip ignore. Decide at remediation time.
- lint reports 2 auto-fixable import-sort warnings in `tests/stubIsolation.test.ts` and `tests/augmentReferenceBundles.test.ts` (Phase 34). Safe `--fix`.

### Gates (must all hold after remediation)
- `npm run test:ci` → 0 failures (currently 901/901 green).
- `npm run knip` → no NEW dead code vs. the documented baseline.
- `npm run lint` → passes (currently exits 0 with 2 warnings; aim for 0 warnings after hygiene fix).

### Debt closure (VVBACK-05)
- After remediation, update STATE.md "Deferred Items" (VVBACK-01..04 now closed by Phase 35), PROJECT.md current-state, and MILESTONES.md to reflect v1.11 closure.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `/gsd-review` cross-AI peer-review machinery and the project "full-review" workflow exist; CODEX is invoked via stdin-piped prompts (never shell-interpolated).
- Gate commands already wired in package.json: `test:ci`, `knip` (config `knip.json`), `lint`.

### Established Patterns
- Adversarial review precedent: the v1.11 ROADMAP itself was revised per an earlier adversarial review (M1/M2/H1/H2 annotations).

### Integration Points
- Findings dir: `.planning/reviews/v1.11-arch-review/` (created).
- Debt tracking files: `.planning/STATE.md`, `.planning/PROJECT.md`, `.planning/MILESTONES.md` (verify path) / ROADMAP shipped-milestones table.

</code_context>

<specifics>
## Specific Ideas

CODEX invocation should scope the review to the application source (server/, src/, shared/, scripts/) and explicitly ask for: dead code, redundant abstractions, duplicated logic, oversized modules, and separation-of-concerns violations — each with concrete file:line references and a severity (critical/high/medium/low).

</specifics>

<deferred>
## Deferred Ideas

Large architectural refactors surfaced by CODEX that are not low-risk are recorded as future tech debt rather than applied in this milestone-closing phase, unless the user explicitly approves them.

</deferred>
