---
phase: 23-dependency-lint-cleanup
plan: 02
type: execute
wave: 2
depends_on: ["23-01"]
files_modified:
  - eslint.config.js
  - DEFERRED-LINT.md
  - .planning/phases/23-dependency-lint-cleanup/23-02-SUMMARY.md
autonomous: true
requirements: [DEPS-02]
must_haves:
  truths:
    - "`npm run lint` exits 0 with 0 errors and 0 warnings after this plan completes (D-11 target)"
    - "`eslint.config.js` enables `prefer-const: 'error'`, `no-var: 'error'`, `eqeqeq: ['error', 'smart']` per D-07 / D-18"
    - "`@typescript-eslint/no-explicit-any` is disabled project-wide (`'off'`) per D-17 and the deferral is documented in `DEFERRED-LINT.md`"
    - "Existing project-specific rules are preserved intact per D-08: `simple-import-sort/imports`, `simple-import-sort/exports`, `no-restricted-imports` for jsonwebtoken (F-23, T-20-13), `src/context/**` override for `react-refresh/only-export-components`"
    - "The autofix pass (`eslint . --fix`) is committed BEFORE any manual rule-by-rule fixes per D-09"
    - "Any remaining lint violation is either (a) fixed in source, (b) suppressed with `// eslint-disable-next-line <rule> -- <concrete reason>` (D-10), or (c) justified via a directory-scoped override in `eslint.config.js` with inline comment"
    - "Every `no-restricted-imports/jsonwebtoken` violation is audited per Pitfall 6 — production-code direct imports are REWRITTEN through `server/jwtUtil.ts` / `server/keycloakJwt.ts`, NEVER per-line-disabled"
    - "`npm run test:ci` exits 0 with 608/608 after every atomic commit (D-15)"
    - "`npm run build` exits 0 after every atomic commit (D-16)"
    - "`npm run knip` exits 0 after every atomic commit (Phase 22 invariant)"
  artifacts:
    - path: "eslint.config.js"
      provides: "Rule set extended with prefer-const, no-var, eqeqeq; no-explicit-any disabled; existing rules preserved"
      contains: "prefer-const"
    - path: "DEFERRED-LINT.md"
      provides: "Deferred-lint ledger: no-explicit-any project-wide disable + optional additive-rule deferrals (no-console, consistent-type-imports, no-param-reassign)"
      contains: "## @typescript-eslint/no-explicit-any"
    - path: ".planning/phases/23-dependency-lint-cleanup/23-02-SUMMARY.md"
      provides: "Before/after lint counts, per-commit rule-fix summary, Pitfall-6 jsonwebtoken audit trail, safety-net evidence"
  key_links:
    - from: "eslint.config.js"
      to: "server/jwtUtil.ts, server/keycloakJwt.ts"
      via: "no-restricted-imports ignore list (F-23 / T-20-13)"
      pattern: "server/jwtUtil\\.ts"
    - from: "eslint.config.js"
      to: "src/context/**"
      via: "react-refresh/only-export-components override"
      pattern: "src/context/\\*\\*"
    - from: "DEFERRED-LINT.md"
      to: "`@typescript-eslint/no-explicit-any` 484-error backlog"
      via: "project-wide 'off' with revisit trigger"
      pattern: "no-explicit-any"
---

<objective>
Plan 23-02 (Wave 2): ESLint tightening + violation cleanup.

Scope (RESEARCH §ESLint Rule Rollout Strategy — strict D-09 order):
1. **Autofix commit** first: `eslint . --fix` eliminates all 611 `simple-import-sort/*` warnings in one pass.
2. **Add new rules** (D-07): `prefer-const: 'error'`, `no-var: 'error'`, `eqeqeq: ['error', 'smart']` (D-18). Pure config change, baseline-verified 0 violations per RESEARCH.
3. **Resolve `no-explicit-any` contradiction (D-17)**: disable project-wide via `'@typescript-eslint/no-explicit-any': 'off'` and create `DEFERRED-LINT.md` with the revisit trigger.
4. **Manual rule-by-rule cleanup** (one commit per rule):
   - `react-refresh/only-export-components` (74 errors) — D-19 pattern inspection (split vs extend override)
   - `no-restricted-imports` (76 errors) — Pitfall 6 audit: production-code violations MUST be rewritten through centralized JWT modules, NEVER per-line-disabled
   - `@typescript-eslint/no-unused-vars` (137 errors) — manual delete/rename
   - Misc (`react-hooks/rules-of-hooks`, stray TypeScript diagnostics) — cleanup batch
5. **Final gate**: `npm run lint` exits 0.

Depends on Plan 23-01 (final dep surface — `eslint-plugin-react-hooks@7.1.1` and `typescript-eslint@8.59.0` may shift rule behavior; running Wave 2 on stale deps risks re-work per RESEARCH §Recommended Task Ordering).

Purpose: Tighten lint rule set per D-07 and drive the codebase to `npm run lint` exit 0 with 0 errors / 0 warnings, respecting D-10 precedence (fix → autofix → disable-with-reason) and D-08 preservation of existing guardrails.

Output: `eslint.config.js` with the D-07 rule block, `DEFERRED-LINT.md` ledger, clean `npm run lint` exit, SUMMARY with per-commit rule-fix deltas and the Pitfall-6 jsonwebtoken audit trail.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/23-dependency-lint-cleanup/23-CONTEXT.md
@.planning/phases/23-dependency-lint-cleanup/23-RESEARCH.md
@.planning/phases/23-dependency-lint-cleanup/23-01-SUMMARY.md
@eslint.config.js

<interfaces>
### Current `eslint.config.js` rule surface (per Read)

Main block (`**/*.{ts,tsx}`):
- Extends: `js.configs.recommended`, `tseslint.configs.recommended` (← this is where `no-explicit-any` lives per D-17), `reactHooks.configs.flat.recommended`, `reactRefresh.configs.vite`
- `simple-import-sort/imports`: 'warn'
- `simple-import-sort/exports`: 'warn'
- `@typescript-eslint/no-unused-vars`: strict with `^_` ignore patterns

Override block 1 (`src/context/**/*.{ts,tsx}`):
- `react-refresh/only-export-components`: 'off'
- `react-hooks/set-state-in-effect`: 'off'

Override block 2 (all files, ignores `server/jwtUtil.ts`, `server/keycloakJwt.ts`, `tests/**/*.test.ts`, `tests/**/*.test.tsx`):
- `no-restricted-imports`: error for `jsonwebtoken` (F-23 / T-20-13)

### Target rule additions (D-07 / D-17 / D-18 — single diff to main rules block)

```javascript
rules: {
  // existing rules ...
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
  'eqeqeq': ['error', 'smart'],    // D-18: 'smart' permits `== null` idiom
  // Phase 23 / D-17 — `no-explicit-any` is inherited from tseslint.configs.recommended;
  // 484 existing violations; disabling project-wide per D-07 spirit. See DEFERRED-LINT.md.
  '@typescript-eslint/no-explicit-any': 'off',
},
```

### Baseline lint breakdown (RESEARCH §Lint Baseline — verified 2026-04-23)

| Rule | Count | Severity | Autofix? | Disposition |
|------|-------|----------|----------|-------------|
| `simple-import-sort/imports` | 599 | warning | YES | Autofix commit eliminates |
| `@typescript-eslint/no-explicit-any` | 484 | error | No | D-17 disable project-wide |
| `@typescript-eslint/no-unused-vars` | 137 | error | No | Manual delete/rename |
| `no-restricted-imports` | 76 | error | No | Pitfall 6 — audit + rewrite / adjust ignores |
| `react-refresh/only-export-components` | 74 | error | No | D-19 split-or-expand-override |
| `simple-import-sort/exports` | 12 | warning | YES | Autofix commit eliminates |
| `react-hooks/rules-of-hooks` | 1 | error | No | Manual fix |
| Misc (renders / declared / expected) | 47 | varies | Mostly manual | Cleanup batch |

**Expected post-autofix baseline:** ~0 warnings (611 autofixed) + ~819 errors. After D-17 disable: ~335 errors (=819-484). Manual cleanup clears the remaining ~335.

### DEFERRED-LINT.md template (D-20 — sibling to DEFERRED-UPGRADES.md)

```markdown
# Deferred Lint Rules

Lint rules whose full remediation was deferred from Phase 23 per D-17.
Revisit triggers documented per rule.

## @typescript-eslint/no-explicit-any

- **Current violations count (disable moment):** 484
- **Rule:** `@typescript-eslint/no-explicit-any` (inherited from `tseslint.configs.recommended`)
- **Why deferred:** D-07 prohibits adding aggressive rules; rule is transitively active; fixing 484 occurrences is a separate large refactor phase (scope explosion vs D-07 spirit). Per D-17 decision: disable project-wide, document here.
- **Revisit trigger:** A future "typescript-strict" phase that also picks up `noImplicitAny` / `strictNullChecks`, OR when a milestone dedicates capacity to `any` → concrete-type narrowing (estimate: ~1 full phase on its own).
- **How to find:** `grep -rnE ': any\b' src/ server/ shared/ --include="*.ts" --include="*.tsx" | wc -l`

## (Additional entries optional — no-console, consistent-type-imports, no-param-reassign)

Per RESEARCH §Additive rules: these were NOT enabled in Phase 23. If planner judges them worth recording for future phases, add H2 sections with a "Not-enabled-because" row instead of a "Current violations count" row.
```

### Pitfall guards (RESEARCH §Common Pitfalls — executor MUST read before each commit)

- **Pitfall 3 (side-effect imports):** Before the autofix commit, grep for side-effect imports: `grep -rn "^import '[^']\+';" src server shared`. For each match, verify the autofix output preserves relative order (inspect diff before running safety-net).
- **Pitfall 6 (no-restricted-imports):** 76 violations MAY indicate a direct `jsonwebtoken` import in production code — a SECURITY REGRESSION. For EACH violation: (a) if production code — rewrite to route through `server/jwtUtil.ts` / `server/keycloakJwt.ts`; (b) if new test/script file — add its path to the ignore list in `eslint.config.js:53` with an inline comment. NEVER use a per-line disable for a production-code jsonwebtoken violation. A commit message like "disable no-restricted-imports for legacy code" is REJECTED.
- **Pitfall 7 (react-refresh override drift):** Do NOT reflexively expand the `src/context/**` override array. Default is SPLIT (extract hooks/constants to sibling file); only expand the override when the pattern truly matches the Phase 20 context-file idiom (hooks + providers co-located). Rubric in D-19: inspect the first 10 violations, classify dominant pattern, apply uniformly.
- **D-10 precedence:** `eslint --fix` → manual code fix → `// eslint-disable-next-line <rule> -- <concrete reason>`. Bare disable ("legacy") REJECTED.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Autofix pass + enable new rules + resolve no-explicit-any contradiction</name>
  <files>
    eslint.config.js,
    DEFERRED-LINT.md,
    (any file touched by `eslint . --fix` — determined at execution)
  </files>
  <read_first>
    eslint.config.js,
    .planning/phases/23-dependency-lint-cleanup/23-RESEARCH.md,
    .planning/phases/23-dependency-lint-cleanup/23-CONTEXT.md
  </read_first>
  <action>
**Pre-flight:**
1. Confirm Plan 23-01 is merged: `grep -q '"follow-redirects"' package.json` (overrides present) and `test -f DEFERRED-UPGRADES.md`. If either fails, STOP — Wave 2 requires Wave 1 post-state.
2. Baseline capture: `npm run lint 2>&1 | tail -5` — expect "1448 problems (819 errors, 629 warnings)" (RESEARCH §Lint Baseline). Record verbatim for SUMMARY.
3. Safety net pre-flight: `npm run test:ci` (608/608), `npm run build`, `npm run knip`. All must exit 0.

**Commit 1a — Side-effect import audit + autofix pass (D-09):**
1. Pitfall 3 guard: `grep -rn "^import '[^']\+';" src server shared 2>/dev/null` — capture matches. For each, note the file and relative order. (Expected matches: small number of CSS imports, possibly `reflect-metadata`.)
2. Run `npx eslint . --fix` — this applies ALL autofixable rules (all `simple-import-sort/*` — expected ~611 fixes).
3. Inspect `git diff` for the side-effect imports captured in step 1 — verify relative order is preserved. If `simple-import-sort` reordered a side-effect import across a boundary (e.g., `import './globals.css'` moved after a value import), manually restore correct order.
4. Safety net: `npm run test:ci` (608/608) + `npm run build` (exit 0) + `npm run knip` (exit 0) + `npm audit --audit-level=moderate` (exit 0).
5. Confirm warning baseline: `npm run lint 2>&1 | tail -5` — expect ~819 errors, 0 warnings (or ~18 delta per RESEARCH note).
6. Commit: `chore(23): autofix simple-import-sort warnings (629→0 per D-09)`.

**Commit 1b — Enable D-07 rules (`prefer-const`, `no-var`, `eqeqeq`):**
1. Edit `eslint.config.js` main rules block: add the three rules shown in `<interfaces>` (preserving existing rules intact per D-08).
2. Run `npm run lint 2>&1 | grep -E "prefer-const|no-var|eqeqeq"` — expect 0 matches (RESEARCH verified these rules produce 0 violations in the codebase).
3. If any violation surfaces: fix it manually in the same commit (trivial — `var` → `let`/`const`; `==` → `===` or permit via `'smart'` mode `== null` idiom per D-18).
4. Safety net (all four gates).
5. Commit: `chore(23): enable prefer-const, no-var, eqeqeq per D-07 D-18`.

**Commit 1c — Disable `no-explicit-any` project-wide (D-17):**
1. Edit `eslint.config.js` main rules block: add `'@typescript-eslint/no-explicit-any': 'off'` with an inline comment pointing to `DEFERRED-LINT.md`.
2. Create `DEFERRED-LINT.md` at repo root using the template in `<interfaces>`. Record the 484 current violations count (captured from pre-flight baseline) and the revisit trigger.
3. Run `npm run lint 2>&1 | tail -5` — expect ~335 errors (819 - 484 = 335), 0 warnings.
4. Safety net (all four gates).
5. Commit: `chore(23): disable @typescript-eslint/no-explicit-any project-wide + DEFERRED-LINT.md (D-17)`.

**Execution guard:** D-08 preservation — do NOT remove or weaken any existing rule (`simple-import-sort`, `@typescript-eslint/no-unused-vars`, the `src/context/**` override, the `no-restricted-imports` jsonwebtoken rule). Any edit to those rule blocks REJECTS the commit.
  </action>
  <verify>
    <automated>npm run test:ci &amp;&amp; npm run build &amp;&amp; npm run knip &amp;&amp; npm audit --audit-level=moderate &amp;&amp; grep -q "prefer-const" eslint.config.js &amp;&amp; grep -q "no-var" eslint.config.js &amp;&amp; grep -q "eqeqeq" eslint.config.js &amp;&amp; grep -q "no-explicit-any.*off" eslint.config.js &amp;&amp; test -f DEFERRED-LINT.md &amp;&amp; grep -q "no-explicit-any" DEFERRED-LINT.md &amp;&amp; grep -q "server/jwtUtil" eslint.config.js &amp;&amp; grep -q "src/context" eslint.config.js</automated>
  </verify>
  <acceptance_criteria>
    - Autofix commit eliminates all `simple-import-sort/*` warnings; `npm run lint 2>&1 | grep -E 'simple-import-sort' | wc -l` returns 0
    - `eslint.config.js` main rules block contains `'prefer-const': 'error'`, `'no-var': 'error'`, `'eqeqeq': ['error', 'smart']`, `'@typescript-eslint/no-explicit-any': 'off'`
    - `eslint.config.js` PRESERVES the `src/context/**` override block, the `no-restricted-imports` jsonwebtoken block, and the `@typescript-eslint/no-unused-vars` strict config (D-08)
    - `DEFERRED-LINT.md` exists at repo root with `## @typescript-eslint/no-explicit-any` H2 section (violations count, rule, why-deferred, revisit-trigger)
    - Side-effect import relative order preserved (Pitfall 3)
    - Safety net (test:ci / build / knip / audit) green after EACH of the 3 commits
    - Three commits created (1a autofix, 1b new rules, 1c no-explicit-any disable)
  </acceptance_criteria>
  <done>
    Autofix noise cleared; D-07 rules enabled with 0 new violations; no-explicit-any contradiction resolved via D-17 disable-and-document. Post-state: `npm run lint` reports ~335 errors to address in Task 2.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Manual rule-by-rule cleanup — react-refresh, no-restricted-imports, no-unused-vars, misc</name>
  <files>
    eslint.config.js,
    (source files flagged by each rule — determined at execution per `npm run lint` output)
  </files>
  <read_first>
    eslint.config.js,
    .planning/phases/23-dependency-lint-cleanup/23-RESEARCH.md,
    (each flagged file — read before editing)
  </read_first>
  <action>
**One commit per rule batch. D-10 precedence: fix → manual → disable-with-reason. Pitfall 6 applies to `no-restricted-imports`.**

**Commit 2a — `react-refresh/only-export-components` (74 errors, D-19):**
1. Enumerate all 74 violations: `npm run lint 2>&1 | grep "react-refresh/only-export-components"`. Capture file list.
2. Inspect the FIRST 10 files (D-19 sampling rule):
   - Read each file's exports.
   - Classify: (A) file legitimately exports a provider + hook (context-file idiom matching `src/context/**`) → candidate for override extension; (B) file exports a component AND a loose non-component (constants, utility fn) → candidate for file SPLIT (extract non-component to sibling file).
3. Determine dominant pattern (A vs B) from the sample of 10.
4. **If dominant is A (context-idiom):** extend the existing `src/context/**` override to matching directories ONLY if the directory name signals context (e.g., `src/providers/**`, `src/hooks/**` if they co-locate providers). Do NOT add arbitrary single-file entries to the array (Pitfall 7 — keep the array ≤20 entries).
5. **If dominant is B (mixed exports):** for each violation, extract the non-component export to a sibling file (e.g., `FooBar.tsx` has a `FOO_BAR_CONSTANTS` export → move to `FooBar.constants.ts`). Update importers.
6. Apply uniformly across all 74 violations per chosen pattern.
7. Safety net (all four gates) + `npm run lint 2>&1 | grep "react-refresh/only-export-components" | wc -l` → 0.
8. Commit: `refactor(23): resolve react-refresh/only-export-components (74→0) via <split|override-extend> per D-19`.

**Commit 2b — `no-restricted-imports` (76 errors — SECURITY CRITICAL, Pitfall 6):**
1. Enumerate ALL 76 violations: `npm run lint 2>&1 | grep "no-restricted-imports"`. Capture file list + line numbers.
2. For EACH violation, classify:
   - **Class A — production code (non-test, non-script):** This is a SECURITY REGRESSION. Rewrite: replace `import jwt from 'jsonwebtoken'` (or named import) with the appropriate helper from `server/jwtUtil.ts` (HS256) or `server/keycloakJwt.ts` (RS256). If no existing helper covers the call-site's needs, add the helper in `server/jwtUtil.ts` first (minimal extension, preserving HS256 hard pin from Phase 14).
   - **Class B — new test file under `tests/`:** Should already match `tests/**/*.test.ts{,x}` ignore pattern. If not (e.g., a `tests/helpers/foo.ts` helper without `.test.`), extend the ignore list in `eslint.config.js:53` to include the specific helper path, with an inline comment explaining the fixture-construction use-case.
   - **Class C — new script file under `scripts/`:** Add to the ignore list with an inline comment, e.g., `'scripts/someNewScript.ts'` and `// fixture tokens for offline testing`.
3. **NEVER use `// eslint-disable-next-line no-restricted-imports` for Class A.** If 76 violations cannot be resolved via A/B/C classification: STOP and report — suggests a systemic regression that needs user review.
4. For each classification group, commit atomically (e.g., one commit for all Class A rewrites if coherent; one for Class B ignore-list extensions; one for Class C).
5. Safety net after each sub-commit (all four gates) + `npm run lint 2>&1 | grep "no-restricted-imports" | wc -l` → 0.
6. Commit message format: `refactor(23): route jsonwebtoken imports through server/jwtUtil.ts (F-23 T-20-13 Pitfall 6)` for Class A; `chore(23): extend no-restricted-imports ignore list for <path> (D-08)` for Class B/C.

**Commit 2c — `@typescript-eslint/no-unused-vars` (137 errors):**
1. Enumerate violations: `npm run lint 2>&1 | grep "no-unused-vars"`. Capture file list.
2. For each violation:
   - Unused import → delete.
   - Unused destructured field → rename with `_` prefix (already in ignore pattern per existing config) OR delete.
   - Unused function parameter in public API → rename with `_` prefix to preserve signature.
   - Unused `catch (err)` binding → rename to `_err` or drop the binding.
3. Safety net after each logical file-group (or a single commit if the total diff is small) + `npm run lint 2>&1 | grep "no-unused-vars" | wc -l` → 0.
4. Commit: `refactor(23): delete unused vars / prefix _ (137→0 per D-07)`.

**Commit 2d — Misc cleanup (`react-hooks/rules-of-hooks` + stray diagnostics):**
1. Enumerate: `npm run lint 2>&1 | grep -vE "(react-refresh|no-restricted-imports|no-unused-vars|simple-import-sort|no-explicit-any)"`. Capture remaining violations.
2. Fix each manually. `react-hooks/rules-of-hooks` is never suppressed — rewrite the hook call order if violated.
3. For any genuine edge-case that CANNOT be fixed (e.g., a compile-driven false positive): use `// eslint-disable-next-line <rule> -- <concrete reason>` per D-10 (bare disable REJECTED).
4. Safety net (all four gates) + `npm run lint` → exit 0 (final lint gate).
5. Commit: `refactor(23): clear misc lint errors (react-hooks/rules-of-hooks + diagnostics, 48→0)`.

**Final verification (inside this task, before marking done):**
- `npm run lint` exits 0 (0 errors, 0 warnings).
- `grep -rn "eslint-disable" src server shared --include="*.ts" --include="*.tsx" | grep -v " -- "` → no matches (every disable has a concrete reason per D-10).
- `grep -c "'" eslint.config.js` to confirm `src/context/**` and `server/jwtUtil.ts` / `server/keycloakJwt.ts` references are intact (D-08).
  </action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run test:ci &amp;&amp; npm run build &amp;&amp; npm run knip &amp;&amp; npm audit --audit-level=moderate &amp;&amp; [ -z "$(grep -rn 'eslint-disable' src server shared --include='*.ts' --include='*.tsx' 2>/dev/null | grep -v ' -- ')" ]</automated>
  </verify>
  <acceptance_criteria>
    - `npm run lint` exits 0 (0 errors, 0 warnings) — D-11 target met
    - `react-refresh/only-export-components` violations = 0 (resolved per D-19 split-or-extend-override)
    - `no-restricted-imports` violations = 0; every Class A violation was REWRITTEN through `server/jwtUtil.ts` / `server/keycloakJwt.ts`, never per-line-disabled (Pitfall 6)
    - `@typescript-eslint/no-unused-vars` violations = 0
    - No bare `eslint-disable` comments remain in `src/`, `server/`, `shared/` — every disable carries `-- <reason>` (D-10)
    - Safety net (test:ci / build / knip / audit) green after EVERY commit
    - `eslint.config.js` `src/context/**` override block and `no-restricted-imports` block preserved (D-08)
  </acceptance_criteria>
  <done>
    `npm run lint` exits 0. All 76 jsonwebtoken violations audited and resolved without suppressing security guardrail. 74 react-refresh violations resolved per D-19 rubric. 137 unused-vars cleared. No bare disables remain.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Write 23-02 SUMMARY with before/after counts + Pitfall-6 audit trail</name>
  <files>
    .planning/phases/23-dependency-lint-cleanup/23-02-SUMMARY.md
  </files>
  <read_first>
    .planning/phases/23-dependency-lint-cleanup/23-01-SUMMARY.md,
    $HOME/.claude/get-shit-done/templates/summary.md,
    eslint.config.js,
    DEFERRED-LINT.md
  </read_first>
  <action>
Create `.planning/phases/23-dependency-lint-cleanup/23-02-SUMMARY.md` using the standard summary template. It MUST include:

1. **Lint baseline vs final:** Pre-Task-1 `npm run lint 2>&1 | tail -5` (expect 1448 problems, 819 errors, 629 warnings) vs post-Task-2 `npm run lint` (exit 0, 0 errors, 0 warnings). Include the rule-by-rule count table.
2. **Per-rule fix ledger:** one row per rule with columns `rule | baseline count | disposition (autofix / config-disable / manual-fix / split / rewrite) | final count | commit-sha`.
3. **Pitfall-6 audit trail (mandatory):** for each of the 76 `no-restricted-imports` violations, classify A/B/C as per Task 2b. Tabulate `file:line | class | action taken | new import path (if A)`. This is a security-first artifact — must be reviewable for F-23 / T-20-13 compliance.
4. **D-19 classification result:** which pattern (A override-extend or B file-split) dominated the react-refresh sample of 10, and the final disposition applied uniformly.
5. **`eslint.config.js` diff summary:** added rules (prefer-const, no-var, eqeqeq, no-explicit-any: off), preserved rules (list — Pitfall-check for D-08 compliance), extended ignore lists if any.
6. **`DEFERRED-LINT.md` snapshot:** list H2 sections recorded.
7. **Safety-net evidence:** final `npm run test:ci` → 608/608, `npm run build` → exit 0, `npm run knip` → exit 0, `npm audit --audit-level=moderate` → exit 0, `npm run lint` → exit 0.
8. **Deviations:** any D-19 / Pitfall-6 anomaly, any rule that required a per-line disable (with the concrete reason text).

Commit: `docs(23): write Plan 23-02 SUMMARY (lint wave complete)`.
  </action>
  <verify>
    <automated>test -f .planning/phases/23-dependency-lint-cleanup/23-02-SUMMARY.md &amp;&amp; grep -q "npm run lint" .planning/phases/23-dependency-lint-cleanup/23-02-SUMMARY.md &amp;&amp; grep -q "Pitfall 6" .planning/phases/23-dependency-lint-cleanup/23-02-SUMMARY.md &amp;&amp; grep -q "no-restricted-imports" .planning/phases/23-dependency-lint-cleanup/23-02-SUMMARY.md &amp;&amp; grep -q "608/608" .planning/phases/23-dependency-lint-cleanup/23-02-SUMMARY.md &amp;&amp; grep -q "D-17\|no-explicit-any" .planning/phases/23-dependency-lint-cleanup/23-02-SUMMARY.md</automated>
  </verify>
  <acceptance_criteria>
    - SUMMARY file exists at `.planning/phases/23-dependency-lint-cleanup/23-02-SUMMARY.md`
    - SUMMARY includes lint baseline (1448/819/629) and final (0/0/0) counts
    - SUMMARY includes per-rule fix ledger with commit SHAs
    - SUMMARY includes Pitfall-6 audit trail classifying all 76 `no-restricted-imports` violations A/B/C with action taken
    - SUMMARY includes D-19 classification result (dominant pattern + uniform disposition)
    - SUMMARY cites final `npm run test:ci` → 608/608, `npm run build` → exit 0, `npm run knip` → exit 0, `npm run lint` → exit 0
    - SUMMARY documents the D-17 resolution (no-explicit-any disabled + DEFERRED-LINT.md entry)
  </acceptance_criteria>
  <done>
    Plan 23-02 SUMMARY written and committed with all required sections. Wave 2 post-state (clean lint) is input to Plan 23-03.
  </done>
</task>

</tasks>

<verification>
Final verification for Plan 23-02:

```bash
npm run lint                       # exit 0 (0 errors, 0 warnings)
npm run test:ci                    # exit 0, 608/608
npm run build                      # exit 0
npm run knip                       # exit 0
npm audit --audit-level=moderate   # exit 0
grep -q "prefer-const" eslint.config.js
grep -q "'no-var'" eslint.config.js
grep -q "eqeqeq" eslint.config.js
grep -q "no-explicit-any.*off" eslint.config.js
test -f DEFERRED-LINT.md
test -f .planning/phases/23-dependency-lint-cleanup/23-02-SUMMARY.md

# D-08 preservation
grep -q "src/context" eslint.config.js
grep -q "server/jwtUtil" eslint.config.js
grep -q "simple-import-sort" eslint.config.js
grep -q "argsIgnorePattern" eslint.config.js

# D-10 bare-disable check
grep -rn "eslint-disable" src server shared --include="*.ts" --include="*.tsx" | grep -v " -- "
# expect no output (exit 1 from grep)
```
</verification>

<success_criteria>
- `npm run lint` exits 0 with 0 errors, 0 warnings (D-11 / DEPS-02 gate)
- `eslint.config.js` enables `prefer-const`, `no-var`, `eqeqeq: 'smart'` (D-07 / D-18)
- `@typescript-eslint/no-explicit-any` disabled project-wide per D-17; `DEFERRED-LINT.md` documents the deferral (D-20)
- D-08 preservation verified: `src/context/**` override, `no-restricted-imports` jsonwebtoken rule, `@typescript-eslint/no-unused-vars` strict config all intact
- D-09 order respected: autofix commit BEFORE manual fix commits
- D-10 precedence respected: no bare `eslint-disable` in `src/`, `server/`, `shared/`
- Pitfall 6 respected: every `no-restricted-imports` production-code violation REWRITTEN through centralized JWT modules, never per-line-disabled
- Safety net green after every commit: `npm run test:ci` (608/608), `npm run build`, `npm run knip`, `npm audit --audit-level=moderate`
- `23-02-SUMMARY.md` written with lint baseline/final, per-rule ledger, Pitfall-6 audit trail, D-19 classification, safety-net evidence
</success_criteria>

<output>
After completion, `.planning/phases/23-dependency-lint-cleanup/23-02-SUMMARY.md` exists. Plan 23-03 reads this SUMMARY to confirm the scripts-normalization wave runs against a clean lint surface (so the new `lint:fix` script references a final config).
</output>
