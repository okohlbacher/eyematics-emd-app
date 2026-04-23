# Phase 23: Dependency & Lint Cleanup - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Mode:** `--auto` (auto-selected recommended defaults for each gray area)

<domain>
## Phase Boundary

Raise baseline package/lint hygiene without behavior changes:

1. `npm audit --audit-level=moderate` exits 0 — non-breaking upgrades applied, breaking upgrades deferred to `DEFERRED-UPGRADES.md`
2. ESLint rules tightened (strict unused-vars, `prefer-const`, `no-var`, project-appropriate additions) — all violations fixed or suppressed with concrete per-line reason
3. `package.json` scripts normalized around the `dev` / `build` / `test` / `lint` pattern; each script verified to run in a clean checkout; CI references updated

Out of scope: behavior changes, UI work, new features, major framework upgrades (React/Vite/TypeScript major jumps).

</domain>

<decisions>
## Implementation Decisions

### Audit fix strategy
- **D-01:** Use `npm audit fix` (non-`--force`) only. Never run `npm audit fix --force` as part of this phase — it causes breaking upgrades that violate the phase's "non-breaking" constraint.
- **D-02:** For any `moderate`+ advisory that `npm audit fix` cannot resolve without `--force`, pin a compatible transitive version via `overrides` in `package.json` rather than upgrading the direct dep past a major.
- **D-03:** Run `npm audit --audit-level=moderate` as the final gate. `low` advisories are acceptable and do not block this phase.

### Upgrade scope
- **D-04:** Apply all patch + minor upgrades in a single atomic commit per package group (e.g., "chore(23): bump eslint-plugin-react-hooks 7.0.1→7.1.1"). One commit per package keeps the diff reviewable.
- **D-05:** Defer ALL major version bumps (eslint 9→10, @eslint/js 9→10, jwks-rsa 3→4, otplib 12→13, typescript-eslint 8→9, @types/node 24→25). Capture each in `DEFERRED-UPGRADES.md` with a one-line blocker note (breaking-changes link or compat concern).
- **D-06:** `DEFERRED-UPGRADES.md` lives at repo root. Format: one H2 per package, "Current" / "Latest" / "Blocker" / "Revisit trigger" rows.

### ESLint tightening scope
- **D-07:** Add rules per ROADMAP spec: `@typescript-eslint/no-unused-vars` strict (already present — keep), `prefer-const`, `no-var`, and `eqeqeq` (safe, cheap, high-value). Do NOT add aggressive rules like `no-explicit-any`, `strict-boolean-expressions`, or `no-non-null-assertion` — those are large refactors out of scope.
- **D-08:** Keep existing project-specific rules intact: `simple-import-sort/imports`, `simple-import-sort/exports`, `no-restricted-imports` for jsonwebtoken (F-23, T-20-13), context-file override (react-refresh/only-export-components off).
- **D-09:** The autofix pass (`eslint . --fix`) must run BEFORE any manual fixes. Preserve the atomic-commit discipline: one commit for autofix, separate commits for manual rule-by-rule fixes.

### Lint violation fix strategy
- **D-10:** Precedence: `eslint --fix` (autofix) → manual code fix → `// eslint-disable-next-line <rule> -- <concrete reason>` as last resort. Bare `eslint-disable` (no reason, or vague "legacy") is rejected.
- **D-11:** Current lint baseline before autofix: 1448 problems (819 errors, 629 warnings). Target after Phase 23: `npm run lint` exits 0 with 0 errors and 0 warnings (or every remaining warning has a per-line disable with reason). Treat `simple-import-sort` warnings as autofixable noise — expect them to drop to 0 after `--fix`.

### Scripts normalization
- **D-12:** Keep the canonical set: `dev`, `build`, `test`, `test:ci`, `lint`, `preview`, `start`, `knip`. Audit these for functional regressions; do NOT rename any script that is referenced by GitHub Actions or documented in README/CLAUDE.md without updating the reference in the same commit.
- **D-13:** Evaluate `test:check-skips` and `generate-bundles` for current use. If still referenced by CI or scripts, keep; otherwise either delete (D-06 from Phase 22 applies — aggressive deletion) OR add inline `// script retained:` note in a `scripts-README.md` sibling doc. Default: keep if referenced, delete if not.
- **D-14:** Add `"lint:fix": "eslint . --fix"` as a convenience script (additive, low-risk, commonly expected).

### Breaking changes guard
- **D-15:** Safety net: `npm run test:ci` (608/608) + `npm run build` must pass after every commit in this phase. One failing commit blocks the phase.
- **D-16:** After each upgrade commit, run `npm run build` explicitly — Vite/rolldown resolve some dynamic imports at build time that tests don't catch (Phase 22 Pitfall 3 continues to apply).

### Claude's Discretion
- Exact order of upgrade commits (alphabetical, dependency-group, or risk-ordered) — Claude picks whatever keeps diffs reviewable.
- Whether to batch patch-only bumps (e.g., 3 packages moving 0.0.1) into a single commit vs one-per-package — Claude judges based on coupling (React hooks plugin + react-refresh are coupled, e.g.).
- Which specific `project-appropriate` ESLint rules beyond the D-07 baseline (if any emerge during planning) — Claude recommends in research; user confirms before enabling.

</decisions>

<specifics>
## Specific Ideas

- The single moderate audit finding (`follow-redirects <=1.15.11`, GHSA-r4q5-vmmm-2653) is a transitive of a dev tool; check which direct dep pulls it before choosing fix strategy. Likely resolvable via `overrides` without a major bump.
- Lint violation volume (819 errors) is almost certainly dominated by `simple-import-sort/imports` (autofixable). Expect the autofix commit to eliminate >500 of the 1448.
- Phase 22 added `knip` — `knip.json` is already clean. Phase 23 should NOT regress knip (add a `npm run knip` check to the safety-net).

</specifics>

<canonical_refs>
**Downstream agents MUST read these before planning or implementing.**

### ROADMAP & requirements
- `.planning/ROADMAP.md` §Phase 23 — Phase goal, success criteria, requirement IDs
- `.planning/REQUIREMENTS.md` DEPS-01, DEPS-02, DEPS-03 — binding requirement text
- `.planning/MILESTONES.md` v1.9 — milestone goal context

### Current lint/deps state
- `eslint.config.js` — existing flat-config; preserves F-23 (import sort), T-20-13 (no-restricted-imports for jsonwebtoken)
- `package.json` — scripts block and dependency ranges
- `knip.json` — dead-code baseline from Phase 22; Phase 23 must not regress

### Phase history (pattern references)
- `.planning/phases/22-codebase-docs-consistency/22-01-SUMMARY.md` — atomic-commit pattern and `// retained: <reason>` convention
- `.planning/phases/22-codebase-docs-consistency/22-02-SUMMARY.md` — knip safety-net pattern, Pitfall 3 (build + test after every delete)
- `.planning/phases/22-codebase-docs-consistency/22-03-SUMMARY.md` — doc reconciliation pattern (keep CI refs aligned when renaming scripts)

### Security precedents
- Phase 20 `F-17`, `T-20-13` — jsonwebtoken restriction rule in `eslint.config.js` MUST NOT be removed or weakened
- `CLAUDE.md` (root) — terminology and entry points; update if scripts rename

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `eslint.config.js` — already modern flat config; add rules via new rule-block rather than rewriting.
- `.planning/phases/22-codebase-docs-consistency/22-02-SUMMARY.md` — knip + atomic-commit playbook.
- `knip.json` — sibling config for dead-code; keep clean.

### Known pitfalls (from Phase 22)
- **Pitfall 3 (build-time resolution):** `npm run build` catches Vite/rolldown dynamic-import breakage that `npm test` misses. Required after every upgrade commit.
- **Pitfall 5 (archive immutability):** `.planning/milestones/` is archive-only; do not touch.

### Audit baseline
- `npm audit --audit-level=moderate` → 1 moderate (follow-redirects, transitive)
- `npm outdated` → 16 packages; 9 minor/patch available, 7 major deferred
- `npm run lint` → 1448 problems (819 errors, 629 warnings); bulk are autofixable import-sort warnings

</code_context>

<specific_ideas>
## Specific Ideas (continued — implementation-style)

None. Use standard ESLint flat-config idioms and `npm`-native commands.

</specific_ideas>

<deferred_ideas>
## Deferred Ideas

- **TypeScript strict-mode tightening** (`strictNullChecks`, `noImplicitAny` if not already on) — too broad for this phase; propose as a separate future phase.
- **`no-explicit-any` rule** — adopting this would touch dozens of files; defer.
- **Major upgrades** — all listed in `DEFERRED-UPGRADES.md` per D-05/D-06 with revisit triggers.
- **Husky / lint-staged / pre-commit hook reinforcement** — out of scope; existing hooks already run the necessary gates.
- **Replacing `simple-import-sort` with `eslint-plugin-import`** — no benefit for this codebase; defer.

</deferred_ideas>
