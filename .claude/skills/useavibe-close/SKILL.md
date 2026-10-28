---
name: useavibe-close
description: Close UseAVibe cycle Z<k> after a team acceptance round without findings — changelog from trailers, PL12 candidates, implementation record for the FB-I sheet, registry promotion proposal, accepted version and digest recorded for the next cycle.
disable-model-invocation: true
argument-hint: <cycle number k>
---
Close cycle Z$ARGUMENTS.

1. `useavibe close --app . --cycle $ARGUMENTS --workspace <path given by the operator>` — refuses unless the last
   round of the cycle ended without findings. It writes `.planning/useavibe/Z$ARGUMENTS/CHANGELOG.md` (problem →
   commits → files → attempts → reviewer verdict → acceptance rounds), the PL12 candidates (earlier-cycle scenarios
   that failed in any round — the team confirms), the accepted version and digest (ZA07) in `cycle.json`, and the
   private implementation record (PL07, PL09 with auxiliary counts, PL10 proposal, diffstat) into the workspace for
   `useavibe fbi-sheet`. Report its summary.
2. Propose the promotion of the cycle's passed scenarios into the requirements registry following `/uat-triage` §5
   (one UIR entry per scenario, mapped to the Playwright test). Write the proposal; the owner/study lead approves it.
3. Defect phase (O-32): if the cycle has class-D defects (`findings/defects.md`) or AT defect fixes, the next user
   test must wait. The test lead enters each defect as `acceptance/AT/AT-M-<nnn>.feature` (header `Source:` = the
   round defect ID, `Cause:` per O-38) or defers it (`useavibe defect-defer --defect … --reason … --by …`); each is
   fixed in a fresh `/useavibe-defect AT-M-<nnn>` session; then `/useavibe-release` (a patch release), a defect round
   (`/useavibe-accept`; the checklist lists the defect fixes and regression checks) until a round is clean, and
   `useavibe defect-close --app . --cycle $ARGUMENTS --workspace <path>`.
4. Remind the operator: the test object of Z<k+1> (`/useavibe-cycle-open`) is the release of the last clean defect
   round, or the accepted digest when there was no defect phase; `cycle-open` refuses anything else. Promote exactly
   that version to `:latest` (release channel, O-37; `close`/`defect-close` print the command:
   `gh workflow run container.yml -f promote_version=<v> -f promote_digest=<sha256>`; the workflow verifies the
   digest before and after, no rebuild). The study and acceptance units stay pinned by digest (C-24). FB-I is entered
   from the transcription sheet, then `useavibe fbi-crosscheck`. Readable CSV exports of all endpoint figures are in
   the workspace `study/Z<k>/export/` (problems, rounds, findings, defects, cycle).
