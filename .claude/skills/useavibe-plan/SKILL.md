---
name: useavibe-plan
description: Change plan for one UseAVibe iteration cycle from the frozen problem list and the frozen acceptance criteria. Plan mode, no code changes; writes PLAN.md for study-team approval.
disable-model-invocation: true
argument-hint: <cycle number k>
---
You are planning iteration cycle Z$ARGUMENTS of the UseAVibe study. PLAN ONLY — make no code changes.
If `.planning/useavibe/Z$ARGUMENTS/cycle.json` has `"final": true`, stop: the final evaluation cycle has no revision.

Read all inputs before writing anything:
- `.planning/useavibe/Z$ARGUMENTS/PROBLEMS.md` — frozen list. Plan only problems with PL06 = `1 umgesetzt`.
- `acceptance/Z$ARGUMENTS/*.feature` — definition of done (read-only). Earlier cycles' `acceptance/Z<j>/*.feature` must keep passing.
- `docs/Pflichtenheft.md` (EMDREQ-*), `docs/Lastenheft.md`, `.planning/GLOSSARY.md`, `CLAUDE.md`.
Use subagents (Explore) for code search so this session's context stays small.

For every problem to implement write `## <ID>` with:
1. **Location** — files and functions with line ranges you actually opened.
2. **Root cause as observed** — what the code does now. If you cannot reproduce it from code + synthetic data, say so.
3. **Proposed change** — ≤ 5 sentences, minimal, naming every file to touch.
4. **Regression risk** — earlier-cycle scenarios on the same components (file, scenario name); registry requirements
   at risk, listed with the command of `/uat-implement` §1 for the files you will touch; affected EMDREQ IDs and
   acceptance-test cases (`AT-…`). Read each listed registry entry (`handoff/requirements/*.yaml`): if the change
   would make its statement or `browser` expectation untrue, that is a conflict, not only a risk — flag it under
   Conflicts, as for a contradicted Pflichtenheft requirement or earlier scenario. Every statement that a test or
   `AT-…` case is, or is not, affected cites the `file:line` you opened; a search hit alone is not evidence.
5. **Test approach per scenario** — Playwright (`tests/acceptance/Z$ARGUMENTS/<ID>.spec.ts`, title `[<ID>] <scenario>`)
   or Vitest for pure logic; selectors, synthetic data, `@visual` scenarios that need the human/agent browser pass.
6. **Size** S/M/L and dependencies on other problems.

Then `## Order` (with justification), `## Conflicts` (between problems, or with Pflichtenheft/Lastenheft, registry
requirements or earlier scenarios — never resolve them yourself) and `## Open questions` (everything the study team must
decide; no assumptions). Where the problem and its scenarios leave a choice open that users would see or the tests
would check (e.g. a default value, a label or message, how far a change reaches), ask it as a question; the proposed
change names the options, not your pick. Do not ask what is yours to decide: code structure (where a helper lives,
which of two equivalent implementations), test set-up, and the English counterpart of a German text — every UI text
change applies to both UI languages; propose the English text and test both languages. Defects you find next to a
problem go under `## Observed, not changed`, unless they share the problem's root cause or would leave the fixed flow
showing the user inconsistent data; only then ask whether they are in scope.
Write each conflict and question as one item `- **C<n>:** …` / `- **Q<n>:** …`, followed by an indented empty
`  Answer:` line for the study team (`useavibe plan-approve` refuses while an item has no answer, O-27). In a problem's
section, name the items it depends on (`Depends on: C1, Q1`).

Write `.planning/useavibe/Z$ARGUMENTS/PLAN.md` and stop. The study team edits and approves it with
`useavibe plan-approve` (ZA05); no implementation before that.

In a real cycle the operator runs this skill interactively in plan mode (`claude --permission-mode plan`, R3,
decision O-24): present the complete PLAN.md content as your plan; once the operator accepts it, write it unchanged
to `.planning/useavibe/Z$ARGUMENTS/PLAN.md` — the only file you write — and stop. Headless runs (rehearsal,
evaluation) cannot write in plan mode; they run in `acceptEdits` and write PLAN.md directly.
