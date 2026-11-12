---
name: useavibe-fix
description: Implement exactly one UseAVibe usability problem against its frozen acceptance criteria — test first, minimal change, gated by the Stop hook, reviewed by ac-reviewer, committed with trailers. One problem per fresh session.
disable-model-invocation: true
argument-hint: <Z<k>-P<nn>>
---
Implement usability problem **$ARGUMENTS** (format `Z<k>-P<nn>`; k = digits after Z). One problem, this session only.

## 0. Activate
Run `node scripts/useavibe/activate.mjs $ARGUMENTS`. If it refuses, report the message and stop. From now on the
Stop hook runs the full gate whenever you end a turn and counts attempts (cap in `.planning/useavibe/Z<k>/cycle.json`).

## 1. Load the specification — do not infer beyond it
- `.planning/useavibe/Z<k>/PROBLEMS.md` → entry $ARGUMENTS.
- `acceptance/Z<k>/$ARGUMENTS.feature` → the ONLY definition of done (read-only).
- `.planning/useavibe/Z<k>/PLAN.md` → approved section `## $ARGUMENTS`; implement only that. The study team's
  `Answer:` lines under `## Conflicts` and `## Open questions` are binding; if your section depends on an item
  answered `deferred`, end with `## Blocked` (O-27). An item without an `Answer:` line means the plan was approved
  without one (plan-approve refuses that): if your section depends on it, change nothing and end with `## Blocked`.
- Follow-up iteration: `acceptance-rounds/Z<k>/round-*/findings/$ARGUMENTS.md` — the team's findings from the
  acceptance round(s) attributed to this problem (human-written; treat as additional criteria, not as permission to
  widen scope).
Before writing any test, check every `Then`/`And` step: can you state its exact observable result (value, text,
order and its key, which pages or elements) from the .feature and the binding `Answer:` lines alone? If a step admits
two implementations with different observable results (e.g. sort by first vs. last name), the criterion is ambiguous.
If a criterion is ambiguous, untestable, or contradicts the plan, the Pflichtenheft or an earlier scenario: stop now,
change nothing and end with `## Blocked` (the alternatives and questions for the study team). Do not choose an
interpretation and ask afterwards.
If a round finding you are to fix cannot be reproduced (code reading plus test), end with `## Blocked`, state
"not reproducible" with your evidence, and change no code; the team decides the disposition (O-29).

## 2. Test first
Write one Playwright test per scenario in `tests/acceptance/Z<k>/$ARGUMENTS.spec.ts`, titled
`[$ARGUMENTS] <scenario name>` (fixtures and login helpers in `tests/acceptance/fixtures.ts`; synthetic data only),
or a Vitest test `tests/acceptance/Z<k>/$ARGUMENTS.test.ts` for pure logic. `@visual` scenarios get a DOM/ARIA proxy
assertion where possible and are listed for the browser pass. Do not run the container tests yourself (the sandbox
blocks Docker by design). Commit nothing yet and end your turn with only the test file(s) changed: the gate's red
check runs them against the production container and MUST report them failing for the reason the .feature describes.
Quote that output. If the gate reports "PASS before any fix", stop and report.

## 3. Implement
Minimal change that turns the tests green, following CLAUDE.md. No unrelated refactoring. Never modify existing tests;
a registry-mapped test keeps its title and assertions — if it goes red, stop and report (regression or owner decision).
Anything else you notice goes under `## Observed, not changed`. Before step 4, reread the code around each change (the
same component, form or translation block) for other visible defects: typos, wrong or untranslated labels,
inconsistent terms, raw codes shown to users. List each with file:line under `## Observed, not changed`; fix none.
Side effects: if your change sets state that outlives the route, component or step it belongs to (e.g.
`document.title`, storage, global listeners, timers, focus), restore it where that scope ends (unmount, navigation
away, logout, browser Back), so that pages outside the problem's scope behave as before the change.

## 4. Verify — evidence, not claims
Every gate run counts as an attempt, and every turn end starts one. Before you end any turn (also in step 2), run
`npm run build`, `npm run lint`, `npm run knip` and `npm run test:ci` yourself (one command per call, no pipes)
and fix what they report until all four
pass; only then end the turn. The gate repeats these steps; a gate attempt lost to a compile, lint, knip or unit
error you could have run yourself is a process error.
End your turn: the Stop hook runs the
whole gate (integrity, unit, build, lint, knip, audit delta, all cycles' acceptance tests, requirements). On failure
it continues the turn with the failing step; fix the root cause and end the turn again. On a pass it also
continues the turn: go on with steps 5–6. A gate run on an unchanged tree after a pass is a re-check and not counted. At the cap the hook asks for
`## Blocked` — then stop changing code.
Whenever you end with `## Blocked` after changing files, leave the tree in one of two states and name it in the
first line under `## Blocked`: reset to the base (`git checkout -- .`, remove your new files), or the complete
change staged with what is missing for a commit. Never leave a half-done, unstaged change.

## 5. Review
When the gate has passed, run the `ac-reviewer` subagent with: problem ID, `git diff <base>..` (base in
`.planning/useavibe/ACTIVE`), the .feature, the PLAN section and the test file. Findings inside the approved PLAN
section: fix them (back to §3 *Implement*); the next gate run counts as a new attempt. Findings outside the PLAN
section or needing a study-team decision: change nothing; list them under `## Observed, not changed`. Log
`node scripts/useavibe/activate.mjs --review pass|findings-fixed|findings-open`.

## 6. Record — stage, do not commit
Do not run `git commit`: the session sandbox hides the study workspace, so the pseudonym guard cannot check the commit
here; the operator commits outside the sandbox (decision O-25). Stage the whole fix (`git add` of every changed and
new file; nothing may stay unstaged), then write the commit message to `.planning/useavibe/COMMIT_MSG`
(handoff §9 types/scopes), body ends with `Verified: …`, trailers:
`Usability-Problem: $ARGUMENTS` · `Acceptance: acceptance/Z<k>/$ARGUMENTS.feature@<first 8 of its SHA-256>` ·
`Attempts: <gate attempts>` · `Reviewer: pass|findings-fixed|findings-open` (· `Round-Finding: Z<k>-R<r>-F<m>` in follow-ups) ·
Co-Authored-By as in the session's system reminder. Do not run `--clear`; end the report with
`Ready to commit: node scripts/useavibe/activate.mjs --commit` (it checks the trailers, commits and closes the session).

## 7. Report (≤ 15 lines)
Scenarios met / not met · attempts · earlier scenarios, registry requirements, EMDREQ touched · side effects and
where they are reset · gate attempts lost to steps you could run yourself · not done ·
what the human must check visually (screen, synthetic case) · `## Observed, not changed`.
