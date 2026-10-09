---
name: uat-implement
description: Phase 2 of the EMD user-study loop — implement an approved round roadmap with parallel worktree agents per workstream, item-tagged unit tests, the repo gates, protection of registry-mapped tests, and an adversarial code review folded back in. Use after uat-triage is approved, or when the owner says "implement", "implement the roadmap", "fix O3", "adversarial review".
---

# uat-implement — approved roadmap → verified commits on main

Inputs: `.planning/<vX.Y>-ROADMAP.md`, `handoff/rounds/<vX.Y>/items.yaml`, `handoff/requirements/*.yaml`.
Output: commits on `main`, one per workstream or item, gates green, review findings folded, roadmap updated.

## 1. Split into workstreams by file ownership
- Group items so no two parallel agents touch the same file. `src/i18n/translations.ts` is the usual collision —
  give it to one workstream, or have the others return the keys they need and add them yourself after merging.
- A big item (new chart renderer) is its own workstream; tiny items go to whichever workstream owns the file.
- For each workstream list the **registry requirements it may break**: the UIR ids whose `evidence`/`tests[].file`
  cite the files it owns —
  `node -e "const y=require('js-yaml'),fs=require('fs');const own=process.argv.slice(1);for(const f of fs.readdirSync('handoff/requirements'))for(const r of y.load(fs.readFileSync('handoff/requirements/'+f,'utf8')).requirements)if([...r.evidence||[],...(r.tests||[]).map(t=>t.file)].some(p=>own.some(o=>String(p).startsWith(o))))console.log(r.id,'|',r.title,'|',(r.tests||[]).map(t=>t.file+' :: '+(t.name||'*')).join('; '))" src/components/outcomes/ server/`

## 2. Spawn one worktree agent per workstream (Agent tool, `isolation: "worktree"`, background)
Give each agent, in the prompt: the item ids + tester quotes + acceptance from `items.yaml`; the exact files it owns
(and that it must not edit others); the registry list from §1 with the rule **"a registry-mapped test keeps its title
and its assertions; if it goes red, stop and report — it is a regression or an owner decision, never an edit"**; the
conventions (`CLAUDE.md`: no env vars, throw-only errors, wire strings unchanged (D-05), tests without jest-dom); the test
instruction below; and: `ln -s <main>/node_modules node_modules` in the worktree (do not `npm install` there),
`. scripts/useavibe/node22.sh`, commit incrementally with conventional subjects
(`feat(vX.Y WS-B/O3): …`), run `npx vitest run <its test files>` + `npx tsc -p tsconfig.app.json --noEmit` before
returning, and **return the branch name**. Salvage an agent that dies mid-way: commit its worktree as `wip`, relaunch a
continuation agent from that branch.

**Tests per item (required):** every `fix` item gets at least one unit test whose it() title contains the item id in
brackets (`it('[O3] y-axis shows the active metric', …)`) and matches `tests[].name` in `items.yaml` — the harness maps
on that whole token; correct the mapping in `items.yaml` if the file/title differs from the plan. Pattern:
`// @vitest-environment jsdom` per file, RTL + `queryByText(...).not.toBeNull()`, recharts mocked via
`vi.mock('recharts', …)` exposing dataKey/label props, Plotly never executes in jsdom (setup.ts stubs `getContext` → the
caller-supplied fallback DOM carries data-testids), translations stubbed with a `tDE` map. Server routes: supertest on an
in-process express app with `initAuth` mocked (`tests/authMiddlewareLocal.test.ts`). Round file naming:
`tests/<Surface>Round<R>.test.tsx` with a header listing the items.

## 3. Merge only what each agent returned
`git merge --no-ff <returned-branch>` per workstream (`merge(vX.Y): WS-A <surface> — <ids>`) — never merge "all
worktrees" (stale locked worktrees exist under `.claude/worktrees/`). Resolve `translations.ts` conflicts by keeping both
key sets. Then on main:
```bash
. scripts/useavibe/node22.sh
npm run test:ci 2>&1 | grep -E "Test Files|Tests |FAIL"; npm run build >/dev/null && npm run lint >/dev/null && npm run knip
npm run requirements -- --round handoff/rounds/<vX.Y> --report handoff/rounds/<vX.Y>/report-implement.md
#   → every round item: unit PASS (no MISSING, no PLANNED); registry: 0 FAIL. Browser columns stay NONE until /uat-verify.
git diff <last-tag>..HEAD --stat -- tests/   # any changed line in a registry-mapped test file needs a reason in the commit body
```
Dependency changes: `npm install --package-lock-only <pkg>` under the **default** npm (12), then `npm ci` under node@22;
update `SBOM.md` (tables + counts — mandatory on any dependency change).

## 4. Adversarial review, then fold
- Mandatory: a `code-reviewer` agent on `git diff <last-tag>..HEAD` with the acceptance criteria **and** the §1 registry
  lists as the spec — correctness, intent mismatches (does it do what the tester asked, not just something), a11y,
  dark mode, D-05, changed registry-mapped tests.
- When the owner says **"adversarial review"**: additionally invoke the `adversarial-review` skill (user-level,
  `~/.claude/skills/adversarial-review/` — it owns the vetted CLI flags, isolation and timeouts for codex, vibe and kimi)
  with the same brief, then synthesize: reconcile, drop wrong findings, keep real ones. Those CLIs tend to over-explore
  for 20–30 min without a final answer — the useful signal is often in their stderr; kill and synthesize when they do not
  converge. If the skill or the CLIs are absent on this machine, say so and run the internal pass only.
- Fold accepted findings as `fix(vX.Y): fold adversarial-review findings (…)`; re-run the gates.

## 5. Record
Append to `.planning/<vX.Y>-ROADMAP.md` what shipped per item (file, mechanism, test file). Items that turned out
infeasible become `by_design` with the reason (update `items.yaml` and tell the owner before verification starts).
