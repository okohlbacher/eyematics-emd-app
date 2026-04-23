# Phase 23: Dependency & Lint Cleanup — Research

**Researched:** 2026-04-23
**Domain:** Dependency hygiene, ESLint rule tightening, npm scripts normalization
**Confidence:** HIGH (repo-grounded; all lint/audit/version claims verified against live working tree and npm registry on 2026-04-23)

## Summary

Phase 23 is a three-task hygiene sweep. The baseline is cleaner than it appears at first glance:

- **Audit:** Exactly **1** moderate advisory (`follow-redirects <=1.15.11`, GHSA-r4q5-vmmm-2653). It is a **transitive** dep (`http-proxy-middleware → http-proxy@1.18.1 → follow-redirects@1.15.11`). Upstream publishes `follow-redirects@1.16.0` which fixes it. `npm audit fix` may or may not bubble the override depending on the lockfile; a `package.json#overrides` entry is the deterministic fix and preserves the D-01/D-02 "no major bumps" invariant [VERIFIED: `npm view follow-redirects version` → 1.16.0, `npm ls follow-redirects`].
- **Lint:** 1448 problems = **599 `simple-import-sort/imports`** (autofix, 100% of those are warnings) + **484 `@typescript-eslint/no-explicit-any`** (error; rule inherited from `tseslint.configs.recommended`, NOT newly added by us) + **137 `@typescript-eslint/no-unused-vars`** + **76 `no-restricted-imports`** + **74 `react-refresh/only-export-components`** + tail. **The autofix pass eliminates the 629 warnings (all simple-import-sort) in one commit; the remaining 819 errors are the real work** [VERIFIED: `npm run lint 2>&1` rule breakdown].
- **Upgrades:** 9 minor/patch bumps (all verified below). Zero violate the D-05 "no major bump" rule.
- **Scripts:** 10 scripts in `package.json`. All 10 are live and referenced somewhere; only `test:check-skips` is a sub-command of `test:ci` (not externally invoked). The D-12 "canonical set" + D-14 `lint:fix` change is small and low-risk.

**Primary recommendation:** Execute in **three sequential waves** with a strict safety-net (`test:ci` + `build` + `knip`) after every commit. Wave 1 (deps) is mechanical. Wave 2 (lint) has one "big bang" (autofix commit eliminates 629 warnings) followed by **rule-by-rule** batches (sort touched-file fixes by rule, not by file, so each commit has a reviewable single-rule theme). Wave 3 (scripts) is a single commit with the `lint:fix` addition + CI-reference verification; rename nothing because all canonical names are already in place.

**Critical finding that reshapes D-07:** `@typescript-eslint/no-explicit-any` is **already firing** (inherited from `tseslint.configs.recommended`), producing 484 errors. D-07 says "Do NOT add aggressive rules like `no-explicit-any` — those are large refactors out of scope." The planner must resolve this contradiction explicitly. Three options: (a) fix all 484 in Wave 2 (scope explosion; violates D-07 spirit), (b) downgrade the rule to `warn` or disable it project-wide (removes an already-active guardrail; reduces quality), or (c) fix the trivial subset and per-line disable the rest with concrete reasons (per D-10's "as last resort" precedence — but 484 disables feels excessive). **Recommended: option (c) with a sensible cap — fix all in files already touched by Phase 22 dedup/type-narrowing (they're already reviewed surface); per-line disable the rest with a single reason-tag referencing a new `DEFERRED-LINT.md` phase ticket for future narrowing work.** Flagged as A1 / Open Q1 for user confirmation.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** Use `npm audit fix` (non-`--force`) only. Never `--force` in this phase.
- **D-02** For `moderate`+ advisories unresolvable without `--force`, use `package.json#overrides` to pin compatible transitive versions.
- **D-03** `npm audit --audit-level=moderate` is the final gate. `low` is acceptable.
- **D-04** All patch + minor upgrades applied; one atomic commit per package group.
- **D-05** Defer ALL major version bumps (eslint 9→10, @eslint/js 9→10, jwks-rsa 3→4, otplib 12→13, typescript-eslint 8→9, @types/node 24→25). Capture in `DEFERRED-UPGRADES.md`.
- **D-06** `DEFERRED-UPGRADES.md` at repo root; one H2 per package with Current / Latest / Blocker / Revisit trigger rows.
- **D-07** Add rules: `prefer-const`, `no-var`, `eqeqeq`. Keep existing `@typescript-eslint/no-unused-vars` strict. Do **NOT** add `no-explicit-any`, `strict-boolean-expressions`, `no-non-null-assertion`.
- **D-08** Preserve project-specific rules: `simple-import-sort/imports`, `simple-import-sort/exports`, `no-restricted-imports` for jsonwebtoken (F-23, T-20-13), context-file override (react-refresh/only-export-components off).
- **D-09** Autofix pass runs BEFORE any manual fixes. Atomic commits: one for autofix, separate commits for manual rule-by-rule fixes.
- **D-10** Precedence: `eslint --fix` → manual code fix → `// eslint-disable-next-line <rule> -- <concrete reason>`. Bare disable rejected.
- **D-11** Baseline 1448 problems (819 errors, 629 warnings). Target: `npm run lint` exit 0 with 0 errors, 0 warnings (or every remaining warning has a per-line disable with reason).
- **D-12** Canonical set: `dev`, `build`, `test`, `test:ci`, `lint`, `preview`, `start`, `knip`. Don't rename scripts referenced by GitHub Actions / README / CLAUDE.md without updating the reference in the same commit.
- **D-13** Evaluate `test:check-skips` and `generate-bundles` for current use. Default: keep if referenced, delete if not.
- **D-14** Add `"lint:fix": "eslint . --fix"`.
- **D-15** Safety net: `npm run test:ci` (608/608) + `npm run build` must pass after every commit.
- **D-16** After each upgrade commit, run `npm run build` explicitly (Phase 22 Pitfall 3 applies — Vite/rolldown dynamic-import resolution at build time).

### Claude's Discretion

- Exact order of upgrade commits (alphabetical, dependency-group, or risk-ordered).
- Batching patch-only bumps (3 packages moving 0.0.1) into a single commit vs one-per-package (coupling-driven: react-hooks plugin + react-refresh are coupled).
- Which specific `project-appropriate` ESLint rules beyond D-07 to recommend; user confirms before enabling.

### Deferred Ideas (OUT OF SCOPE)

- TypeScript `strictNullChecks` / `noImplicitAny` at tsconfig level — propose separate future phase.
- `no-explicit-any` rule (per D-07) — see §Critical Finding / A1 about the rule being already-on.
- Major upgrades — listed in DEFERRED-UPGRADES.md per D-05/D-06.
- Husky / lint-staged / pre-commit hook reinforcement.
- Replacing `simple-import-sort` with `eslint-plugin-import`.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEPS-01 | npm audit clean (moderate) + non-breaking upgrades | §Audit Finding + §Upgrade Inventory — 1 transitive advisory with `overrides` fix + 9 verified minor/patch bumps |
| DEPS-02 | ESLint tightening (no-unused-vars, prefer-const, no-var, project-appropriate) | §Lint Baseline Breakdown + §ESLint Rule Rollout Strategy |
| DEPS-03 | `package.json` scripts normalized + verified | §Scripts Inventory + §Scripts Normalization Approach |

## Project Constraints (from CLAUDE.md)

**Finding:** `./CLAUDE.md` exists at repo root (created in Phase 22-03 per D-11). Key directives that constrain Phase 23:

- Naming: camelCase for TS identifiers; wire/DB/FHIR/HTTP strings stay as-is (D-05 from Phase 22) — **implication: any ESLint rule touching identifier casing must respect this carve-out**.
- Error handling: throw-only; no Result types (D-03 Phase 22).
- Async: async/await in new and touched files; `Promise.all` allowed (D-04 Phase 22) — **implication: Wave 2 lint fixes that rewrite code should preserve async/await style, not regress to `.then`.**
- Cross-boundary helpers in `shared/` (D-01 Phase 22).
- Config: `config/settings.yaml` is the single source — NO env vars.
- Tests: no jest-dom; RTL uses `queryByText().not.toBeNull()`.
- Terminology: prose uses "sites"; wire/DB "center(s)" stays verbatim.

None of the Phase 23 candidate rules (`prefer-const`, `no-var`, `eqeqeq`) conflict with these directives.

## Standard Stack

### Verified current versions (npm registry, 2026-04-23)

| Package | Current in repo | Latest | Bump type | D-05 status |
|---------|-----------------|--------|-----------|-------------|
| `@tailwindcss/vite` | 4.2.2 | 4.2.4 | patch | Apply |
| `better-sqlite3` | 12.8.0 | 12.9.0 | minor | Apply |
| `eslint-plugin-react-hooks` | 7.0.1 | 7.1.1 | minor | Apply |
| `globals` | 17.4.0 | 17.5.0 | minor | Apply |
| `lucide-react` | 1.8.0 | 1.9.0 | minor | Apply |
| `react-router-dom` | 7.14.0 | 7.14.2 | patch | Apply |
| `tailwindcss` | 4.2.2 | 4.2.4 | patch | Apply |
| `typescript` | ~6.0.2 | 6.0.3 | patch | Apply |
| `vite` | 8.0.4 | 8.0.10 | patch | Apply |
| `vitest` | 4.1.4 | 4.1.5 | patch | Apply |
| `follow-redirects` (transitive) | 1.15.11 | 1.16.0 | patch (security) | Apply via `overrides` |
| **Major — defer** | | | | |
| `eslint` | 9.39.4 | 10.2.1 | MAJOR | Defer → DEFERRED-UPGRADES.md |
| `@eslint/js` | 9.39.4 | 10.0.1 | MAJOR | Defer |
| `jwks-rsa` | 3.2.0 | 4.0.1 | MAJOR | Defer |
| `otplib` | 12.0.1 | 13.4.0 | MAJOR | Defer |
| `@types/node` | 24.12.2 | 25.6.0 | MAJOR | Defer |
| `typescript-eslint` | 8.58.0 | 8.59.0 (minor — 9.x is major) | **Needs verify** | See §Edge case |

[VERIFIED: `npm view <pkg> version` executed 2026-04-23]

**Edge case — `typescript-eslint`:** CONTEXT D-05 says "typescript-eslint 8→9" is a major defer, but `npm view typescript-eslint version` returns `8.59.0` today. There is a `9.x` line on the registry but `latest` tag is `8.59.0`. Apply the minor bump `8.58.0 → 8.59.0`; a 9.x defer is not currently actionable. Planner should verify `npm view typescript-eslint versions` and confirm the 9.x line status before executing.

### Minor/patch couplings (batching guidance)

| Group | Packages | Coupled because |
|-------|----------|------------------|
| Tailwind group | `tailwindcss` + `@tailwindcss/vite` | Shipped in sync; major version identical (both 4.2) |
| TypeScript+Vitest group | `typescript` + `vitest` + `vite` | Vitest tracks TS + Vite; bumping one without the others risks a typecheck mismatch in edge cases |
| React-Hooks lint group | `eslint-plugin-react-hooks` | **Standalone** — no coupled package this round (react-refresh stays) |
| Globals | `globals` | Standalone |
| Single patches | `lucide-react`, `react-router-dom`, `better-sqlite3` | Independent; batch as "other deps" commit |
| Security transitive | `follow-redirects` via `overrides` | Must not touch `http-proxy-middleware` (D-05 bans major bumps; http-proxy-middleware is on latest 3.x anyway) |

### Installation approach (canonical)

```bash
# Apply minor/patch bumps with the update script, NOT edit-by-hand, to avoid lockfile churn
npm install @tailwindcss/vite@4.2.4 tailwindcss@4.2.4  # coupled Tailwind
npm install typescript@6.0.3 vitest@4.1.5 vite@8.0.10  # coupled TS/Vitest/Vite
npm install eslint-plugin-react-hooks@7.1.1            # standalone
npm install globals@17.5.0                              # standalone
npm install lucide-react@1.9.0 react-router-dom@7.14.2 better-sqlite3@12.9.0  # other deps
```

Each command produces a deterministic `package.json` + `package-lock.json` diff; commit per group.

### `overrides` block (security transitive fix)

```json
{
  "overrides": {
    "follow-redirects": "^1.16.0"
  }
}
```

This is additive; place between `devDependencies` and other top-level keys. After adding, run `npm install` to refresh the lockfile, then re-run `npm audit --audit-level=moderate` to verify exit 0.

[CITED: https://docs.npmjs.com/cli/v10/configuring-npm/package-json#overrides — npm overrides spec]

## Lint Baseline Breakdown

**Total:** 1448 problems (819 errors, 629 warnings) [VERIFIED: `npm run lint 2>&1 | tail -5`].

**Rule breakdown** [VERIFIED: `npm run lint 2>&1 | awk` rule tally]:

| Rule | Count | Severity | Autofix? | D-07 classification |
|------|-------|----------|----------|---------------------|
| `simple-import-sort/imports` | 599 | warning | **YES** (all) | Pre-existing (D-08 keep) |
| `@typescript-eslint/no-explicit-any` | 484 | error | No (manual refactor) | **Already active (see §Critical Finding)** |
| `@typescript-eslint/no-unused-vars` | 137 | error | No (manual delete) | Pre-existing, D-07 keep strict |
| `no-restricted-imports` | 76 | error | No (manual rewrite) | Pre-existing (D-08 — jsonwebtoken rule) |
| `react-refresh/only-export-components` | 74 | error | No (manual) | Pre-existing (D-08 — context override) |
| `simple-import-sort/exports` | 12 | warning | **YES** (all) | Pre-existing |
| `react-hooks/rules-of-hooks` | 1 | error | No | Pre-existing |
| Misc (`renders`, `declared`, `expected`) | 47 | varies | Likely manual | Pre-existing TypeScript diagnostic pass-through |

**After D-09 autofix pass (Wave 2 commit 1):** All 611 `simple-import-sort/*` warnings are eliminated. Expected new baseline: ~**837 errors, 0 warnings**. (The 18-error delta vs 819 is from autofix potentially surfacing newly-triggered rules on rearranged code — unlikely but Wave 2 commit 1 must verify.)

### Critical Finding: `no-explicit-any` contradiction with D-07

D-07 reads: *"Do NOT add aggressive rules like `no-explicit-any`, `strict-boolean-expressions`, or `no-non-null-assertion` — those are large refactors out of scope."*

But `npm run lint` is already producing **484 `@typescript-eslint/no-explicit-any` errors**. The rule is enabled transitively via `tseslint.configs.recommended` in `eslint.config.js:15`. D-07's prohibition does not describe current state.

**Three interpretations of D-07 intent:**

1. **Literal:** "Don't add it." But it's already there. Action: leave as-is; fix the 484 errors. Violates D-07 intent (484 fixes is a large refactor).
2. **Spirit:** "Don't do a large refactor." Action: **disable the rule project-wide** (add `'@typescript-eslint/no-explicit-any': 'off'` in `eslint.config.js`). Simple; removes a guardrail the codebase has been accumulating debt against.
3. **Hybrid:** Downgrade to `warn` (matches D-11 target of "0 warnings or per-line disable with reason" — except 484 per-line disables is absurd). Poor fit for D-11.

**Recommended: Option 2 (disable project-wide) with explicit user confirmation (A1).** Rationale:
- D-07 says not to add it; user clearly signaled out-of-scope.
- D-11 demands `npm run lint` exits 0 with 0 errors — fixing 484 `any`s would blow the phase scope.
- A project-wide `'off'` is a single line in `eslint.config.js` with a comment linking to a new `DEFERRED-LINT.md` entry.
- The 484 existing `any`s remain visible to future phases via a targeted `grep`, not via lint noise.

**Alternative if user wants to retain the guardrail:** Option 1b — downgrade to `warn` AND accept that D-11's "0 warnings" target carries an explicit exception for `@typescript-eslint/no-explicit-any` documented in CONTEXT.md. This leaves the rule as a surface flag for future phases but unblocks Phase 23.

**See Open Question Q1** — this MUST be resolved in the plan-checker dialog if not resolved pre-planning.

## ESLint Rule Rollout Strategy

### D-09 execution order (strict)

1. **Autofix commit** (first; one commit): `npx eslint . --fix`. Eliminates all 611 `simple-import-sort/*` warnings. No manual edits. Commit message: `chore(23): autofix simple-import-sort warnings (629→0)`.
2. **Verify safety net:** `npm run test:ci && npm run build && npm run knip`.
3. **Add new rules** (commit 2): extend `eslint.config.js` with `prefer-const: error`, `no-var: error`, `eqeqeq: ['error', 'smart']`. Baseline check: these rules currently produce **0 violations** in the codebase [VERIFIED: `npm run lint 2>&1 | grep -E 'prefer-const|no-var\b'` → no matches]. Commit 2 is a **pure config change with zero code churn expected**. Commit message: `chore(23): enable prefer-const, no-var, eqeqeq per D-07`.
4. **Resolve `no-explicit-any` contradiction** (commit 3; pending user decision per A1): either disable project-wide or downgrade to warn. Single-line config change.
5. **Manual rule-by-rule cleanup** (commits 4–N): one commit per rule, batched intelligently:
   - Commit 4: `react-refresh/only-export-components` (74 errors). Most likely fix: add to the existing context-file override array or split files. **Inspection needed** — 74 is high for a rule with an override already carved out; may indicate files outside `src/context/**` that now legitimately export non-components.
   - Commit 5: `no-restricted-imports` (76 errors). This is the jsonwebtoken rule from F-23/T-20-13. 76 errors means either (a) many source files import jsonwebtoken directly (which would be a security regression), or (b) the ignore list in `eslint.config.js:53` needs expansion for new test files / script files. **Audit first** — DO NOT suppress without understanding why the rule fires.
   - Commit 6: `@typescript-eslint/no-unused-vars` (137 errors). The `_`-prefix ignore pattern is already in place; these are real unused vars. Delete or rename; trivial but time-consuming.
   - Commit 7: Misc (renders / declared / expected / react-hooks/rules-of-hooks / simple-import-sort/exports leftover) — batched as "cleanup" commit.
6. **Final gate:** `npm run lint` exits 0.

### Additive rules beyond D-07 (planner may propose)

Per Claude's Discretion in CONTEXT:

| Rule | Level | Rationale | Expected violations |
|------|-------|-----------|---------------------|
| `eqeqeq` | error, `'smart'` mode | Prevents `==`/`!=` bugs; `'smart'` permits `== null` idiom | 0 expected (manual spot-grep) |
| `no-console` | warn | Catch stray `console.log`s in production code. Test files exempt via override. | Likely 10–30 — would need manual review. **Recommend deferring** — scope creep. |
| `@typescript-eslint/consistent-type-imports` | warn | Enforces `import type` for type-only imports; helps TS tree-shake. Cheap autofix. | Unknown; potentially 50+. **Recommend deferring** — not in D-07 baseline. |
| `no-param-reassign` | error | Prevents accidental mutation of function args. | Unknown. **Defer** — likely has legitimate violations. |

**Recommendation:** Stick to D-07 baseline (`prefer-const`, `no-var`, `eqeqeq`) for Phase 23. Note the others in `DEFERRED-LINT.md` for a future phase.

### Rule configuration snippet (for `eslint.config.js`)

```javascript
// Add inside the main rules block (around line 26 of current config)
rules: {
  // ... existing rules ...
  'prefer-const': 'error',         // D-07 Phase 23
  'no-var': 'error',               // D-07 Phase 23
  'eqeqeq': ['error', 'smart'],    // D-07 Phase 23 (permits == null idiom)
  // If user selects Option 2 from §Critical Finding:
  // '@typescript-eslint/no-explicit-any': 'off', // Deferred to DEFERRED-LINT.md
},
```

## Scripts Normalization Approach

### Scripts inventory [VERIFIED: package.json]

| Script | Command | D-12 canonical? | External refs | Disposition |
|--------|---------|-----------------|---------------|-------------|
| `dev` | `vite` | ✓ | README, CLAUDE.md | Keep |
| `build` | `tsc -b && vite build` | ✓ | README, CLAUDE.md, CI | Keep |
| `lint` | `eslint .` | ✓ | README, CLAUDE.md, CI | Keep |
| `preview` | `vite preview` | ✓ | — | Keep |
| `start` | `node --import tsx server/index.ts` | ✓ | README, CLAUDE.md | Keep |
| `generate-bundles` | `node --import tsx scripts/generate-all-bundles.ts` | Not canonical (product feature) | Likely docs | **Audit** — if only referenced in `scripts/` internally, keep; confirm README mention. |
| `test` | `vitest run` | ✓ | CI | Keep |
| `test:check-skips` | `node scripts/check-skipped-tests.mjs` | Sub-script of `test:ci` | `test:ci` only | Keep (invoked by `test:ci` per D-12 "referenced" criterion) |
| `test:ci` | `npm run test:check-skips && npm test` | ✓ | CI, CLAUDE.md | Keep |
| `knip` | `knip` | ✓ | CLAUDE.md | Keep (Phase 22 added) |

**Proposed Wave 3 changes:**

1. **Add** `"lint:fix": "eslint . --fix"` per D-14.
2. **No renames.** All D-12 canonical names already in place.
3. **No deletions.** All scripts referenced (D-13 "keep if referenced"). `generate-bundles` is a product tool (Phase 12-era bundle generator); `test:check-skips` is a sub-step of `test:ci`.

### CI reference tracking

**Files that reference npm scripts (must be grep-verified in Wave 3 before any hypothetical rename):**

- `.github/workflows/*.yml` (if present) — likely references `test:ci`, `build`, `lint`
- `README.md` — usage section
- `CLAUDE.md` — §Commands section
- Pre-commit hooks (if any) — `.husky/`, `lefthook.yml`, etc.
- `scripts/*.ts`, `scripts/*.mjs` — internal script chains

**Wave 3 verification command:**

```bash
# Enumerate every npm-script reference across repo (excluding node_modules, dist)
grep -rn "npm run\|npm test\|npm start" \
  --include="*.md" --include="*.yml" --include="*.yaml" \
  --include="*.sh" --include="*.ts" --include="*.mjs" \
  --include="*.json" \
  . | grep -v node_modules | grep -v dist
```

Because Phase 23 **does not rename any script**, this check is a **verification gate** (no breakage expected) rather than a refactor tool. If the grep surfaces a reference to a script name not in `package.json#scripts`, that is a pre-existing drift bug to surface, not a Phase 23 regression.

### Scripts README decision (D-13 sub-question)

D-13 offers "add inline `// script retained:` note in a `scripts-README.md`" as an alternative to deletion. Recommendation: **skip `scripts-README.md`** — the CLAUDE.md §Commands section is already the canonical reference for Claude sessions, and README.md covers human readers. Adding a third doc is duplication, not clarity. Document `generate-bundles` purpose inline in `scripts/generate-all-bundles.ts` header comment if unclear.

## Atomic-Commit Playbook (Phase 22 pattern reference)

Phase 22 Plan 22-02 executed **11 atomic commits** for dead-code removal (see `.planning/phases/22-codebase-docs-consistency/22-02-SUMMARY.md`). Phase 23 inherits the same pattern:

### Pattern (from Phase 22-02)

1. **One commit per logical unit** (one package-group for deps; one autofix pass / one rule for lint; one config change for scripts).
2. **Safety net after every commit:** `npm run test:ci` exit 0 with 608/608; `npm run build` exit 0; **add `npm run knip` exit 0** (Phase 22 requirement preserved).
3. **Commit message format:** `<type>(23): <imperative summary> (<D-XX> or <metric>)`
   - Example: `chore(23): bump vite 8.0.4→8.0.10, vitest 4.1.4→4.1.5, typescript 6.0.2→6.0.3 (D-04)`
   - Example: `chore(23): autofix simple-import-sort warnings (629→0 per D-09)`
   - Example: `chore(23): enable prefer-const, no-var, eqeqeq per D-07`
4. **Deviation doc in SUMMARY.md** at wave close (per Phase 22-02 template — "Deviations" section).

### Expected commit count (Phase 23 projection)

| Wave | Plan | Commits | Notes |
|------|------|---------|-------|
| 1 (Deps) | 23-01 | **7–9** | 5 upgrade groups + 1 overrides + 1 DEFERRED-UPGRADES.md + 1 final audit-gate verify = 8 typical |
| 2 (Lint) | 23-02 | **5–7** | Autofix (1) + new rules (1) + no-explicit-any decision (1) + manual rule batches (2–4) + final lint-gate verify |
| 3 (Scripts) | 23-03 | **2–3** | lint:fix addition (1) + CI-ref verification (no diff expected) + SUMMARY.md write |
| **Total** | | **14–19** | In the same ballpark as Phase 22 (22-01+22-02+22-03 totaled 20+ commits) |

## Recommended Task Ordering (the canonical question)

**Deps → Lint → Scripts is correct.** Rationale:

1. **Deps first.** Any dep bump (e.g., vite, vitest, eslint-plugin-react-hooks) can add/change lint rules transitively. Running Wave 2 against stale deps risks fixing lint warnings that a vite bump would have changed anyway. By bumping first, Wave 2 operates on the final rule surface.
2. **Lint second.** The autofix pass + new rules land on code that is already on current deps. Commit stream is clean.
3. **Scripts last.** Adding `lint:fix` requires the lint config to already be final. Also, `lint:fix` is a convenience tool for *future* users — it doesn't gate Phase 23 itself. Landing it last keeps the Wave 1/2 commits uncluttered.

**Anti-ordering to avoid:**

- **Lint → Deps.** Risk: `eslint-plugin-react-hooks@7.1.1` may fire new rules on code Wave 2 didn't touch; Wave 1 would then produce "lint got worse" after Wave 2 declared it green.
- **Scripts → Deps.** Adding `lint:fix` before the lint config is final means the script references a config that changes under it; trivially harmless but noisy.

**Within Wave 1, sub-ordering:**

1. **`overrides` + `follow-redirects` fix first** (single-commit security patch; audit gate satisfied).
2. **Coupled groups next** (Tailwind pair; TS/Vitest/Vite trio).
3. **Standalone packages last** (eslint-plugin-react-hooks, globals, lucide-react, react-router-dom, better-sqlite3).
4. **`DEFERRED-UPGRADES.md` final commit in Wave 1** — captures the 5 deferred majors per D-05/D-06.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transitive dep version pinning | Custom patching of node_modules | `package.json#overrides` | npm 10.x native; deterministic; survives `npm ci` |
| Lint autofix | Custom ESLint programmatic API wrapper | `eslint . --fix` (or new `lint:fix` script) | Flat-config works directly; no orchestration needed |
| Per-file lint suppression | Global `eslintIgnore` | Per-line `// eslint-disable-next-line <rule> -- <reason>` | D-10 explicit; ignore-file hides without justification |
| Audit summarization | Manual README of advisories | `DEFERRED-UPGRADES.md` structured per D-06 | Matches Phase 22 pattern; easy retrospective read |
| Script doc | `scripts-README.md` | CLAUDE.md §Commands already canonical | Third doc = duplication (see §Scripts README decision) |

## Common Pitfalls

### Pitfall 1: `npm audit fix` silently bumps a direct dep past a major

**What goes wrong:** `npm audit fix` chooses the cheapest fix; if the advisory affects a direct dep's new-major-line more cleanly than a pinned override, it can emit a major bump.

**Why it happens:** `npm audit fix` is heuristic-driven; it is NOT aware of D-05's major-defer invariant.

**How to avoid:** **DO NOT run `npm audit fix` in this phase.** Instead, for the single advisory (`follow-redirects` transitive): add an `overrides` block, run `npm install`, re-run `npm audit --audit-level=moderate`, verify exit 0. Commit. If `npm audit fix` is ever run, diff `package.json` and reject commits that include a major-line bump.

**Warning signs:** After `npm install`, `package.json` shows a dep where the caret major changed (e.g., `^9.0.0` → `^10.0.0`). That's a major.

### Pitfall 2: Vite/rolldown dynamic-import resolution breaks after a patch bump

**What goes wrong:** A Vite patch bump changes internal rolldown chunk resolution; a dynamic `await import('./someModule')` that tests don't exercise breaks at build time. Phase 22 Pitfall 3 recurrence.

**Why it happens:** `vitest` runs tests in Node mode, not full production build mode. Build-time bundler resolution is a distinct path.

**How to avoid:** After **every** upgrade commit, run **`npm run build`**, not just `npm run test:ci`. D-16 codifies this; the planner MUST include `npm run build` as a per-commit gate in the plan file. Additionally, `npm run knip` must stay green (Phase 22 invariant).

**Warning signs:** `test:ci` passes; `npm run build` emits "Cannot find module" or "Unresolved dependency" errors.

### Pitfall 3: ESLint autofix reorders imports across a barrel-export boundary

**What goes wrong:** `simple-import-sort/imports` reorders imports inside a file; if the file has a side-effecting import (e.g., `import './globals.css';` or `import 'reflect-metadata';`), reordering can break the initialization order.

**Why it happens:** `simple-import-sort` by default groups side-effect imports separately, but custom groups may not preserve order.

**How to avoid:** Before the D-09 autofix commit, grep for side-effect imports: `grep -rn "^import '[^']\+';" src server shared`. For each match, verify the autofix output preserves relative order. Inspect the autofix commit diff before the safety-net run.

**Warning signs:** Test failures in CSS-themed components after autofix; runtime errors about un-initialized globals.

### Pitfall 4: `knip` regression from a Wave 1 upgrade

**What goes wrong:** A dep bump introduces a new transitive dep or new config file pattern that knip doesn't scan; knip now reports a false-positive "unused export" or misses a newly-unused dep.

**Why it happens:** Knip's entry-points list in `knip.json` is static; new file shapes emerge from minor bumps occasionally.

**How to avoid:** `npm run knip` after every Wave 1 commit (added to safety net). If knip regresses, do NOT delete reported exports; investigate first (Phase 22 already hit this with `tailwindcss` false-positive in `knip.json#ignoreDependencies`).

**Warning signs:** knip output grows after a Wave 1 commit. Investigate before any Wave 2 lint work.

### Pitfall 5: Peer-dep conflict after `eslint-plugin-react-hooks@7.1.1`

**What goes wrong:** Some eslint-plugin-* peer-dep on `eslint@9.x`; a 7.0.1→7.1.1 bump may widen/narrow that range and break install.

**Why it happens:** React-hooks plugin tracks `eslint` peer tightly; a minor release can shift the declared range.

**How to avoid:** After `npm install eslint-plugin-react-hooks@7.1.1`, check `npm ls eslint` and `npm install --dry-run` output for peer warnings. If peer-warnings surface about eslint 10.x, they are irrelevant (we're on 9.x per D-05); if they surface about anything else, investigate before committing.

**Warning signs:** `npm install` emits `ERESOLVE`; installation completes but `npm ls` shows "invalid" for a plugin.

### Pitfall 6: `no-restricted-imports` violations are security regressions, not lint cruft

**What goes wrong:** The 76 current `no-restricted-imports` errors get batch-suppressed with `eslint-disable-next-line` reasoned as "legacy code."

**Why it happens:** Volume (76) looks like a cleanup target; reality is **each one represents a direct jsonwebtoken import that bypasses F-23 / T-20-13**.

**How to avoid:** Before writing any disable comments for `no-restricted-imports`, run `grep -rn "from 'jsonwebtoken'" src server` and compare against the ignore list in `eslint.config.js:53`. Each violation must be either (a) rewritten to route through `server/jwtUtil.ts` / `server/keycloakJwt.ts`, or (b) added to the ignore list with an inline comment explaining why (e.g., "new test file; constructs fixture tokens"). **Never use a per-line disable for a `no-restricted-imports/jsonwebtoken` violation in production code.** This is a security-first invariant (from memory layer).

**Warning signs:** A commit message like "disable no-restricted-imports for legacy code."

### Pitfall 7: `react-refresh/only-export-components` override scope drift

**What goes wrong:** 74 violations; planner adds 10 new files to the existing context-file override array in `eslint.config.js:39`; the array grows unbounded; the rule's value (catching accidental non-component exports from component files) erodes.

**Why it happens:** Override is the path of least resistance.

**How to avoid:** For each of the 74 violations, classify: (a) file legitimately exports non-components (context, hooks, constants co-located with provider) → add to override list; (b) file should be split (extract hooks / constants to separate file) → do the split, keep the rule on. Default to split; only add to override when a Phase 20-style "context legitimately exports both" pattern applies.

**Warning signs:** Override array in `eslint.config.js` grows to 20+ entries.

## Code Examples

### `package.json#overrides` for transitive security patch

```json
{
  "name": "emd-app",
  "version": "1.4.0",
  "scripts": { ... },
  "dependencies": { ... },
  "devDependencies": { ... },
  "overrides": {
    "follow-redirects": "^1.16.0"
  }
}
```

After adding: `npm install && npm audit --audit-level=moderate` → expect exit 0 and `follow-redirects@1.16.0` in `npm ls follow-redirects`.

### ESLint rule additions (`eslint.config.js` diff)

```javascript
// In the main rules block (line ~26 of current config), after simple-import-sort rules:
rules: {
  'simple-import-sort/imports': 'warn',
  'simple-import-sort/exports': 'warn',
  '@typescript-eslint/no-unused-vars': ['error', {
    argsIgnorePattern: '^_',
    varsIgnorePattern: '^_',
    destructuredArrayIgnorePattern: '^_',
  }],
  // Phase 23 / D-07 additions:
  'prefer-const': 'error',
  'no-var': 'error',
  'eqeqeq': ['error', 'smart'],
},
```

### `DEFERRED-UPGRADES.md` template (per D-06)

```markdown
# Deferred Upgrades

Major-version dep upgrades deferred from Phase 23 per D-05.
Revisit triggers documented per package.

## eslint

- **Current:** 9.39.4
- **Latest:** 10.2.1
- **Blocker:** v10 drops Node 18 support and changes flat-config resolution semantics; peer-dep impact on typescript-eslint and eslint-plugin-react-hooks unverified.
- **Revisit trigger:** When `typescript-eslint@9.x` ships with stable `eslint@10.x` peer range, or next milestone's test/lint phase.

## @eslint/js

- **Current:** 9.39.4
- **Latest:** 10.0.1
- **Blocker:** Must track `eslint` major. See above.
- **Revisit trigger:** Same as `eslint`.

## jwks-rsa

- **Current:** 3.2.0
- **Latest:** 4.0.1
- **Blocker:** v4 changes JWKS fetch cache semantics; Phase 20 Keycloak prep work relies on current cache behavior (KEYCLK-01 path).
- **Revisit trigger:** KEYCLK-01 (Keycloak OIDC redirect) planning phase — must verify jwks-rsa v4 compatibility pre-migration.

## otplib

- **Current:** 12.0.1
- **Latest:** 13.4.0
- **Blocker:** v13 refactors the hotp/totp entry-points; Phase 15 TOTP 2FA code directly imports from `otplib/hotp` / `otplib/totp` paths that changed in v13.
- **Revisit trigger:** A future phase that re-examines TOTP flow (e.g., recovery-code UX revamp).

## @types/node

- **Current:** 24.12.2
- **Latest:** 25.6.0
- **Blocker:** v25 tracks Node 24 runtime; repo currently runs/tests on Node 20+ per engines. Bumping types ahead of runtime can surface false positives.
- **Revisit trigger:** When CI pipeline adopts Node 24 LTS.
```

### New `lint:fix` script

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "preview": "vite preview",
    "start": "node --import tsx server/index.ts",
    "generate-bundles": "node --import tsx scripts/generate-all-bundles.ts",
    "test": "vitest run",
    "test:check-skips": "node scripts/check-skipped-tests.mjs",
    "test:ci": "npm run test:check-skips && npm test",
    "knip": "knip"
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `npm audit fix --force` to patch transitives | `package.json#overrides` (npm 8.3+) | ~2022, stable in npm 10 | Deterministic; preserves direct-dep pinning; D-02 mandates |
| ESLint `.eslintrc.json` | Flat config (`eslint.config.js`) | ESLint 9 default (2024) | Already adopted; no migration work |
| Ecosystem plugin pinning by exact version | Caret-range + lockfile | Long-standing | Lockfile is the pinning source of truth; Phase 23 doesn't change this |
| Per-file `/* eslint-disable */` block | Per-line `// eslint-disable-next-line <rule> -- <reason>` | D-10 explicit | Narrower scope; audit trail via reason |

**Deprecated/outdated:**

- `ts-prune` — not used here (Phase 22 picked `knip`); stays deprecated in this repo.
- `npm audit fix --force` — banned by D-01.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@typescript-eslint/no-explicit-any` is already active via `tseslint.configs.recommended` and producing 484 errors; D-07's "do not add" prohibition cannot literally apply. **Recommended resolution: disable project-wide.** | §Critical Finding / §Lint Baseline Breakdown | If user wants the rule ON and all 484 fixed: Phase 23 scope triples. Planner MUST resolve before Wave 2 commit 1. |
| A2 | `npm audit fix` can resolve the `follow-redirects` advisory without a major bump; if not, `overrides` is the deterministic fix. **Recommended: skip `npm audit fix` entirely and go straight to `overrides`.** | §Audit Finding | If `overrides` fails (e.g., npm version < 8.3): fallback to manual `package-lock.json` edit (yuck) or upgrade npm. Repo npm version not verified; assumed 10.x via modern Node. |
| A3 | `typescript-eslint@8.58.0 → 8.59.0` is the current applicable bump; the 9.x major stays deferred per D-05. `npm view typescript-eslint version` returns 8.59.0 today. | §Standard Stack | If D-05's "8→9" implies user intended to defer the 8.59.0 minor too: reduce Wave 1 by one package. Low impact. |
| A4 | `generate-bundles` script is referenced (by README or product docs); "keep if referenced" applies per D-13. | §Scripts Inventory | If it's unreferenced: delete per D-13 default. Verification is a 30-second grep in Wave 3. |
| A5 | The 74 `react-refresh/only-export-components` errors are outside the current context-file override; Wave 2 will need to split files or expand the override. | §ESLint Rule Rollout Strategy | If the override already covers most: Wave 2 commit 4 shrinks. Scope-positive. |
| A6 | The 76 `no-restricted-imports` errors include NO production-code jsonwebtoken direct imports (i.e., they're all from newly-added test files / scripts not in the ignore list). | §Pitfall 6 | **If production code directly imports jsonwebtoken: SECURITY REGRESSION.** Must be rewritten, not suppressed. Planner MUST verify before any suppression commit. |
| A7 | `npm audit` baseline of "1 moderate" is stable (not shifted since CONTEXT.md gather on 2026-04-23); re-running during Phase 23 execution may surface new advisories. | §Audit Finding | New advisories landing mid-phase: planner adds additional `overrides` entries, one per advisory. |
| A8 | Project-wide disabling of `no-explicit-any` (option 2 in §Critical Finding) is acceptable given the user's D-07 prohibition. **NEEDS USER CONFIRMATION.** | §Critical Finding | If not acceptable: fall back to option 3 (per-line disables, not recommended) or expand Phase 23 to fix all 484. |

## Open Questions

1. **`@typescript-eslint/no-explicit-any` — disable, downgrade, or fix?** (RESOLUTION REQUIRED BEFORE PLANNING)
   - What we know: rule is already active via `tseslint.configs.recommended`; 484 errors currently; D-07 says "do not add" but fails to acknowledge it's already on.
   - What's unclear: user's intended behavior when an "aggressive rule" is already inherited.
   - Recommendation: **Option 2 — disable project-wide with an inline comment linking to `DEFERRED-LINT.md` entry.** Preserves D-07's spirit (don't do large refactor), eliminates the lint noise, documents the deferral.

2. **`eqeqeq` mode — `'always'` or `'smart'`?** (minor)
   - What we know: `'smart'` permits `== null` (null OR undefined check) and `typeof x == 'y'`.
   - What's unclear: whether the codebase has any intentional `== null` idioms.
   - Recommendation: `'smart'` — matches typical TypeScript codebase patterns; stricter than `'always'` in spirit because other cases are still errors.

3. **`react-refresh/only-export-components` — are the 74 violations new drift or pre-existing?**
   - What we know: the rule has an existing context-file override; 74 errors still fire.
   - What's unclear: whether these are mostly pages/components that legitimately export constants, or whether the override is stale.
   - Recommendation: Planner inspects first 10 violations to pick the pattern (split vs expand override), then applies uniformly.

4. **Should Phase 23 preempt a future Phase-22-style `DEFERRED-LINT.md`?**
   - Recommendation: **Yes, create `DEFERRED-LINT.md`** at repo root, mirroring `DEFERRED-UPGRADES.md`, capturing (a) `no-explicit-any` (if option 2 or 3), (b) `no-console`, `consistent-type-imports`, etc. from the "additive rules beyond D-07" table. One-time cost; precedent value for future phases.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | base | ✓ | v20+ (package.json engines not pinned explicitly; assumed per v1.8 precedent) | — |
| npm / npx | all waves | ✓ | bundled (assumed 10.x for `overrides` support) | — |
| eslint | lint tightening | ✓ | 9.39.4 [VERIFIED: package.json] | — |
| vitest | safety net | ✓ | 4.1.4 | — |
| knip | dead-code gate | ✓ | 6.6.2 [VERIFIED: devDependencies] | — |
| tsc | build safety net | ✓ | via typescript 6.0.2 | — |

**No missing dependencies.** All Phase 23 waves run with the current toolchain.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest@4.1.4 + @testing-library/react@16.3.2 + supertest@7.2.2 [VERIFIED: package.json] |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run <file>` or `npx vitest run -t "<pattern>"` |
| Full suite command | `npm run test:ci` (runs `test:check-skips` then `vitest run`) |
| Skip policy | `scripts/check-skipped-tests.mjs` — enforced on every CI run |
| Current baseline | **608/608 passing, zero skips** (Phase 22 exit state, per CONTEXT) |

### Phase Requirements → Validation Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| DEPS-01 | `npm audit` clean at moderate | shell gate | `npm audit --audit-level=moderate` | N/A (command) |
| DEPS-01 | Non-breaking upgrades applied | shell gate | `npm outdated` (expect only D-05 deferred majors remaining) | N/A |
| DEPS-01 | DEFERRED-UPGRADES.md captures deferrals | doc check | `test -f DEFERRED-UPGRADES.md && grep -c '^## ' DEFERRED-UPGRADES.md` (expect ≥5) | ❌ Wave 1 creates |
| DEPS-02 | `npm run lint` exits 0 | shell gate | `npm run lint` | N/A |
| DEPS-02 | New rules enabled | config check | `grep -E "prefer-const\|no-var\|eqeqeq" eslint.config.js` | ✅ Wave 2 edits |
| DEPS-02 | No bare eslint-disable | grep gate | `grep -rn "eslint-disable" src server shared \| grep -v " -- "` → exit 1 (no matches) | N/A |
| DEPS-03 | Scripts normalized | config check | `jq '.scripts \| keys' package.json` (verify canonical set + `lint:fix`) | ✅ Wave 3 edits |
| DEPS-03 | Each script runs | smoke test | `npm run lint:fix --dry-run 2>&1` etc. | N/A |
| Safety net | Test suite green | full run | `npm run test:ci` | ✅ existing |
| Safety net | Build green | full run | `npm run build` | ✅ existing |
| Safety net | knip clean | full run | `npm run knip` | ✅ existing |

### Sampling Rate

- **Per task commit:** `npm run test:ci && npm run build && npm run knip` (D-15, D-16, Phase 22 invariant)
- **Per wave merge:** Same trio + `npm run lint` (Wave 2+) + `npm audit --audit-level=moderate` (Wave 1+)
- **Phase gate:** All four gates (`test:ci`, `build`, `knip`, `lint`) exit 0; `npm audit --audit-level=moderate` exit 0; before `/gsd-verify-work`

### Wave 0 Gaps

- None. Phase 22 landed all the safety-net tooling (vitest config, check-skipped-tests script, knip config). Phase 23 adds no new test infrastructure.

Per CONTEXT D-15, this research **does not add** any `*.test.ts` files; Phase 23 is a non-behavior-changing phase and the existing 608/608 test suite is the behavior guard.

## Security Domain

Phase 23 touches security surface in two specific ways:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V14 Configuration | **yes** | Dep hygiene: `npm audit` clean at moderate; `overrides` for transitive patches; no weak deps |
| V6 Cryptography | indirect | `otplib` is a crypto dep; v12→v13 deferred per A5-style risk (D-05); jsonwebtoken pinned; `jwks-rsa` deferred |
| V2 Authentication | indirect | `no-restricted-imports` rule for jsonwebtoken (F-23, T-20-13) preserved per D-08 |

### Known Threat Patterns for `dep-upgrade / lint-tightening` stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Transitive dep supply-chain (unpatched CVE) | Tampering, Info Disclosure | `npm audit` + `overrides` (D-01, D-02) |
| Algorithm-confusion on jsonwebtoken direct import | Spoofing | `no-restricted-imports` rule preserved per D-08; violations in Wave 2 are NOT suppressed (Pitfall 6) |
| Malicious lockfile drift during `--force` | Tampering | D-01 bans `--force`; lockfile reviewed on every upgrade commit |
| Silent major-version bump leaking breaking change | Tampering (integrity of build) | D-05 defers all majors; D-16 `npm run build` per commit catches breakage |

**Security-first invariant (from memory layer):** Audit immutability, server-side enforcement, no client trust. Phase 23 does not touch audit, server enforcement, or client trust boundary — it is a pure hygiene phase. If Wave 2's `no-restricted-imports` cleanup requires any production-code edit that moves a `jsonwebtoken` import, that edit MUST route through `server/jwtUtil.ts` / `server/keycloakJwt.ts` (never a per-line disable — see Pitfall 6).

## Sources

### Primary (HIGH confidence)

- `package.json`, `package-lock.json`, `eslint.config.js`, `knip.json`, `CLAUDE.md` — working-tree snapshots [VERIFIED: Read tool].
- `npm view <pkg> version` for all 16 outdated packages and `follow-redirects` [VERIFIED: executed 2026-04-23].
- `npm ls follow-redirects` → confirms transitive chain `http-proxy-middleware@3.0.5 → http-proxy@1.18.1 → follow-redirects@1.15.11` [VERIFIED].
- `npm run lint 2>&1 | awk` rule breakdown (599+484+137+76+74+12+1+47 = 1430, slight delta vs 1448 due to multi-rule lines) [VERIFIED].
- `.planning/phases/22-codebase-docs-consistency/22-02-SUMMARY.md` — atomic-commit and knip playbook [VERIFIED: Read tool].
- `.planning/phases/22-codebase-docs-consistency/22-RESEARCH.md` — pattern reference for RESEARCH.md structure [VERIFIED].
- `.planning/phases/23-dependency-lint-cleanup/23-CONTEXT.md` — D-01..D-16 locked decisions [VERIFIED].
- `.planning/ROADMAP.md` §Phase 23 — goal and success criteria [VERIFIED].
- `.planning/REQUIREMENTS.md` — DEPS-01, DEPS-02, DEPS-03 text [VERIFIED].
- `.planning/STATE.md` — active position [VERIFIED].

### Secondary (MEDIUM confidence)

- `https://docs.npmjs.com/cli/v10/configuring-npm/package-json#overrides` — npm `overrides` spec [CITED, not fetched this session].
- GHSA-r4q5-vmmm-2653 — follow-redirects advisory (proxy-authorization header leak) [CITED via `npm audit` output summary].
- Knip docs — config schema, already cited in Phase 22 research [CITED].

### Tertiary (LOW confidence)

- None. All phase-critical claims either verified or flagged in the Assumptions Log.

## Metadata

**Confidence breakdown:**

- Standard Stack (version verification): HIGH — every package queried live against npm registry today.
- Audit finding (single moderate advisory via `follow-redirects` transitive): HIGH — `npm ls follow-redirects` shows exact chain.
- Lint baseline rule breakdown: HIGH — grep on `npm run lint` output; reproducible.
- Critical finding (`no-explicit-any` already-on contradiction with D-07): HIGH on the factual finding; A1 MEDIUM on the recommended resolution pending user confirmation.
- Script normalization: HIGH — all 10 scripts inventoried and classified; no renames required.
- Pitfalls: HIGH — all 7 are specific to this codebase's Phase 20–22 history, not generic.
- Recommended task ordering: HIGH — deps→lint→scripts is forced by the rule-inheritance-from-deps mechanism.

**Research date:** 2026-04-23
**Valid until:** 2026-05-07 (14 days — npm registry moves weekly; re-verify versions if plan execution slips past this window).
