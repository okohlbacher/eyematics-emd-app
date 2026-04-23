---
phase: 22-codebase-docs-consistency
plan: 02
type: execute
wave: 2
depends_on: ["22-01"]
files_modified:
  - package.json
  - package-lock.json
  - knip.json
  - .planning/phases/22-codebase-docs-consistency/22-02-SUMMARY.md
autonomous: true
requirements: [CONSIST-03, CONSIST-04]
must_haves:
  truths:
    - "`knip` is installed as a devDependency and configured with a `knip.json` entry-points file"
    - "`npx knip` produces a clean report OR every flagged export is either deleted or carries an inline `// retained: <concrete reason>` comment per D-06"
    - "`any` / `unknown` types are narrowed in every file touched by Plan 22-01 OR this plan (touched-file scope per D-07)"
    - "Duplicated type definitions across `src/`, `server/`, `shared/` are consolidated into `shared/types/` or the nearest shared module"
    - "`npm run test:ci` exits 0 with 608/608 passing tests after every atomic commit"
  artifacts:
    - path: "package.json"
      provides: "knip listed in devDependencies; `knip` script entry"
    - path: "knip.json"
      provides: "knip entry-points and project configuration"
    - path: ".planning/phases/22-codebase-docs-consistency/22-02-SUMMARY.md"
      provides: "Before/after counts; deleted-vs-retained list; type-narrowing diff summary"
  key_links:
    - from: "knip.json"
      to: "server/index.ts, src/main.tsx, scripts/*, tests/**/*.test.*"
      via: "entry points"
      pattern: "\"entry\":"
    - from: "package.json scripts"
      to: "knip"
      via: "npm run knip invokes `knip`"
      pattern: "\"knip\":"
---

<objective>
Plan 22-02 (Wave 2): Dead-code removal + type narrowing.

Scope:
1. Wave 0: Install `knip@^6.6.2` as devDependency (D-14) + create `knip.json` entry-points config
2. Run `npx knip`; delete unused exports aggressively per D-06 (retention requires inline `// retained:` with concrete reason)
3. Narrow `any` / `unknown` types in files touched by Plan 22-01 OR this plan (D-07 touched-file scope); consolidate duplicated type definitions into `shared/types/`

Depends on Plan 22-01 completing (post-dedup surface is the input to knip; narrowing applies to the consolidated module set).

Purpose: Reduce surface area and tighten types on the already-deduped codebase so Plan 22-03's docs reconcile against the final code shape.

Output: `knip` devDependency + config, one atomic delete commit per module, type-narrowing commits per touched file, SUMMARY with before/after counts.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/22-codebase-docs-consistency/22-CONTEXT.md
@.planning/phases/22-codebase-docs-consistency/22-RESEARCH.md
@.planning/phases/22-codebase-docs-consistency/22-01-SUMMARY.md

<interfaces>
knip.json baseline (from RESEARCH §Code Examples — knip configuration schema):

```json
{
  "$schema": "https://unpkg.com/knip@6/schema.json",
  "entry": [
    "server/index.ts",
    "src/main.tsx",
    "scripts/generate-all-bundles.ts",
    "scripts/check-skipped-tests.mjs",
    "tests/**/*.test.{ts,tsx}"
  ],
  "project": [
    "src/**/*.{ts,tsx}",
    "server/**/*.ts",
    "shared/**/*.ts"
  ],
  "ignoreExportsUsedInFile": true
}
```

Retention pattern (D-06):

```typescript
// retained: public export consumed by scripts/generate-all-bundles.ts via
// dynamic import at runtime; knip entry-point list covers the script but
// this helper is invoked reflectively — removing it breaks bundle generation.
export function buildCenterBundle(config: CenterConfig): FhirBundle { ... }
```

Type consolidation candidates from RESEARCH §any/unknown Inventory:
- `Cohort` / `CohortFilter` (likely both `src/` and `shared/`)
- FHIR resource types (`shared/types/` vs `src/types/fhir.ts`)
- `UserRole` (AuthContext vs server `types.d.ts`)

D-07 touched-file scope: 34 `any`/`unknown` occurrences total across src+server+shared. Narrow only in files touched by Plan 22-01 (the 7 shim files + 7 `.then`-rewrite files) AND any file this plan touches while deleting unused exports.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Wave 0 — Install knip and create knip.json config</name>
  <files>
    package.json,
    package-lock.json,
    knip.json
  </files>
  <read_first>
    package.json,
    .planning/phases/22-codebase-docs-consistency/22-RESEARCH.md
  </read_first>
  <action>
1. Run `npm install --save-dev knip@^6.6.2` (D-14).
2. Add to `package.json` `scripts`: `"knip": "knip"`.
3. Create `knip.json` at repo root with exactly the configuration shown in `<interfaces>`. Verify the listed entry-point files exist:
   - `server/index.ts`
   - `src/main.tsx`
   - `scripts/generate-all-bundles.ts`
   - `scripts/check-skipped-tests.mjs`
   - `tests/**/*.test.{ts,tsx}`
   If any entry-point path does not exist, adjust (e.g., if `scripts/generate-all-bundles.ts` is named differently, match the actual filename). Do NOT invent new entry points.
4. Run `npx knip --reporter compact` to produce the baseline report. Capture the output verbatim for the SUMMARY (Task 3).
5. Run `npm run test:ci` — must still be 608/608 (config-only change should not affect runtime).
6. Commit: `chore(22-02): install knip + entry-points config per D-14`.
  </action>
  <verify>
    <automated>npm run test:ci &amp;&amp; npx knip --reporter compact</automated>
  </verify>
  <acceptance_criteria>
    - `knip` appears in `package.json` `devDependencies`
    - `package.json` `scripts` contains `"knip": "knip"`
    - `knip.json` exists at repo root with `entry`, `project`, `ignoreExportsUsedInFile: true`
    - `npx knip` runs without a config error (a non-zero exit because of unused-export findings is expected and OK)
    - `npm run test:ci` exits 0 with 608/608 passing tests
  </acceptance_criteria>
  <done>
    knip installed, configured, and produces a baseline report. Test suite still green.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Delete unused exports per knip; narrow any/unknown in touched files</name>
  <files>
    (Determined by knip report + Plan 22-01 touched files — see action)
  </files>
  <read_first>
    .planning/phases/22-codebase-docs-consistency/22-01-SUMMARY.md,
    (every file flagged by `npx knip`),
    (every file listed in Plan 22-01 files_modified that contains `any`/`unknown`)
  </read_first>
  <action>
**Part A — knip deletions (D-06 aggressive delete):**

1. Run `npx knip --reporter json > /tmp/knip-report.json`.
2. Parse the report into per-module deletion lists. For each unused export:
   - Run `grep -rn "<exportName>" .` across the WHOLE repo (not just entry-point graph) per Pitfall 1. If any match exists outside the entry-point graph (e.g., in `docs/`, `scripts/`, dynamic imports), investigate:
     - If reachable via `await import(...)`, Vite alias, or similar: extend `knip.json` entry-points OR add `// retained: <concrete reason>` comment at export site.
     - If a generic-named `formatDate`/`parseThing`/`*Utils.ts` export: flag for manual review before deletion.
3. Delete unused exports one module at a time (one commit per module). After each deletion:
   - `npm run test:ci` → 608/608 required.
   - `npm run build` → exit 0 required (catches Vite dynamic resolution per Pitfall 3).
4. Commit message per module: `refactor(22-02): remove unused exports from <module> per D-06`.
5. For any export kept despite knip flagging: add `// retained: <concrete reason>` on the line above the export (vague reasons like "legacy" are forbidden per D-06 — delete those).

**Part B — any/unknown narrowing (D-07 touched-file scope):**

For the union of (a) files listed in Plan 22-01 `files_modified` and (b) files touched in Part A above:

1. In each file: `grep -nE ": any\b|: unknown\b" <file>`.
2. For each occurrence, narrow where the shape is inferable:
   - Function parameter with obvious usage → concrete type or generic.
   - Error-catch `catch (err: unknown)` → keep `unknown` + `err instanceof Error` narrowing (this is CORRECT TypeScript idiom; do NOT rewrite to `any`).
   - `Record<string, any>` where keys/values are clear → narrow to specific record type.
   - Truly heterogeneous (e.g., deserialized JSON before validation) → keep `unknown`; add inline `// intentional unknown: <reason>` comment.
3. Commit per file: `refactor(22-02): narrow any/unknown in <file> per D-07`.

**Part C — type dedup consolidation:**

For candidate type names (`Cohort`, `CohortFilter`, FHIR resource types, `UserRole`):

1. `grep -rnE "^(export )?type (Cohort|CohortFilter|UserRole)\s*=" src/ server/ shared/ --include="*.ts" --include="*.tsx"` to find duplicated definitions.
2. For each type with ≥2 definitions, consolidate into `shared/types/` (create the file if missing) and update importers.
3. If a type is only defined once, no action.
4. Run `npm run test:ci` after each consolidation; commit per type: `refactor(22-02): consolidate <Type> into shared/types per CONSIST-04`.
  </action>
  <verify>
    <automated>npm run test:ci &amp;&amp; npm run build &amp;&amp; npx knip --reporter compact</automated>
  </verify>
  <acceptance_criteria>
    - `npm run test:ci` exits 0 with 608/608 passing tests after EVERY commit in this task
    - `npm run build` exits 0 after every deletion commit (Pitfall 3 guard)
    - `npx knip --reporter compact` reports zero unused exports OR every remaining flag has an adjacent `// retained: <concrete reason>` comment (not "legacy")
    - Every file touched by Plan 22-01 or this task has no un-narrowed `: any` outside of intentional `catch (err: unknown)` or explicitly-commented `// intentional unknown:` cases
    - Type names `Cohort`, `CohortFilter`, `UserRole` each have exactly one exported definition across `src/`, `server/`, `shared/` (grep-verified)
  </acceptance_criteria>
  <done>
    knip reports clean (or all retentions justified); any/unknown narrowed in touched-file scope; duplicated types consolidated into shared/types/. Test suite and build pass after every commit.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Write 22-02 SUMMARY with before/after counts</name>
  <files>
    .planning/phases/22-codebase-docs-consistency/22-02-SUMMARY.md
  </files>
  <read_first>
    .planning/phases/22-codebase-docs-consistency/22-01-SUMMARY.md,
    $HOME/.claude/get-shit-done/templates/summary.md
  </read_first>
  <action>
Create `.planning/phases/22-codebase-docs-consistency/22-02-SUMMARY.md` using the standard summary template. It MUST include:

1. **knip baseline vs final:** The output of `npx knip --reporter compact` at the start (captured in Task 1) vs at plan completion. Include the exact counts: "Baseline: N unused files, M unused exports, K unused deps. Final: ..."
2. **Deletion table:** one row per module touched, columns `module | exports deleted | exports retained (with reason)`.
3. **any/unknown narrowing diff:** For each touched file, `before count | after count` (baseline is 34 total per RESEARCH).
4. **Type dedup:** For each consolidated type name, `old locations | new single location in shared/types/`.
5. **Safety-net evidence:** Final `npm run test:ci` output → exit 0, 608/608. Final `npm run build` → exit 0.
6. **knip.json path + install command** (so Plan 22-03 can reference these in docs).
  </action>
  <verify>
    <automated>test -f .planning/phases/22-codebase-docs-consistency/22-02-SUMMARY.md &amp;&amp; grep -q "knip baseline" .planning/phases/22-codebase-docs-consistency/22-02-SUMMARY.md &amp;&amp; grep -q "any/unknown" .planning/phases/22-codebase-docs-consistency/22-02-SUMMARY.md</automated>
  </verify>
  <acceptance_criteria>
    - SUMMARY file exists at `.planning/phases/22-codebase-docs-consistency/22-02-SUMMARY.md`
    - SUMMARY includes knip baseline and final counts
    - SUMMARY includes per-module deletion table
    - SUMMARY includes per-file any/unknown narrowing diff
    - SUMMARY cites final `npm run test:ci` → 608/608 and `npm run build` → exit 0
  </acceptance_criteria>
  <done>
    Plan 22-02 SUMMARY written and committed with all required sections.
  </done>
</task>

</tasks>

<verification>
Final verification for Plan 22-02:

```bash
npm run test:ci                  # exits 0, 608/608
npm run build                    # exits 0
npx knip --reporter compact      # zero findings OR all retentions have inline justification
grep -rnE ": any\b" src/ server/ shared/ --include="*.ts" --include="*.tsx"
# only untouched files and intentional cases remain

# Type dedup verification
grep -rnE "^(export )?type (Cohort|CohortFilter|UserRole)\s*=" src/ server/ shared/
# each name appears exactly once

test -f knip.json
test -f .planning/phases/22-codebase-docs-consistency/22-02-SUMMARY.md
```
</verification>

<success_criteria>
- `knip` installed (devDependency) and `knip.json` configured with verified entry points
- `npx knip` reports zero unused exports OR every retained item has a concrete inline `// retained:` comment
- `any`/`unknown` narrowed in all Plan 22-01 + Plan 22-02 touched files per D-07 scope
- Duplicated type definitions consolidated into `shared/types/`
- `npm run test:ci` exits 0 with 608/608 passing tests after every atomic commit
- `npm run build` exits 0 after every deletion
</success_criteria>

<output>
After completion, create `.planning/phases/22-codebase-docs-consistency/22-02-SUMMARY.md` (see Task 3 for required content).
</output>
