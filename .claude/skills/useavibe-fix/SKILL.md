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
- `.planning/useavibe/Z<k>/PLAN.md` → approved section `## $ARGUMENTS`; implement only that.
- Follow-up iteration: `acceptance-rounds/Z<k>/round-*/findings/$ARGUMENTS.md` — the team's findings from the
  acceptance round(s) attributed to this problem (human-written; treat as additional criteria, not as permission to
  widen scope).
If a criterion is ambiguous, untestable, or contradicts the plan, the Pflichtenheft or an earlier scenario: stop and
end with `## Blocked` (questions for the study team). Do not guess.

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
Anything else you notice goes under `## Observed, not changed`.

## 4. Verify — evidence, not claims
End your turn: the Stop hook runs the
whole gate (integrity, unit, build, lint, knip, audit delta, all cycles' acceptance tests, requirements). On failure
it continues the turn with the failing step; fix the root cause and end the turn again. At the cap the hook asks for
`## Blocked` — then stop changing code.

## 5. Review
When the gate has passed, run the `ac-reviewer` subagent with: problem ID, `git diff <base>..` (base in
`.planning/useavibe/ACTIVE`), the .feature, the PLAN section and the test file. Its findings go back to step 3
(the next gate run is a new attempt). Log its verdict with `node scripts/useavibe/activate.mjs --review pass|findings`.

## 6. Record
Commit (handoff §9 types/scopes), body ends with `Verified: …`, trailers:
`Usability-Problem: $ARGUMENTS` · `Acceptance: acceptance/Z<k>/$ARGUMENTS.feature@<first 8 of its SHA-256>` ·
`Attempts: <gate attempts>` · `Reviewer: pass|findings` (· `Round-Finding: Z<k>-R<r>-F<m>` in follow-ups) ·
Co-Authored-By as in the session's system reminder. Then `node scripts/useavibe/activate.mjs --clear`.

## 7. Report (≤ 15 lines)
Scenarios met / not met · attempts · earlier scenarios, registry requirements, EMDREQ touched · not done ·
what the human must check visually (screen, synthetic case) · `## Observed, not changed`.
