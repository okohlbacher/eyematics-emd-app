---
phase: 23-dependency-lint-cleanup
plan: 03
type: execute
wave: 3
depends_on: ["23-02"]
files_modified:
  - package.json
  - package-lock.json
  - .planning/phases/23-dependency-lint-cleanup/23-03-SUMMARY.md
autonomous: true
requirements: [DEPS-03]
must_haves:
  truths:
    - "`package.json#scripts` contains the D-12 canonical set (`dev`, `build`, `test`, `test:ci`, `lint`, `preview`, `start`, `knip`) plus `test:check-skips` (sub-script of `test:ci`) and `generate-bundles` (product tool — retained per D-13 default)"
    - "`package.json#scripts` contains a new `lint:fix` entry: `\"lint:fix\": \"eslint . --fix\"` (D-14)"
    - "No script is renamed or deleted in this plan (RESEARCH §Scripts Inventory — all 10 existing scripts are referenced per D-13)"
    - "Every script in `package.json#scripts` has been verified to run successfully in the current checkout — no dead commands"
    - "Every external reference to an npm script (GitHub Actions, README.md, CLAUDE.md, internal scripts) matches a live key in `package.json#scripts` (no drift)"
    - "`npm run test:ci` exits 0 with 608/608 (D-15), `npm run build` exits 0 (D-16), `npm run knip` exits 0 (Phase 22 invariant), `npm run lint` exits 0 (carried from Plan 23-02), `npm audit --audit-level=moderate` exits 0 (carried from Plan 23-01)"
  artifacts:
    - path: "package.json"
      provides: "scripts block with canonical set + new `lint:fix` entry; no renames, no deletions"
      contains: "\"lint:fix\""
    - path: ".planning/phases/23-dependency-lint-cleanup/23-03-SUMMARY.md"
      provides: "Scripts inventory before/after, CI-reference verification output, smoke-test log for each script, phase-close safety-net evidence"
  key_links:
    - from: "package.json#scripts.lint:fix"
      to: "eslint . --fix"
      via: "npm run lint:fix"
      pattern: "\"lint:fix\":\\s*\"eslint\\s+\\."
    - from: "package.json#scripts"
      to: "README.md, CLAUDE.md, .github/workflows/**"
      via: "external npm-script references (no rename, so no edits required — verification-only)"
      pattern: "npm (run|test|start)"
---

<objective>
Plan 23-03 (Wave 3): `package.json` scripts normalization + `lint:fix` convenience + CI-reference verification.

Scope per RESEARCH §Scripts Normalization Approach:
1. **Add** `"lint:fix": "eslint . --fix"` to `package.json#scripts` (D-14).
2. **No renames, no deletions.** All 10 existing scripts are referenced (per D-13 "keep if referenced"). `test:check-skips` is a sub-script of `test:ci`; `generate-bundles` is a product tool (Phase 12-era bundle generator).
3. **Verify** that every script in `package.json#scripts` runs (smoke-test each).
4. **Verify** that every external npm-script reference across the repo matches a live script key (drift audit — verification-only, no edits expected per RESEARCH).
5. **Phase-close**: run the full safety-net suite a final time and write Plan 23-03 SUMMARY. Because this is the last plan in Phase 23, the SUMMARY closes the phase.

Depends on Plan 23-02 (lint config must be final before `lint:fix` references it; also, `npm run lint` must already exit 0 so the new script isn't adding noise on top of an already-dirty baseline).

Purpose: Finalize script surface per D-12 / D-14 and verify zero CI-reference drift. Phase 23 post-state becomes the input to verify-work.

Output: Updated `package.json` with `lint:fix`; smoke-test log proving every script runs; CI-reference drift audit; `23-03-SUMMARY.md`; phase-close.
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
@.planning/phases/23-dependency-lint-cleanup/23-02-SUMMARY.md
@package.json

<interfaces>
### Current `package.json#scripts` (verified via Read — 2026-04-23)

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
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

### Target state (post-Plan 23-03)

Add `"lint:fix": "eslint . --fix"` (D-14). Recommended insertion point: immediately after `"lint"`. No other changes.

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

### D-13 disposition table (RESEARCH §Scripts Inventory)

| Script | Referenced by | Disposition |
|--------|---------------|-------------|
| `dev` | README, CLAUDE.md | Keep |
| `build` | README, CLAUDE.md, CI | Keep |
| `lint` | README, CLAUDE.md, CI | Keep |
| `preview` | — (canonical vite) | Keep |
| `start` | README, CLAUDE.md | Keep |
| `generate-bundles` | scripts/, product docs | Keep (A4 — referenced per D-13 "keep if referenced") |
| `test` | CI | Keep |
| `test:check-skips` | `test:ci` only (internal) | Keep (invoked by test:ci per D-12 "referenced" criterion) |
| `test:ci` | CI, CLAUDE.md | Keep |
| `knip` | CLAUDE.md (Phase 22) | Keep |

**Decision:** No deletes, no renames. Only addition is `lint:fix`.

### CI-reference verification command (RESEARCH §CI reference tracking)

```bash
grep -rn "npm run\|npm test\|npm start" \
  --include="*.md" --include="*.yml" --include="*.yaml" \
  --include="*.sh" --include="*.ts" --include="*.mjs" \
  --include="*.json" \
  . | grep -v node_modules | grep -v dist | grep -v package-lock.json
```

Because Plan 23-03 RENAMES NOTHING, this grep is a drift-verification gate. Every match must refer to a script key present in `package.json#scripts` (post-add of `lint:fix`). A match referring to a missing script key is pre-existing drift — surface in SUMMARY Deviations; do NOT rename scripts to match drift.

### scripts-README.md decision (D-13 sub-question, RESEARCH §Scripts README decision)

**Decision: skip `scripts-README.md`.** CLAUDE.md §Commands section is already canonical for Claude sessions; README.md covers humans. Adding a third doc is duplication. If `generate-bundles` is unclear, add a header comment in `scripts/generate-all-bundles.ts` — NOT a separate doc.

### Smoke-test plan per script

| Script | Smoke test | Expected |
|--------|------------|----------|
| `dev` | `timeout 5 npm run dev 2>&1 \|\| true` — verify Vite startup banner | "VITE v8.x ready" line printed before timeout |
| `build` | `npm run build` | exit 0; `dist/` populated |
| `lint` | `npm run lint` | exit 0 (post-Plan 23-02) |
| `lint:fix` | `npm run lint:fix` on clean tree | exit 0; git status shows no changes (clean tree already) |
| `preview` | `timeout 3 npm run preview 2>&1 \|\| true` — runs after `build` | port binding printed before timeout |
| `start` | `timeout 5 npm start 2>&1 \|\| true` — server boot banner | "Listening on ..." printed before timeout |
| `generate-bundles` | `npm run generate-bundles --silent 2>&1 \| head -5` | exit 0 (product command — verify no runtime crash) |
| `test` | `npm test` | exit 0 with 608/608 |
| `test:check-skips` | `npm run test:check-skips` | exit 0 (no unjustified skips) |
| `test:ci` | `npm run test:ci` | exit 0, 608/608 |
| `knip` | `npm run knip` | exit 0 |

Note: `dev`, `preview`, `start` are long-running processes — smoke-test via `timeout` wrapper to capture startup without blocking. If `timeout` is unavailable on the host, use `&` + `kill` pattern or skip with a Deviations note (they're already exercised by developer workflow).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add `lint:fix` script + verify scripts inventory</name>
  <files>
    package.json
  </files>
  <read_first>
    package.json,
    .planning/phases/23-dependency-lint-cleanup/23-RESEARCH.md
  </read_first>
  <action>
**Pre-flight:**
1. Confirm Plan 23-02 is merged: `npm run lint` exits 0. If not, STOP — Wave 3 requires Wave 2 post-state.
2. Baseline capture: read current `package.json#scripts` verbatim. Confirm it matches the pre-state shown in `<interfaces>`. If any script has drifted since RESEARCH (2026-04-23), capture for SUMMARY Deviations.
3. Safety net pre-flight: `npm run test:ci` (608/608), `npm run build`, `npm run knip`, `npm run lint`, `npm audit --audit-level=moderate`. All exit 0.

**Step A — Add `lint:fix` (D-14):**
1. Edit `package.json`: insert `"lint:fix": "eslint . --fix"` immediately after the `"lint"` key, preserving exact formatting/indentation of the surrounding object.
2. Do NOT rename, reorder, or delete any other script (per D-12 / D-13 analysis in `<interfaces>`).
3. Verify: `node -e "const p=require('./package.json'); if(p.scripts['lint:fix'] !== 'eslint . --fix') throw 'lint:fix not set correctly'; const expected=['dev','build','lint','lint:fix','preview','start','generate-bundles','test','test:check-skips','test:ci','knip']; for(const k of expected){ if(!(k in p.scripts)) throw 'missing '+k; } if(Object.keys(p.scripts).length !== expected.length) throw 'unexpected script count: '+Object.keys(p.scripts).length;"`
4. Smoke-test the new script: `npm run lint:fix` on the clean tree (post-Plan-23-02). Expect exit 0 and `git status --porcelain` showing no changes (lint is already clean, so autofix is a no-op).
5. Safety net (all five gates: test:ci / build / knip / lint / audit).
6. Commit: `chore(23): add lint:fix script per D-14`.

**Execution guard:** D-12 prohibits renaming scripts referenced by GitHub Actions / README / CLAUDE.md without updating the reference in the SAME commit. This task does NOT rename — but if any downstream-reference update becomes necessary (it should not), bundle into the same commit.
  </action>
  <verify>
    <automated>npm run lint:fix &amp;&amp; [ -z "$(git status --porcelain package.json package-lock.json src server shared tests)" ] &amp;&amp; npm run test:ci &amp;&amp; npm run build &amp;&amp; npm run knip &amp;&amp; npm run lint &amp;&amp; npm audit --audit-level=moderate &amp;&amp; node -e "const p=require('./package.json'); if(p.scripts['lint:fix'] !== 'eslint . --fix') throw 'lint:fix missing';"</automated>
  </verify>
  <acceptance_criteria>
    - `package.json#scripts.lint:fix` exists with value `"eslint . --fix"` (D-14)
    - `package.json#scripts` contains exactly 11 keys (the 10 pre-existing + `lint:fix`) — no renames, no deletions (D-12 / D-13)
    - `npm run lint:fix` exits 0 on the clean tree and leaves git status clean (no-op because Plan 23-02 already made lint clean)
    - Safety net green: `npm run test:ci` (608/608), `npm run build`, `npm run knip`, `npm run lint`, `npm audit --audit-level=moderate`
  </acceptance_criteria>
  <done>
    `lint:fix` script added. Existing 10 scripts preserved intact. Safety net green.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Smoke-test every script + CI-reference drift audit</name>
  <files>
    (none — verification-only; results recorded in Task 3 SUMMARY)
  </files>
  <read_first>
    package.json,
    .planning/phases/23-dependency-lint-cleanup/23-RESEARCH.md,
    README.md,
    CLAUDE.md
  </read_first>
  <action>
**Step A — Smoke-test each script per the plan in `<interfaces>`:**

Run each entry from the §Smoke-test plan table. Capture verbatim output (or `timeout`-truncated output for long-running processes) for SUMMARY.

For each script, record:
- Command run
- Exit code (or "timeout" for long-running)
- Pass/fail vs expected

Any failure (other than the intentional `timeout` on `dev` / `preview` / `start`) is a BLOCKER — STOP and report.

**Step B — CI-reference drift audit:**

1. Run the verification grep from `<interfaces>`:
   ```bash
   grep -rn "npm run\|npm test\|npm start" \
     --include="*.md" --include="*.yml" --include="*.yaml" \
     --include="*.sh" --include="*.ts" --include="*.mjs" \
     --include="*.json" \
     . 2>/dev/null | grep -v node_modules | grep -v dist | grep -v package-lock.json
   ```
2. For each match, extract the referenced script name and verify it exists in current `package.json#scripts`. Tabulate: `source-file:line | reference | matches-package-json? (yes/no)`.
3. **All "no" matches are pre-existing drift** (Plan 23-03 renamed nothing). Surface them in SUMMARY Deviations — do NOT rename scripts to match the drift (that would be scope creep; drift-fix is a separate ticket).
4. Additionally, verify CLAUDE.md §Commands section and README.md script list enumerate the current live set (including the new `lint:fix`). If CLAUDE.md is missing `lint:fix`, note in SUMMARY Deviations — updating docs is Phase 22's concern unless drift clearly originated in Phase 23.

**Step C — No commit from this task** — it is pure verification. All findings feed into Task 3 SUMMARY.
  </action>
  <verify>
    <automated>node -e "const p=require('./package.json'); const keys=Object.keys(p.scripts); const required=['dev','build','lint','lint:fix','preview','start','test','test:ci','knip']; for(const k of required){ if(!keys.includes(k)) throw 'missing canonical '+k; }" &amp;&amp; npm run test:ci &amp;&amp; npm run build &amp;&amp; npm run knip &amp;&amp; npm run lint &amp;&amp; npm run knip &amp;&amp; npm run lint:fix</automated>
  </verify>
  <acceptance_criteria>
    - Every script in `package.json#scripts` has a smoke-test result recorded (success, or `timeout`-truncated-with-startup-banner for long-running processes)
    - CI-reference drift grep run; every match tabulated as matches-live-script yes/no
    - No script failures (other than intentional `timeout` truncations)
    - Pre-existing drift (if any) is surfaced — NOT silently fixed by renaming
    - Safety net green: `npm run test:ci`, `npm run build`, `npm run knip`, `npm run lint`, `npm run lint:fix`
  </acceptance_criteria>
  <done>
    Every script smoke-tested and confirmed working. CI-reference drift audit complete — results captured for SUMMARY.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Phase-close safety net + write 23-03 SUMMARY</name>
  <files>
    .planning/phases/23-dependency-lint-cleanup/23-03-SUMMARY.md
  </files>
  <read_first>
    .planning/phases/23-dependency-lint-cleanup/23-01-SUMMARY.md,
    .planning/phases/23-dependency-lint-cleanup/23-02-SUMMARY.md,
    $HOME/.claude/get-shit-done/templates/summary.md,
    package.json,
    DEFERRED-UPGRADES.md,
    DEFERRED-LINT.md
  </read_first>
  <action>
**Step A — Final phase-close safety net (MUST run all gates fresh):**

```bash
npm run test:ci                    # expect exit 0, 608/608
npm run build                      # expect exit 0
npm run knip                       # expect exit 0
npm run lint                       # expect exit 0 (0/0 errors/warnings)
npm run lint:fix                   # expect exit 0, no-op on clean tree
npm audit --audit-level=moderate   # expect exit 0
npm outdated                       # expect only D-05 deferred majors
```

Capture ALL outputs verbatim for SUMMARY.

**Step B — Write `23-03-SUMMARY.md`:**

Create `.planning/phases/23-dependency-lint-cleanup/23-03-SUMMARY.md` using the standard summary template. It MUST include:

1. **Scripts inventory before/after:** verbatim `package.json#scripts` pre-Plan-23-03 vs post. Highlight the single addition (`lint:fix`).
2. **Smoke-test log (from Task 2 Step A):** per-script command + exit code + pass/fail.
3. **CI-reference drift audit (from Task 2 Step B):** per-match table. Note "all matches resolve to live script keys" OR list drift with file:line (drift is a Deviations item, not a Plan 23-03 regression).
4. **D-13 disposition rationale:** restate why no scripts were deleted (`generate-bundles` referenced per A4 assumption confirmed; `test:check-skips` invoked by `test:ci`). Note that `scripts-README.md` was NOT created (CLAUDE.md §Commands is canonical).
5. **Phase-close safety-net evidence:** verbatim output of Step A (`npm run test:ci` 608/608, `build` exit 0, `knip` exit 0, `lint` exit 0, `lint:fix` exit 0, `audit` exit 0, `outdated` showing only D-05 deferrals).
6. **Phase 23 rollup (this is the phase-close summary):**
   - Total commits across waves 1–3 (expect 14–19 per RESEARCH projection).
   - `DEFERRED-UPGRADES.md` H2 count (expected 5–6).
   - `DEFERRED-LINT.md` H2 count (expected 1 minimum — `no-explicit-any`).
   - `npm audit` before → after: "1 moderate" → "exit 0".
   - `npm run lint` before → after: "1448 problems" → "0 problems".
   - `package.json#scripts` keys before → after: 10 → 11 (adds `lint:fix`).
7. **Deviations:** any anomaly from Task 1 (e.g., formatting idiosyncrasies), Task 2 (drift matches, long-running smoke-test timeouts), or Step A (unexpected audit/outdated output).
8. **Requirement coverage map:**
   - DEPS-01 → Plan 23-01 (audit clean, non-breaking upgrades, DEFERRED-UPGRADES.md)
   - DEPS-02 → Plan 23-02 (lint config tightened, violations resolved, DEFERRED-LINT.md)
   - DEPS-03 → Plan 23-03 (scripts normalized, `lint:fix` added, no drift)

Commit: `docs(23): write Plan 23-03 SUMMARY + Phase 23 close (DEPS-01..03)`.
  </action>
  <verify>
    <automated>npm run test:ci &amp;&amp; npm run build &amp;&amp; npm run knip &amp;&amp; npm run lint &amp;&amp; npm run lint:fix &amp;&amp; npm audit --audit-level=moderate &amp;&amp; test -f .planning/phases/23-dependency-lint-cleanup/23-03-SUMMARY.md &amp;&amp; grep -q "lint:fix" .planning/phases/23-dependency-lint-cleanup/23-03-SUMMARY.md &amp;&amp; grep -q "608/608" .planning/phases/23-dependency-lint-cleanup/23-03-SUMMARY.md &amp;&amp; grep -q "DEPS-01" .planning/phases/23-dependency-lint-cleanup/23-03-SUMMARY.md &amp;&amp; grep -q "DEPS-02" .planning/phases/23-dependency-lint-cleanup/23-03-SUMMARY.md &amp;&amp; grep -q "DEPS-03" .planning/phases/23-dependency-lint-cleanup/23-03-SUMMARY.md &amp;&amp; grep -q "drift" .planning/phases/23-dependency-lint-cleanup/23-03-SUMMARY.md</automated>
  </verify>
  <acceptance_criteria>
    - All 7 phase-close safety-net commands exit 0 with expected output
    - `23-03-SUMMARY.md` exists with scripts before/after, smoke-test log, CI-drift audit, D-13 rationale, phase-close safety-net evidence, Phase 23 rollup, Deviations section, requirement coverage map (DEPS-01, DEPS-02, DEPS-03)
    - Phase 23 rollup confirms: audit clean, lint clean (0 problems), tests 608/608, build green, knip green, scripts normalized
  </acceptance_criteria>
  <done>
    Phase 23 closed. All three requirements (DEPS-01, DEPS-02, DEPS-03) satisfied per SUMMARY. Ready for `/gsd-verify-work`.
  </done>
</task>

</tasks>

<verification>
Final verification for Plan 23-03 (also serves as Phase 23 close):

```bash
npm run test:ci                    # exit 0, 608/608
npm run build                      # exit 0
npm run knip                       # exit 0
npm run lint                       # exit 0, 0/0 errors/warnings
npm run lint:fix                   # exit 0, no-op
npm audit --audit-level=moderate   # exit 0
npm outdated                       # only D-05 deferred majors

# Scripts shape
node -e "const p=require('./package.json'); const keys=Object.keys(p.scripts); if(!keys.includes('lint:fix')) throw 'lint:fix missing'; if(keys.length !== 11) throw 'unexpected script count';"

# Artifacts
test -f DEFERRED-UPGRADES.md
test -f DEFERRED-LINT.md
test -f .planning/phases/23-dependency-lint-cleanup/23-01-SUMMARY.md
test -f .planning/phases/23-dependency-lint-cleanup/23-02-SUMMARY.md
test -f .planning/phases/23-dependency-lint-cleanup/23-03-SUMMARY.md
```
</verification>

<success_criteria>
- `package.json#scripts` contains `"lint:fix": "eslint . --fix"` (DEPS-03 / D-14)
- No script is renamed or deleted (D-12 / D-13 "keep if referenced")
- Every script smoke-tested and confirmed working
- CI-reference drift audit complete — any drift surfaced in SUMMARY Deviations (not silently fixed)
- Phase-close safety net green: `test:ci` (608/608), `build`, `knip`, `lint` (0/0), `lint:fix`, `audit` (exit 0 at moderate)
- `23-03-SUMMARY.md` written with scripts before/after, smoke-test log, CI-drift audit, Phase 23 rollup, requirement coverage map (DEPS-01..03)
- Phase 23 post-state ready for `/gsd-verify-work`
</success_criteria>

<output>
After completion, `.planning/phases/23-dependency-lint-cleanup/23-03-SUMMARY.md` exists and serves as the Phase 23 close summary. Orchestrator proceeds to plan-checker verification (and then `/gsd-verify-work` once all three plans are checker-approved).
</output>
