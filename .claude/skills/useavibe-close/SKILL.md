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
3. Remind the operator: the accepted digest is the test object of Z<k+1> (`/useavibe-cycle-open`), FB-I is entered
   from the transcription sheet, then `useavibe fbi-crosscheck`.
