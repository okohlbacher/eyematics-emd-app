---
name: useavibe-defect
description: Fix exactly one acceptance-test defect (AT-M-<nnn>) of the AT defect track — not a usability problem of the study. Test first against the team's criterion, minimal change, gated by the Stop hook, reviewed by ac-reviewer, staged for the operator's commit. One defect per fresh session.
disable-model-invocation: true
argument-hint: <AT-M-nnn>
---
Fix acceptance-test defect **$ARGUMENTS** (format `AT-M-<nnn>`). One defect, this session only. This is the defect
track (decisions O-31, O-34, O-38): defects not caused by a usability fix of the current cycle. It is not study
work — usability problems and regressions caused by their fixes go through `/useavibe-fix`.

## 0. Activate
Run `node scripts/useavibe/activate.mjs $ARGUMENTS --at`. If it refuses, report the message and stop — in particular
when the defect's cause is open or names a usability fix of the current cycle (that is a class-B regression for
`/useavibe-fix`, O-38). From now on the Stop hook runs the full gate whenever you end a turn and counts attempts.

## 1. Load the specification — do not infer beyond it
- `acceptance/AT/$ARGUMENTS.feature` → the ONLY definition of done (read-only), written by the study team / test
  lead. Its header names the defect's source, the related EMDREQ/UIR/AT cases and the `Cause:`.
- The AT case(s) and requirements named there (`docs/Pflichtenheft.md`, `handoff/requirements/`).
If the criterion is ambiguous, untestable, or contradicts the Pflichtenheft or an earlier scenario: stop and end
with `## Blocked` (questions for the test lead). Do not guess. If the defect cannot be reproduced, end with
`## Blocked`, state "not reproducible" with your evidence, and change no code.

## 2. Test first
Write one Playwright test per scenario in `tests/acceptance-at/$ARGUMENTS.spec.ts`, titled
`[$ARGUMENTS] <scenario name>` (helpers in `tests/acceptance-at/helpers.ts`; synthetic data only). A defect that
occurs only sometimes (race, timing) needs a repeated test as red evidence: repeat the failing interaction at least
20 times inside the test (decision O-34), so one run reliably fails before the fix. Do not run the container tests
yourself (the sandbox blocks Docker by design). End your turn with only the test file changed: the gate's red check
runs it against the production container and MUST report it failing for the reason the .feature describes. Quote
that output. If the gate reports "PASS before any fix", stop and report.

## 3. Implement
Minimal change that turns the tests green, following CLAUDE.md. No unrelated refactoring. Never modify existing tests;
a registry-mapped test keeps its title and assertions — if it goes red, stop and report. Similar code paths with the
same defect pattern are not part of this defect: list them under `## Observed, not changed` (candidates for further
AT-M entries).

## 4. Verify — evidence, not claims
End your turn: the Stop hook runs the whole gate. On failure it continues the turn with the failing step; fix the
root cause and end the turn again. On a pass it also continues the turn: go on with steps 5–6. A gate run on an
unchanged tree after a pass is a re-check and not counted. At the cap the hook asks for `## Blocked` — then stop
changing code.

## 5. Review
When the gate has passed, run the `ac-reviewer` subagent with: defect ID, `git diff <base>..` (base in
`.planning/useavibe/ACTIVE`), the .feature and the test file. Findings inside the defect's .feature: fix them (back
to §3 *Implement*); the next gate run counts as a new attempt. Findings outside it or needing a study-team decision:
change nothing; list them under `## Observed, not changed`. Log
`node scripts/useavibe/activate.mjs --review pass|findings-fixed|findings-open`.

## 6. Record — stage, do not commit
Do not run `git commit` (the pseudonym guard cannot run in the sandbox; the operator commits, O-25). Stage the whole
fix (`git add` of every changed and new file; nothing may stay unstaged), then write the commit message to
`.planning/useavibe/COMMIT_MSG` (handoff §9 types/scopes), body ends with `Verified: …`, trailers:
`Acceptance-Defect: $ARGUMENTS` · `Acceptance-Test: <AT case ID or —>` · `Attempts: <gate attempts>` ·
`Reviewer: pass|findings-fixed|findings-open` · `Regression-Of: <ID>` when the .feature's `Cause:` is `latent Z<j>-P<nn>` or
`defect-fix AT-M-<nnn>` · Co-Authored-By as in the session's system reminder, all trailers in one final block with no
blank line between them (git reads only the last paragraph). Never a `Usability-Problem:` trailer.
End the report with `Ready to commit: node scripts/useavibe/activate.mjs --commit`.

## 7. Report (≤ 15 lines)
Scenarios met / not met · attempts · registry requirements, EMDREQ, AT cases touched · not done · what the test lead
must re-test in the next team round · `## Observed, not changed`.
