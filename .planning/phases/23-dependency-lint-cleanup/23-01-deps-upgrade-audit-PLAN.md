---
phase: 23-dependency-lint-cleanup
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - package-lock.json
  - DEFERRED-UPGRADES.md
  - .planning/phases/23-dependency-lint-cleanup/23-01-SUMMARY.md
autonomous: true
requirements: [DEPS-01]
must_haves:
  truths:
    - "`npm audit --audit-level=moderate` exits 0 after this plan completes"
    - "All non-breaking (patch + minor) upgrades identified in RESEARCH §Standard Stack are applied — one atomic commit per package-group"
    - "All deferred MAJOR upgrades per D-05 are captured in `DEFERRED-UPGRADES.md` at repo root with Current / Latest / Blocker / Revisit-trigger rows (D-06)"
    - "`npm run test:ci` exits 0 with 608/608 passing tests after every atomic commit (D-15)"
    - "`npm run build` exits 0 after every upgrade commit (D-16 / Phase 22 Pitfall 3)"
    - "`npm run knip` exits 0 (no regression in dead-code baseline) after every commit"
    - "`follow-redirects` advisory (GHSA-r4q5-vmmm-2653) is resolved via `package.json#overrides` pinning `follow-redirects@^1.16.0` — NOT via `npm audit fix --force` (D-01, D-02, D-21)"
  artifacts:
    - path: "package.json"
      provides: "Updated dep versions (patch/minor) + `overrides` block pinning follow-redirects"
      contains: "\"overrides\""
    - path: "package-lock.json"
      provides: "Regenerated lockfile reflecting all minor/patch bumps and override resolution"
    - path: "DEFERRED-UPGRADES.md"
      provides: "One H2 per deferred major (eslint, @eslint/js, jwks-rsa, otplib, @types/node) with Current / Latest / Blocker / Revisit trigger rows"
      contains: "## eslint"
    - path: ".planning/phases/23-dependency-lint-cleanup/23-01-SUMMARY.md"
      provides: "Before/after audit counts, per-commit diff summary, safety-net evidence"
  key_links:
    - from: "package.json#overrides.follow-redirects"
      to: "transitive chain http-proxy-middleware → http-proxy → follow-redirects"
      via: "npm override resolution"
      pattern: "\"follow-redirects\":\\s*\"\\^1\\.16"
    - from: "DEFERRED-UPGRADES.md"
      to: "D-05 deferred majors list"
      via: "one H2 per package"
      pattern: "^## (eslint|@eslint/js|jwks-rsa|otplib|@types/node)"
---

<objective>
Plan 23-01 (Wave 1): Dependency upgrades + audit remediation.

Scope per RESEARCH §Recommended Task Ordering:
1. Apply `package.json#overrides` for `follow-redirects@^1.16.0` FIRST (security advisory, deterministic fix per D-02/D-21)
2. Apply coupled minor/patch upgrade groups per RESEARCH §Standard Stack (Tailwind pair → TS/Vitest/Vite trio → standalone packages)
3. Create `DEFERRED-UPGRADES.md` capturing all D-05 deferred majors

Sequential sub-ordering within the plan (one atomic commit each):
  a. `overrides` + follow-redirects fix
  b. Tailwind group (`tailwindcss` + `@tailwindcss/vite`)
  c. TS/Vitest/Vite group (`typescript` + `vitest` + `vite`)
  d. `eslint-plugin-react-hooks` (standalone)
  e. `globals` (standalone)
  f. Other deps batch (`lucide-react`, `react-router-dom`, `better-sqlite3`)
  g. Verify `typescript-eslint` 8.58.0→8.59.0 applicability (per RESEARCH §Edge case A3)
  h. Create `DEFERRED-UPGRADES.md`

Output: Post-state where `npm audit --audit-level=moderate` exits 0, `npm outdated` shows only deferred majors, and `DEFERRED-UPGRADES.md` documents every deferral. This post-state is the input to Plan 23-02 (lint tightening runs against final dep surface, avoiding re-work if a dep bump changes lint rules).

Purpose: Raise package hygiene to a clean audit baseline without breaking any behavior. Non-breaking-only (D-01, D-05). All safety-net gates must pass after every commit (D-15, D-16).
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
@.planning/phases/22-codebase-docs-consistency/22-02-SUMMARY.md
@package.json

<interfaces>
### Target versions (from RESEARCH §Standard Stack, verified 2026-04-23 against npm registry)

Apply (patch/minor — D-04):

| Package | Current | Target |
|---------|---------|--------|
| `@tailwindcss/vite` | 4.2.2 | 4.2.4 |
| `tailwindcss` | 4.2.2 | 4.2.4 |
| `typescript` | ~6.0.2 | 6.0.3 |
| `vitest` | 4.1.4 | 4.1.5 |
| `vite` | 8.0.4 | 8.0.10 |
| `eslint-plugin-react-hooks` | 7.0.1 | 7.1.1 |
| `globals` | 17.4.0 | 17.5.0 |
| `lucide-react` | 1.8.0 | 1.9.0 |
| `react-router-dom` | 7.14.0 | 7.14.2 |
| `better-sqlite3` | 12.8.0 | 12.9.0 |
| `typescript-eslint` | 8.58.0 | 8.59.0 (minor — verify live; `latest` tag per RESEARCH A3) |

Defer per D-05 (record in DEFERRED-UPGRADES.md):

| Package | Current | Latest | Blocker |
|---------|---------|--------|---------|
| `eslint` | 9.39.4 | 10.2.1 | v10 drops Node 18; flat-config resolution semantics change; peer-dep cascade unverified |
| `@eslint/js` | 9.39.4 | 10.0.1 | Must track `eslint` major |
| `jwks-rsa` | 3.2.0 | 4.0.1 | v4 changes JWKS fetch cache semantics; Phase 20 Keycloak prep depends on current cache (KEYCLK-01) |
| `otplib` | 12.0.1 | 13.4.0 | v13 refactors hotp/totp entry-points; Phase 15 TOTP 2FA imports `otplib/hotp` / `otplib/totp` paths that changed |
| `@types/node` | 24.12.2 | 25.6.0 | v25 tracks Node 24 runtime; repo runs on Node 20+ |

### `overrides` block (D-21 / RESEARCH §Code Examples)

```json
{
  "overrides": {
    "follow-redirects": "^1.16.0"
  }
}
```

Place as a new top-level key in `package.json` (between `devDependencies` and the existing keys), then `npm install` to refresh the lockfile.

### DEFERRED-UPGRADES.md template (D-06 / RESEARCH §Code Examples)

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
...
## jwks-rsa
...
## otplib
...
## @types/node
...
```

### Pitfall guards (from RESEARCH §Common Pitfalls — executor MUST read before each commit)

- **Pitfall 1 (D-01):** Do NOT run `npm audit fix --force`. If `npm audit fix` (no --force) is run, diff `package.json` and reject any commit that includes a caret-major bump.
- **Pitfall 2 (D-16):** `npm run build` MUST run after every upgrade commit — Vite/rolldown resolves some dynamic imports only at build time (`test:ci` alone does not catch this).
- **Pitfall 4:** `npm run knip` MUST stay green. If knip regresses after an upgrade, do NOT delete reported exports; investigate first (a bumped package may have introduced a new file-shape knip misreads).
- **Pitfall 5:** After `npm install eslint-plugin-react-hooks@7.1.1`, check `npm ls eslint` for peer-dep warnings. Peer warnings about `eslint@10.x` are irrelevant (we're on 9.x per D-05); anything else warrants investigation.
- **Pitfall 7 (A7):** Re-run `npm audit --audit-level=moderate` as the final gate — new advisories may have landed since 2026-04-23. Each additional advisory → add one more `overrides` entry, do NOT bump a direct dep past a major.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add follow-redirects override (security patch) + DEFERRED-UPGRADES.md scaffold</name>
  <files>
    package.json,
    package-lock.json,
    DEFERRED-UPGRADES.md
  </files>
  <read_first>
    package.json,
    .planning/phases/23-dependency-lint-cleanup/23-RESEARCH.md
  </read_first>
  <action>
**Pre-flight (verify baseline):**
1. `npm audit --audit-level=moderate` — capture current advisory list. Expected: 1 moderate (`follow-redirects <=1.15.11`, GHSA-r4q5-vmmm-2653). Save verbatim to a scratch note for SUMMARY.
2. `npm ls follow-redirects` — confirm transitive chain. Expected: `http-proxy-middleware@3.0.5 → http-proxy@1.18.1 → follow-redirects@1.15.11`.
3. `npm run test:ci` → 608/608. `npm run build` → exit 0. `npm run knip` → exit 0. If any gate fails pre-flight, STOP and report — do not proceed with upgrades on a broken baseline.

**Step A — `overrides` block (per D-02, D-21):**
1. Edit `package.json`: add a top-level `"overrides"` block AFTER `devDependencies`:
   ```json
   "overrides": {
     "follow-redirects": "^1.16.0"
   }
   ```
2. Run `npm install` (no `--force`). This regenerates `package-lock.json`.
3. Verify resolution: `npm ls follow-redirects` should now show `follow-redirects@1.16.0` (or higher within the `^1` range).
4. Run audit gate: `npm audit --audit-level=moderate` — MUST exit 0 (Pitfall 7: if a NEW advisory has appeared since 2026-04-23, add another `overrides` entry for it and document in the commit message; do NOT proceed with a non-clean audit).
5. Safety net: `npm run test:ci` (608/608) + `npm run build` (exit 0) + `npm run knip` (exit 0). All three MUST pass.
6. Commit: `chore(23): pin follow-redirects@^1.16.0 via overrides (GHSA-r4q5-vmmm-2653, D-02 D-21)`.

**Step B — Create `DEFERRED-UPGRADES.md` at repo root (per D-05, D-06):**
1. Use the template in `<interfaces>` — populate H2 sections for all 5 deferred majors: `eslint`, `@eslint/js`, `jwks-rsa`, `otplib`, `@types/node`. Use the exact Current/Latest/Blocker/Revisit-trigger text from RESEARCH §Standard Stack (already verified 2026-04-23).
2. Do NOT include `typescript-eslint` as a deferred major here — per RESEARCH A3, `latest` tag is 8.59.0 today, so it gets a minor bump in Task 4. If at execution time `npm view typescript-eslint version` returns a 9.x as `latest`, add it here and skip the Task 4 minor bump.
3. Safety net: `npm run test:ci` + `npm run build` + `npm run knip` (doc-only change, all must still pass).
4. Commit: `docs(23): create DEFERRED-UPGRADES.md for 5 deferred major bumps (D-05 D-06)`.

**Execution guard:** `npm audit fix --force` is BANNED in this phase (D-01). If at any point an error suggests `--force`, STOP and report.
  </action>
  <verify>
    <automated>npm audit --audit-level=moderate &amp;&amp; npm run test:ci &amp;&amp; npm run build &amp;&amp; npm run knip &amp;&amp; test -f DEFERRED-UPGRADES.md &amp;&amp; grep -q '^## eslint$' DEFERRED-UPGRADES.md &amp;&amp; grep -q '^## @eslint/js$' DEFERRED-UPGRADES.md &amp;&amp; grep -q '^## jwks-rsa$' DEFERRED-UPGRADES.md &amp;&amp; grep -q '^## otplib$' DEFERRED-UPGRADES.md &amp;&amp; grep -q '^## @types/node$' DEFERRED-UPGRADES.md &amp;&amp; grep -q '"follow-redirects"' package.json</automated>
  </verify>
  <acceptance_criteria>
    - `package.json` contains a top-level `"overrides"` block with `"follow-redirects": "^1.16.0"`
    - `npm ls follow-redirects` resolves to `1.16.0` or higher within `^1`
    - `npm audit --audit-level=moderate` exits 0
    - `DEFERRED-UPGRADES.md` exists at repo root with exactly 5 H2 sections (`## eslint`, `## @eslint/js`, `## jwks-rsa`, `## otplib`, `## @types/node`), each with Current/Latest/Blocker/Revisit-trigger rows
    - `npm run test:ci` exits 0 with 608/608 passing tests
    - `npm run build` exits 0
    - `npm run knip` exits 0
    - Two commits created: one for the override, one for DEFERRED-UPGRADES.md
  </acceptance_criteria>
  <done>
    Security advisory resolved deterministically via overrides; major-defer ledger documented. Full safety net green.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Apply coupled upgrade groups — Tailwind pair + TS/Vitest/Vite trio</name>
  <files>
    package.json,
    package-lock.json
  </files>
  <read_first>
    package.json,
    .planning/phases/23-dependency-lint-cleanup/23-RESEARCH.md
  </read_first>
  <action>
**Rationale (RESEARCH §Minor/patch couplings):** Tailwind pair ships in sync (both 4.2.x); TS/Vitest/Vite trio is bumped together because vitest tracks ts+vite — bumping one without the others risks a typecheck mismatch.

**Commit 2a — Tailwind group:**
1. `npm install @tailwindcss/vite@4.2.4 tailwindcss@4.2.4`
2. Verify `package.json` diff shows only the two Tailwind entries changing (no caret-major jumps per Pitfall 1).
3. Safety net: `npm run test:ci` (608/608) + `npm run build` (exit 0) + `npm run knip` (exit 0) + `npm audit --audit-level=moderate` (exit 0).
4. Commit: `chore(23): bump @tailwindcss/vite 4.2.2→4.2.4, tailwindcss 4.2.2→4.2.4 (D-04)`.

**Commit 2b — TS/Vitest/Vite trio:**
1. `npm install typescript@6.0.3 vitest@4.1.5 vite@8.0.10`
2. Verify `package.json` diff shows only the three entries changing (no caret-major jumps).
3. Safety net: `npm run test:ci` (608/608) + `npm run build` (exit 0) + `npm run knip` (exit 0) + `npm audit --audit-level=moderate` (exit 0).
4. Pitfall 2 guard: `npm run build` MUST succeed — Vite/rolldown dynamic-import resolution lives at build time.
5. Commit: `chore(23): bump typescript 6.0.2→6.0.3, vitest 4.1.4→4.1.5, vite 8.0.4→8.0.10 (D-04)`.

**Between commits:** If ANY safety-net gate fails, STOP. Investigate. Do NOT proceed to the next group. Do NOT run `npm audit fix --force`. Report the failure for user decision.
  </action>
  <verify>
    <automated>npm run test:ci &amp;&amp; npm run build &amp;&amp; npm run knip &amp;&amp; npm audit --audit-level=moderate &amp;&amp; node -e "const p=require('./package.json'); const d={...p.dependencies,...p.devDependencies}; if(!d.tailwindcss.includes('4.2.4')) throw 'tailwindcss'; if(!d['@tailwindcss/vite'].includes('4.2.4')) throw '@tailwindcss/vite'; if(!d.typescript.includes('6.0.3')) throw 'typescript'; if(!d.vitest.includes('4.1.5')) throw 'vitest'; if(!d.vite.includes('8.0.10')) throw 'vite';"</automated>
  </verify>
  <acceptance_criteria>
    - `package.json` shows `@tailwindcss/vite@^4.2.4`, `tailwindcss@^4.2.4`, `typescript@~6.0.3`, `vitest@^4.1.5`, `vite@^8.0.10` (exact caret/tilde preserved from pre-state)
    - No package outside the 5 listed changes in either commit's diff
    - `npm run test:ci` exits 0 with 608/608 after EACH of the two commits
    - `npm run build` exits 0 after EACH commit
    - `npm run knip` exits 0 after EACH commit
    - `npm audit --audit-level=moderate` exits 0 after EACH commit
    - Two commits created (2a Tailwind, 2b TS/Vitest/Vite)
  </acceptance_criteria>
  <done>
    Coupled upgrade groups applied. Full safety net green after each commit. No major-version leakage.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Apply standalone upgrades — react-hooks plugin, globals, other deps</name>
  <files>
    package.json,
    package-lock.json
  </files>
  <read_first>
    package.json,
    .planning/phases/23-dependency-lint-cleanup/23-RESEARCH.md
  </read_first>
  <action>
**Commit 3a — `eslint-plugin-react-hooks`:**
1. `npm install eslint-plugin-react-hooks@7.1.1`
2. Pitfall 5 guard: `npm ls eslint` — confirm no ERESOLVE / invalid. Peer warnings about `eslint@10.x` are IRRELEVANT (we're on 9.x per D-05). Peer warnings about anything else → STOP and investigate.
3. Safety net: `npm run test:ci` + `npm run build` + `npm run knip` + `npm audit --audit-level=moderate`. All exit 0.
4. Commit: `chore(23): bump eslint-plugin-react-hooks 7.0.1→7.1.1 (D-04)`.

**Commit 3b — `globals`:**
1. `npm install globals@17.5.0`
2. Safety net (all four gates).
3. Commit: `chore(23): bump globals 17.4.0→17.5.0 (D-04)`.

**Commit 3c — Other deps batch (`lucide-react`, `react-router-dom`, `better-sqlite3`):**
Per D-04 planner discretion: these three are independent single-bump packages with low coupling — batch into one commit to keep the commit stream tight.
1. `npm install lucide-react@1.9.0 react-router-dom@7.14.2 better-sqlite3@12.9.0`
2. Safety net (all four gates). `better-sqlite3` is a native module — `npm run build` and `npm run test:ci` together will catch any rebuild issue.
3. Commit: `chore(23): bump lucide-react 1.8.0→1.9.0, react-router-dom 7.14.0→7.14.2, better-sqlite3 12.8.0→12.9.0 (D-04)`.

**Between commits:** Same STOP-on-failure rule as Task 2. Never run `npm audit fix --force`.
  </action>
  <verify>
    <automated>npm run test:ci &amp;&amp; npm run build &amp;&amp; npm run knip &amp;&amp; npm audit --audit-level=moderate &amp;&amp; node -e "const p=require('./package.json'); const d={...p.dependencies,...p.devDependencies}; const need={'eslint-plugin-react-hooks':'7.1.1','globals':'17.5.0','lucide-react':'1.9.0','react-router-dom':'7.14.2','better-sqlite3':'12.9.0'}; for(const k in need){ if(!d[k].includes(need[k])) throw k+' not at '+need[k]+' got '+d[k]; }"</automated>
  </verify>
  <acceptance_criteria>
    - `package.json` shows `eslint-plugin-react-hooks@^7.1.1`, `globals@^17.5.0`, `lucide-react@^1.9.0`, `react-router-dom@^7.14.2`, `better-sqlite3@^12.9.0`
    - No ERESOLVE / invalid peer deps
    - `npm run test:ci` exits 0 with 608/608 after EACH of the three commits
    - `npm run build` exits 0 after EACH commit
    - `npm run knip` exits 0 after EACH commit
    - `npm audit --audit-level=moderate` exits 0 after EACH commit
    - Three commits created (3a react-hooks, 3b globals, 3c other-deps-batch)
  </acceptance_criteria>
  <done>
    All standalone non-breaking upgrades applied. Safety net green throughout. Zero major-version leakage.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: typescript-eslint minor verification + final audit gate + SUMMARY</name>
  <files>
    package.json,
    package-lock.json,
    DEFERRED-UPGRADES.md,
    .planning/phases/23-dependency-lint-cleanup/23-01-SUMMARY.md
  </files>
  <read_first>
    package.json,
    DEFERRED-UPGRADES.md,
    $HOME/.claude/get-shit-done/templates/summary.md
  </read_first>
  <action>
**Step A — `typescript-eslint` applicability check (RESEARCH A3):**
1. Run `npm view typescript-eslint version` → captures the current `latest` tag.
2. **If `latest` is 8.59.0** (or any 8.x minor above 8.58.0):
   - `npm install typescript-eslint@<that-version>`
   - Safety net: `npm run test:ci` + `npm run build` + `npm run knip` + `npm audit --audit-level=moderate`.
   - Commit: `chore(23): bump typescript-eslint 8.58.0→<version> (D-04 — minor-only per A3)`.
3. **If `latest` is 9.x:** D-05 applies — do NOT install. Instead:
   - Append a `## typescript-eslint` H2 to `DEFERRED-UPGRADES.md` with Current=8.58.0, Latest=<9.x>, Blocker="v9 is a major bump; peer-dep cascade with eslint@9 unverified", Revisit-trigger="Phase that adopts eslint@10 (paired with the eslint major defer)".
   - Commit: `docs(23): defer typescript-eslint 9.x in DEFERRED-UPGRADES.md (D-05)`.
4. **If a different anomaly** (e.g., registry returns a patch-only version like 8.58.1, or the package is unpublished): capture the anomaly verbatim in SUMMARY §Deviations and report; do not force a bump.

**Step B — Final audit gate + outdated verification:**
1. `npm audit --audit-level=moderate` → MUST exit 0. Capture verbatim output for SUMMARY.
2. `npm outdated` → capture verbatim output for SUMMARY. Expected result: ONLY the D-05 deferred majors remain (eslint, @eslint/js, jwks-rsa, otplib, @types/node, and typescript-eslint if Step A went to 9.x-defer path). If any non-deferred package still shows outdated: STOP and investigate.
3. Safety net: `npm run test:ci` + `npm run build` + `npm run knip`. All exit 0.

**Step C — Write `23-01-SUMMARY.md`:**
Create `.planning/phases/23-dependency-lint-cleanup/23-01-SUMMARY.md` using the standard summary template. Include:
1. **Before/after audit:** Pre-state `npm audit --audit-level=moderate` output (1 moderate) vs post-state (exit 0). Include the GHSA-r4q5-vmmm-2653 resolution trail.
2. **Commit table:** one row per commit in Plan 23-01 with columns `commit-sha | package-group | D-XX | safety-net-status`.
3. **Post-state `npm outdated`:** verbatim output, annotated to show only D-05 deferrals remain.
4. **DEFERRED-UPGRADES.md snapshot:** list the H2 sections recorded (5 or 6 depending on Step A).
5. **Safety-net evidence:** final `npm run test:ci` → 608/608, `npm run build` → exit 0, `npm run knip` → exit 0, `npm audit --audit-level=moderate` → exit 0.
6. **Deviations:** if any step 4-A anomaly surfaced, or if an additional `overrides` entry was needed due to a newly-landed advisory, document verbatim.

Commit: `docs(23): write Plan 23-01 SUMMARY (deps wave complete)`.
  </action>
  <verify>
    <automated>npm audit --audit-level=moderate &amp;&amp; npm run test:ci &amp;&amp; npm run build &amp;&amp; npm run knip &amp;&amp; test -f .planning/phases/23-dependency-lint-cleanup/23-01-SUMMARY.md &amp;&amp; grep -q 'GHSA-r4q5-vmmm-2653' .planning/phases/23-dependency-lint-cleanup/23-01-SUMMARY.md &amp;&amp; grep -q '608/608' .planning/phases/23-dependency-lint-cleanup/23-01-SUMMARY.md &amp;&amp; grep -q 'npm outdated' .planning/phases/23-dependency-lint-cleanup/23-01-SUMMARY.md</automated>
  </verify>
  <acceptance_criteria>
    - `typescript-eslint` branching resolved per Step A (either minor-bumped in package.json, or added as H2 to DEFERRED-UPGRADES.md)
    - `npm audit --audit-level=moderate` exits 0 (final gate)
    - `npm outdated` shows only D-05 deferred packages
    - `npm run test:ci` exits 0 with 608/608
    - `npm run build` exits 0
    - `npm run knip` exits 0
    - `23-01-SUMMARY.md` exists with before/after audit, commit table, npm-outdated snapshot, safety-net evidence, deviations section
    - Final commit created for SUMMARY (plus optional typescript-eslint commit)
  </acceptance_criteria>
  <done>
    Wave 1 complete: audit clean, all non-breaking bumps applied, all majors deferred and documented, SUMMARY written. Post-state is the input to Plan 23-02.
  </done>
</task>

</tasks>

<verification>
Final verification for Plan 23-01:

```bash
npm audit --audit-level=moderate   # exit 0
npm run test:ci                    # exit 0, 608/608
npm run build                      # exit 0
npm run knip                       # exit 0
npm outdated                       # only D-05 deferrals remain
test -f DEFERRED-UPGRADES.md
grep -c '^## ' DEFERRED-UPGRADES.md    # >=5
test -f .planning/phases/23-dependency-lint-cleanup/23-01-SUMMARY.md
grep -q '"overrides"' package.json
grep -q '"follow-redirects"' package.json
```
</verification>

<success_criteria>
- `npm audit --audit-level=moderate` exits 0 (DEPS-01 gate 1)
- All patch/minor bumps from RESEARCH §Standard Stack applied — one atomic commit per package-group per D-04
- All D-05 deferred majors recorded in `DEFERRED-UPGRADES.md` with Current/Latest/Blocker/Revisit-trigger per D-06
- `follow-redirects` resolved via `package.json#overrides` (D-02, D-21) — NOT via `npm audit fix --force` (D-01)
- Safety net green after every commit: `npm run test:ci` (608/608), `npm run build`, `npm run knip`, `npm audit --audit-level=moderate`
- `23-01-SUMMARY.md` written with before/after counts, commit table, safety-net evidence, and deviations
</success_criteria>

<output>
After completion, `.planning/phases/23-dependency-lint-cleanup/23-01-SUMMARY.md` exists (created in Task 4). Plan 23-02 reads this SUMMARY to confirm the lint-tightening wave runs against the final dep surface.
</output>
